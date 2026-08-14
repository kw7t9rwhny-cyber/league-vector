"use strict";

const Stage2 = require("./development-orchestrator-v02.js");
const Stage3A = require("./development-orchestrator-v03a.js");
const Stage3B = require("./development-orchestrator-v03b.js");

const CONTROLLED_VERSION = "lv-development-orchestrator-stage3b-controlled-v0.1";
const FOUNDER_ENV = "LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED";

function parseTargetPr(value) {
  const raw = String(value === undefined || value === null ? "" : value).trim();
  if (!/^[1-9][0-9]*$/.test(raw)) throw new Error("invalid_target_pr_number");
  const number = Number(raw);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error("invalid_target_pr_number");
  return number;
}

function founderActivationGate(env = process.env) {
  const raw = env[FOUNDER_ENV];
  if (raw !== "1") return { allowed:false, reason:raw === undefined || raw === "" ? "founder_activation_missing" : "founder_activation_not_approved" };
  return { allowed:true, reason:"founder_activation_approved" };
}

function canonicalMutationsOnly(plan) {
  const errors = Stage3B.validateMutationAllowlist(plan);
  if (errors.length) return { valid:false, errors };
  for (const mutation of plan.mutations || []) {
    if (!(mutation.label.startsWith("status:") || mutation.label.startsWith("owner:"))) {
      return { valid:false, errors:[`non_orchestrator_label:${mutation.label}`] };
    }
  }
  return { valid:true, errors:[] };
}

function planForTarget(data, targetPr) {
  const queues = Stage2.deriveQueues(data.prs || []);
  const item = queues.items.find((x) => Number(x.id) === Number(targetPr));
  const rawPr = (data.prs || []).find((x) => Number(x.number) === Number(targetPr));
  if (!item || !rawPr) throw new Error("target_pr_not_found");
  const byId = Object.fromEntries(queues.items.map((x) => [x.id, x]));
  return { queues, item, rawPr, plan:Stage3A.planItem(item, rawPr, byId, data.main_sha || null) };
}

function previewFrom(data, targetPr) {
  const { item, rawPr, plan } = planForTarget(data, targetPr);
  const labels = (rawPr.labels || []).map((x) => typeof x === "string" ? x : x.name).filter(Boolean).sort();
  const proposedAdd = (plan.mutations || []).filter((x) => x.operation === "ADD_LABEL").map((x) => x.label);
  const proposedRemove = (plan.mutations || []).filter((x) => x.operation === "REMOVE_LABEL").map((x) => x.label);
  const p = plan.provenance || {};
  return {
    schema:"lv-stage3b-controlled-preview-v0.1",
    version:CONTROLLED_VERSION,
    authorization:false,
    target_pr:Number(targetPr),
    current_head:rawPr.head_sha || null,
    stage2_state:{
      status:item.status || null,
      owner:item.owner || null,
      type:item.type || null,
      risk:item.risk || null,
      priority:item.priority || null,
      recommended_action:item.recommended_action || null,
      structured:Boolean(item.structured)
    },
    stage3a_disposition:plan.disposition,
    stage3a_reason:plan.reason,
    current_labels:labels,
    proposed_labels:{ add:proposedAdd, remove:proposedRemove },
    exact_mutations:plan.mutations || [],
    qa:{ state:plan.qa_state || "none", tested_sha:plan.qa_tested_sha || null },
    founder:{
      required:item.founder_decision_required,
      gate:item.founder_gate || null,
      decision:item.founder_decision || null
    },
    dependencies:p.dependencies || [],
    current_main:p.main_sha || data.main_sha || null,
    replay_fingerprint:p.fingerprint || null
  };
}

async function githubJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers:{
      Accept:"application/vnd.github+json",
      Authorization:`Bearer ${token}`,
      "X-GitHub-Api-Version":"2022-11-28",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`github_http_${response.status}:${options.operation || "request"}`);
  if (response.status === 204) return null;
  return response.json();
}

class GitHubControlledLabelAdapter extends Stage3B.GitHubReadOnlyAdapter {
  constructor(token) { super(token); }
  async addLabel(repository, pr, label) {
    if (!Stage3B.CANONICAL_LABEL_ALLOWLIST.has(label)) throw new Error(`noncanonical_label:${label}`);
    await githubJson(`https://api.github.com/repos/${repository}/issues/${Number(pr)}/labels`, this.token, {
      method:"POST",
      operation:"add_label",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({labels:[label]})
    });
  }
  async removeLabel(repository, pr, label) {
    if (!Stage3B.CANONICAL_LABEL_ALLOWLIST.has(label)) throw new Error(`noncanonical_label:${label}`);
    await githubJson(`https://api.github.com/repos/${repository}/issues/${Number(pr)}/labels/${encodeURIComponent(label)}`, this.token, {
      method:"DELETE",
      operation:"remove_label"
    });
  }
}

