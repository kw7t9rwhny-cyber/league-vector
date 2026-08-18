"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const researchSource = read(".github/workflows/stage3c-research-worker.md");
const qaSource = read(".github/workflows/stage3c-qa-worker.md");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const REPO = "kw7t9rwhny-cyber/league-vector";
const TITLE = "AGENT SPIKE TEST — harmless two-worker handoff";
const REVISION = "stage3c-v0.1-r6";
const RESEARCH_RUN_ID = 9001;
const RESEARCH_RUN_NUMBER = 12;
const RESEARCH_HEAD_SHA = "0123456789abcdef0123456789abcdef01234567";
const QA_RUN_ID = 9106;
const QA_RUN_NUMBER = 16;
const ACTIONS_BOT = Object.freeze({ login: "github-actions[bot]", type: "Bot" });

function extractScript(source, stepName, startIndent, endMarker) {
  const startMarker = `${" ".repeat(startIndent)}- name: ${stepName}`;
  const stepStart = source.indexOf(startMarker);
  assert.notEqual(stepStart, -1, `${stepName} must exist in production source`);
  const scriptIndent = " ".repeat(startIndent + 4);
  const scriptMarker = `${scriptIndent}script: |\n`;
  const scriptStart = source.indexOf(scriptMarker, stepStart);
  assert.notEqual(scriptStart, -1, `${stepName} production script must exist`);
  const bodyStart = scriptStart + scriptMarker.length;
  const bodyEnd = source.indexOf(endMarker, bodyStart);
  assert.notEqual(bodyEnd, -1, `${stepName} script boundary must remain identifiable`);
  const bodyIndent = " ".repeat(startIndent + 6);
  const lines = source.slice(bodyStart, bodyEnd).split("\n");
  assert.ok(lines.every((line) => line === "" || line.startsWith(bodyIndent)), `${stepName} indentation changed`);
  return lines.map((line) => line.startsWith(bodyIndent) ? line.slice(bodyIndent.length) : line).join("\n");
}

const researchCompletion = new AsyncFunction("core", "context", "github", "process",
  extractScript(researchSource, "Prove durable authoritative Research result", 6, "\nif: needs.pre_activation.outputs.exact_transition_result"));
const qaPreActivation = new AsyncFunction("core", "context", "github", "process",
  extractScript(qaSource, "Prove authoritative Research completion and durable handoff", 4, "\njobs:\n  conclusion:"));
const qaCompletion = new AsyncFunction("core", "context", "github", "process",
  extractScript(qaSource, "Prove durable authoritative QA result", 6, "\nif: needs.pre_activation.outputs.research_authority_result"));

function fixtureBody(state = "READY") {
  return [
    "# Stage 3C isolated fixture",
    "",
    `Fixture revision: ${REVISION}`,
    "",
    `Eligibility: ${state}`,
    "",
    "Historical note: an older attempt changed Eligibility: DORMANT to Eligibility: READY.",
    "Future rule: only an authorized Eligibility: DORMANT to Eligibility: READY edit may activate this revision.",
    "",
  ].join("\n");
}

function researchBody({ runId = RESEARCH_RUN_ID, runNumber = RESEARCH_RUN_NUMBER, revision = REVISION } = {}) {
  return [
    "STAGE3C_RESEARCH_RESULT v0.1",
    "worker_role: research-worker-a",
    "fixture_issue: 53",
    `fixture_revision: ${revision}`,
    `research_run_id: ${runId}`,
    `research_run_number: ${runNumber}`,
    "repository_source_path: docs/ARCHITECTURE.md",
    "observed_fact: exists",
    "completion_status: complete",
  ].join("\n");
}

