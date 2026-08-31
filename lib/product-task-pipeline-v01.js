"use strict";

const crypto = require("node:crypto");
const path = require("node:path");

const CONTRACT_SCHEMA_VERSION = "league-vector.product-task-contract/v0.1";
const EVIDENCE_SCHEMA_VERSION = "league-vector.product-task-deterministic-evidence/v0.1";
const QA_SCHEMA_VERSION = "league-vector.product-task-qa-result/v0.1";
const EXECUTION_SCHEMA_VERSION = "league-vector.product-task-execution/v0.1";
const EXPECTED_REPOSITORY = "kw7t9rwhny-cyber/league-vector";
const MAX_CHANGED_FILES = 20;
const MAX_PATCH_BYTES = 524288;
const MAX_PROVIDER_COST_USD = 30;
const MAX_AUTHORITY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CONTRACT_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;
const ACTIONS_BOT = Object.freeze({login: "github-actions[bot]", id: 41898282, type: "Bot"});

const CONTROL_PLANE_PATHS = Object.freeze([
  "scripts/product-task-pipeline-v01.js",
  "lib/product-task-pipeline-v01.js",
  "protocol/product-task-pipeline-v01/task-contract.schema.json",
  "protocol/product-task-pipeline-v01/deterministic-evidence.schema.json",
  "protocol/product-task-pipeline-v01/qa-result.schema.json",
  "protocol/product-task-pipeline-v01/compiler-manifest.json",
  "tests/product-task-pipeline-v01.test.js",
  "docs/product-task-pipeline-v01.md"
]);

const REQUIRED_COMMANDS = Object.freeze([
  "npm ci",
  "npm run validate",
  "npx playwright install --with-deps chromium",
  "npm run test:e2e"
]);

const REQUIRED_PROHIBITED_ACTIONS = Object.freeze([
  "write_main",
  "merge",
  "deploy",
  "release",
  "create_or_request_credentials",
  "payment",
  "customer_delivery",
  "source_rights_conclusion",
  "self_approve",
  "issue_closure",
  "branch_deletion",
  "router_control",
  "stage_0",
  "vectoros_cycle_2",
  "mlp"
]);

const REQUIRED_PROHIBITED_PATH_PATTERNS = Object.freeze([
  ".github/**",
  ".agents/**",
  ".codex/**",
  "package.json",
  "package-lock.json",
  "data/**",
  "**/.env*",
  "**/*credential*",
  "**/*deploy*"
]);

const REQUIRED_STOP_CONDITIONS = Object.freeze([
  "additional_credential_required",
  "repository_identity_moved",
  "task_contract_invalid",
  "task_specific_file_boundary_unenforceable",
  "exact_head_validation_unavailable",
  "separate_read_only_qa_unavailable",
  "provider_cost_authority_unavailable",
  "real_product_task_requested_during_bootstrap"
]);

const MARKERS = Object.freeze({
  contract: "<!-- LEAGUE_VECTOR_PRODUCT_TASK_CONTRACT_V0.1 -->",
  claim: "<!-- LEAGUE_VECTOR_PRODUCT_TASK_CLAIM_V0.1 -->",
  implementation: "<!-- LEAGUE_VECTOR_PRODUCT_TASK_IMPLEMENTATION_V0.1 -->",
  validation: "<!-- LEAGUE_VECTOR_PRODUCT_TASK_VALIDATION_V0.1 -->",
  qa: "<!-- LEAGUE_VECTOR_PRODUCT_TASK_QA_V0.1 -->",
  status: "<!-- LEAGUE_VECTOR_PRODUCT_TASK_STATUS_V0.1 -->",
  receipt: "<!-- LEAGUE_VECTOR_PRODUCT_TASK_EXECUTION_RECEIPT_V0.1 -->"
});

const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PROHIBITED_REQUEST = /\b(credential|secret|api[ _-]?key|password|deploy(?:ment)?|release|merge|payment|charge|invoice|customer delivery|deliver to (?:a )?customer|source[ _-]?rights?|copyright clearance|router control|stage 0|cycle #?2|minimum learning proof|\bmlp\b)\b/i;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}_not_object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (canonical(actual) !== canonical(wanted)) throw new Error(`${label}_fields_invalid`);
}

