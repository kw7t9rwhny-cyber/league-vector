"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const pipeline = require("../lib/product-task-pipeline-v01.js");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(ROOT, ".github/workflows/product-task-pipeline-v01.md");
const LOCK_PATH = path.join(ROOT, ".github/workflows/product-task-pipeline-v01.lock.yml");
const VALIDATION_PATH = path.join(ROOT, ".github/workflows/product-task-pipeline-v01-exact-head.yml");
const QA_PATH = path.join(ROOT, ".github/workflows/product-task-pipeline-v01-qa.yml");
const MANIFEST_PATH = path.join(ROOT, "protocol/product-task-pipeline-v01/compiler-manifest.json");
const FIXED_NOW = new Date("2026-08-30T12:00:00Z");
const START_COMMIT = "1".repeat(40);
const START_TREE = "2".repeat(40);
const CANDIDATE_COMMIT = "3".repeat(40);
const CANDIDATE_TREE = "4".repeat(40);

function fixtureContract(overrides = {}) {
  const contract = {
    schema_version: pipeline.CONTRACT_SCHEMA_VERSION,
    task_id: "task.product.sample-v01",
    assignment_id: "assignment.product.sample-v01",
    objective: "Add a bounded presentation improvement to the public product page.",
    repository: pipeline.EXPECTED_REPOSITORY,
    starting_commit: START_COMMIT,
    starting_tree: START_TREE,
    allowed_files: ["app.js"],
    prohibited_path_patterns: [...pipeline.REQUIRED_PROHIBITED_PATH_PATTERNS],
    required_deterministic_commands: [...pipeline.REQUIRED_COMMANDS],
    maximum_changed_files: 1,
    maximum_patch_bytes: 4096,
    maximum_provider_cost_usd: 30,
    authority: {
      status: "APPROVED",
      authorized_by: "kw7t9rwhny-cyber",
      authorized_at: "2026-08-30T11:00:00Z",
      authorization_id: "founder-approval.product.sample-v01",
      scope: "PRODUCT_TASK_IMPLEMENTATION"
    },
    prohibited_actions: [...pipeline.REQUIRED_PROHIBITED_ACTIONS],
    qa_requirement: "FRESH_INDEPENDENT_READ_ONLY",
    acceptance_threshold: {p0: 0, p1: 0},
    expires_at: "2026-09-06T12:00:00Z",
    target_date: "2026-09-05",
    idempotency_identity: "0".repeat(64),
    stop_conditions: [...pipeline.REQUIRED_STOP_CONDITIONS]
  };
  Object.assign(contract, overrides);
  contract.idempotency_identity = pipeline.deriveIdempotencyIdentity(contract);
  return contract;
}

function trustedComment(marker, record) {
  return {
    user: {...pipeline.ACTIONS_BOT},
    body: pipeline.taggedRecord(marker, record)
  };
}

function candidate(overrides = {}) {
  return {
    repository: pipeline.EXPECTED_REPOSITORY,
    base_branch: "main",
    base_commit: START_COMMIT,
    candidate_branch: "agent/product-task-sample-v01",
    candidate_commit: CANDIDATE_COMMIT,
    candidate_tree: CANDIDATE_TREE,
    changed_paths: ["app.js"],
    patch_bytes: 1200,
    draft: true,
    ...overrides
  };
}

function expectedEvidenceBinding() {
  return {
    task_contract_identity: "5".repeat(64),
    implementation_run_identity: "6".repeat(64),
    implementation_workflow_run_id: "90",
    implementation_workflow_run_attempt: "1",
    validation_dispatch_identity: "7".repeat(64),
    candidate_pr_number: 17,
    expected_candidate_branch: "agent/product-task-sample-v01",
    expected_candidate_commit: CANDIDATE_COMMIT,
    expected_candidate_tree: CANDIDATE_TREE,
    expected_base_commit: START_COMMIT,
    expected_changed_paths: ["app.js"],
    workflow_run_id: "100",
    run_attempt: "1",
    validation_actor: pipeline.ACTIONS_BOT.login,
    validation_triggering_actor: pipeline.ACTIONS_BOT.login,
    validation_workflow_path: pipeline.VALIDATION_WORKFLOW_PATH,
    validation_workflow_ref: pipeline.VALIDATION_WORKFLOW_REF,
    validation_workflow_sha: START_COMMIT,
    validation_event_name: "workflow_dispatch"
  };
}

