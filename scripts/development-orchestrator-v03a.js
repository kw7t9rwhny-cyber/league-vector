"use strict";

const fs = require("fs");
const crypto = require("crypto");
const Stage1 = require("./development-orchestrator-v01.js");
const Stage2 = require("./development-orchestrator-v02.js");

const CANONICAL_STATUS_LABELS = new Set(Stage1.CONFIG.states.map((state) => `status:${state}`));
const CANONICAL_OWNER_LABELS = new Set(Stage1.CONFIG.owners.map((owner) => `owner:${owner}`));
const QA_LIKE = /^QA\s+(PASS|FAIL)\b/i;
const QA_CANONICAL = /^QA (PASS|FAIL) — tested head [0-9a-f]{40}$/;

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableObject(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

function labelNames(rawPr) {
  return (rawPr.labels || []).map((label) => typeof label === "string" ? label : label.name).filter(Boolean).sort();
}

function labelsWithPrefix(rawPr, prefix) {
  return labelNames(rawPr).filter((name) => name.startsWith(`${prefix}:`));
}

function malformedQaEvidence(rawPr) {
  const malformed = [];
  for (const event of rawPr.events || []) {
    for (const rawLine of String(event.body || "").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (QA_LIKE.test(line) && !QA_CANONICAL.test(line)) malformed.push(line);
    }
  }
  return [...new Set(malformed)].sort();
}

function qaState(item) {
  if (item.qa_conflicted_current) return "conflicted";
  if (item.qa_failed_current) return "fail";
  if (item.qa_fresh) return "pass-fresh";
  if (item.qa_stale) return "stale";
  return "none";
}

function dependencySnapshot(item, byId) {
  return (item.dependencies || []).map((id) => {
    const dep = byId[id];
    if (!dep) return { id, missing: true };
    return {
      id,
      status: dep.status || null,
      head_sha: dep.head_sha || null,
      qa_state: qaState(dep),
      qa_tested_sha: dep.qa_tested_sha || null,
      structured: Boolean(dep.structured)
    };
  });
}

function provenanceFor(item, rawPr, byId, mainSha) {
  const snapshot = {
    schema: "lv-stage3a-plan-provenance-v0.1",
    main_sha: mainSha || null,
    pr: item.id,
    head_sha: item.head_sha || null,
    declared_candidate_sha: item.declared_candidate_sha || null,
    labels: labelNames(rawPr),
    metadata: {
      owner: item.owner || null,
      risk: item.risk || null,
      status: item.status || null,
      type: item.type || null,
      priority: item.priority || null,
      integration_required: item.integration_required,
      promotion_type: item.promotion_type || null,
      promotion_authorized: item.promotion_authorized,
      founder_decision_required: item.founder_decision_required,
      founder_gate: item.founder_gate || null,
      founder_decision: item.founder_decision || null,
      dependencies: item.dependencies || []
    },
    qa: {
      state: qaState(item),
      tested_sha: item.qa_tested_sha || null,
      current_event: item.current_qa_verdict || null,
      latest_event: item.latest_qa_verdict || null
    },
    dependencies: dependencySnapshot(item, byId)
  };
  return { ...snapshot, fingerprint: sha256(snapshot) };
}

function statusMutations(rawPr, targetStatus) {
  const current = labelsWithPrefix(rawPr, "status");
  const target = `status:${targetStatus}`;
  if (!CANONICAL_STATUS_LABELS.has(target)) throw new Error(`unsupported_target_status:${targetStatus}`);
  const mutations = [];
  for (const label of current) {
    if (label !== target) mutations.push({ operation: "REMOVE_LABEL", label });
  }
  if (!current.includes(target)) mutations.push({ operation: "ADD_LABEL", label: target });
  return mutations;
}

function handoffPreview(item, proposedRoute, reason, mutations) {
  return [
    "ORCHESTRATOR HANDOFF PREVIEW — NO GITHUB MUTATION",
    `PR: #${item.id}`,
    `Exact head: ${item.head_sha}`,
    `Current owner: ${item.owner || "unknown"}`,
    `Proposed route: ${proposedRoute || "none"}`,
    `Reason: ${reason}`,
    `Risk: ${(item.risk || "unknown").toUpperCase()}`,
    `QA: ${qaState(item)}${item.qa_tested_sha ? ` (${item.qa_tested_sha})` : ""}`,
    `Proposed label changes: ${mutations.length ? mutations.map((m) => `${m.operation} ${m.label}`).join("; ") : "none"}`,
    "No GitHub mutation performed. This preview is not a QA verdict, Founder decision, merge, release, or model-promotion authorization."
  ].join("\n");
}

function noOpPlan(item, rawPr, byId, mainSha, reason, detail = null) {
  const provenance = provenanceFor(item, rawPr, byId, mainSha);
  return {
    pr: item.id,
    title: item.title,
    evaluated_head_sha: item.head_sha || null,
    qa_tested_sha: item.qa_tested_sha || null,
    qa_state: qaState(item),
    stage2_recommended_action: item.recommended_action || "NO_ACTION",
    disposition: "NO_MUTATION",
    reason,
    detail,
    proposed_route: null,
    mutations: [],
    handoff_preview: null,
    provenance
  };
}

function planItem(item, rawPr, byId, mainSha) {
  if (!item || !rawPr) throw new Error("missing_plan_item");

  if (!item.open) return noOpPlan(item, rawPr, byId, mainSha, "closed_or_merged_pr");
  if (!item.structured) return noOpPlan(item, rawPr, byId, mainSha, "legacy_or_incomplete_metadata", item.missing_metadata || []);

  const ownerLabels = labelsWithPrefix(rawPr, "owner");
  const statusLabels = labelsWithPrefix(rawPr, "status");
  if (ownerLabels.length > 1) return noOpPlan(item, rawPr, byId, mainSha, "ambiguous_owner_labels", ownerLabels);
  if (statusLabels.length > 1) return noOpPlan(item, rawPr, byId, mainSha, "ambiguous_status_labels", statusLabels);
  if (ownerLabels.some((label) => !CANONICAL_OWNER_LABELS.has(label))) return noOpPlan(item, rawPr, byId, mainSha, "unsupported_owner_label", ownerLabels);

  const malformed = malformedQaEvidence(rawPr);
  if (malformed.length) return noOpPlan(item, rawPr, byId, mainSha, "malformed_qa_like_evidence", malformed);
  if (item.declared_candidate_sha && item.declared_candidate_sha !== item.head_sha) return noOpPlan(item, rawPr, byId, mainSha, "candidate_head_moved");
  if (item.qa_conflicted_current) return noOpPlan(item, rawPr, byId, mainSha, "qa_evidence_conflicted");
  if (item.qa_stale) return noOpPlan(item, rawPr, byId, mainSha, "qa_evidence_stale");
  if (!item.dependencies_satisfied) return noOpPlan(item, rawPr, byId, mainSha, "blocked_dependency", item.blocked_dependencies || []);
  if (item.founder_decision === "rejected") return noOpPlan(item, rawPr, byId, mainSha, "founder_decision_rejected");

  let targetStatus = null;
  let route = null;
  let reason = item.recommended_action;

  switch (item.recommended_action) {
    case "SEND_TO_QA":
      targetStatus = "ready-for-qa";
      route = "qa";
      break;
    case "RETURN_TO_OWNER":
      targetStatus = "qa-failed";
      route = item.owner;
      break;
    case "READY_FOR_CORE_REVIEW":
      if (item.type === "research") return noOpPlan(item, rawPr, byId, mainSha, "raw_research_firewall");
      if (!item.qa_fresh || item.qa_tested_sha !== item.head_sha) return noOpPlan(item, rawPr, byId, mainSha, "core_requires_fresh_exact_sha_qa");
      targetStatus = "ready-for-core";
      route = "core";
      break;
    case "WAITING_ON_FOUNDER":
      if (item.founder_decision === "approved") return noOpPlan(item, rawPr, byId, mainSha, "founder_already_approved_requires_fresh_stage2_re_evaluation");
      targetStatus = "waiting-founder";
      route = "founder";
      break;
    case "BLOCKED_DEPENDENCY":
      return noOpPlan(item, rawPr, byId, mainSha, "blocked_dependency", item.blocked_dependencies || []);
    case "MORE_RESEARCH_REQUIRED":
      if (item.type !== "research") return noOpPlan(item, rawPr, byId, mainSha, "non_research_more_research_signal");
      return noOpPlan(item, rawPr, byId, mainSha, "research_remains_with_canonical_owner", item.owner);
    case "NO_ACTION":
    default:
      return noOpPlan(item, rawPr, byId, mainSha, "no_authorized_routine_handoff");
  }

  const mutations = statusMutations(rawPr, targetStatus);
  const provenance = provenanceFor(item, rawPr, byId, mainSha);
  return {
    pr: item.id,
    title: item.title,
    evaluated_head_sha: item.head_sha,
    qa_tested_sha: item.qa_tested_sha || null,
    qa_state: qaState(item),
    stage2_recommended_action: item.recommended_action,
    disposition: mutations.length ? "WOULD_MUTATE" : "WOULD_ROUTE_ONLY",
    reason,
    detail: null,
    proposed_route: route,
    mutations,
    handoff_preview: handoffPreview(item, route, reason, mutations),
    provenance
  };
}

function commandCenterPreview(data, queues, plans, generatedAt) {
  const compact = (item) => ({
    pr: item.id,
    title: item.title,
    owner: item.owner || null,
    risk: item.risk || null,
    status: item.status || null,
    head_sha: item.head_sha || null,
    qa_state: qaState(item),
    recommended_action: item.recommended_action
  });
  const blocked = queues.items.filter((item) => item.open && item.structured && !item.dependencies_satisfied).map(compact);
  const staleQa = queues.items.filter((item) => item.open && item.qa_stale).map(compact);
  const conflictedQa = queues.items.filter((item) => item.open && item.qa_conflicted_current).map(compact);
  return {
    schema: "lv-command-center-stage3a-preview-v0.1",
    operational: false,
    mutation_mode: "dry-run-read-only",
    generated_at: generatedAt,
    provenance: {
      main_sha: data.main_sha || null,
      stage2_source_head: "a60af97b1a52cf2ff9a980cd6220edf93c4cf827",
      stage2_merge_commit: "7405de62dd7be6c512138324cfbeaca88473262f",
      plan_fingerprints: plans.map((plan) => ({ pr: plan.pr, fingerprint: plan.provenance.fingerprint }))
    },
    qa_queue: queues.qa.map(compact),
    core_queue: queues.core.map(compact),
    remediation_queue: queues.remediation.map(compact),
    founder_queue: queues.founder.map(compact),
    research_queue: queues.research.map(compact),
    blocked,
    stale_qa: staleQa,
    conflicted_qa: conflictedQa,
    legacy_unstructured_count: queues.legacy.length
  };
}

function derivePlan(data) {
  const queues = Stage2.deriveQueues(data.prs || []);
  const byId = Object.fromEntries(queues.items.map((item) => [item.id, item]));
  const rawById = Object.fromEntries((data.prs || []).map((pr) => [Number(pr.number), pr]));
  const plans = queues.items
    .filter((item) => item.open && item.structured)
    .map((item) => planItem(item, rawById[item.id], byId, data.main_sha || null))
    .filter((plan) => plan.disposition !== "NO_MUTATION" || ["qa_evidence_stale", "qa_evidence_conflicted", "blocked_dependency", "founder_decision_rejected", "candidate_head_moved"].includes(plan.reason));
  const generatedAt = data.generated_at || process.env.ORCHESTRATOR_GENERATED_AT || new Date().toISOString();
  return {
    schema: "lv-development-orchestrator-stage3a-plan-v0.1",
    source: "stage2-live-github-plus-stage3a-read-only-planner",
    mutation_mode: "dry-run-read-only",
    main_sha: data.main_sha || null,
    generated_at: generatedAt,
    plans,
    command_center_preview: commandCenterPreview(data, queues, plans, generatedAt),
    counts: {
      would_mutate: plans.filter((plan) => plan.disposition === "WOULD_MUTATE").length,
      would_route_only: plans.filter((plan) => plan.disposition === "WOULD_ROUTE_ONLY").length,
      blocked_or_no_mutation: plans.filter((plan) => plan.disposition === "NO_MUTATION").length,
      legacy_unstructured_suppressed: queues.legacy.length
    },
    queues
  };
}

function humanPlan(plan) {
  const lines = [
    `PR #${plan.pr} — ${plan.title}`,
    `Exact evaluated head: ${plan.evaluated_head_sha || "unknown"}`,
    `QA: ${plan.qa_state}${plan.qa_tested_sha ? ` (${plan.qa_tested_sha})` : ""}`,
    `Stage-2 action: ${plan.stage2_recommended_action}`,
    `Disposition: ${plan.disposition}`,
    `Reason: ${plan.reason}`,
    `Route: ${plan.proposed_route || "none"}`,
    `Replay fingerprint: ${plan.provenance.fingerprint}`
  ];
  if (plan.mutations.length) {
    lines.push("Proposed mutations:");
    for (const mutation of plan.mutations) lines.push(`  WOULD ${mutation.operation.replace("_", " ")}: ${mutation.label}`);
  } else {
    lines.push("Proposed mutations: none");
  }
  if (plan.handoff_preview) lines.push("", plan.handoff_preview);
  return lines.join("\n");
}

async function loadInput(args) {
  const fixtureIndex = args.indexOf("--fixture");
  if (fixtureIndex >= 0) return JSON.parse(fs.readFileSync(args[fixtureIndex + 1], "utf8"));
  const repository = process.env.GITHUB_REPOSITORY || process.env.LEAGUE_VECTOR_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !token) throw new Error("live_mode_requires_GITHUB_REPOSITORY_and_GITHUB_TOKEN");
  return Stage2.loadLiveRepository(repository, token);
}