function nonEmptyString(value, label, max = 10000) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || value.length > max) {
    throw new Error(`${label}_invalid`);
  }
  return value;
}

function exactStringArray(value, label, {min = 1, max = 100} = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${label}_invalid`);
  const seen = new Set();
  for (const entry of value) {
    nonEmptyString(entry, label, 500);
    if (seen.has(entry)) throw new Error(`${label}_duplicate`);
    seen.add(entry);
  }
  return value;
}

function iso(value, label) {
  nonEmptyString(value, label, 40);
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || Number.isNaN(date.getTime())) {
    throw new Error(`${label}_invalid`);
  }
  return date;
}

function normalizeRepositoryPath(value) {
  nonEmptyString(value, "allowed_file", 300);
  if (value.includes("\\") || value.includes("\0") || value.startsWith("/") || value.endsWith("/")) {
    throw new Error("allowed_file_invalid");
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized === "." || normalized.startsWith("../") || value.includes("*")) {
    throw new Error("allowed_file_not_exact");
  }
  return normalized;
}

function isProhibitedPath(file) {
  const normalized = normalizeRepositoryPath(file);
  const lower = normalized.toLowerCase();
  const segments = lower.split("/");
  const base = segments.at(-1);
  const protectedBasenames = new Set([
    "package.json", "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml",
    "bun.lockb", "deno.json", "deno.jsonc", "deno.lock", "requirements.txt", "pipfile",
    "pipfile.lock", "pyproject.toml", "setup.py", "setup.cfg", "gemfile", "gemfile.lock",
    "go.mod", "go.sum", "cargo.toml", "cargo.lock", "agents.md", "codeowners"
  ]);
  if (CONTROL_PLANE_PATHS.includes(normalized)) return true;
  if (/^(?:scripts|lib|tests|docs)\/product-task-pipeline-v01(?:[.\/-]|$)/.test(normalized) || normalized.startsWith("protocol/product-task-pipeline-v01/")) return true;
  if (protectedBasenames.has(base)) return true;
  if (segments.some((segment) => [".git", ".github", ".agents", ".codex", "node_modules", "data"].includes(segment))) return true;
  if (segments.some((segment) => segment.includes("deploy"))) return true;
  if (segments.some((segment) => /^(?:deploy|deployment|release|payment|customer-delivery|router|vectoros|mlp)(?:$|[-_.])/.test(segment))) return true;
  if (segments.some((segment) => /(?:credential|secret|token|\.env)/.test(segment))) return true;
  return false;
}

function isWithinStaticSafeProfile(file) {
  const normalized = normalizeRepositoryPath(file);
  if (isProhibitedPath(normalized)) return false;
  return /^(?:[^/]+\.(?:js|css|html)|(?:scripts|lib)\/[^/]+\.js|tests\/[^/]+\.test\.js|docs\/[^/]+\.md|protocol\/product-[A-Za-z0-9._/-]+\.(?:json|md)|assets\/[A-Za-z0-9._/-]+)$/.test(normalized);
}

function deriveIdempotencyIdentity(contract) {
  const copy = {...contract};
  delete copy.idempotency_identity;
  return sha256(canonical(copy));
}

function deriveTaskContractIdentity(contract) {
  return sha256(canonical(contract));
}

function validateTaskContract(contract, {now = new Date(), expectedRepository = EXPECTED_REPOSITORY} = {}) {
  exactKeys(contract, [
    "schema_version", "task_id", "assignment_id", "objective", "repository", "starting_commit",
    "starting_tree", "allowed_files", "prohibited_path_patterns", "required_deterministic_commands",
    "maximum_changed_files", "maximum_patch_bytes", "maximum_provider_cost_usd", "authority",
    "prohibited_actions", "qa_requirement", "acceptance_threshold", "expires_at", "target_date",
    "idempotency_identity", "stop_conditions"
  ], "task_contract");
  if (contract.schema_version !== CONTRACT_SCHEMA_VERSION) throw new Error("task_contract_schema_invalid");
  if (!ID.test(nonEmptyString(contract.task_id, "task_id", 200))) throw new Error("task_id_invalid");
  if (!ID.test(nonEmptyString(contract.assignment_id, "assignment_id", 200))) throw new Error("assignment_id_invalid");
  nonEmptyString(contract.objective, "objective", 5000);
  if (PROHIBITED_REQUEST.test(contract.objective)) throw new Error("objective_requests_prohibited_action");
  if (contract.repository !== expectedRepository) throw new Error("task_contract_wrong_repository");
  if (!SHA40.test(contract.starting_commit)) throw new Error("starting_commit_invalid");
  if (!SHA40.test(contract.starting_tree)) throw new Error("starting_tree_invalid");

  exactStringArray(contract.allowed_files, "allowed_files", {min: 1, max: MAX_CHANGED_FILES});
  for (const file of contract.allowed_files) {
    if (!isWithinStaticSafeProfile(file)) throw new Error("allowed_file_outside_safe_profile");
  }
  exactStringArray(contract.prohibited_path_patterns, "prohibited_path_patterns", {min: REQUIRED_PROHIBITED_PATH_PATTERNS.length, max: REQUIRED_PROHIBITED_PATH_PATTERNS.length});
  if (canonical(contract.prohibited_path_patterns) !== canonical(REQUIRED_PROHIBITED_PATH_PATTERNS)) throw new Error("prohibited_path_controls_invalid");
  if (canonical(contract.required_deterministic_commands) !== canonical(REQUIRED_COMMANDS)) {
    throw new Error("required_commands_invalid");
  }
  if (!Number.isInteger(contract.maximum_changed_files) || contract.maximum_changed_files < 1 || contract.maximum_changed_files > MAX_CHANGED_FILES || contract.maximum_changed_files > contract.allowed_files.length) {
    throw new Error("maximum_changed_files_invalid");
  }
  if (!Number.isInteger(contract.maximum_patch_bytes) || contract.maximum_patch_bytes < 1 || contract.maximum_patch_bytes > MAX_PATCH_BYTES) {
    throw new Error("maximum_patch_bytes_invalid");
  }
  if (contract.maximum_provider_cost_usd !== MAX_PROVIDER_COST_USD) {
    throw new Error("provider_cost_authority_invalid");
  }

  exactKeys(contract.authority, ["status", "authorized_by", "authorized_at", "authorization_id", "scope"], "authority");
  if (contract.authority.status !== "APPROVED" || contract.authority.scope !== "PRODUCT_TASK_IMPLEMENTATION") throw new Error("authority_insufficient");
  const owner = expectedRepository.split("/")[0];
  if (contract.authority.authorized_by !== owner) throw new Error("authority_actor_invalid");
  if (!ID.test(nonEmptyString(contract.authority.authorization_id, "authorization_id", 200))) throw new Error("authorization_id_invalid");
  const authorizedAt = iso(contract.authority.authorized_at, "authorized_at");
  const expiresAt = iso(contract.expires_at, "expires_at");
  if (authorizedAt.getTime() > now.getTime() || now.getTime() - authorizedAt.getTime() > MAX_AUTHORITY_AGE_MS || expiresAt.getTime() <= now.getTime() || expiresAt.getTime() <= authorizedAt.getTime() || expiresAt.getTime() - authorizedAt.getTime() > MAX_CONTRACT_LIFETIME_MS) {
    throw new Error("authority_expired_or_contradictory");
  }
  const targetDateEnd = new Date(`${contract.target_date}T23:59:59Z`).getTime();
  if (!DATE.test(contract.target_date) || targetDateEnd < now.getTime() || targetDateEnd > expiresAt.getTime()) {
    throw new Error("target_date_invalid");
  }

  exactStringArray(contract.prohibited_actions, "prohibited_actions", {min: REQUIRED_PROHIBITED_ACTIONS.length, max: REQUIRED_PROHIBITED_ACTIONS.length});
  if (canonical(contract.prohibited_actions) !== canonical(REQUIRED_PROHIBITED_ACTIONS)) throw new Error("prohibited_action_controls_invalid");
  if (contract.qa_requirement !== "FRESH_INDEPENDENT_READ_ONLY") throw new Error("qa_requirement_invalid");
  exactKeys(contract.acceptance_threshold, ["p0", "p1"], "acceptance_threshold");
  if (contract.acceptance_threshold.p0 !== 0 || contract.acceptance_threshold.p1 !== 0) throw new Error("acceptance_threshold_invalid");
  exactStringArray(contract.stop_conditions, "stop_conditions", {min: REQUIRED_STOP_CONDITIONS.length, max: REQUIRED_STOP_CONDITIONS.length});
  if (canonical(contract.stop_conditions) !== canonical(REQUIRED_STOP_CONDITIONS)) throw new Error("stop_condition_controls_invalid");
  if (!SHA64.test(contract.idempotency_identity) || contract.idempotency_identity !== deriveIdempotencyIdentity(contract)) {
    throw new Error("idempotency_identity_invalid");
  }
  return true;
}

function taggedRecord(marker, value) {
  return `${marker}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function parseTaggedRecords(text, marker) {
  if (typeof text !== "string") return [];
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escaped}\\s*\\n\\s*\`\`\`json\\s*\\n([\\s\\S]*?)\\n\`\`\``, "g");
  const out = [];
  for (let match; (match = regex.exec(text));) {
    try { out.push(JSON.parse(match[1])); } catch { throw new Error("tagged_record_malformed"); }
  }
  return out;
}

