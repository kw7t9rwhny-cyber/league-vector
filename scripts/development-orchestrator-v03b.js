"use strict";

const Stage1 = require("./development-orchestrator-v01.js");
const Stage2 = require("./development-orchestrator-v02.js");
const Stage3A = require("./development-orchestrator-v03a.js");

const EXECUTOR_VERSION = "lv-development-orchestrator-stage3b-v0.2";
const CANONICAL_STATUS_LABELS = new Set(Stage1.CONFIG.states.map((state) => `status:${state}`));
const CANONICAL_OWNER_LABELS = new Set(Stage1.CONFIG.owners.map((owner) => `owner:${owner}`));
const CANONICAL_LABEL_ALLOWLIST = new Set([...CANONICAL_STATUS_LABELS, ...CANONICAL_OWNER_LABELS]);
const MUTATION_OPS = new Set(["ADD_LABEL", "REMOVE_LABEL"]);

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
  return value;
}
function stableJson(value) { return JSON.stringify(stableObject(value)); }
function clone(value) { return structuredClone(value); }
function labelNames(rawPr) { return (rawPr.labels || []).map((x) => typeof x === "string" ? x : x.name).filter(Boolean).sort(); }
function orchestratorLabels(rawPr) { return labelNames(rawPr).filter((name) => name.startsWith("status:") || name.startsWith("owner:")).sort(); }
function mutationKey(mutation) { return `${mutation.operation}:${mutation.label}`; }

function validateMutationAllowlist(plan) {
  const errors = [];
  for (const mutation of plan && plan.mutations || []) {
    if (!MUTATION_OPS.has(mutation.operation)) errors.push(`unsupported_operation:${mutation.operation}`);
    if (!CANONICAL_LABEL_ALLOWLIST.has(mutation.label)) errors.push(`noncanonical_label:${mutation.label}`);
  }
  return errors;
}

function applyMutationToRaw(rawPr, mutation) {
  const labels = new Set(labelNames(rawPr));
  if (mutation.operation === "REMOVE_LABEL") labels.delete(mutation.label);
  if (mutation.operation === "ADD_LABEL") labels.add(mutation.label);
  rawPr.labels = [...labels].sort();
}
function dataAfterMutations(baseData, pr, mutations) {
  const out = clone(baseData);
  const raw = (out.prs || []).find((x) => Number(x.number) === Number(pr));
  if (!raw) return out;
  for (const mutation of mutations) applyMutationToRaw(raw, mutation);
  return out;
}
function desiredLabelsFromPlan(plan, rawPr) {
  const current = clone(rawPr);
  for (const mutation of plan.mutations || []) applyMutationToRaw(current, mutation);
  return orchestratorLabels(current);
}

function qaState(item) {
  if (item.qa_conflicted_current) return "conflicted";
  if (item.qa_failed_current) return "fail";
  if (item.qa_fresh) return "pass-fresh";
  if (item.qa_stale) return "stale";
  return "none";
}

function deriveLivePlan(liveData, pr) {
  const queues = Stage2.deriveQueues(liveData.prs || []);
  const byId = Object.fromEntries(queues.items.map((x) => [x.id, x]));
  const rawById = Object.fromEntries((liveData.prs || []).map((x) => [Number(x.number), x]));
  const item = byId[pr];
  const rawPr = rawById[pr];
  const plan = item && rawPr ? Stage3A.planItem(item, rawPr, byId, liveData.main_sha || null) : null;
  return { queues, byId, rawById, item, rawPr, plan };
}

function buildExpectedBefore(plan, rawPr, currentItem, liveData) {
  return {
    main_sha: liveData.main_sha || null,
    pr: Number(rawPr.number),
    head_sha: rawPr.head_sha || null,
    orchestrator_labels: orchestratorLabels(rawPr),
    owner: currentItem.owner || null,
    status: currentItem.status || null,
    type: currentItem.type || null,
    risk: currentItem.risk || null,
    priority: currentItem.priority || null,
    integration_required: currentItem.integration_required,
    promotion_type: currentItem.promotion_type || null,
    promotion_authorized: currentItem.promotion_authorized,
    founder_decision_required: currentItem.founder_decision_required,
    founder_gate: currentItem.founder_gate || null,
    founder_decision: currentItem.founder_decision || null,
    dependencies: currentItem.dependencies || [],
    dependency_snapshot: plan && plan.provenance && plan.provenance.dependencies || [],
    qa_state: qaState(currentItem),
    qa_tested_sha: currentItem.qa_tested_sha || null,
    plan_fingerprint: plan && plan.provenance && plan.provenance.fingerprint || null
  };
}