function evidence(overrides = {}) {
  const expected = expectedEvidenceBinding();
  return {
    schema_version: pipeline.EVIDENCE_SCHEMA_VERSION,
    ...expected,
    observed_candidate_commit: expected.expected_candidate_commit,
    observed_candidate_tree: expected.expected_candidate_tree,
    observed_base_commit: expected.expected_base_commit,
    observed_changed_paths: [...expected.expected_changed_paths],
    observed_patch_bytes: 1200,
    test_commands: [...pipeline.REQUIRED_COMMANDS],
    command_results: pipeline.REQUIRED_COMMANDS.map((command) => ({command, exit_code: 0, started_at: "2026-08-30T12:00:00Z", ended_at: "2026-08-30T12:00:01Z", test_count: "UNKNOWN"})),
    workflow_run_id: "100",
    run_attempt: "1",
    started_at: "2026-08-30T12:00:00Z",
    ended_at: "2026-08-30T12:01:00Z",
    identity_error: null,
    movement_error: null,
    overall: "PASS",
    ...overrides
  };
}

test("valid frozen task contract passes and has a stable identity", () => {
  const contract = fixtureContract();
  assert.equal(pipeline.validateTaskContract(contract, {now: FIXED_NOW}), true);
  assert.equal(pipeline.deriveTaskContractIdentity(contract), pipeline.deriveTaskContractIdentity(structuredClone(contract)));
});

test("malformed or extra contract fields fail closed", () => {
  const contract = fixtureContract();
  contract.unreviewed = true;
  assert.throws(() => pipeline.validateTaskContract(contract, {now: FIXED_NOW}), /task_contract_fields_invalid/);
  assert.throws(() => pipeline.parseContractIssue({body: "not a contract"}), /task_contract_missing_or_duplicate/);
});

test("authority-bearing tagged JSON rejects duplicate members at every depth and escape-equivalent names", () => {
  const tagged = (json) => `${pipeline.MARKERS.contract}\n\n\`\`\`json\n${json}\n\`\`\``;
  for (const json of [
    '{"repository":"wrong","reposito\\u0072y":"right"}',
    '{"authority":{"authorized_by":"wrong","authorized_\\u0062y":"right"}}',
    '{"items":[{"task_id":"first","task_\\u0069d":"second"}]}'
  ]) {
    assert.throws(() => pipeline.parseTaggedRecords(tagged(json), pipeline.MARKERS.contract), /tagged_record_duplicate_member/);
  }
  assert.deepEqual(pipeline.parseTaggedRecords(tagged('{"outer":{"first":1,"second":2}}'), pipeline.MARKERS.contract), [{outer: {first: 1, second: 2}}]);
});

test("v0.1 rejects unimplemented extra controls and any unsupported provider budget", () => {
  const extraPath = fixtureContract({prohibited_path_patterns: [...pipeline.REQUIRED_PROHIBITED_PATH_PATTERNS, "docs/**"]});
  assert.throws(() => pipeline.validateTaskContract(extraPath, {now: FIXED_NOW}), /prohibited_path_controls_invalid|prohibited_path_patterns_invalid/);
  const extraAction = fixtureContract({prohibited_actions: [...pipeline.REQUIRED_PROHIBITED_ACTIONS, "extra_action"]});
  assert.throws(() => pipeline.validateTaskContract(extraAction, {now: FIXED_NOW}), /prohibited_action_controls_invalid|prohibited_actions_invalid/);
  const extraStop = fixtureContract({stop_conditions: [...pipeline.REQUIRED_STOP_CONDITIONS, "extra_stop"]});
  assert.throws(() => pipeline.validateTaskContract(extraStop, {now: FIXED_NOW}), /stop_condition_controls_invalid|stop_conditions_invalid/);
  assert.throws(() => pipeline.validateTaskContract(fixtureContract({maximum_provider_cost_usd: 29}), {now: FIXED_NOW}), /provider_cost_authority_invalid/);
});

test("wrong repository and moved starting identity fail closed", () => {
  assert.throws(() => pipeline.validateTaskContract(fixtureContract({repository: "elsewhere/repo"}), {now: FIXED_NOW}), /wrong_repository/);
  const contract = fixtureContract();
  assert.throws(() => pipeline.validateRepositoryIdentity(contract, {repository: contract.repository, commit: "9".repeat(40), tree: START_TREE}), /starting_commit_mismatch/);
  assert.throws(() => pipeline.validateRepositoryIdentity(contract, {repository: contract.repository, commit: START_COMMIT, tree: "9".repeat(40)}), /starting_tree_mismatch/);
});

test("missing Founder authority and invalid authority actor fail closed", () => {
  const missing = fixtureContract();
  delete missing.authority;
  assert.throws(() => pipeline.validateTaskContract(missing, {now: FIXED_NOW}), /task_contract_fields_invalid/);
  const wrongActor = fixtureContract();
  wrongActor.authority.authorized_by = "someone-else";
  wrongActor.idempotency_identity = pipeline.deriveIdempotencyIdentity(wrongActor);
  assert.throws(() => pipeline.validateTaskContract(wrongActor, {now: FIXED_NOW}), /authority_actor_invalid/);
});