function parseContractIssue(issue) {
  if (!issue || typeof issue !== "object") throw new Error("task_contract_issue_missing");
  const records = parseTaggedRecords(issue.body, MARKERS.contract);
  if (records.length !== 1) throw new Error("task_contract_missing_or_duplicate");
  return records[0];
}

function isTrustedActionsComment(comment) {
  return Boolean(comment && comment.user && comment.user.login === ACTIONS_BOT.login && comment.user.id === ACTIONS_BOT.id && comment.user.type === ACTIONS_BOT.type);
}

function parseTrustedRecords(comments, marker) {
  const records = [];
  for (const comment of comments || []) {
    if (!isTrustedActionsComment(comment)) continue;
    records.push(...parseTaggedRecords(comment.body, marker));
  }
  return records;
}

function assertUniqueExecution(comments, idempotencyIdentity) {
  const records = [
    ...parseTrustedRecords(comments, MARKERS.claim),
    ...parseTrustedRecords(comments, MARKERS.implementation),
    ...parseTrustedRecords(comments, MARKERS.receipt)
  ].filter((record) => record.idempotency_identity === idempotencyIdentity);
  if (records.length !== 0) throw new Error("duplicate_or_terminal_execution");
  return true;
}

function assertCurrentClaim(comments, taskContractIdentity, implementationRunIdentity) {
  const records = parseTrustedRecords(comments, MARKERS.claim).filter((record) => record.task_contract_identity === taskContractIdentity && record.implementation_run_identity === implementationRunIdentity);
  if (records.length !== 1) throw new Error("current_execution_claim_missing_or_duplicate");
  return true;
}