function executionGate(env = process.env) {
  const requested = env.LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE === "1";
  const activated = env.LEAGUE_VECTOR_STAGE3B_ACTIVATED === "1";
  const defaultBranch = String(env.GITHUB_DEFAULT_BRANCH || "").trim();
  const event = env.GITHUB_EVENT_NAME || "";
  const ref = env.GITHUB_REF || "";
  const refType = env.GITHUB_REF_TYPE || "";
  const refName = env.GITHUB_REF_NAME || "";
  const exactDefaultBranch = Boolean(defaultBranch) && event === "workflow_dispatch" && ref === `refs/heads/${defaultBranch}` && refType === "branch" && refName === defaultBranch;
  const nonFork = env.GITHUB_HEAD_REPO_FORK !== "true";
  return {
    requested,
    activated,
    default_branch: defaultBranch || null,
    exact_default_branch_ref: exactDefaultBranch,
    non_fork: nonFork,
    allowed: requested && activated && exactDefaultBranch && nonFork,
    reason: !requested ? "execute_not_requested" : !activated ? "stage3b_not_activated" : !defaultBranch ? "default_branch_provenance_missing" : !exactDefaultBranch ? "not_exact_default_branch_manual_dispatch" : !nonFork ? "fork_execution_forbidden" : "allowed"
  };
}

function auditBase(plan, mode) {
  return {
    executor_version: EXECUTOR_VERSION,
    mode,
    pr: plan && plan.pr || null,
    evaluated_head_sha: plan && plan.evaluated_head_sha || null,
    replay_fingerprint: plan && plan.provenance && plan.provenance.fingerprint || null,
    expected_before_state: null,
    desired_after_state: null,
    mutations_attempted: [],
    mutations_completed: [],
    prewrite_revalidations: [],
    rollback_attempted: [],
    rollback_completed: [],
    rollback_revalidations: [],
    manual_review_required: false,
    post_write_verification: "not-run",
    aborted_reason: null
  };
}

function compareExpectedPlan(expected, fresh, expectedRemaining) {
  const reasons = [];
  if (!expected.item || !expected.rawPr || !expected.plan || !fresh.item || !fresh.rawPr || !fresh.plan) return ["live_item_missing"];
  if (fresh.rawPr.state !== "open" || fresh.item.open !== true) reasons.push("pr_not_open");
  if (fresh.rawPr.head_sha !== expected.rawPr.head_sha) reasons.push("head_sha_changed");
  if ((fresh.plan.provenance && fresh.plan.provenance.fingerprint || null) !== (expected.plan.provenance && expected.plan.provenance.fingerprint || null)) reasons.push("replay_fingerprint_changed");
  if (fresh.plan.disposition !== expected.plan.disposition) reasons.push("fresh_disposition_changed");
  if (stableJson(fresh.plan.mutations || []) !== stableJson(expected.plan.mutations || [])) reasons.push("fresh_mutation_set_changed");
  if (stableJson(fresh.plan.mutations || []) !== stableJson(expectedRemaining || [])) reasons.push("remaining_mutation_set_changed");
  if ((fresh.plan.qa_tested_sha || null) !== (expected.plan.qa_tested_sha || null)) reasons.push("qa_tested_sha_changed");
  if ((fresh.plan.qa_state || "none") !== (expected.plan.qa_state || "none")) reasons.push("qa_state_changed");
  return reasons;
}

function rollbackProtectedSnapshot(derived, liveData) {
  if (!derived.item || !derived.rawPr || !derived.plan) return null;
  const p = derived.plan.provenance || {};
  return {
    main_sha: liveData.main_sha || null,
    pr_open: derived.rawPr.state === "open" && derived.item.open === true,
    head_sha: derived.rawPr.head_sha || null,
    orchestrator_labels: orchestratorLabels(derived.rawPr),
    owner: derived.item.owner || null,
    status: derived.item.status || null,
    type: derived.item.type || null,
    risk: derived.item.risk || null,
    priority: derived.item.priority || null,
    integration_required: derived.item.integration_required,
    promotion_type: derived.item.promotion_type || null,
    promotion_authorized: derived.item.promotion_authorized,
    founder_decision_required: derived.item.founder_decision_required,
    founder_gate: derived.item.founder_gate || null,
    founder_decision: derived.item.founder_decision || null,
    metadata_conflicts: derived.item.metadata_conflicts || [],
    metadata_body_occurrences: derived.item.metadata_body_occurrences || {},
    qa_state: qaState(derived.item),
    qa_tested_sha: derived.item.qa_tested_sha || null,
    qa_event_provenance: p.qa && p.qa.event_provenance || [],
    dependencies: p.dependencies || []
  };
}