function qaBody({ disposition = "PASS", qaRunId = QA_RUN_ID, qaRunNumber = QA_RUN_NUMBER, researchRunId = RESEARCH_RUN_ID, researchRunNumber = RESEARCH_RUN_NUMBER, researchHeadSha = RESEARCH_HEAD_SHA, revision = REVISION, observed = "exists", verdict = disposition } = {}) {
  return [
    `STAGE3C_QA_RESULT v0.1 — ${disposition}`,
    "worker_role: qa-worker-b",
    "fixture_issue: 53",
    `fixture_revision: ${revision}`,
    `qa_run_id: ${qaRunId}`,
    `qa_run_number: ${qaRunNumber}`,
    `research_run_id: ${researchRunId}`,
    `research_run_number: ${researchRunNumber}`,
    `research_head_sha: ${researchHeadSha}`,
    "repository_source_path: docs/ARCHITECTURE.md",
    `independent_observed_fact: ${observed}`,
    `verdict: ${verdict}`,
  ].join("\n");
}

function workflowRun(overrides = {}) {
  return {
    id: RESEARCH_RUN_ID,
    run_number: RESEARCH_RUN_NUMBER,
    run_attempt: 1,
    name: "Stage 3C Research Worker A",
    path: ".github/workflows/stage3c-research-worker.lock.yml",
    event: "issues",
    head_branch: "main",
    head_sha: RESEARCH_HEAD_SHA,
    conclusion: "success",
    repository: { full_name: REPO, fork: false },
    run_started_at: "2026-08-18T00:00:00Z",
    updated_at: "2026-08-18T00:05:00Z",
    ...overrides,
  };
}

function comment(body, user = ACTIONS_BOT, created_at = "2026-08-18T00:02:00Z") { return { body, user, created_at }; }

function githubMock(issueBody, comments) {
  return {
    rest: { issues: { get: async () => ({ data: { number: 53, title: TITLE, body: issueBody } }), listComments: async () => { throw new Error("paginate required"); } } },
    paginate: async () => comments,
  };
}

async function execute(script, { comments, issueBody = fixtureBody(), wr = workflowRun(), runId = QA_RUN_ID, runNumber = QA_RUN_NUMBER, attempt = "1", expectedRepository = false } = {}) {
  let failure = null;
  const infos = [];
  const core = { setFailed: (m) => { failure = String(m); }, info: (m) => infos.push(String(m)) };
  const context = { repo: { owner: "kw7t9rwhny-cyber", repo: "league-vector" }, payload: { workflow_run: wr }, runId, runNumber };
  const env = { GITHUB_RUN_ATTEMPT: attempt };
  if (expectedRepository) env.EXPECTED_REPOSITORY = REPO;
  await script(core, context, githubMock(issueBody, comments), { env });
  return { accepted: failure === null, failure, infos };
}

async function completionOutcome(comments, overrides = {}) {
  const out = await execute(qaCompletion, { comments, ...overrides });
  if (out.accepted) return { accepted: true, infos: out.infos };
  const prefix = "stage3c_qa_completion_denied:";
  assert.ok(out.failure.startsWith(prefix), out.failure);
  return { accepted: false, reason: out.failure.slice(prefix.length) };
}

test("Worker B completion accepts one authoritative QA PASS and one authoritative QA FAIL", async () => {
  for (const disposition of ["PASS", "FAIL"]) {
    const out = await completionOutcome([comment(qaBody({ disposition }))]);
    assert.equal(out.accepted, true);
    assert.deepEqual(out.infos, [`stage3c_qa_completion_verified:qa_run_id=${QA_RUN_ID}:verdict=${disposition}`]);
  }
});

test("Worker B completion rejects zero, report_incomplete-equivalent zero, and duplicate QA results", async () => {
  assert.deepEqual(await completionOutcome([]), { accepted: false, reason: "missing_or_duplicate_qa_result" });
  assert.deepEqual(await completionOutcome([]), { accepted: false, reason: "missing_or_duplicate_qa_result" });
  const valid = comment(qaBody());
  assert.deepEqual(await completionOutcome([valid, { ...valid }]), { accepted: false, reason: "missing_or_duplicate_qa_result" });
});