function assertClaimAuthority(comments, expected) {
  const records = parseTrustedRecords(comments, MARKERS.claim).filter((record) => record.task_contract_identity === expected.task_contract_identity && record.implementation_run_identity === expected.implementation_run_identity);
  if (records.length !== 1) throw new Error("trusted_claim_missing_or_duplicate");
  const claim = records[0];
  if (claim.schema_version !== EXECUTION_SCHEMA_VERSION || claim.idempotency_identity !== expected.idempotency_identity || String(claim.implementation_workflow_run_id) !== String(expected.implementation_workflow_run_id) || String(claim.implementation_workflow_run_attempt) !== String(expected.implementation_workflow_run_attempt)) {
    throw new Error("trusted_claim_binding_mismatch");
  }
  const derived = deriveImplementationRunIdentity({
    taskContractIdentity: expected.task_contract_identity,
    runId: expected.implementation_workflow_run_id,
    runAttempt: expected.implementation_workflow_run_attempt
  });
  if (derived !== expected.implementation_run_identity || claim.claim_identity !== sha256(`${expected.task_contract_identity}:${expected.implementation_run_identity}:CLAIM`)) {
    throw new Error("trusted_claim_identity_mismatch");
  }
  return claim;
}

function assertImplementationAuthority(comments, expected) {
  const claim = assertClaimAuthority(comments, expected);
  const records = parseTrustedRecords(comments, MARKERS.implementation).filter((record) => record.implementation_run_identity === expected.implementation_run_identity);
  if (records.length !== 1) throw new Error("trusted_implementation_missing_or_duplicate");
  const implementation = records[0];
  const exact = implementation.schema_version === EXECUTION_SCHEMA_VERSION &&
    implementation.record_type === "IMPLEMENTATION_DISPATCH" &&
    implementation.task_contract_identity === expected.task_contract_identity &&
    implementation.idempotency_identity === expected.idempotency_identity &&
    String(implementation.implementation_workflow_run_id) === String(expected.implementation_workflow_run_id) &&
    String(implementation.implementation_workflow_run_attempt) === String(expected.implementation_workflow_run_attempt) &&
    implementation.candidate_pr_number === expected.candidate_pr_number &&
    implementation.base_commit === expected.expected_base_commit &&
    implementation.candidate_commit === expected.expected_candidate_commit &&
    implementation.candidate_tree === expected.expected_candidate_tree &&
    canonical(implementation.changed_paths) === canonical(expected.expected_changed_paths);
  if (!exact) throw new Error("trusted_implementation_binding_mismatch");
  return {claim, implementation};
}