test("expired, future, and contradictory authority fail closed", () => {
  const expired = fixtureContract({expires_at: "2026-08-30T11:59:59Z", target_date: "2026-08-30"});
  assert.throws(() => pipeline.validateTaskContract(expired, {now: FIXED_NOW}), /expired_or_contradictory/);
  const future = fixtureContract();
  future.authority.authorized_at = "2026-08-31T00:00:00Z";
  future.idempotency_identity = pipeline.deriveIdempotencyIdentity(future);
  assert.throws(() => pipeline.validateTaskContract(future, {now: FIXED_NOW}), /expired_or_contradictory/);
  const stale = fixtureContract();
  stale.authority.authorized_at = "2026-08-20T12:00:00Z";
  stale.idempotency_identity = pipeline.deriveIdempotencyIdentity(stale);
  assert.throws(() => pipeline.validateTaskContract(stale, {now: FIXED_NOW}), /expired_or_contradictory/);
});

test("broad, traversing, and globbed paths fail closed", () => {
  for (const file of ["*", "../app.js", "src/**", "/app.js"]) {
    const contract = fixtureContract({allowed_files: [file]});
    assert.throws(() => pipeline.validateTaskContract(contract, {now: FIXED_NOW}));
  }
});

test("workflow, dependency, data, credential, deployment, customer, and control-plane paths are prohibited", () => {
  const files = [
    ".github/workflows/rogue.yml",
    "package.json",
    "data/new.json",
    "secrets/api-token.txt",
    "deploy-prod.js",
    "scripts/predeploy-hook.js",
    "customer.js",
    "customers.js",
    "lib/customerPortal.js",
    "docs/customer-success.md",
    "assets/noncustomer-copy.txt",
    "scripts/product-task-pipeline-v01.js",
    "protocol/product-task-pipeline-v01/qa-result.schema.json",
    "tests/product-task-pipeline-v01-regression.test.js"
  ];
  for (const file of files) {
    assert.equal(pipeline.isProhibitedPath(file), true, file);
    assert.equal(pipeline.isWithinStaticSafeProfile(file), false, file);
  }
});

test("duplicate trusted implementation or terminal receipt is rejected", () => {
  const contract = fixtureContract();
  const implementation = {idempotency_identity: contract.idempotency_identity};
  assert.throws(() => pipeline.assertUniqueExecution([trustedComment(pipeline.MARKERS.implementation, implementation)], contract.idempotency_identity), /duplicate_or_terminal_execution/);
  assert.throws(() => pipeline.assertUniqueExecution([trustedComment(pipeline.MARKERS.receipt, implementation)], contract.idempotency_identity), /duplicate_or_terminal_execution/);
  assert.throws(() => pipeline.assertUniqueExecution([trustedComment(pipeline.MARKERS.claim, implementation)], contract.idempotency_identity), /duplicate_or_terminal_execution/);
});

test("only one trusted claim for the current exact run is admitted", () => {
  const record = {task_contract_identity: "a".repeat(64), implementation_run_identity: "b".repeat(64)};
  const comment = trustedComment(pipeline.MARKERS.claim, record);
  assert.equal(pipeline.assertCurrentClaim([comment], record.task_contract_identity, record.implementation_run_identity), true);
  assert.throws(() => pipeline.assertCurrentClaim([], record.task_contract_identity, record.implementation_run_identity), /missing_or_duplicate/);
  assert.throws(() => pipeline.assertCurrentClaim([comment, comment], record.task_contract_identity, record.implementation_run_identity), /missing_or_duplicate/);
});

test("exact-head authority requires one claim and implementation record bound to one run attempt", () => {
  const contract = fixtureContract();
  const taskContractIdentity = pipeline.deriveTaskContractIdentity(contract);
  const runId = "90";
  const runAttempt = "1";
  const runIdentity = pipeline.deriveImplementationRunIdentity({taskContractIdentity, runId, runAttempt});
  const expected = {
    task_contract_identity: taskContractIdentity,
    idempotency_identity: contract.idempotency_identity,
    implementation_run_identity: runIdentity,
    implementation_workflow_run_id: runId,
    implementation_workflow_run_attempt: runAttempt,
    candidate_pr_number: 17,
    expected_base_commit: START_COMMIT,
    expected_candidate_commit: CANDIDATE_COMMIT,
    expected_candidate_tree: CANDIDATE_TREE,
    expected_changed_paths: ["app.js"]
  };
  const claim = {
    schema_version: pipeline.EXECUTION_SCHEMA_VERSION,
    claim_identity: pipeline.sha256(`${taskContractIdentity}:${runIdentity}:CLAIM`),
    task_contract_identity: taskContractIdentity,
    idempotency_identity: contract.idempotency_identity,
    implementation_run_identity: runIdentity,
    implementation_workflow_run_id: runId,
    implementation_workflow_run_attempt: runAttempt,
    claimed_at: "2026-08-30T12:00:00Z"
  };
  const implementation = {
    schema_version: pipeline.EXECUTION_SCHEMA_VERSION,
    record_type: "IMPLEMENTATION_DISPATCH",
    task_id: contract.task_id,
    task_contract_identity: taskContractIdentity,
    idempotency_identity: contract.idempotency_identity,
    implementation_run_identity: runIdentity,
    implementation_workflow_run_id: runId,
    implementation_workflow_run_attempt: runAttempt,
    candidate_pr_number: 17,
    base_commit: START_COMMIT,
    candidate_commit: CANDIDATE_COMMIT,
    candidate_tree: CANDIDATE_TREE,
    changed_paths: ["app.js"],
    created_at: "2026-08-30T12:01:00Z"
  };
  const comments = [trustedComment(pipeline.MARKERS.claim, claim), trustedComment(pipeline.MARKERS.implementation, implementation)];
  assert.equal(pipeline.assertImplementationAuthority(comments, expected).implementation.candidate_commit, CANDIDATE_COMMIT);
  assert.throws(() => pipeline.assertImplementationAuthority(comments, {...expected, implementation_workflow_run_attempt: "2"}), /trusted_claim|run_identity/);
  assert.throws(() => pipeline.assertImplementationAuthority([...comments, trustedComment(pipeline.MARKERS.implementation, implementation)], expected), /missing_or_duplicate/);
});

