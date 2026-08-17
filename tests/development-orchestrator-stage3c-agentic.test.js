"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const research = read(".github/workflows/stage3c-research-worker.md");
const qa = read(".github/workflows/stage3c-qa-worker.md");
const researchLock = read(".github/workflows/stage3c-research-worker.lock.yml");
const qaLock = read(".github/workflows/stage3c-qa-worker.lock.yml");
const compile = read(".github/workflows/stage3c-agentic-compile-validation.yml");
const docs = read("docs/development-orchestrator-stage3c-two-worker-proof-v01.md");

function researchEligible({repo="kw7t9rwhny-cyber/league-vector", issue=53, title="AGENT SPIKE TEST — harmless two-worker handoff", before, after, attempt="1"}) {
  const eligibility = (body) => {
    if (typeof body !== "string") return null;
    const m = [...body.matchAll(/^Eligibility: ([^\r\n]+)$/gm)];
    return m.length === 1 ? m[0][1] : null;
  };
  const revisionCount = (body) => typeof body === "string" ? [...body.matchAll(/^Fixture revision: stage3c-v0\.1-r1$/gm)].length : 0;
  if (attempt !== "1" || repo !== "kw7t9rwhny-cyber/league-vector" || issue !== 53 || title !== "AGENT SPIKE TEST — harmless two-worker handoff") return false;
  if (typeof before !== "string" || typeof after !== "string") return false;
  if (revisionCount(before) !== 1 || revisionCount(after) !== 1) return false;
  if (eligibility(before) !== "DORMANT" || eligibility(after) !== "READY") return false;
  return after === before.replace(/^Eligibility: DORMANT$/m, "Eligibility: READY");
}

const dormant = "Fixture revision: stage3c-v0.1-r1\n\nEligibility: DORMANT\n";
const ready = "Fixture revision: stage3c-v0.1-r1\n\nEligibility: READY\n";

test("Worker A authority is exact DORMANT to READY only", () => {
  assert.equal(researchEligible({before:dormant, after:ready}), true);
  const attacks = [
    {before:ready, after:ready},
    {before:dormant.replace("DORMANT","UNKNOWN"), after:ready},
    {before:undefined, after:ready},
    {before:dormant, after:undefined},
    {before:dormant, after:ready.replace("READY","ready")},
    {before:dormant, after:ready + "extra\n"},
    {before:dormant, after:ready, issue:54},
    {before:dormant, after:ready, repo:"attacker/repo"},
    {before:dormant, after:ready, attempt:"2"},
    {before:dormant + "Eligibility: DORMANT\n", after:ready},
  ];
  for (const attack of attacks) assert.equal(researchEligible(attack), false);
  for (const token of ["replayed_run","wrong_repository","wrong_issue","missing_previous_body","missing_current_body","invalid_fixture_revision","previous_not_dormant","current_not_ready","body_changed_beyond_authorized_transition"]) assert.match(research, new RegExp(token));
  assert.match(research, /if: needs\.pre_activation\.outputs\.exact_transition_result == 'success'/);
});

test("Worker B deterministic pre-activation binds complete Research authority", () => {
  for (const fragment of [
    "wr.name !== 'Stage 3C Research Worker A'",
    "wr.path !== '.github/workflows/stage3c-research-worker.lock.yml'",
    "wr.event !== 'issues'",
    "wr.head_branch !== 'main'",
    "wr.conclusion !== 'success'",
    "wr.run_attempt !== 1",
    "issue_number: 53",
    "fixture_revision: stage3c-v0.1-r1",
    "researchForRun.length !== 1",
    "github-actions[bot]",
    "research_result_outside_authoritative_window",
    "prior_authoritative_qa_result",
  ]) assert.ok(qa.includes(fragment), fragment);
  for (const reason of ["wrong_workflow_name","wrong_workflow_path","wrong_research_event","wrong_research_branch","research_not_success","replayed_research_run","wrong_fixture","wrong_fixture_revision","fixture_not_ready","missing_or_duplicate_research_result","research_result_not_actions_safe_output","malformed_research_result","malformed_observed_fact","research_result_outside_authoritative_window","prior_authoritative_qa_result"]) assert.match(qa, new RegExp(reason));
  assert.match(qa, /if: needs\.pre_activation\.outputs\.research_authority_result == 'success'/);
});

test("failed cancelled skipped timed-out or generic workflow completion cannot authorize QA", () => {
  assert.match(qa, /types: \[completed\]/);
  assert.match(qa, /wr\.conclusion !== 'success'/);
  assert.match(qa, /wr\.name !== 'Stage 3C Research Worker A'/);
  assert.match(qa, /wr\.path !== '\.github\/workflows\/stage3c-research-worker\.lock\.yml'/);
  assert.match(qa, /wr\.repository\?\.full_name !== process\.env\.EXPECTED_REPOSITORY/);
  assert.match(qa, /wr\.repository\?\.fork/);
});