function validateRepositoryIdentity(contract, observed) {
  if (!observed || observed.repository !== contract.repository) throw new Error("observed_repository_mismatch");
  if (observed.commit !== contract.starting_commit) throw new Error("observed_starting_commit_mismatch");
  if (observed.tree !== contract.starting_tree) throw new Error("observed_starting_tree_mismatch");
  return true;
}

function validateCandidate(contract, candidate) {
  exactKeys(candidate, ["repository", "base_branch", "base_commit", "candidate_branch", "candidate_commit", "candidate_tree", "changed_paths", "patch_bytes", "draft"], "candidate");
  if (candidate.repository !== contract.repository) throw new Error("candidate_repository_mismatch");
  if (candidate.base_branch !== "main" || candidate.base_commit !== contract.starting_commit) throw new Error("candidate_base_mismatch");
  if (candidate.candidate_branch === "main" || !candidate.candidate_branch.startsWith("agent/product-task-")) throw new Error("candidate_branch_invalid");
  if (!SHA40.test(candidate.candidate_commit) || !SHA40.test(candidate.candidate_tree)) throw new Error("candidate_identity_invalid");
  if (candidate.draft !== true) throw new Error("candidate_not_draft");
  exactStringArray(candidate.changed_paths, "candidate_changed_paths", {min: 1, max: contract.maximum_changed_files});
  if (candidate.changed_paths.length > contract.maximum_changed_files) throw new Error("candidate_changed_file_limit_exceeded");
  const allowed = new Set(contract.allowed_files);
  for (const file of candidate.changed_paths) {
    normalizeRepositoryPath(file);
    if (!allowed.has(file) || isProhibitedPath(file)) throw new Error("candidate_path_not_allowed");
  }
  if (!Number.isInteger(candidate.patch_bytes) || candidate.patch_bytes < 1 || candidate.patch_bytes > contract.maximum_patch_bytes) throw new Error("candidate_patch_limit_exceeded");
  return true;
}