test("validation dispatch authority binds one bot-originated run, attempt, workflow, branch, and candidate", () => {
  const contract = fixtureContract();
  const taskContractIdentity = pipeline.deriveTaskContractIdentity(contract);
  const implementationRunIdentity = pipeline.deriveImplementationRunIdentity({taskContractIdentity, runId: "90", runAttempt: "1"});
  const binding = {
    task_id: contract.task_id,
    task_contract_identity: taskContractIdentity,
    implementation_run_identity: implementationRunIdentity,
    implementation_workflow_run_id: "90",
    implementation_workflow_run_attempt: "1",
    candidate_pr_number: 17,
    candidate_branch: "agent/product-task-sample-v01",
    base_commit: START_COMMIT,
    candidate_commit: CANDIDATE_COMMIT,
    candidate_tree: CANDIDATE_TREE,
    changed_paths: ["app.js"]
  };
  const validationDispatchIdentity = pipeline.deriveValidationDispatchIdentity(binding);
  const record = {
    schema_version: pipeline.EXECUTION_SCHEMA_VERSION,
    record_type: "VALIDATION_DISPATCH",
    validation_dispatch_identity: validationDispatchIdentity,
    ...binding,
    idempotency_identity: contract.idempotency_identity,
    validation_workflow_id: "1234",
    validation_workflow_path: pipeline.VALIDATION_WORKFLOW_PATH,
    validation_workflow_ref: pipeline.VALIDATION_WORKFLOW_REF,
    validation_workflow_run_id: "100",
    validation_workflow_run_attempt: "1",
    validation_actor: {...pipeline.ACTIONS_BOT},
    validation_triggering_actor: {...pipeline.ACTIONS_BOT},
    created_at: "2026-08-30T12:02:00Z"
  };
  const expected = {
    task_id: contract.task_id,
    task_contract_identity: taskContractIdentity,
    idempotency_identity: contract.idempotency_identity,
    implementation_run_identity: implementationRunIdentity,
    implementation_workflow_run_id: "90",
    implementation_workflow_run_attempt: "1",
    validation_dispatch_identity: validationDispatchIdentity,
    workflow_run_id: "100",
    run_attempt: "1",
    validation_actor: pipeline.ACTIONS_BOT.login,
    validation_triggering_actor: pipeline.ACTIONS_BOT.login,
    candidate_pr_number: 17,
    expected_candidate_branch: binding.candidate_branch,
    expected_base_commit: START_COMMIT,
    expected_candidate_commit: CANDIDATE_COMMIT,
    expected_candidate_tree: CANDIDATE_TREE,
    expected_changed_paths: ["app.js"]
  };
  const comment = trustedComment(pipeline.MARKERS.validationDispatch, record);
  assert.equal(pipeline.assertValidationDispatchAuthority([comment], expected).validation_workflow_run_id, "100");
  assert.equal(pipeline.assertValidationDispatchAvailable([], implementationRunIdentity), true);
  assert.throws(() => pipeline.assertValidationDispatchAvailable([comment], implementationRunIdentity), /already_recorded/);
  assert.throws(() => pipeline.assertValidationDispatchAuthority([], expected), /dispatch_missing/);
  assert.throws(() => pipeline.assertValidationDispatchAuthority([comment, comment], expected), /dispatch_duplicate/);
  assert.throws(() => pipeline.assertValidationDispatchAuthority([comment], {...expected, workflow_run_id: "101"}), /binding_mismatch/);
  assert.throws(() => pipeline.assertValidationDispatchAuthority([comment], {...expected, run_attempt: "2"}), /binding_mismatch/);
  assert.throws(() => pipeline.assertValidationDispatchAuthority([comment], {...expected, validation_actor: "wrong-actor"}), /binding_mismatch/);
  assert.throws(() => pipeline.assertValidationDispatchAuthority([comment], {...expected, expected_candidate_branch: "agent/product-task-substituted-v01"}), /binding_mismatch/);
  const wrongActor = structuredClone(record);
  wrongActor.validation_actor = {login: "wrong-actor", id: 1, type: "User"};
  assert.throws(() => pipeline.assertValidationDispatchAuthority([trustedComment(pipeline.MARKERS.validationDispatch, wrongActor)], expected), /binding_mismatch/);
});