async function buildLivePreview({ repository, token, targetPr }) {
  const number = parseTargetPr(targetPr);
  const data = await Stage2.loadLiveRepository(repository, token);
  return { data, preview:previewFrom(data, number), plan:planForTarget(data, number).plan };
}

async function executeControlled({ repository, token, targetPr, expectedFingerprint, env = process.env, adapter = null }) {
  const number = parseTargetPr(targetPr);
  const founder = founderActivationGate(env);
  const result = {
    schema:"lv-stage3b-controlled-audit-v0.1",
    workflow_run_id:env.GITHUB_RUN_ID || null,
    target_pr:number,
    founder_activation:founder,
    expected_preview_fingerprint:expectedFingerprint || null,
    trusted_repository_identity:null,
    trusted_default_branch:null,
    trusted_fork:null,
    stage3b_audit:null,
    abort_reason:null,
    manual_review_required:false
  };
  if (!founder.allowed) { result.abort_reason=`founder_gate:${founder.reason}`; return result; }
  if (!expectedFingerprint || !/^[0-9a-f]{64}$/.test(expectedFingerprint)) { result.abort_reason="missing_or_invalid_preview_fingerprint"; return result; }

  const writeAdapter = adapter || new GitHubControlledLabelAdapter(token);
  const trusted = await writeAdapter.readActivationProvenance(repository);
  result.trusted_repository_identity = trusted.repository_full_name || null;
  result.trusted_default_branch = trusted.default_branch || null;
  result.trusted_fork = trusted.fork;

  const live = await writeAdapter.readRepository(repository);
  const { plan } = planForTarget(live, number);
  if ((plan.provenance && plan.provenance.fingerprint) !== expectedFingerprint) {
    result.abort_reason="preview_state_changed";
    return result;
  }
  const mutationCheck = canonicalMutationsOnly(plan);
  if (!mutationCheck.valid) { result.abort_reason=`mutation_allowlist:${mutationCheck.errors.join("|")}`; return result; }
  if (!plan.mutations || plan.mutations.length === 0) { result.abort_reason="no_live_mutation_authorized"; return result; }

  const audit = await Stage3B.executePlan({ plan, repository, adapter:writeAdapter, mode:"execute", env });
  result.stage3b_audit = audit;
  result.abort_reason = audit.aborted_reason || null;
  result.manual_review_required = Boolean(audit.manual_review_required);
  return result;
}

module.exports = {
  CONTROLLED_VERSION,
  FOUNDER_ENV,
  parseTargetPr,
  founderActivationGate,
  canonicalMutationsOnly,
  planForTarget,
  previewFrom,
  buildLivePreview,
  executeControlled,
  GitHubControlledLabelAdapter
};

if (require.main === module) {
  (async () => {
    const fs = require("fs");
    const args = process.argv.slice(2);
    const command = args[0] || "preview";
    const targetIndex = args.indexOf("--target-pr");
    if (targetIndex < 0 || !args[targetIndex + 1]) throw new Error("--target-pr <positive-integer> required");
    const targetPr = parseTargetPr(args[targetIndex + 1]);
    const repository = process.env.GITHUB_REPOSITORY || process.env.LEAGUE_VECTOR_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;
    if (!repository || !token) throw new Error("GITHUB_REPOSITORY_and_GITHUB_TOKEN_required");

    if (command === "preview") {
      const { preview } = await buildLivePreview({ repository, token, targetPr });
      process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
      return;
    }
    if (command !== "execute") throw new Error(`unknown_command:${command}`);
    const fingerprintIndex = args.indexOf("--expected-fingerprint");
    const expectedFingerprint = fingerprintIndex >= 0 ? args[fingerprintIndex + 1] : null;
    const result = await executeControlled({ repository, token, targetPr, expectedFingerprint, env:process.env });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    const ok = result.stage3b_audit && ["verified", "no-op-success"].includes(result.stage3b_audit.post_write_verification) && !result.abort_reason;
    if (!ok) process.exitCode = 2;
  })().catch((error) => { process.stderr.write(`${error.message}\n`); process.exit(2); });
}