async function rollbackCompleted({ adapter, repository, pr, completed, baseData, audit }) {
  const active = [...completed];
  for (let index = active.length - 1; index >= 0; index--) {
    const mutation = active[index];
    const inverse = mutation.operation === "ADD_LABEL" ? { operation: "REMOVE_LABEL", label: mutation.label } : { operation: "ADD_LABEL", label: mutation.label };
    audit.rollback_attempted.push(mutationKey(inverse));

    const live = await adapter.readRepository(repository);
    const expectedData = dataAfterMutations(baseData, pr, active);
    const fresh = deriveLivePlan(live, pr);
    const expected = deriveLivePlan(expectedData, pr);
    const freshProtected = rollbackProtectedSnapshot(fresh, live);
    const expectedProtected = rollbackProtectedSnapshot(expected, expectedData);
    const safe = freshProtected && expectedProtected && stableJson(freshProtected) === stableJson(expectedProtected);
    audit.rollback_revalidations.push({ mutation: mutationKey(inverse), safe: Boolean(safe) });
    if (!safe) {
      audit.manual_review_required = true;
      audit.aborted_reason = `${audit.aborted_reason || "transaction_failed"};rollback_unsafe:${mutationKey(inverse)}`;
      return;
    }

    const labels = new Set(orchestratorLabels(fresh.rawPr));
    const ownedEffectPresent = mutation.operation === "ADD_LABEL" ? labels.has(mutation.label) : !labels.has(mutation.label);
    if (!ownedEffectPresent) {
      audit.manual_review_required = true;
      audit.aborted_reason = `${audit.aborted_reason || "transaction_failed"};rollback_effect_not_owned:${mutationKey(inverse)}`;
      return;
    }

    try {
      if (inverse.operation === "ADD_LABEL") await adapter.addLabel(repository, pr, inverse.label);
      else await adapter.removeLabel(repository, pr, inverse.label);
    } catch (error) {
      audit.manual_review_required = true;
      audit.aborted_reason = `${audit.aborted_reason || "transaction_failed"};rollback_failed:${mutationKey(inverse)}:${error && error.message || "unknown"}`;
      return;
    }

    const post = await adapter.readRepository(repository);
    const expectedAfter = dataAfterMutations(baseData, pr, active.slice(0, index));
    const postDerived = deriveLivePlan(post, pr);
    const expectedAfterDerived = deriveLivePlan(expectedAfter, pr);
    const postProtected = rollbackProtectedSnapshot(postDerived, post);
    const expectedAfterProtected = rollbackProtectedSnapshot(expectedAfterDerived, expectedAfter);
    if (!postProtected || !expectedAfterProtected || stableJson(postProtected) !== stableJson(expectedAfterProtected)) {
      audit.manual_review_required = true;
      audit.aborted_reason = `${audit.aborted_reason || "transaction_failed"};rollback_poststate_unverified:${mutationKey(inverse)}`;
      return;
    }
    audit.rollback_completed.push(mutationKey(inverse));
    active.splice(index, 1);
  }
}