test("untrusted comments cannot forge an authoritative duplicate", () => {
  const contract = fixtureContract();
  const comment = trustedComment(pipeline.MARKERS.implementation, {idempotency_identity: contract.idempotency_identity});
  comment.user = {login: "github-actions[bot]", id: 999, type: "Bot"};
  assert.equal(pipeline.assertUniqueExecution([comment], contract.idempotency_identity), true);
});

test("candidate must be one draft branch targeting exact main base", () => {
  const contract = fixtureContract();
  assert.equal(pipeline.validateCandidate(contract, candidate()), true);
  assert.throws(() => pipeline.validateCandidate(contract, candidate({draft: false})), /not_draft/);
  assert.throws(() => pipeline.validateCandidate(contract, candidate({candidate_branch: "main"})), /candidate_branch_invalid/);
  assert.throws(() => pipeline.validateCandidate(contract, candidate({base_commit: "8".repeat(40)})), /candidate_base_mismatch/);
});

test("candidate changed-file and patch ceilings are enforced", () => {
  const contract = fixtureContract();
  assert.throws(() => pipeline.validateCandidate(contract, candidate({changed_paths: ["app.js", "other.js"]})), /changed_paths_invalid|file_limit|path_not_allowed/);
  assert.throws(() => pipeline.validateCandidate(contract, candidate({patch_bytes: contract.maximum_patch_bytes + 1})), /patch_limit_exceeded/);
});

test("candidate cannot modify a path outside the exact task list", () => {
  assert.throws(() => pipeline.validateCandidate(fixtureContract(), candidate({changed_paths: ["core-v08.js"]})), /path_not_allowed/);
  const helper = fs.readFileSync(path.join(ROOT, "scripts/product-task-pipeline-v01.js"), "utf8");
  assert.match(helper, /"--name-only", "--no-renames"/);
  assert.doesNotMatch(helper, /--diff-filter/);
});

test("pre-mutation gate accepts only passing creator evidence and exactly two authorized requests", () => {
  const contract = fixtureContract();
  const taskContractIdentity = pipeline.deriveTaskContractIdentity(contract);
  const implementationWorkflowRunId = "90";
  const implementationWorkflowRunAttempt = "1";
  const implementationRunIdentity = pipeline.deriveImplementationRunIdentity({taskContractIdentity, runId: implementationWorkflowRunId, runAttempt: implementationWorkflowRunAttempt});
  const creator = {
    schema_version: "league-vector.product-task-creator-evidence/v0.1",
    task_contract_identity: taskContractIdentity,
    implementation_run_identity: implementationRunIdentity,
    implementation_workflow_run_id: implementationWorkflowRunId,
    implementation_workflow_run_attempt: implementationWorkflowRunAttempt,
    candidate: candidate(),
    commands: pipeline.REQUIRED_COMMANDS.map((command) => ({command, exit_code: 0, started_at: "2026-08-30T12:00:00Z", ended_at: "2026-08-30T12:00:01Z", test_count: "UNKNOWN"})),
    started_at: "2026-08-30T12:00:00Z",
    ended_at: "2026-08-30T12:01:00Z",
    overall: "PASS"
  };
  const expected = {task_contract_identity: taskContractIdentity, implementation_run_identity: implementationRunIdentity, implementation_workflow_run_id: implementationWorkflowRunId, implementation_workflow_run_attempt: implementationWorkflowRunAttempt};
  assert.equal(pipeline.validateCreatorEvidence(contract, creator, expected), true);
  const failed = structuredClone(creator);
  failed.commands[0].exit_code = 1;
  failed.overall = "FAIL";
  assert.throws(() => pipeline.validateCreatorEvidence(contract, failed, expected), /command_failed|not_pass/);
  assert.equal(pipeline.validateSafeOutputRequests({items: [{type: "create_pull_request"}, {type: "dispatch_validation", confirmation: true}]}), true);
  assert.throws(() => pipeline.validateSafeOutputRequests({items: [{type: "create_pull_request"}, {type: "dispatch_validation", confirmation: false}]}), /request_set_invalid/);
  assert.throws(() => pipeline.validateSafeOutputRequests({items: [{type: "create_pull_request"}, {type: "dispatch_validation", confirmation: true}, {type: "create_pull_request"}]}), /request_count_invalid/);
});