module.exports = {
  stableJson,
  sha256,
  malformedQaEvidence,
  provenanceFor,
  planItem,
  derivePlan,
  commandCenterPreview,
  humanPlan
};

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const json = args.includes("--json");
    const data = await loadInput(args);
    const result = derivePlan(data);
    const positional = args.filter((arg, index) => arg !== "--json" && arg !== "--fixture" && args[index - 1] !== "--fixture");
    const command = positional[0] || "plan";
    if (command !== "plan") throw new Error(`unknown_command:${command}`);
    const requestedPr = positional[1] ? Number(positional[1]) : null;
    if (requestedPr) {
      const queues = result.queues;
      const item = queues.items.find((entry) => entry.id === requestedPr);
      const rawPr = (data.prs || []).find((entry) => Number(entry.number) === requestedPr);
      if (!item || !rawPr) throw new Error("item_not_found");
      const byId = Object.fromEntries(queues.items.map((entry) => [entry.id, entry]));
      const plan = planItem(item, rawPr, byId, data.main_sha || null);
      process.stdout.write(json ? `${JSON.stringify(plan, null, 2)}\n` : `${humanPlan(plan)}\n`);
      return;
    }
    if (json) {
      const output = { ...result };
      delete output.queues;
      process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    } else {
      process.stdout.write(`League Vector Orchestrator Stage 3A — DRY RUN ONLY\nmain ${result.main_sha || "unknown"}\nWould mutate ${result.counts.would_mutate} | Route only ${result.counts.would_route_only} | Blocked/no mutation ${result.counts.blocked_or_no_mutation} | Legacy suppressed ${result.counts.legacy_unstructured_suppressed}\n\n`);
      process.stdout.write(`${result.plans.map(humanPlan).join("\n\n")}\n`);
    }
  })().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  });
}