test("Worker B completion rejects malformed marker and terminal fields", async () => {
  assert.deepEqual(await completionOutcome([comment(qaBody().replace("STAGE3C_QA_RESULT v0.1 — PASS", "STAGE3C_QA_RESULT v0.2 — PASS"))]), { accepted: false, reason: "malformed_qa_result_marker" });
  assert.deepEqual(await completionOutcome([comment(`${qaBody()}\nverdict: FAIL`)]), { accepted: false, reason: "malformed_or_contradictory_verdict" });
  assert.deepEqual(await completionOutcome([comment(`${qaBody()}\nSTAGE3C_QA_RESULT v0.1 — FAIL`)]), { accepted: false, reason: "malformed_qa_result_marker" });
  assert.deepEqual(await completionOutcome([comment(qaBody({ observed: "present" }))]), { accepted: false, reason: "malformed_independent_observed_fact" });
});

test("Worker B completion rejects wrong QA run identity", async () => {
  assert.deepEqual(await completionOutcome([comment(qaBody({ qaRunId: QA_RUN_ID - 1 }))]), { accepted: false, reason: "missing_or_duplicate_qa_result" });
  assert.deepEqual(await completionOutcome([comment(qaBody({ qaRunNumber: QA_RUN_NUMBER - 1 }))]), { accepted: false, reason: `malformed_qa_result:qa_run_number: ${QA_RUN_NUMBER}` });
  assert.deepEqual(await completionOutcome([comment(qaBody())], { attempt: "2" }), { accepted: false, reason: "replayed_run" });
});

test("Worker B completion rejects wrong Research parent correlation", async () => {
  assert.deepEqual(await completionOutcome([comment(qaBody({ researchRunId: RESEARCH_RUN_ID - 1 }))]), { accepted: false, reason: `malformed_qa_result:research_run_id: ${RESEARCH_RUN_ID}` });
  assert.deepEqual(await completionOutcome([comment(qaBody({ researchRunNumber: RESEARCH_RUN_NUMBER - 1 }))]), { accepted: false, reason: `malformed_qa_result:research_run_number: ${RESEARCH_RUN_NUMBER}` });
  assert.deepEqual(await completionOutcome([comment(qaBody({ researchHeadSha: "f".repeat(40) }))]), { accepted: false, reason: `malformed_qa_result:research_head_sha: ${RESEARCH_HEAD_SHA}` });
});

test("Worker B completion rejects stale fixture and untrusted result author", async () => {
  assert.deepEqual(await completionOutcome([comment(qaBody({ revision: "stage3c-v0.1-r5" }))]), { accepted: false, reason: `malformed_qa_result:fixture_revision: ${REVISION}` });
  assert.deepEqual(await completionOutcome([comment(qaBody(), { login: "founder", type: "User" })]), { accepted: false, reason: "qa_result_not_actions_safe_output" });
  assert.deepEqual(await completionOutcome([comment(qaBody())], { issueBody: fixtureBody("DORMANT") }), { accepted: false, reason: "fixture_not_ready" });
});

test("end-to-end deterministic composition reaches and proves Worker B terminal durability", async () => {
  const issueBody = fixtureBody("READY");
  const research = comment(researchBody());
  const a = await execute(researchCompletion, { comments: [research], issueBody, wr: workflowRun(), runId: RESEARCH_RUN_ID, runNumber: RESEARCH_RUN_NUMBER });
  assert.equal(a.accepted, true, a.failure);

  const bPre = await execute(qaPreActivation, { comments: [research], issueBody, wr: workflowRun(), expectedRepository: true });
  assert.equal(bPre.accepted, true, bPre.failure);
  assert.deepEqual(bPre.infos, [`stage3c_qa_activation_authorized:research_run_id=${RESEARCH_RUN_ID}`]);

  const qa = comment(qaBody({ disposition: "PASS" }));
  const bDone = await completionOutcome([research, qa], { issueBody, wr: workflowRun() });
  assert.equal(bDone.accepted, true);
});