test("objective cannot request credentials, merge, deployment, release, payment, rights, or customer delivery", () => {
  for (const word of ["credential", "merge", "deployment", "release", "payment", "source rights", "customer delivery", "Router control", "MLP"]) {
    const contract = fixtureContract({objective: `Perform ${word} for this product task.`});
    assert.throws(() => pipeline.validateTaskContract(contract, {now: FIXED_NOW}), /objective_requests_prohibited_action/);
  }
});

test("deterministic evidence binds exact base, head, tree, paths, commands, and run", () => {
  assert.equal(pipeline.validateDeterministicEvidence(evidence(), expectedEvidenceBinding()), true);
  assert.throws(() => pipeline.validateDeterministicEvidence(evidence({observed_candidate_tree: "7".repeat(40)}), expectedEvidenceBinding()), /false_pass/);
  assert.throws(() => pipeline.validateDeterministicEvidence(evidence({workflow_run_id: "101"}), expectedEvidenceBinding()), /workflow_run_id_mismatch/);
});

test("failed commands cannot be reported as deterministic PASS", () => {
  const bad = evidence();
  bad.command_results[1].exit_code = 1;
  assert.throws(() => pipeline.validateDeterministicEvidence(bad, expectedEvidenceBinding()), /false_pass/);
});

test("candidate movement between validation and QA becomes BLOCKED", () => {
  const state = pipeline.reconcileState({
    validationRecords: [{candidate_commit: CANDIDATE_COMMIT, candidate_tree: CANDIDATE_TREE, overall: "PASS"}],
    qaRecords: [{candidate_commit: "7".repeat(40), candidate_tree: CANDIDATE_TREE, status: "PASS"}],
    candidateCommit: CANDIDATE_COMMIT,
    candidateTree: CANDIDATE_TREE
  });
  assert.deepEqual(state, {state: "BLOCKED", reason: "candidate_moved_after_qa"});
});

test("exact deterministic PASS is only READY_FOR_QA, never terminal acceptance", () => {
  const state = pipeline.reconcileState({
    validationRecords: [{candidate_commit: CANDIDATE_COMMIT, candidate_tree: CANDIDATE_TREE, overall: "PASS"}],
    qaRecords: [],
    candidateCommit: CANDIDATE_COMMIT,
    candidateTree: CANDIDATE_TREE
  });
  assert.deepEqual(state, {state: "READY_FOR_QA", reason: "exact_validation_pass"});
  const helper = fs.readFileSync(path.join(ROOT, "scripts/product-task-pipeline-v01.js"), "utf8");
  assert.ok(helper.indexOf("p.MARKERS.status, status") < helper.indexOf("dispatchWorkflow(\"product-task-pipeline-v01-qa.yml\""));
});

test("fresh QA PASS requires exactly P0=0 and P1=0", () => {
  const pass = {schema_version: pipeline.QA_SCHEMA_VERSION, status: "PASS", p0_count: 0, p1_count: 0, findings: [], limitations: ""};
  assert.equal(pipeline.qaAcceptance(pass), true);
  assert.throws(() => pipeline.qaAcceptance({...pass, p1_count: 1}), /pass_threshold_not_met/);
  assert.equal(pipeline.qaAcceptance({...pass, status: "FAIL", p1_count: 1}), false);
  assert.equal(pipeline.qaAcceptance({...pass, status: "BLOCKED", p0_count: "UNKNOWN", p1_count: "UNKNOWN"}), false);
});

test("terminal FAIL and BLOCKED propagate without false-green acceptance", () => {
  for (const status of ["FAIL", "BLOCKED"]) {
    const state = pipeline.reconcileState({
      validationRecords: [],
      qaRecords: [{candidate_commit: CANDIDATE_COMMIT, candidate_tree: CANDIDATE_TREE, status}],
      candidateCommit: CANDIDATE_COMMIT,
      candidateTree: CANDIDATE_TREE
    });
    assert.equal(state.state, status);
  }
});

test("accepted true exists only in the final post-artifact authoritative transition", () => {
  const qaWorkflow = fs.readFileSync(QA_PATH, "utf8");
  const helper = fs.readFileSync(path.join(ROOT, "scripts/product-task-pipeline-v01.js"), "utf8");
  assert.ok(qaWorkflow.indexOf("Upload exact terminal receipt") < qaWorkflow.indexOf("  terminal:"));
  assert.ok(qaWorkflow.indexOf("  terminal:") < qaWorkflow.indexOf("  finalize_acceptance:"));
  assert.ok(qaWorkflow.indexOf("finalize_acceptance:") < qaWorkflow.indexOf("finalize-qa-acceptance"));
  assert.equal((helper.match(/accepted: true/g) || []).length, 1);
  const persistence = helper.slice(helper.indexOf("async function persistQa"), helper.indexOf("async function finalizeQaAcceptance"));
  assert.doesNotMatch(persistence, /accepted:\s*true/);
  assert.match(persistence, /accepted:\s*false/);
  assert.match(helper, /qa_finalize_terminal_artifact_missing_or_duplicate/);
  assert.match(helper, /await writeRecord\(expected\.contract_issue_number, p\.MARKERS\.status, acceptance, "status_identity"\);\n\}/);
});