function validateCreatorEvidence(contract, evidence, expected) {
  exactKeys(evidence, [
    "schema_version", "task_contract_identity", "implementation_run_identity",
    "implementation_workflow_run_id", "implementation_workflow_run_attempt", "candidate",
    "commands", "started_at", "ended_at", "overall"
  ], "creator_evidence");
  if (evidence.schema_version !== "league-vector.product-task-creator-evidence/v0.1" || evidence.task_contract_identity !== expected.task_contract_identity || evidence.implementation_run_identity !== expected.implementation_run_identity || String(evidence.implementation_workflow_run_id) !== String(expected.implementation_workflow_run_id) || String(evidence.implementation_workflow_run_attempt) !== String(expected.implementation_workflow_run_attempt)) {
    throw new Error("creator_evidence_binding_mismatch");
  }
  if (deriveImplementationRunIdentity({taskContractIdentity: evidence.task_contract_identity, runId: evidence.implementation_workflow_run_id, runAttempt: evidence.implementation_workflow_run_attempt}) !== evidence.implementation_run_identity) {
    throw new Error("creator_evidence_run_identity_mismatch");
  }
  validateCandidate(contract, evidence.candidate);
  if (!Array.isArray(evidence.commands) || evidence.commands.length !== REQUIRED_COMMANDS.length) throw new Error("creator_evidence_commands_invalid");
  for (const [index, result] of evidence.commands.entries()) {
    exactKeys(result, ["command", "exit_code", "started_at", "ended_at", "test_count"], `creator_evidence_command_${index}`);
    if (result.command !== REQUIRED_COMMANDS[index] || result.exit_code !== 0) throw new Error("creator_evidence_command_failed");
  }
  iso(evidence.started_at, "creator_evidence_started_at");
  iso(evidence.ended_at, "creator_evidence_ended_at");
  if (evidence.overall !== "PASS") throw new Error("creator_evidence_not_pass");
  return true;
}

function validateSafeOutputRequests(agentOutput) {
  exactKeys(agentOutput, ["items"], "agent_output");
  if (!Array.isArray(agentOutput.items) || agentOutput.items.length !== 2) throw new Error("safe_output_request_count_invalid");
  const createRequests = agentOutput.items.filter((item) => item && item.type === "create_pull_request");
  const dispatchRequests = agentOutput.items.filter((item) => item && item.type === "dispatch_validation");
  if (createRequests.length !== 1 || dispatchRequests.length !== 1 || dispatchRequests[0].confirmation !== true) throw new Error("safe_output_request_set_invalid");
  return true;
}

