"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const researchPath = path.join(ROOT, ".github/workflows/stage3c-research-worker.md");
const qaPath = path.join(ROOT, ".github/workflows/stage3c-qa-worker.md");
const docPath = path.join(ROOT, "docs/development-orchestrator-stage3c-two-worker-proof-v01.md");
const compilePath = path.join(ROOT, ".github/workflows/stage3c-agentic-compile-validation.yml");

const read = (p) => fs.readFileSync(p, "utf8");
const research = read(researchPath);
const qa = read(qaPath);
const docs = read(docPath);
const compile = read(compilePath);

function assertNoDangerousAgentWrites(source) {
  assert.doesNotMatch(source, /pull_request_target/);
  assert.doesNotMatch(source, /create-pull-request:/);
  assert.doesNotMatch(source, /push-to-pull-request-branch:/);
  assert.doesNotMatch(source, /add-labels:/);
  assert.doesNotMatch(source, /remove-labels:/);
  assert.doesNotMatch(source, /update-issue:/);
  assert.doesNotMatch(source, /dispatch-workflow:/);
  assert.doesNotMatch(source, /call-workflow:/);
  assert.doesNotMatch(source, /deployments?:\s*write/i);
  assert.doesNotMatch(source, /contents:\s*write/i);
}

test("Stage 3C uses two distinct Codex worker definitions", () => {
  assert.match(research, /name: Stage 3C Research Worker A/);
  assert.match(qa, /name: Stage 3C QA Worker B/);
  assert.match(research, /engine: codex/);
  assert.match(qa, /engine: codex/);
  assert.notEqual(research, qa);
});

test("Research Worker A is fixture-scoped, dormant-until-READY, and read-only", () => {
  assert.match(research, /issues:\n\s+types: \[edited\]/);
  assert.match(research, /github\.event\.issue\.number == 53/);
  assert.match(research, /Eligibility: `READY`/);
  assert.match(research, /contents: read/);
  assert.match(research, /issues: read/);
  assert.doesNotMatch(research, /actions: write/);
  assert.match(research, /STAGE3C_RESEARCH_RESULT v0\.1/);
  assert.match(research, /research_run_id: \$\{\{ github\.run_id \}\}/);
  assert.match(research, /research_head_sha: \$\{\{ github\.sha \}\}/);
  assert.match(research, /repository_source_path: docs\/ARCHITECTURE\.md/);
});

test("QA Worker B chains only from successful Research completion on main", () => {
  assert.match(qa, /workflow_run:/);
  assert.match(qa, /workflows: \['Stage 3C Research Worker A'\]/);
  assert.match(qa, /types: \[completed\]/);
  assert.match(qa, /branches: \[main\]/);
  assert.match(qa, /conclusion: success/);
  assert.match(qa, /fresh independent Codex execution/);
  assert.match(qa, /research_run_id: \$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.match(qa, /research_head_sha: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(qa, /STAGE3C_QA_RESULT v0\.1 — PASS/);
  assert.match(qa, /STAGE3C_QA_RESULT v0\.1 — FAIL/);
});

test("Both workers use only one fixed-issue add-comment safe output", () => {
  for (const source of [research, qa]) {
    assert.match(source, /safe-outputs:/);
    assert.match(source, /add-comment:/);
    assert.match(source, /target: 53/);
    assert.match(source, /max: 1/);
    assert.match(source, /required-title-prefix: 'AGENT SPIKE TEST —'/);
    assertNoDangerousAgentWrites(source);
  }
});

test("worker sources never reference the OpenAI secret directly", () => {
  for (const source of [research, qa]) {
    assert.doesNotMatch(source, /OPENAI_API_KEY/);
    assert.doesNotMatch(source, /CODEX_API_KEY/);
    assert.doesNotMatch(source, /secrets\./);
    assert.doesNotMatch(source, /github_pat_|gh[pousr]_/i);
  }
});

test("concurrency and budget bounds prevent uncontrolled fan-out", () => {
  assert.match(research, /group: stage3c-research-fixture-53/);
  assert.match(research, /cancel-in-progress: true/);
  assert.match(qa, /group: stage3c-qa-\$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.match(qa, /cancel-in-progress: false/);
  for (const source of [research, qa]) {
    assert.match(source, /queue: single/);
    assert.match(source, /max-ai-credits: 250/);
    assert.match(source, /max-daily-ai-credits: 500/);
    assert.match(source, /timeout-minutes: 10/);
  }
});

test("QA explicitly rejects stale or uncorrelated durable handoffs", () => {
  assert.match(qa, /If no exactly correlated result exists, the QA verdict must be FAIL/);
  assert.match(qa, /Reject the handoff as stale and return FAIL/);
  assert.match(qa, /Do not substitute an older Research result/);
  assert.match(qa, /independently inspect repository truth/);
});

test("compile validation is non-agent and pins gh-aw compiler version", () => {
  assert.match(compile, /Stage 3C Agentic Workflow Compile Validation/);
  assert.match(compile, /github\/gh-aw\/actions\/setup-cli@v0\.37\.18/);
  assert.match(compile, /version: v0\.37\.18/);
  assert.match(compile, /gh aw compile stage3c-research-worker --strict/);
  assert.match(compile, /gh aw compile stage3c-qa-worker --strict/);
  assert.match(compile, /gh aw validate stage3c-research-worker --strict/);
  assert.match(compile, /gh aw validate stage3c-qa-worker --strict/);
  assert.match(compile, /permissions:\n\s+contents: read/);
  assert.doesNotMatch(compile, /engine: codex/);
  assert.doesNotMatch(compile, /secrets\.OPENAI_API_KEY/);
});

test("documentation preserves isolation and live-proof stop gate", () => {
  assert.match(docs, /Do not run the live agent chain before independent HIGH-risk QA PASS/);
  assert.match(docs, /No production League Vector behavior is changed/);
  assert.match(docs, /No PAT is introduced/);
  assert.match(docs, /Issue #53/);
  assert.match(docs, /Do \*\*nothing\*\* between Worker A and Worker B/);
});