test("transport failures remain distinct from task failures", () => {
  assert.equal(pipeline.classifyFailure(new Error("github_api_transport_503")), "TRANSPORT_FAILURE");
  assert.equal(pipeline.classifyFailure(new Error("creator_tests_failed")), "TASK_FAILURE");
});

test("implementation run identity binds contract and one workflow attempt", () => {
  const identity = pipeline.deriveImplementationRunIdentity({taskContractIdentity: "a".repeat(64), runId: "9", runAttempt: "1"});
  assert.match(identity, /^[0-9a-f]{64}$/);
  assert.notEqual(identity, pipeline.deriveImplementationRunIdentity({taskContractIdentity: "a".repeat(64), runId: "9", runAttempt: "2"}));
});

test("agentic source is manual-only bootstrap-safe and requests one draft PR", () => {
  const source = fs.readFileSync(SOURCE_PATH, "utf8");
  const eventBlock = source.slice(source.indexOf("on:\n"), source.indexOf("\n\npermissions:"));
  assert.match(source, /on:\n  workflow_dispatch:/);
  assert.doesNotMatch(eventBlock, /\n  (?:push|schedule|issues|pull_request):/);
  assert.match(source, /create-pull-request:\n    max: 1\n    draft: true\n    base-branch: main/);
  assert.match(source, /dispatch-validation:/);
  assert.doesNotMatch(source, /push-to-pull-request-branch:/);
});

test("agentic source has read-only agent permissions and bounded cost and patch limits", () => {
  const source = fs.readFileSync(SOURCE_PATH, "utf8");
  assert.match(source, /permissions:\n  contents: read\n  issues: read\n  pull-requests: read\n  actions: read/);
  assert.match(source, /max-ai-credits: 1000/);
  assert.match(source, /max-patch-size: 512/);
  assert.match(source, /max-patch-files: 20/);
  assert.match(source, /protected-files: blocked/);
});

