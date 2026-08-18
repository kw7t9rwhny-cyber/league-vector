"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const researchSource = read(".github/workflows/stage3c-research-worker.md");
const qaSource = read(".github/workflows/stage3c-qa-worker.md");

const REPO = "kw7t9rwhny-cyber/league-vector";
const ISSUE = 53;
const TITLE = "AGENT SPIKE TEST — harmless two-worker handoff";
const REVISION = "stage3c-v0.1-r5";
const SOURCE_PATH = "docs/ARCHITECTURE.md";
const MARKER = "STAGE3C_RESEARCH_RESULT v0.1";
const WORKFLOW_NAME = "Stage 3C Research Worker A";
const WORKFLOW_PATH = ".github/workflows/stage3c-research-worker.lock.yml";
const ACTIONS_BOT = Object.freeze({ login: "github-actions[bot]", type: "Bot" });
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function extractProductionConsumerScript() {
  const startMarker = "    - name: Prove authoritative Research completion and durable handoff";
  const stepStart = qaSource.indexOf(startMarker);
  assert.notEqual(stepStart, -1, "Worker B production handoff-validation step must exist");

  const scriptMarker = "        script: |\n";
  const scriptStart = qaSource.indexOf(scriptMarker, stepStart);
  assert.notEqual(scriptStart, -1, "Worker B production validator script must exist");

  const bodyStart = scriptStart + scriptMarker.length;
  const bodyEnd = qaSource.indexOf("\nif: needs.pre_activation.outputs.research_authority_result", bodyStart);
  assert.notEqual(bodyEnd, -1, "Worker B production validator script boundary must remain mechanically identifiable");

  const indented = qaSource.slice(bodyStart, bodyEnd);
  const lines = indented.split("\n");
  assert.ok(lines.every((line) => line === "" || line.startsWith("          ")), "Worker B production validator indentation changed");
  return lines.map((line) => line.startsWith("          ") ? line.slice(10) : line).join("\n");
}

const productionConsumerScript = extractProductionConsumerScript();
const productionConsumer = new AsyncFunction("core", "context", "github", "process", productionConsumerScript);

function canonicalResearchBody({
  runId = 32082361085,
  runNumber = 8,
  observed = "exists",
  fixtureIssue = ISSUE,
  revision = REVISION,
  sourcePath = SOURCE_PATH,
} = {}) {
  return [
    MARKER,
    "worker_role: research-worker-a",
    `fixture_issue: ${fixtureIssue}`,
    `fixture_revision: ${revision}`,
    `research_run_id: ${runId}`,
    `research_run_number: ${runNumber}`,
    `repository_source_path: ${sourcePath}`,
    `observed_fact: ${observed}`,
    "completion_status: complete",
  ].join("\n");
}

function baseFixture(overrides = {}) {
  const workflowRun = {
    id: 9001,
    run_number: 12,
    run_attempt: 1,
    name: WORKFLOW_NAME,
    path: WORKFLOW_PATH,
    event: "issues",
    head_branch: "main",
    conclusion: "success",
    repository: { full_name: REPO, fork: false },
    run_started_at: "2026-08-18T00:00:00Z",
    updated_at: "2026-08-18T00:05:00Z",
    ...overrides.workflowRun,
  };
  const issue = {
    number: ISSUE,
    title: TITLE,
    body: `Fixture revision: ${REVISION}\n\nEligibility: READY\n`,
    ...overrides.issue,
  };
  const result = {
    user: ACTIONS_BOT,
    created_at: "2026-08-18T00:02:00Z",
    body: canonicalResearchBody({ runId: workflowRun.id, runNumber: workflowRun.run_number }),
    ...overrides.result,
  };
  return {
    workflowRun,
    issue,
    comments: overrides.comments || [result],
    result,
    repositoryContext: overrides.repositoryContext || { owner: "kw7t9rwhny-cyber", repo: "league-vector" },
  };
}

async function executeProductionConsumer(fixture) {
  let failure = null;
  const infos = [];
  const core = {
    setFailed(message) {
      failure = String(message);
    },
    info(message) {
      infos.push(String(message));
    },
  };
  const context = {
    repo: fixture.repositoryContext,
    payload: { workflow_run: fixture.workflowRun },
  };
  const github = {
    rest: {
      issues: {
        async get() {
          return { data: fixture.issue };
        },
        async listComments() {
          throw new Error("production validator should call listComments through github.paginate");
        },
      },
    },
    async paginate() {
      return fixture.comments;
    },
  };
  const processMock = { env: { EXPECTED_REPOSITORY: REPO } };

  await productionConsumer(core, context, github, processMock);
  if (failure) {
    const prefix = "stage3c_qa_activation_denied:";
    assert.ok(failure.startsWith(prefix), `unexpected production denial: ${failure}`);
    return { accepted: false, reason: failure.slice(prefix.length) };
  }

  assert.equal(infos.length, 1, "production validator must emit exactly one authorization info record");
  assert.equal(infos[0], `stage3c_qa_activation_authorized:research_run_id=${fixture.workflowRun.id}`);
  return { accepted: true, reason: "authorized" };
}

async function expectDenied(fixture, reason) {
  const outcome = await executeProductionConsumer(fixture);
  assert.equal(outcome.accepted, false);
  if (reason) assert.equal(outcome.reason, reason);
}