function validateDeterministicEvidence(evidence, expected) {
  exactKeys(evidence, [
    "schema_version", "task_contract_identity", "implementation_run_identity",
    "implementation_workflow_run_id", "implementation_workflow_run_attempt", "candidate_pr_number",
    "expected_candidate_commit", "observed_candidate_commit", "expected_candidate_tree",
    "observed_candidate_tree", "expected_base_commit", "observed_base_commit",
    "expected_changed_paths", "observed_changed_paths", "observed_patch_bytes", "test_commands",
    "command_results", "workflow_run_id", "run_attempt", "started_at", "ended_at",
    "identity_error", "movement_error", "overall"
  ], "evidence");
  if (evidence.schema_version !== EVIDENCE_SCHEMA_VERSION) throw new Error("evidence_schema_invalid");
  for (const field of ["task_contract_identity", "implementation_run_identity", "implementation_workflow_run_id", "implementation_workflow_run_attempt", "candidate_pr_number", "expected_candidate_commit", "expected_candidate_tree", "expected_base_commit"]) {
    if (evidence[field] !== expected[field]) throw new Error(`evidence_${field}_mismatch`);
  }
  if (String(evidence.workflow_run_id) !== String(expected.workflow_run_id)) throw new Error("evidence_workflow_run_id_mismatch");
  if (String(evidence.run_attempt) !== String(expected.run_attempt)) throw new Error("evidence_run_attempt_mismatch");
  if (!SHA64.test(evidence.task_contract_identity) || !SHA64.test(evidence.implementation_run_identity) || !Number.isInteger(evidence.candidate_pr_number) || evidence.candidate_pr_number < 1) throw new Error("evidence_binding_invalid");
  for (const field of ["expected_candidate_commit", "expected_candidate_tree", "expected_base_commit"]) {
    if (!SHA40.test(evidence[field])) throw new Error("evidence_binding_invalid");
  }
  if (!/^\d+$/.test(String(evidence.implementation_workflow_run_id)) || !/^\d+$/.test(String(evidence.implementation_workflow_run_attempt)) || !/^\d+$/.test(String(evidence.workflow_run_id)) || !/^\d+$/.test(String(evidence.run_attempt))) throw new Error("evidence_run_identity_invalid");
  exactStringArray(evidence.expected_changed_paths, "evidence_expected_changed_paths", {min: 0, max: MAX_CHANGED_FILES});
  exactStringArray(evidence.observed_changed_paths, "evidence_observed_changed_paths", {min: 0, max: MAX_CHANGED_FILES});
  if (!(evidence.observed_patch_bytes === "UNKNOWN" || (Number.isInteger(evidence.observed_patch_bytes) && evidence.observed_patch_bytes >= 0 && evidence.observed_patch_bytes <= MAX_PATCH_BYTES))) throw new Error("evidence_observed_patch_bytes_invalid");
  iso(evidence.started_at, "evidence_started_at");
  iso(evidence.ended_at, "evidence_ended_at");
  const exactObservedIdentity = evidence.observed_candidate_commit === expected.expected_candidate_commit && evidence.observed_candidate_tree === expected.expected_candidate_tree && evidence.observed_base_commit === expected.expected_base_commit;
  const exactObservedPaths = canonical(evidence.observed_changed_paths) === canonical(expected.expected_changed_paths);
  if (canonical(evidence.expected_changed_paths) !== canonical(expected.expected_changed_paths)) throw new Error("evidence_expected_changed_paths_mismatch");
  if (canonical(evidence.test_commands) !== canonical(REQUIRED_COMMANDS)) throw new Error("evidence_commands_mismatch");
  if (!Array.isArray(evidence.command_results) || evidence.command_results.length !== REQUIRED_COMMANDS.length) throw new Error("evidence_command_results_invalid");
  for (const [index, result] of evidence.command_results.entries()) {
    exactKeys(result, ["command", "exit_code", "started_at", "ended_at", "test_count"], `evidence_command_result_${index}`);
    if (result.command !== REQUIRED_COMMANDS[index] || !(result.exit_code === "NOT_RUN" || (Number.isInteger(result.exit_code) && result.exit_code >= 0))) throw new Error("evidence_command_result_invalid");
  }
  const allPassed = evidence.command_results.every((result, index) => result.command === REQUIRED_COMMANDS[index] && result.exit_code === 0);
  if (!['PASS', 'FAIL'].includes(evidence.overall)) throw new Error("evidence_overall_invalid");
  if (evidence.overall === "PASS" && (!allPassed || !exactObservedIdentity || !exactObservedPaths)) throw new Error("evidence_false_pass");
  if (evidence.overall === "FAIL" && allPassed && exactObservedIdentity && exactObservedPaths && !evidence.identity_error && !evidence.movement_error) throw new Error("evidence_false_fail");
  return true;
}

function validateQaSubstance(substance) {
  exactKeys(substance, ["schema_version", "status", "p0_count", "p1_count", "findings", "limitations"], "qa_substance");
  if (substance.schema_version !== QA_SCHEMA_VERSION) throw new Error("qa_schema_invalid");
  if (!["PASS", "FAIL", "BLOCKED"].includes(substance.status)) throw new Error("qa_status_invalid");
  const count = (value) => value === "UNKNOWN" || (Number.isInteger(value) && value >= 0);
  if (!count(substance.p0_count) || !count(substance.p1_count)) throw new Error("qa_counts_invalid");
  exactStringArray(substance.findings, "qa_findings", {min: 0, max: 100});
  if (typeof substance.limitations !== "string" || substance.limitations.length > 10000) throw new Error("qa_limitations_invalid");
  if (substance.status === "PASS" && (substance.p0_count !== 0 || substance.p1_count !== 0)) throw new Error("qa_pass_threshold_not_met");
  return true;
}

function qaAcceptance(substance) {
  validateQaSubstance(substance);
  return substance.status === "PASS" && substance.p0_count === 0 && substance.p1_count === 0;
}