test("repository-writing safe outputs require verifier success and exact bundle allowlist validation", () => {
  const source = fs.readFileSync(SOURCE_PATH, "utf8");
  const lock = fs.readFileSync(LOCK_PATH, "utf8");
  const helper = fs.readFileSync(path.join(ROOT, "scripts/product-task-pipeline-v01.js"), "utf8");
  assert.match(source, /safe_outputs:\n    if: \$\{\{ needs\.agent\.result == 'success' && needs\.detection\.result == 'success' \}\}/);
  assert.match(source, /Download the immutable agent artifact before any repository mutation/);
  assert.match(source, /safe-output-gate/);
  assert.match(helper, /bundle", "verify"/);
  assert.match(helper, /p\.validateCandidate\(state\.contract, bundledCandidate\)/);
  assert.match(helper, /safe_output_bundle_creator_evidence_mismatch/);
  assert.match(helper, /"merge-base", "--is-ancestor"/);
  assert.match(helper, /remote_candidate_not_descended_from_starting_commit/);
  assert.match(lock, /needs\.agent\.result == 'success'/);
  assert.ok(lock.indexOf("Enforce the exact task allowed-files boundary on the immutable bundle") < lock.indexOf("persist-credentials: true"));
  assert.ok(lock.indexOf("Enforce the exact task allowed-files boundary on the immutable bundle") < lock.indexOf("Process Safe Outputs"));
});

test("exact-head validation uses immutable base verifier and four exact commands", () => {
  const workflow = fs.readFileSync(VALIDATION_PATH, "utf8");
  const qaWorkflow = fs.readFileSync(QA_PATH, "utf8");
  const helper = fs.readFileSync(path.join(ROOT, "scripts/product-task-pipeline-v01.js"), "utf8");
  assert.match(workflow, /ref: \$\{\{ inputs\.expected_candidate_commit \}\}/);
  assert.match(workflow, /git show "\$EXPECTED_BASE_COMMIT:scripts\/product-task-pipeline-v01\.js"/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /implementation_workflow_run_attempt:/);
  assert.match(workflow, /validation_dispatch_identity:/);
  assert.match(workflow, /expected_candidate_branch:/);
  assert.match(qaWorkflow, /deterministic_workflow_run_attempt:/);
  assert.match(qaWorkflow, /validation_dispatch_identity:/);
  assert.match(qaWorkflow, /expected_candidate_branch:/);
  assert.match(helper, /p\.assertImplementationAuthority/);
  assert.match(helper, /implementation_workflow_run_provenance_mismatch/);
  assert.match(helper, /return_run_details = true/);
  assert.match(helper, /validation_dispatch_workflow_run_provenance_mismatch/);
  assert.match(helper, /p\.assertValidationDispatchAvailable/);
  assert.match(helper, /waitForValidationDispatchAuthority/);
  assert.match(helper, /validation_workflow_run_provenance_mismatch/);
  const exactValidation = helper.slice(helper.indexOf("async function exactHeadValidate"), helper.indexOf("async function persistValidation"));
  assert.ok(exactValidation.indexOf("waitForValidationDispatchAuthority") < exactValidation.indexOf("runRequiredCommands()"));
  assert.ok(exactValidation.indexOf("verifyValidationWorkflowRun") < exactValidation.indexOf("runRequiredCommands()"));
  assert.match(helper, /runRequiredCommands\(\)/);
  assert.deepEqual([...pipeline.REQUIRED_COMMANDS], ["npm ci", "npm run validate", "npx playwright install --with-deps chromium", "npm run test:e2e"]);
});

test("separate QA actor is read-only, schema-bound, and cannot self-remediate", () => {
  const workflow = fs.readFileSync(QA_PATH, "utf8");
  assert.match(workflow, /permission-profile: ":read-only"/);
  assert.match(workflow, /allow-bot-users: github-actions\[bot\]/);
  assert.match(workflow, /codex-version: "0\.147\.0"/);
  assert.match(workflow, /model: gpt-5\.4-mini/);
  assert.match(workflow, /permissions:\n      contents: read\n    outputs:/);
  assert.match(workflow, /Restore immutable QA schema from the admitted base/);
  assert.doesNotMatch(workflow, /pull-requests: write/);
  assert.doesNotMatch(workflow, /contents: write/);
});

test("every action use, including generated gh-aw setup, is immutable-SHA pinned", () => {
  const workflows = [SOURCE_PATH, LOCK_PATH, VALIDATION_PATH, QA_PATH].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  for (const use of workflows.matchAll(/uses:\s+([^\s#]+)/g)) {
    assert.match(use[1], /@[0-9a-f]{40}$/);
  }
  assert.match(workflows, /github\/gh-aw-actions\/setup@6aab9e5b5c91c615506061f09bedd81a23babe3c/);
  const ordinary = [VALIDATION_PATH, QA_PATH].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(ordinary, /GH_AW_CI_TRIGGER_TOKEN|personal.access.token|PAT_/i);
  assert.match(ordinary, /secrets\.OPENAI_API_KEY/);
});

test("all protocol schemas parse and reject unspecified object properties", () => {
  for (const name of ["task-contract.schema.json", "deterministic-evidence.schema.json", "qa-result.schema.json"]) {
    const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "protocol/product-task-pipeline-v01", name), "utf8"));
    assert.equal(schema.type, "object");
    assert.equal(schema.additionalProperties, false);
  }
});

test("deterministic evidence schema binds validation dispatch, actor, workflow, and candidate branch", () => {
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "protocol/product-task-pipeline-v01/deterministic-evidence.schema.json"), "utf8"));
  for (const field of ["validation_dispatch_identity", "expected_candidate_branch", "validation_actor", "validation_triggering_actor", "validation_workflow_path", "validation_workflow_ref", "validation_workflow_sha", "validation_event_name"]) {
    assert.ok(schema.required.includes(field), field);
    assert.ok(schema.properties[field], field);
  }
});

test("official compiler manifest binds exact source and compiled lock bytes", () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  assert.equal(pipeline.validateCompilerManifestBytes(manifest, fs.readFileSync(SOURCE_PATH), fs.readFileSync(LOCK_PATH)), true);
  assert.equal(manifest.gh_aw_version, "v0.86.2");
  assert.equal(manifest.compiler_commit, "48e5fa3ff52294d91d97715017a9f8693a48387f");
});

test("stale or tampered compiled workflow bytes fail closed", () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const source = fs.readFileSync(SOURCE_PATH);
  const lock = Buffer.concat([fs.readFileSync(LOCK_PATH), Buffer.from("# tampered\n")]);
  assert.throws(() => pipeline.validateCompilerManifestBytes(manifest, source, lock), /compiled_lock_stale_or_mismatched/);
});

test("private handoff names only the approved boundary and stays non-canonical", () => {
  assert.deepEqual(pipeline.privateHandoffArtifact({state: "PASS"}), {
    schema_version: "league-vector.private-research-system-handoff/v0.1",
    destination: "PRIVATE RESEARCH SYSTEM",
    canonical_ingestion: "NOT_AUTHORIZED",
    state: "PASS"
  });
});
