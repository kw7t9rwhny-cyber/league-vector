"use strict";

const Stage1 = require("./development-orchestrator-v01.js");
const Stage2 = require("./development-orchestrator-v02.js");
const Stage3A = require("./development-orchestrator-v03a.js");

const EXECUTOR_VERSION = "lv-development-orchestrator-stage3b-v0.1";
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

function desiredLabelsFromPlan(plan, rawPr) {
  const current = new Set(orchestratorLabels(rawPr));
  for (const mutation of plan.mutations || []) {
    if (mutation.operation === "REMOVE_LABEL") current.delete(mutation.label);
    if (mutation.operation === "ADD_LABEL") current.add(mutation.label);
  }
  return [...current].sort();
}

function qaState(item) {
  if (item.qa_conflicted_current) return "conflicted";
  if (item.qa_failed_current) return "fail";
  if (item.qa_fresh) return "pass-fresh";
  if (item.qa_stale) return "stale";
  return "none";
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
    qa_state: qaState(currentItem),
    qa_tested_sha: currentItem.qa_tested_sha || null,
    plan_fingerprint: plan.provenance && plan.provenance.fingerprint || null
  };
}

function executionGate(env = process.env) {
  const requested = env.LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE === "1";
  const activated = env.LEAGUE_VECTOR_STAGE3B_ACTIVATED === "1";
  const manualMain = env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.GITHUB_REF_NAME === "main";
  const nonFork = env.GITHUB_HEAD_REPO_FORK !== "true";
  return {
    requested,
    activated,
    manual_default_branch: manualMain,
    non_fork: nonFork,
    allowed: requested && activated && manualMain && nonFork,
    reason: !requested ? "execute_not_requested" : !activated ? "stage3b_not_activated" : !manualMain ? "not_default_branch_manual_dispatch" : !nonFork ? "fork_execution_forbidden" : "allowed"
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
    rollback_attempted: [],
    rollback_completed: [],
    post_write_verification: "not-run",
    aborted_reason: null
  };
}

function protectedStateReasons(plan, replanned, rawPr, item, liveData) {
  const reasons = [];
  if (!rawPr || !item) return ["live_item_missing"];
  if (rawPr.state !== "open" || item.open !== true) reasons.push("pr_not_open");
  if (rawPr.head_sha !== plan.evaluated_head_sha) reasons.push("head_sha_changed");
  if (!replanned || !replanned.provenance || replanned.provenance.fingerprint !== plan.provenance.fingerprint) reasons.push("replay_fingerprint_changed");
  if ((plan.qa_tested_sha || null) !== (item.qa_tested_sha || null)) reasons.push("qa_tested_sha_changed");
  if ((plan.qa_state || "none") !== qaState(item)) reasons.push("qa_state_changed");
  if ((plan.provenance.main_sha || null) !== (liveData.main_sha || null)) reasons.push("main_sha_changed");
  const expectedLabels = (plan.provenance.labels || []).filter((x) => x.startsWith("status:") || x.startsWith("owner:")).sort();
  if (stableJson(expectedLabels) !== stableJson(orchestratorLabels(rawPr))) reasons.push("orchestrator_labels_changed");
  return reasons;
}

async function rollbackCompleted({ adapter, repository, pr, completed, audit }) {
  for (const mutation of [...completed].reverse()) {
    const inverse = mutation.operation === "ADD_LABEL" ? { operation: "REMOVE_LABEL", label: mutation.label } : { operation: "ADD_LABEL", label: mutation.label };
    audit.rollback_attempted.push(mutationKey(inverse));
    try {
      if (inverse.operation === "ADD_LABEL") await adapter.addLabel(repository, pr, inverse.label);
      else await adapter.removeLabel(repository, pr, inverse.label);
      audit.rollback_completed.push(mutationKey(inverse));
    } catch (error) {
      audit.aborted_reason = `${audit.aborted_reason || "transaction_failed"};rollback_failed:${mutationKey(inverse)}:${error && error.message || "unknown"}`;
      return;
    }
  }
}