test("durable Research marker must be unique exact-run bot safe output in authoritative window", () => {
  assert.match(qa, /exactLineCount\(comment\.body, runIdLine\) > 0/);
  assert.match(qa, /researchForRun\.length !== 1/);
  assert.match(qa, /result\.user\?\.login !== 'github-actions\[bot\]'/);
  assert.match(qa, /created < started \|\| created > completed/);
  assert.match(qa, /completion_status: complete/);
  assert.match(qa, /repository_source_path: docs\/ARCHITECTURE\.md/);
});

function jobBlock(lock, name) {
  const marker = `\n  ${name}:\n`;
  const i = lock.indexOf(marker);
  assert.notEqual(i, -1, `missing ${name}`);
  const rest = lock.slice(i + marker.length);
  const m = rest.match(/\n  [A-Za-z0-9_-]+:\n/);
  return m ? rest.slice(0, m.index) : rest;
}

test("effective generated agent jobs have no GitHub write permission", () => {
  for (const lock of [researchLock, qaLock]) {
    const agent = jobBlock(lock, "agent");
    assert.match(agent, /contents: read/);
    assert.match(agent, /issues: read/);
    assert.doesNotMatch(agent, /:\s*write/);
    assert.match(agent, /GITHUB_READ_ONLY/);
    for (const forbidden of ["contents: write","pull-requests: write","actions: write","deployments: write","packages: write","administration: write","statuses: write","checks: write"]) assert.ok(!lock.includes(forbidden), forbidden);
  }
});

test("effective generated safe-output handler is fixed to one Issue 53 comment capability", () => {
  for (const lock of [researchLock, qaLock]) {
    const safe = jobBlock(lock, "safe_outputs");
    assert.match(safe, /permissions:\n\s+issues: write/);
    assert.doesNotMatch(safe, /pull-requests: write|contents: write|actions: write/);
    const config = lock.match(/GH_AW_SAFE_OUTPUTS_HANDLER_CONFIG: "[^\n]+"/)[0];
    assert.match(config, /add_comment/);
    assert.match(config, /target\\":\\"53/);
    assert.match(config, /max\\":1/);
    for (const forbidden of ["create_pull_request","add_labels","remove_labels","merge_pull_request","push_to_pull_request_branch","update_release","dispatch_workflow","create_issue"]) assert.ok(!config.includes(`\\\"${forbidden}\\\"`), forbidden);
  }
});

test("source safe outputs disable non-fixture write/report channels", () => {
  for (const source of [research, qa]) {
    assert.match(source, /report-failure-as-issue: false/);
    assert.match(source, /missing-tool: false/);
    assert.match(source, /missing-data: false/);
    assert.match(source, /noop: false/);
    assert.match(source, /target: "53"/);
    assert.match(source, /max: 1/);
    assert.match(source, /issues: true/);
    assert.match(source, /pull-requests: false/);
    assert.match(source, /discussions: false/);
  }
});

test("duplicate and retry chain remains bounded", () => {
  assert.match(research, /group: stage3c-research-fixture-53/);
  assert.match(research, /cancel-in-progress: true/);
  assert.match(research, /GITHUB_RUN_ATTEMPT !== '1'/);
  assert.match(qa, /group: stage3c-qa-\$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.match(qa, /cancel-in-progress: false/);
  assert.match(qa, /priorQa\.length !== 0/);
  for (const source of [research, qa]) assert.match(source, /timeout-minutes: 10/);
  assert.doesNotMatch(qa, /dispatch-workflow|call-workflow/);
});

test("secret boundary remains native Codex engine authentication", () => {
  for (const source of [research, qa, compile]) assert.doesNotMatch(source, /OPENAI_API_KEY|CODEX_API_KEY|github_pat_|gh[pousr]_/i);
  for (const lock of [researchLock, qaLock]) {
    assert.match(lock, /"OPENAI_API_KEY"/);
    assert.match(lock, /"agent_id":"codex"/);
    assert.match(lock, /"compiler_version":"v0\.86\.2"/);
    assert.match(lock, /"strict":true/);
  }
});

test("verified gh-aw compiler is read-only and byte-compares executable locks", () => {
  assert.match(compile, /v0\.86\.2\/linux-amd64/);
  assert.match(compile, /b8fd100d1d56a77b842ad28375ff361215a5aa1277db6b9a05d70054cde7260e/);
  assert.match(compile, /contents: read/);
  assert.doesNotMatch(compile, /contents: write/);
  assert.match(compile, /compile stage3c-research-worker --strict/);
  assert.match(compile, /compile stage3c-qa-worker --strict/);
  assert.match(compile, /validate stage3c-research-worker --strict/);
  assert.match(compile, /validate stage3c-qa-worker --strict/);
  assert.match(compile, /cmp --silent/);
});

test("documentation preserves production firewall and live-proof stop gate", () => {
  assert.match(docs, /independent HIGH-risk QA PASS/);
  assert.match(docs, /No production League Vector behavior is changed/);
  assert.match(docs, /Issue #53/);
  assert.match(docs, /No PAT is introduced/);
});
