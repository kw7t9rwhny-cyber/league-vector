"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const researchSource = fs.readFileSync(path.join(root, ".github/workflows/stage3c-research-worker.md"), "utf8");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const REPO = "kw7t9rwhny-cyber/league-vector";
const TITLE = "AGENT SPIKE TEST — harmless two-worker handoff";
const REVISION = "stage3c-v0.1-r6";
const RUN_ID = 9106;
const RUN_NUMBER = 16;

function extractScript(stepName, endMarker) {
  const startMarker = `      - name: ${stepName}`;
  const stepStart = researchSource.indexOf(startMarker);
  assert.notEqual(stepStart, -1, `${stepName} must exist in production source`);
  const scriptMarker = "          script: |\n";
  const scriptStart = researchSource.indexOf(scriptMarker, stepStart);
  assert.notEqual(scriptStart, -1, `${stepName} production script must exist`);
  const bodyStart = scriptStart + scriptMarker.length;
  const bodyEnd = researchSource.indexOf(endMarker, bodyStart);
  assert.notEqual(bodyEnd, -1, `${stepName} script boundary must remain identifiable`);
  const lines = researchSource.slice(bodyStart, bodyEnd).split("\n");
  assert.ok(lines.every((line) => line === "" || line.startsWith("            ")), `${stepName} indentation changed`);
  return lines.map((line) => line.startsWith("            ") ? line.slice(12) : line).join("\n");
}

const completionScript = extractScript("Prove durable authoritative Research result", "\nif: needs.pre_activation.outputs.exact_transition_result");
const completion = new AsyncFunction("core", "context", "github", "process", completionScript);

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

function resultBody({ runId = RUN_ID, runNumber = RUN_NUMBER, revision = REVISION, observed = "exists" } = {}) {
  return [
    "STAGE3C_RESEARCH_RESULT v0.1",
    "worker_role: research-worker-a",
    "fixture_issue: 53",
    `fixture_revision: ${revision}`,
    `research_run_id: ${runId}`,
    `research_run_number: ${runNumber}`,
    "repository_source_path: docs/ARCHITECTURE.md",
    `observed_fact: ${observed}`,
    "completion_status: complete",
  ].join("\n");
}

async function executeCompletion(comments, issueBody = fixtureBody()) {
  let failure = null;
  const infos = [];
  const core = { setFailed: (m) => { failure = String(m); }, info: (m) => infos.push(String(m)) };
  const context = { repo: { owner: "kw7t9rwhny-cyber", repo: "league-vector" }, runId: RUN_ID, runNumber: RUN_NUMBER };
  const github = {
    rest: { issues: { get: async () => ({ data: { number: 53, title: TITLE, body: issueBody } }), listComments: async () => { throw new Error("paginate required"); } } },
    paginate: async () => comments,
  };
  await completion(core, context, github, { env: { GITHUB_RUN_ATTEMPT: "1" } });
  if (failure) return { accepted: false, reason: failure.replace("stage3c_research_completion_denied:", "") };
  return { accepted: true, infos };
}

test("actual-style fixture body keeps authoritative eligibility field unambiguous", () => {
  const ready = fixtureBody("READY");
  const dormant = fixtureBody("DORMANT");
  const canonical = (body) => [...body.matchAll(/^Eligibility: ([^\r\n]+)$/gm)].map((m) => m[1]);
  assert.deepEqual(canonical(ready), ["READY"]);
  assert.deepEqual(canonical(dormant), ["DORMANT"]);
  assert.ok(ready.split("Eligibility: READY").length - 1 > 1, "regression fixture must retain historical/procedural literal text");
  assert.ok(researchSource.includes("Those deterministic authority findings are authoritative; do not independently re-derive eligibility by counting literal text elsewhere in Issue prose."));
  assert.doesNotMatch(researchSource, /`Eligibility: READY` occurs exactly once/);
});

test("producer success path requires one durable canonical current-run result", async () => {
  const comment = { user: { login: "github-actions[bot]", type: "Bot" }, body: resultBody() };
  assert.equal((await executeCompletion([comment])).accepted, true);
});

test("producer success path rejects zero or duplicate current-run results", async () => {
  assert.deepEqual(await executeCompletion([]), { accepted: false, reason: "missing_or_duplicate_research_result" });
  const comment = { user: { login: "github-actions[bot]", type: "Bot" }, body: resultBody() };
  assert.deepEqual(await executeCompletion([comment, { ...comment }]), { accepted: false, reason: "missing_or_duplicate_research_result" });
});

test("producer success path rejects malformed current-run result", async () => {
  const malformed = { user: { login: "github-actions[bot]", type: "Bot" }, body: resultBody({ observed: "present" }) };
  assert.deepEqual(await executeCompletion([malformed]), { accepted: false, reason: "malformed_observed_fact" });
});

test("producer success path rejects wrong or stale run identity", async () => {
  const wrongId = { user: { login: "github-actions[bot]", type: "Bot" }, body: resultBody({ runId: RUN_ID - 1 }) };
  assert.deepEqual(await executeCompletion([wrongId]), { accepted: false, reason: "missing_or_duplicate_research_result" });
  const wrongNumber = { user: { login: "github-actions[bot]", type: "Bot" }, body: resultBody({ runNumber: RUN_NUMBER - 1 }) };
  assert.deepEqual(await executeCompletion([wrongNumber]), { accepted: false, reason: `malformed_research_result:research_run_number: ${RUN_NUMBER}` });
  const staleRevision = { user: { login: "github-actions[bot]", type: "Bot" }, body: resultBody({ revision: "stage3c-v0.1-r5" }) };
  assert.deepEqual(await executeCompletion([staleRevision]), { accepted: false, reason: `malformed_research_result:fixture_revision: ${REVISION}` });
});