async function executePlan({ plan, repository, adapter, mode = "dry-run", env = process.env }) {
  const audit = auditBase(plan, mode);
  if (!plan || !plan.provenance || !plan.provenance.fingerprint) { audit.aborted_reason = "invalid_plan_provenance"; return audit; }
  const allowlistErrors = validateMutationAllowlist(plan);
  if (allowlistErrors.length) { audit.aborted_reason = allowlistErrors.join(","); return audit; }
  if (!adapter || typeof adapter.readRepository !== "function") { audit.aborted_reason = "missing_read_adapter"; return audit; }

  const initialData = await adapter.readRepository(repository);
  const initial = deriveLivePlan(initialData, plan.pr);
  if (!initial.item || !initial.rawPr || !initial.plan) { audit.aborted_reason = "live_item_missing"; return audit; }
  audit.expected_before_state = buildExpectedBefore(initial.plan, initial.rawPr, initial.item, initialData);
  audit.desired_after_state = { orchestrator_labels: desiredLabelsFromPlan(plan, initial.rawPr) };

  if ((initial.plan.provenance && initial.plan.provenance.fingerprint || null) !== plan.provenance.fingerprint) { audit.aborted_reason = "replay_fingerprint_changed"; return audit; }
  if (initial.plan.disposition !== plan.disposition || stableJson(initial.plan.mutations || []) !== stableJson(plan.mutations || [])) { audit.aborted_reason = "plan_no_longer_matches_live_recommendation"; return audit; }
  if (initial.rawPr.state !== "open" || initial.item.open !== true || initial.rawPr.head_sha !== plan.evaluated_head_sha) { audit.aborted_reason = "initial_live_state_changed"; return audit; }

  if (!plan.mutations || plan.mutations.length === 0) { audit.post_write_verification = "no-op-success"; return audit; }
  if (mode !== "execute") { audit.post_write_verification = "dry-run-no-write"; return audit; }

  const gate = executionGate(env);
  if (!gate.allowed) { audit.aborted_reason = `execution_gate:${gate.reason}`; return audit; }
  if (typeof adapter.addLabel !== "function" || typeof adapter.removeLabel !== "function") { audit.aborted_reason = "missing_write_adapter"; return audit; }

  const completed = [];
  for (let index = 0; index < plan.mutations.length; index++) {
    const mutation = plan.mutations[index];
    const current = await adapter.readRepository(repository);
    const expectedData = dataAfterMutations(initialData, plan.pr, completed);
    const fresh = deriveLivePlan(current, plan.pr);
    const expected = deriveLivePlan(expectedData, plan.pr);
    const expectedRemaining = plan.mutations.slice(index);
    const reasons = compareExpectedPlan(expected, fresh, expectedRemaining);
    audit.prewrite_revalidations.push({ mutation: mutationKey(mutation), passed: reasons.length === 0, reasons });
    if (reasons.length) {
      audit.aborted_reason = `prewrite_full_revalidation_failed:${reasons.join("|")}`;
      await rollbackCompleted({ adapter, repository, pr: plan.pr, completed, baseData: initialData, audit });
      break;
    }

    audit.mutations_attempted.push(mutationKey(mutation));
    try {
      if (mutation.operation === "ADD_LABEL") await adapter.addLabel(repository, plan.pr, mutation.label);
      else await adapter.removeLabel(repository, plan.pr, mutation.label);
      completed.push(mutation);
      audit.mutations_completed.push(mutationKey(mutation));
    } catch (error) {
      audit.aborted_reason = `write_failed:${mutationKey(mutation)}:${error && error.message || "unknown"}`;
      audit.manual_review_required = true;
      await rollbackCompleted({ adapter, repository, pr: plan.pr, completed, baseData: initialData, audit });
      break;
    }
  }

  const post = await adapter.readRepository(repository);
  const postRaw = (post.prs || []).find((x) => Number(x.number) === Number(plan.pr));
  const actual = postRaw ? orchestratorLabels(postRaw) : [];
  const desired = audit.desired_after_state.orchestrator_labels;
  if (!audit.aborted_reason && stableJson(actual) === stableJson(desired)) audit.post_write_verification = "verified";
  else if (audit.aborted_reason && stableJson(actual) === stableJson(audit.expected_before_state.orchestrator_labels) && !audit.manual_review_required) audit.post_write_verification = "rolled-back-to-before-state";
  else if (audit.aborted_reason) { audit.post_write_verification = "failed-or-partial"; audit.manual_review_required = true; }
  else { audit.aborted_reason = "post_write_verification_failed"; audit.post_write_verification = "failed"; audit.manual_review_required = true; }
  return audit;
}

class GitHubReadOnlyAdapter {
  constructor(token) { this.token = token; }
  async readRepository(repository) { return Stage2.loadLiveRepository(repository, this.token); }
}

module.exports = { EXECUTOR_VERSION, CANONICAL_LABEL_ALLOWLIST, validateMutationAllowlist, desiredLabelsFromPlan, deriveLivePlan, dataAfterMutations, executionGate, executePlan, GitHubReadOnlyAdapter, stableJson };

if (require.main === module) {
  (async () => {
    const fs = require("fs");
    const args = process.argv.slice(2);
    const json = args.includes("--json");
    const mode = args.includes("--execute") ? "execute" : "dry-run";
    const planPathIndex = args.indexOf("--plan");
    if (planPathIndex < 0 || !args[planPathIndex + 1]) throw new Error("--plan <json-file> required");
    const plan = JSON.parse(fs.readFileSync(args[planPathIndex + 1], "utf8"));
    const repository = process.env.GITHUB_REPOSITORY || process.env.LEAGUE_VECTOR_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;
    if (!repository || !token) throw new Error("live_mode_requires_GITHUB_REPOSITORY_and_GITHUB_TOKEN");
    const audit = await executePlan({ plan, repository, adapter: new GitHubReadOnlyAdapter(token), mode, env: process.env });
    process.stdout.write(`${json ? JSON.stringify(audit, null, 2) : `${audit.executor_version} ${audit.mode} PR #${audit.pr} ${audit.aborted_reason ? `ABORT ${audit.aborted_reason}` : audit.post_write_verification}`}\n`);
    if (mode === "execute" && !["verified", "no-op-success"].includes(audit.post_write_verification)) process.exitCode = 2;
  })().catch((error) => { process.stderr.write(`${error.message}\n`); process.exit(2); });
}