test("Worker A canonical producer contract is exercised by Worker B's actual production validator", async () => {
  const producerValues = [...researchSource.matchAll(/^- `observed_fact: ([^`\r\n]+)`$/gm)].map((match) => match[1]);
  assert.deepEqual(producerValues, ["exists", "missing"]);
  assert.ok(researchSource.includes("Do not add explanation, path text, branch text, punctuation, or any other prose to the `observed_fact` line."));

  for (const observed of producerValues) {
    const fixture = baseFixture();
    fixture.comments[0].body = canonicalResearchBody({
      runId: fixture.workflowRun.id,
      runNumber: fixture.workflowRun.run_number,
      observed,
    });
    assert.deepEqual(await executeProductionConsumer(fixture), { accepted: true, reason: "authorized" });
  }
});

test("noncanonical observed_fact values fail closed through Worker B production validation", async () => {
  for (const observed of ["docs/ARCHITECTURE.md exists on the default branch", "present"]) {
    const fixture = baseFixture();
    fixture.comments[0].body = canonicalResearchBody({
      runId: fixture.workflowRun.id,
      runNumber: fixture.workflowRun.run_number,
      observed,
    });
    await expectDenied(fixture, "malformed_observed_fact");
  }
});

test("mixed canonical and unsupported observed_fact fields fail closed through Worker B production validation", async () => {
  for (const [canonical, extra] of [
    ["exists", "observed_fact: present"],
    ["missing", "observed_fact: present"],
    ["exists", "observed_fact: unknown"],
    ["exists", "observed_fact:present"],
  ]) {
    const fixture = baseFixture();
    fixture.comments[0].body = `${canonicalResearchBody({
      runId: fixture.workflowRun.id,
      runNumber: fixture.workflowRun.run_number,
      observed: canonical,
    })}\n${extra}`;
    await expectDenied(fixture, "malformed_observed_fact");
  }
});

test("missing duplicate and contradictory observed_fact fields fail closed through Worker B production validation", async () => {
  const missing = baseFixture();
  missing.comments[0].body = missing.comments[0].body.split("\n").filter((line) => !line.startsWith("observed_fact: ")).join("\n");
  await expectDenied(missing, "malformed_observed_fact");

  const duplicate = baseFixture();
  duplicate.comments[0].body += "\nobserved_fact: exists";
  await expectDenied(duplicate, "malformed_observed_fact");

  const both = baseFixture();
  both.comments[0].body += "\nobserved_fact: missing";
  await expectDenied(both, "malformed_observed_fact");
});

test("wrong producer correlation fields fail closed through Worker B production validation", async () => {
  const wrongRunId = baseFixture();
  wrongRunId.comments[0].body = canonicalResearchBody({ runId: 9999, runNumber: wrongRunId.workflowRun.run_number });
  await expectDenied(wrongRunId, "missing_or_duplicate_research_result");

  const wrongRunNumber = baseFixture();
  wrongRunNumber.comments[0].body = canonicalResearchBody({ runId: wrongRunNumber.workflowRun.id, runNumber: 9999 });
  await expectDenied(wrongRunNumber, `malformed_research_result:research_run_number: ${wrongRunNumber.workflowRun.run_number}`);

  for (const [key, value, required] of [
    ["fixtureIssue", 54, "fixture_issue: 53"],
    ["revision", "stage3c-v0.1-r4", "fixture_revision: stage3c-v0.1-r5"],
    ["sourcePath", "README.md", "repository_source_path: docs/ARCHITECTURE.md"],
  ]) {
    const fixture = baseFixture();
    fixture.comments[0].body = canonicalResearchBody({
      runId: fixture.workflowRun.id,
      runNumber: fixture.workflowRun.run_number,
      [key]: value,
    });
    await expectDenied(fixture, `malformed_research_result:${required}`);
  }
});

test("duplicate Research result and untrusted author fail closed through Worker B production validation", async () => {
  const duplicate = baseFixture();
  duplicate.comments.push({ ...duplicate.comments[0] });
  await expectDenied(duplicate, "missing_or_duplicate_research_result");

  const untrusted = baseFixture();
  untrusted.comments[0].user = { login: "founder", type: "User" };
  await expectDenied(untrusted, "research_result_not_actions_safe_output");
});

test("wrong repository/workflow/path/event/branch/conclusion and replayed parent fail closed through Worker B production validation", async () => {
  const attacks = [
    [{ repository: { full_name: "other/repo", fork: false } }, "wrong_research_repository"],
    [{ name: "Other Research" }, "wrong_workflow_name"],
    [{ path: ".github/workflows/other.yml" }, "wrong_workflow_path"],
    [{ event: "push" }, "wrong_research_event"],
    [{ head_branch: "feature" }, "wrong_research_branch"],
    [{ conclusion: "failure" }, "research_not_success"],
    [{ run_attempt: 2 }, "replayed_research_run"],
  ];
  for (const [workflowRun, reason] of attacks) {
    await expectDenied(baseFixture({ workflowRun }), reason);
  }

  await expectDenied(baseFixture({ repositoryContext: { owner: "other", repo: "repo" } }), "wrong_repository_context");
});