function reconcileState({validationRecords = [], qaRecords = [], candidateCommit, candidateTree}) {
  const exactQa = qaRecords.filter((record) => record.candidate_commit === candidateCommit && record.candidate_tree === candidateTree);
  if (exactQa.length > 1) return {state: "BLOCKED", reason: "duplicate_terminal_qa"};
  if (exactQa.length === 1) return {state: exactQa[0].status, reason: "terminal_qa"};
  if (qaRecords.length > 0) return {state: "BLOCKED", reason: "candidate_moved_after_qa"};
  const exactValidation = validationRecords.filter((record) => record.candidate_commit === candidateCommit && record.candidate_tree === candidateTree);
  if (exactValidation.some((record) => record.overall === "PASS")) return {state: "READY_FOR_QA", reason: "exact_validation_pass"};
  if (exactValidation.some((record) => record.overall === "FAIL")) return {state: "FAIL", reason: "exact_validation_fail"};
  return {state: "VALIDATION_PENDING", reason: "no_exact_validation"};
}

function classifyFailure(error) {
  const code = String(error && (error.code || error.message || error));
  if (/transport|github_api_(?:408|429|5\d\d)|dispatch_unconfirmed|network|timeout/i.test(code)) return "TRANSPORT_FAILURE";
  return "TASK_FAILURE";
}

function deriveImplementationRunIdentity({taskContractIdentity, runId, runAttempt}) {
  if (!SHA64.test(taskContractIdentity) || !/^\d+$/.test(String(runId)) || !/^\d+$/.test(String(runAttempt))) throw new Error("implementation_run_identity_inputs_invalid");
  return sha256(`${taskContractIdentity}:${runId}:${runAttempt}`);
}

function privateHandoffArtifact(payload) {
  return {
    schema_version: "league-vector.private-research-system-handoff/v0.1",
    destination: "PRIVATE RESEARCH SYSTEM",
    canonical_ingestion: "NOT_AUTHORIZED",
    ...payload
  };
}

function validateCompilerManifestBytes(manifest, sourceBytes, lockBytes) {
  exactKeys(manifest, ["schema_version", "gh_aw_version", "compiler_commit", "source_path", "source_sha256", "lock_path", "lock_sha256"], "compiler_manifest");
  if (manifest.schema_version !== "league-vector.gh-aw-compiler-manifest/v0.1" || manifest.gh_aw_version !== "v0.86.2" || manifest.compiler_commit !== "48e5fa3ff52294d91d97715017a9f8693a48387f") throw new Error("compiler_manifest_identity_invalid");
  if (manifest.source_sha256 !== sha256(sourceBytes)) throw new Error("agentic_source_stale_or_mismatched");
  if (manifest.lock_sha256 !== sha256(lockBytes)) throw new Error("compiled_lock_stale_or_mismatched");
  return true;
}

module.exports = {
  CONTRACT_SCHEMA_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  QA_SCHEMA_VERSION,
  EXECUTION_SCHEMA_VERSION,
  EXPECTED_REPOSITORY,
  CONTROL_PLANE_PATHS,
  MAX_CHANGED_FILES,
  MAX_PATCH_BYTES,
  MAX_PROVIDER_COST_USD,
  MAX_AUTHORITY_AGE_MS,
  MAX_CONTRACT_LIFETIME_MS,
  ACTIONS_BOT,
  REQUIRED_COMMANDS,
  REQUIRED_PROHIBITED_ACTIONS,
  REQUIRED_PROHIBITED_PATH_PATTERNS,
  REQUIRED_STOP_CONDITIONS,
  MARKERS,
  canonical,
  sha256,
  deriveIdempotencyIdentity,
  deriveTaskContractIdentity,
  validateTaskContract,
  taggedRecord,
  parseTaggedRecords,
  parseContractIssue,
  parseTrustedRecords,
  assertUniqueExecution,
  assertCurrentClaim,
  assertClaimAuthority,
  assertImplementationAuthority,
  normalizeRepositoryPath,
  isProhibitedPath,
  isWithinStaticSafeProfile,
  validateRepositoryIdentity,
  validateCandidate,
  validateCreatorEvidence,
  validateSafeOutputRequests,
  validateDeterministicEvidence,
  validateQaSubstance,
  qaAcceptance,
  reconcileState,
  classifyFailure,
  deriveImplementationRunIdentity,
  privateHandoffArtifact,
  validateCompilerManifestBytes
};
