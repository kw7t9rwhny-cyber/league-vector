"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const research = fs.readFileSync(path.join(ROOT, ".github/workflows/stage3c-research-worker.md"), "utf8");
const qa = fs.readFileSync(path.join(ROOT, ".github/workflows/stage3c-qa-worker.md"), "utf8");
const docs = fs.readFileSync(path.join(ROOT, "docs/development-orchestrator-stage3c-two-worker-proof-v01.md"), "utf8");
const compile = fs.readFileSync(path.join(ROOT, ".github/workflows/stage3c-agentic-compile-validation.yml"), "utf8");

function assertNoDangerousAgentWrites(source) {
  for (const pattern of [/pull_request_target/,/create-pull-request:/,/push-to-pull-request-branch:/,/add-labels:/,/remove-labels:/,/update-issue:/,/dispatch-workflow:/,/call-workflow:/,/deployments?:\s*write/i,/contents:\s*write/i]) {
    assert.doesNotMatch(source, pattern);
  }
}

test("Stage 3C uses two distinct Codex worker definitions", () => {
  assert.match(research, /name: Stage 3C Research Worker A/);
  assert.match(qa, /name: Stage 3C QA Worker B/);
  assert.match(research, /engine: codex/);
  assert.match(qa, /engine: codex/);
  assert.notEqual(research, qa);
});

test("Research Worker A is exact fixture-transition scoped and read-only", () => {
  assert.match(research, /issues:\n\s+types: \[edited\]/);
  assert.match(research, /github\.event\.issue\.number == 53/);
  assert.match(research, /github\.event\.changes\.body\.from != null/);
  assert.match(research, /contains\(github\.event\.issue\.body, 'Eligibility: READY'\)/);
  assert.match(research, /!contains\(github\.event\.changes\.body\.from, 'Eligibility: READY'\)/);
  assert.match(research, /contents: read/);
  assert.match(research, /issues: read/);
  assert.match(research, /STAGE3C_RESEARCH_RESULT v0\.1/);
  assert.match(research, /research_run_id: \$\{\{ github\.run_id \}\}/);
  assert.match(research, /research_run_number: \$\{\{ github\.run_number \}\}/);
  assert.match(research, /repository_source_path: docs\/ARCHITECTURE\.md/);
  assert.doesNotMatch(research, /github\.sha|github\.run_attempt/);
});

test("QA Worker B chains from successful Research completion with durable de-duplication", () => {
  assert.match(qa, /workflow_run:/);
  assert.match(qa, /workflows: \['Stage 3C Research Worker A'\]/);
  assert.match(qa, /types: \[completed\]/);
  assert.match(qa, /branches: \[main\]/);
  assert.match(qa, /conclusion: success/);
  assert.match(qa, /fresh independent Codex execution/);
  assert.match(qa, /research_run_id: \$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.match(qa, /research_run_number: \$\{\{ github\.event\.workflow_run\.run_number \}\}/);
  assert.match(qa, /research_head_sha: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(qa, /prior QA comment already contains both/);
  assert.match(qa, /produce no second QA result/);
  assert.match(qa, /STAGE3C_QA_RESULT v0\.1 — PASS/);
  assert.match(qa, /STAGE3C_QA_RESULT v0\.1 — FAIL/);
  assert.doesNotMatch(qa, /run_attempt/);
});

test("Both workers expose only one fixed-issue add-comment safe output", () => {
  for (const source of [research, qa]) {
    assert.match(source, /safe-outputs:/);
    assert.match(source, /add-comment:/);
    assert.match(source, /target: "53"/);
    assert.match(source, /max: 1/);
    assertNoDangerousAgentWrites(source);
  }
});

test("workers are read-only and never directly reference OpenAI/GitHub secrets", () => {
  for (const source of [research, qa]) {
    assert.match(source, /contents: read/);
    assert.match(source, /issues: read/);
    assert.doesNotMatch(source, /actions:\s*write|issues:\s*write|pull-requests:\s*write/);
    assert.doesNotMatch(source, /OPENAI_API_KEY|CODEX_API_KEY|secrets\.|github_pat_|gh[pousr]_/i);
  }
  assert.doesNotMatch(qa, /actions: read/);
});

test("concurrency, transition gating, durable QA de-duplication and timeout bound fan-out", () => {
  assert.match(research, /group: stage3c-research-fixture-53/);
  assert.match(research, /cancel-in-progress: true/);
  assert.match(qa, /group: stage3c-qa-\$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.match(qa, /cancel-in-progress: false/);
  for (const source of [research, qa]) {
    assert.doesNotMatch(source, /queue:/);
    assert.doesNotMatch(source, /max-ai-credits|max-daily-ai-credits/);
    assert.match(source, /timeout-minutes: 10/);
  }
});

test("QA rejects stale or uncorrelated durable handoffs", () => {
  assert.match(qa, /If no exactly correlated result exists, the QA verdict must be FAIL/);
  assert.match(qa, /Reject the handoff as stale and return FAIL/);
  assert.match(qa, /Do not substitute an older Research result/);
  assert.match(qa, /independently inspect repository truth/i);
});

test("compile validation uses verified official gh-aw binary and no agent secret", () => {
  assert.match(compile, /releases\/download\/v0\.37\.18\/linux-amd64/);
  assert.match(compile, /626f8f73842581f08072f2e0bc8dd49cf4e7e70977186e582cff86ac2d472c04/);
  assert.match(compile, /gh-aw compile stage3c-research-worker --strict/);
  assert.match(compile, /gh-aw compile stage3c-qa-worker --strict/);
  assert.match(compile, /gh-aw validate stage3c-research-worker --strict/);
  assert.match(compile, /gh-aw validate stage3c-qa-worker --strict/);
  assert.match(compile, /permissions:\n\s+contents: read/);
  assert.doesNotMatch(compile, /engine: codex|OPENAI_API_KEY|CODEX_API_KEY|secrets\./);
});

test("documentation preserves isolation and live-proof stop gate", () => {
  assert.match(docs, /Do not run the live agent chain before independent HIGH-risk QA PASS/);
  assert.match(docs, /No production League Vector behavior is changed/);
  assert.match(docs, /No PAT is introduced/);
  assert.match(docs, /Issue #53/);
  assert.match(docs, /Do \*\*nothing\*\* between Worker A and Worker B/);
});