async function executePlan({ plan, repository, adapter, mode = "dry-run", env = process.env }) {
  const audit = auditBase(plan, mode);
  if (!plan || !plan.provenance || !plan.provenance.fingerprint) { audit.aborted_reason = "invalid_plan_provenance"; return audit; }
  const allowlistErrors = validateMutationAllowlist(plan);
  if (allowlistErrors.length) { audit.aborted_reason = allowlistErrors.join(","); return audit; }
  if (!adapter || typeof adapter.readRepository !== "function") { audit.aborted_reason = "missing_read_adapter"; return audit; }

  const liveData = await adapter.readRepository(repository);
  const queues = Stage2.deriveQueues(liveData.prs || []);
  const byId = Object.fromEntries(queues.items.map((x) => [x.id, x]));
  const rawById = Object.fromEntries((liveData.prs || []).map((x) => [Number(x.number), x]));
  const item = byId[plan.pr];
  const rawPr = rawById[plan.pr];
  if (!item || !rawPr) { audit.aborted_reason = "live_item_missing"; return audit; }

  const replanned = Stage3A.planItem(item, rawPr, byId, liveData.main_sha || null);
  audit.expected_before_state = buildExpectedBefore(plan, rawPr, item, liveData);
  audit.desired_after_state = { orchestrator_labels: desiredLabelsFromPlan(plan, rawPr) };

  const protectedChanges = protectedStateReasons(plan, replanned, rawPr, item, liveData);
  if (protectedChanges.length) { audit.aborted_reason = protectedChanges.join(","); return audit; }
  if (replanned.disposition !== plan.disposition || stableJson(replanned.mutations || []) !== stableJson(plan.mutations || [])) {
    audit.aborted_reason = "plan_no_longer_matches_live_recommendation";
    return audit;
  }

  if (!plan.mutations || plan.mutations.length === 0) {
    audit.post_write_verification = "no-op-success";
    return audit;
  }
  if (mode !== "execute") {
    audit.post_write_verification = "dry-run-no-write";
    return audit;
  }

  const gate = executionGate(env);
  if (!gate.allowed) { audit.aborted_reason = `execution_gate:${gate.reason}`; return audit; }
  if (typeof adapter.addLabel !== "function" || typeof adapter.removeLabel !== "function") { audit.aborted_reason = "missing_write_adapter"; return audit; }

  const completed = [];
  for (const mutation of plan.mutations) {
    const current = await adapter.readRepository(repository);
    const q = Stage2.deriveQueues(current.prs || []);
    const ids = Object.fromEntries(q.items.map((x) => [x.id, x]));
    const raws = Object.fromEntries((current.prs || []).map((x) => [Number(x.number), x]));
    const liveItem = ids[plan.pr];
    const liveRaw = raws[plan.pr];
    if (!liveItem || !liveRaw || liveRaw.state !== "open" || liveRaw.head_sha !== plan.evaluated_head_sha) {
      audit.aborted_reason = "prewrite_live_state_changed";
      await rollbackCompleted({ adapter, repository, pr: plan.pr, completed, audit });
      break;
    }

    const expectedLabels = new Set((plan.provenance.labels || []).filter((x) => x.startsWith("status:") || x.startsWith("owner:")));
    for (const done of completed) {
      if (done.operation === "REMOVE_LABEL") expectedLabels.delete(done.label);
      if (done.operation === "ADD_LABEL") expectedLabels.add(done.label);
    }
    if (stableJson(orchestratorLabels(liveRaw)) !== stableJson([...expectedLabels].sort())) {
      audit.aborted_reason = "prewrite_labels_changed";
      await rollbackCompleted({ adapter, repository, pr: plan.pr, completed, audit });
      break;
    }

    // Re-plan on every write boundary. The original plan fingerprint will differ only because
    // this same transaction may already have completed earlier allowlisted mutations; therefore
    // authority-sensitive fields are checked through Stage 2 item state and exact head, while
    // label drift is compared against the transaction's expected intermediate state above.
    if (qaState(liveItem) !== plan.qa_state || (liveItem.qa_tested_sha || null) !== (plan.qa_tested_sha || null)) {
      audit.aborted_reason = "prewrite_qa_state_changed";
      await rollbackCompleted({ adapter, repository, pr: plan.pr, completed, audit });
      break;
    }
    if ((liveItem.founder_decision || null) !== (item.founder_decision || null) || stableJson(liveItem.dependencies || []) !== stableJson(item.dependencies || [])) {
      audit.aborted_reason = "prewrite_authority_state_changed";
      await rollbackCompleted({ adapter, repository, pr: plan.pr, completed, audit });
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
      await rollbackCompleted({ adapter, repository, pr: plan.pr, completed, audit });
      break;
    }
  }

  const post = await adapter.readRepository(repository);
  const postRaw = (post.prs || []).find((x) => Number(x.number) === Number(plan.pr));
  const actual = postRaw ? orchestratorLabels(postRaw) : [];
  const desired = audit.desired_after_state.orchestrator_labels;
  if (!audit.aborted_reason && stableJson(actual) === stableJson(desired)) audit.post_write_verification = "verified";
  else if (audit.aborted_reason && stableJson(actual) === stableJson(audit.expected_before_state.orchestrator_labels)) audit.post_write_verification = "rolled-back-to-before-state";
  else if (audit.aborted_reason) audit.post_write_verification = "failed-or-partial";
  else { audit.aborted_reason = "post_write_verification_failed"; audit.post_write_verification = "failed"; }
  return audit;
}

class GitHubReadOnlyAdapter {
  constructor(token) { this.token = token; }
  async readRepository(repository) { return Stage2.loadLiveRepository(repository, this.token); }
}

module.exports = { EXECUTOR_VERSION, CANONICAL_LABEL_ALLOWLIST, validateMutationAllowlist, desiredLabelsFromPlan, executionGate, executePlan, GitHubReadOnlyAdapter, stableJson };

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
