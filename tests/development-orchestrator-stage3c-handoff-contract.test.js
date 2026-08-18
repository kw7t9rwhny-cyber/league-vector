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
const REVISION = "stage3c-v0.1-r4";
const SOURCE_PATH = "docs/ARCHITECTURE.md";
const MARKER = "STAGE3C_RESEARCH_RESULT v0.1";
const WORKFLOW_NAME = "Stage 3C Research Worker A";
const WORKFLOW_PATH = ".github/workflows/stage3c-research-worker.lock.yml";
const ACTIONS_BOT = Object.freeze({ login: "github-actions[bot]", type: "Bot" });
const OBSERVED_FACT_LINES = Object.freeze(["observed_fact: exists", "observed_fact: missing"]);

const exactLineCount = (text, line) => typeof text === "string"
  ? text.split(/\r?\n/).filter((value) => value === line).length
  : 0;

function canonicalResearchBody({ runId = 32082361085, runNumber = 8, observed = "exists", fixtureIssue = ISSUE, revision = REVISION, sourcePath = SOURCE_PATH } = {}) {
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

function validateResearchHandoff({
  workflowRun = {},
  issue = {},
  comments = [],
} = {}) {
  const wr = workflowRun;
  const deny = (reason) => ({ accepted: false, reason });
  if (!wr) return deny("missing_workflow_run");
  if (wr.repository?.full_name !== REPO || wr.repository?.fork) return deny("wrong_research_repository");
  if (wr.name !== WORKFLOW_NAME) return deny("wrong_workflow_name");
  if (wr.path !== WORKFLOW_PATH) return deny("wrong_workflow_path");
  if (wr.event !== "issues") return deny("wrong_research_event");
  if (wr.head_branch !== "main") return deny("wrong_research_branch");
  if (wr.conclusion !== "success") return deny("research_not_success");
  if (wr.run_attempt !== 1) return deny("replayed_research_run");
  if (!Number.isInteger(wr.id) || !Number.isInteger(wr.run_number)) return deny("malformed_research_identity");

  if (issue.number !== ISSUE || issue.title !== TITLE) return deny("wrong_fixture");
  if (typeof issue.body !== "string") return deny("missing_fixture_body");
  const revisionMatches = [...issue.body.matchAll(/^Fixture revision: stage3c-v0\.1-r4$/gm)];
  const eligibilityMatches = [...issue.body.matchAll(/^Eligibility: ([^\r\n]+)$/gm)];
  if (revisionMatches.length !== 1) return deny("wrong_fixture_revision");
  if (eligibilityMatches.length !== 1 || eligibilityMatches[0][1] !== "READY") return deny("fixture_not_ready");

  const runIdLine = `research_run_id: ${wr.id}`;
  const runNumberLine = `research_run_number: ${wr.run_number}`;
  const researchForRun = comments.filter((comment) => typeof comment.body === "string" && exactLineCount(comment.body, MARKER) > 0 && exactLineCount(comment.body, runIdLine) > 0);
  if (researchForRun.length !== 1) return deny("missing_or_duplicate_research_result");
  const result = researchForRun[0];
  if (result.user?.login !== ACTIONS_BOT.login || result.user?.type !== ACTIONS_BOT.type) return deny("research_result_not_actions_safe_output");

  const required = [
    MARKER,
    "worker_role: research-worker-a",
    "fixture_issue: 53",
    "fixture_revision: stage3c-v0.1-r4",
    runIdLine,
    runNumberLine,
    "repository_source_path: docs/ARCHITECTURE.md",
    "completion_status: complete",
  ];
  for (const line of required) if (exactLineCount(result.body, line) !== 1) return deny(`malformed_research_result:${line}`);
  const observed = OBSERVED_FACT_LINES.filter((line) => exactLineCount(result.body, line) === 1);
  if (observed.length !== 1) return deny("malformed_observed_fact");

  const started = Date.parse(wr.run_started_at);
  const completed = Date.parse(wr.updated_at);
  const created = Date.parse(result.created_at);
  if (![started, completed, created].every(Number.isFinite) || created < started || created > completed) return deny("research_result_outside_authoritative_window");

  const priorQa = comments.filter((comment) => typeof comment.body === "string" && /^STAGE3C_QA_RESULT v0\.1 — (PASS|FAIL)$/m.test(comment.body) && exactLineCount(comment.body, runIdLine) === 1);
  if (priorQa.length !== 0) return deny("prior_authoritative_qa_result");
  return { accepted: true, reason: "authorized", observedFact: observed[0].slice("observed_fact: ".length) };
}

function baseFixture(overrides = {}) {
  const wr = {
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
    body: canonicalResearchBody({ runId: wr.id, runNumber: wr.run_number }),
    ...overrides.result,
  };
  return { workflowRun: wr, issue, comments: overrides.comments || [result], result };
}

function expectDenied(fixture, reason) {
  const outcome = validateResearchHandoff(fixture);
  assert.equal(outcome.accepted, false);
  if (reason) assert.equal(outcome.reason, reason);
}

test("producer source requires the exact observed_fact enum consumed by Worker B", () => {
  for (const line of OBSERVED_FACT_LINES) {
    assert.ok(researchSource.includes(`\`${line}\``), `Research producer contract must name ${line}`);
    assert.ok(qaSource.includes(`'${line}'`) || qaSource.includes(`\"${line}\"`), `QA consumer must accept ${line}`);
  }
  assert.ok(researchSource.includes("Do not add explanation, path text, branch text, punctuation, or any other prose to the `observed_fact` line."));
});

test("canonical producer result is accepted by Worker B contract semantics", () => {
  const outcome = validateResearchHandoff(baseFixture());
  assert.deepEqual(outcome, { accepted: true, reason: "authorized", observedFact: "exists" });
});

test("noncanonical observed_fact values fail closed", () => {
  for (const observed of ["docs/ARCHITECTURE.md exists on the default branch", "present"]) {
    const f = baseFixture();
    f.comments[0].body = canonicalResearchBody({ runId: f.workflowRun.id, runNumber: f.workflowRun.run_number, observed });
    expectDenied(f, "malformed_observed_fact");
  }
});

test("missing duplicate and contradictory observed_fact fields fail closed", () => {
  const missing = baseFixture();
  missing.comments[0].body = missing.comments[0].body.split("\n").filter((line) => !line.startsWith("observed_fact: ")).join("\n");
  expectDenied(missing, "malformed_observed_fact");

  const duplicate = baseFixture();
  duplicate.comments[0].body += "\nobserved_fact: exists";
  expectDenied(duplicate, "malformed_observed_fact");

  const both = baseFixture();
  both.comments[0].body += "\nobserved_fact: missing";
  expectDenied(both, "malformed_observed_fact");
});

test("wrong producer correlation fields fail closed", () => {
  const wrongRunId = baseFixture();
  wrongRunId.comments[0].body = canonicalResearchBody({ runId: 9999, runNumber: wrongRunId.workflowRun.run_number });
  expectDenied(wrongRunId, "missing_or_duplicate_research_result");

  const wrongRunNumber = baseFixture();
  wrongRunNumber.comments[0].body = canonicalResearchBody({ runId: wrongRunNumber.workflowRun.id, runNumber: 9999 });
  expectDenied(wrongRunNumber, `malformed_research_result:research_run_number: ${wrongRunNumber.workflowRun.run_number}`);

  for (const [key, value, required] of [
    ["fixtureIssue", 54, "fixture_issue: 53"],
    ["revision", "stage3c-v0.1-r3", "fixture_revision: stage3c-v0.1-r4"],
    ["sourcePath", "README.md", "repository_source_path: docs/ARCHITECTURE.md"],
  ]) {
    const f = baseFixture();
    f.comments[0].body = canonicalResearchBody({ runId: f.workflowRun.id, runNumber: f.workflowRun.run_number, [key]: value });
    expectDenied(f, `malformed_research_result:${required}`);
  }
});

test("duplicate Research result and untrusted author fail closed", () => {
  const duplicate = baseFixture();
  duplicate.comments.push({ ...duplicate.comments[0] });
  expectDenied(duplicate, "missing_or_duplicate_research_result");

  const untrusted = baseFixture();
  untrusted.comments[0].user = { login: "founder", type: "User" };
  expectDenied(untrusted, "research_result_not_actions_safe_output");
});

test("stale or wrong Research parent identity fails closed", () => {
  const attacks = [
    [{ name: "Other Research" }, "wrong_workflow_name"],
    [{ path: ".github/workflows/other.yml" }, "wrong_workflow_path"],
    [{ event: "push" }, "wrong_research_event"],
    [{ head_branch: "feature" }, "wrong_research_branch"],
    [{ conclusion: "failure" }, "research_not_success"],
    [{ run_attempt: 2 }, "replayed_research_run"],
    [{ repository: { full_name: "other/repo", fork: false } }, "wrong_research_repository"],
  ];
  for (const [workflowRun, reason] of attacks) expectDenied(baseFixture({ workflowRun }), reason);
});
