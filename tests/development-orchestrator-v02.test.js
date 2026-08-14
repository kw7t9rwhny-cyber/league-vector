"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  parseStructuredMetadata,
  parseVerdicts,
  normalizePr,
  deriveQueues,
  handoffFor,
  statusSummary,
  candidateShaFromText
} = require("../scripts/development-orchestrator-v02.js");

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_C = "cccccccccccccccccccccccccccccccccccccccc";

function body(overrides = {}) {
  const values = {
    owner: "core",
    risk: "medium",
    status: "ready-for-qa",
    type: "infrastructure",
    priority: "normal",
    integration: "yes",
    promotion: "none",
    promotionAuth: "not-applicable",
    founderRequired: "no",
    founderGate: "none",
    founderDecision: "not-required",
    dependencies: "None",
    ...overrides
  };
  return `## League Vector work-item contract\n\n**Owner:** \`owner:${values.owner}\`\n\n**Risk:** \`risk:${values.risk}\`\n\n**Status:** \`status:${values.status}\`\n\n**Type:** \`type:${values.type}\`\n\n**Priority:** \`priority:${values.priority}\`\n\n**Dependencies:** ${values.dependencies}\n\n**Integration required:** ${values.integration}\n\n**Promotion type:** \`${values.promotion}\`\n\n**Promotion authorized:** \`${values.promotionAuth}\`\n\n**Founder decision required:** ${values.founderRequired}\n\n**Founder gate:** \`${values.founderGate}\`\n\n**Founder decision when required:** \`${values.founderDecision}\`\n`;
}

function pr(number, overrides = {}) {
  return {
    number,
    title: `PR ${number}`,
    body: body(),
    state: "open",
    draft: false,
    head_sha: SHA_A,
    declared_candidate_sha: SHA_A,
    labels: [],
    events: [],
    ...overrides
  };
}

function verdict(verdictName, sha, when = "2026-08-14T10:00:00Z", id = null) {
  return { body: `QA ${verdictName} — tested head ${sha}`, created_at: when, source: "comment", id };
}

test("structured metadata parses canonical Stage-1 fields", () => {
  const parsed = parseStructuredMetadata(body({ dependencies: "#2, #3" }));
  assert.equal(parsed.structured, true);
  assert.equal(parsed.fields.owner, "core");
  assert.deepEqual(parsed.fields.dependencies, [2, 3]);
  assert.equal(parsed.fields.integration_required, true);
});

test("legacy PR fails closed when metadata is missing", () => {
  const item = normalizePr(pr(1, { body: "READY FOR QA — HIGH RISK\nExact candidate head: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`" }));
  assert.equal(item.structured, false);
  assert.equal(item.legacy_observed_state, "candidate-ready-observed");
  assert.equal(item.recommended_action, undefined);
});

test("canonical verdict parser ignores malformed PASS text and missing SHA", () => {
  const parsed = parseVerdicts([
    { body: `QA PASS tested head ${SHA_A}`, created_at: "1" },
    { body: "QA PASS — tested head", created_at: "2" },
    verdict("PASS", SHA_A, "3", 3)
  ]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].tested_sha, SHA_A);
  assert.equal(parsed[0].event_id, "3");
});

test("QA PASS on stale SHA is stale and not current approval", () => {
  const item = normalizePr(pr(2, { head_sha: SHA_B, events: [verdict("PASS", SHA_A)] }));
  assert.equal(item.qa_fresh, false);
  assert.equal(item.qa_stale, true);
});

test("QA PASS followed by commit automatically invalidates approval", () => {
  const queues = deriveQueues([pr(2, { head_sha: SHA_B, declared_candidate_sha: SHA_B, events: [verdict("PASS", SHA_A)] })]);
  assert.equal(queues.qa.length, 1);
  assert.equal(queues.qa[0].qa_fresh, false);
  assert.equal(queues.qa[0].recommended_action, "SEND_TO_QA");
});

test("PASS then FAIL on same SHA and same timestamp fails closed independent of identifiers", () => {
  const queues = deriveQueues([pr(3, {
    body: body({ status: "qa-passed" }),
    events: [verdict("PASS", SHA_A, "2026-08-14T10:00:00Z", 100), verdict("FAIL", SHA_A, "2026-08-14T10:00:00Z", 101)]
  })]);
  const item = queues.items[0];
  assert.equal(item.qa_conflicted_current, true);
  assert.equal(item.qa_verdict, "conflicted");
  assert.equal(item.qa_fresh, false);
  assert.equal(queues.core.length, 0);
  assert.equal(queues.qa.length, 0);
  assert.equal(queues.remediation.length, 1);
  assert.equal(item.recommended_action, "RETURN_TO_OWNER");
});

test("FAIL then PASS on same SHA and same timestamp also fails closed", () => {
  const queues = deriveQueues([pr(4, {
    body: body({ status: "qa-passed" }),
    events: [verdict("FAIL", SHA_A, "2026-08-14T10:00:00Z", 201), verdict("PASS", SHA_A, "2026-08-14T10:00:00Z", 202)]
  })]);
  const item = queues.items[0];
  assert.equal(item.qa_conflicted_current, true);
  assert.equal(item.qa_verdict, "conflicted");
  assert.equal(item.qa_fresh, false);
  assert.equal(queues.core.length, 0);
  assert.equal(queues.remediation.length, 1);
});

test("earlier PASS followed by provably later FAIL remains FAIL", () => {
  const item = normalizePr(pr(5, { events: [verdict("PASS", SHA_A, "2026-08-14T10:00:00Z"), verdict("FAIL", SHA_A, "2026-08-14T10:00:01Z")] }));
  assert.equal(item.qa_failed_current, true);
  assert.equal(item.qa_conflicted_current, false);
  assert.equal(item.qa_fresh, false);
});

test("earlier FAIL followed by provably later PASS is PASS on exact SHA", () => {
  const queues = deriveQueues([pr(6, {
    body: body({ status: "qa-passed" }),
    events: [verdict("FAIL", SHA_A, "2026-08-14T10:00:00Z"), verdict("PASS", SHA_A, "2026-08-14T10:00:01Z")]
  })]);
  const item = queues.items[0];
  assert.equal(item.qa_conflicted_current, false);
  assert.equal(item.qa_fresh, true);
  assert.equal(item.qa_verdict, "pass");
  assert.equal(queues.core.length, 1);
  assert.equal(item.recommended_action, "READY_FOR_CORE_REVIEW");
});

test("duplicate same-verdict events at same timestamp do not create false conflict", () => {
  const item = normalizePr(pr(7, {
    events: [verdict("PASS", SHA_A, "2026-08-14T10:00:00Z", 301), verdict("PASS", SHA_A, "2026-08-14T10:00:00Z", 302)]
  }));
  assert.equal(item.qa_conflicted_current, false);
  assert.equal(item.qa_fresh, true);
  assert.equal(item.qa_verdict, "pass");
});

test("different SHAs do not contaminate exact-SHA verdict resolution", () => {
  const item = normalizePr(pr(8, {
    head_sha: SHA_B,
    declared_candidate_sha: SHA_B,
    events: [verdict("FAIL", SHA_A, "2026-08-14T10:00:00Z", 401), verdict("PASS", SHA_B, "2026-08-14T10:00:00Z", 402)]
  }));
  assert.equal(item.qa_conflicted_current, false);
  assert.equal(item.qa_fresh, true);
  assert.equal(item.qa_verdict, "pass");
  assert.equal(item.qa_tested_sha, SHA_B);
});

test("QA FAIL followed by new candidate returns to owner only when failure is current", () => {
  const moved = deriveQueues([pr(9, { head_sha: SHA_B, declared_candidate_sha: SHA_B, body: body({ status: "ready-for-qa" }), events: [verdict("FAIL", SHA_A)] })]);
  assert.equal(moved.remediation.length, 0);
  assert.equal(moved.qa.length, 1);
  assert.equal(moved.qa[0].qa_stale, true);
});

test("current QA FAIL enters remediation queue", () => {
  const queues = deriveQueues([pr(10, { body: body({ status: "qa-failed" }), events: [verdict("FAIL", SHA_A)] })]);
  assert.equal(queues.remediation.length, 1);
  assert.equal(queues.remediation[0].recommended_action, "RETURN_TO_OWNER");
});

test("raw research marked integration_required never becomes Core eligible", () => {
  const queues = deriveQueues([pr(11, {
    body: body({ status: "qa-passed", type: "research", integration: "yes", promotion: "none" }),
    events: [verdict("PASS", SHA_A)]
  })]);
  assert.equal(queues.core.length, 0);
  assert.equal(queues.research.length, 1);
  assert.equal(queues.research[0].recommended_action, "MORE_RESEARCH_REQUIRED");
});

test("Founder-gated item without approval enters Founder queue and cannot enter Core", () => {
  const queues = deriveQueues([pr(12, {
    body: body({ status: "waiting-founder", founderRequired: "release", founderGate: "release", founderDecision: "pending" }),
    events: [verdict("PASS", SHA_A)]
  })]);
  assert.equal(queues.founder.length, 1);
  assert.equal(queues.core.length, 0);
  assert.equal(queues.founder[0].recommended_action, "WAITING_ON_FOUNDER");
});

test("rejected Founder decision remains blocked", () => {
  const queues = deriveQueues([pr(13, {
    body: body({ status: "waiting-founder", founderRequired: "release", founderGate: "release", founderDecision: "rejected" }),
    events: [verdict("PASS", SHA_A)]
  })]);
  assert.equal(queues.core.length, 0);
  assert.equal(queues.founder.length, 1);
});

test("unsatisfied dependency blocks progression", () => {
  const queues = deriveQueues([pr(14, {
    body: body({ status: "qa-passed", dependencies: "#99" }),
    events: [verdict("PASS", SHA_A)]
  })]);
  assert.equal(queues.core.length, 0);
  assert.equal(queues.items[0].recommended_action, "BLOCKED_DEPENDENCY");
});

test("satisfied dependency plus fresh QA produces Core queue item", () => {
  const dep = pr(15, { body: body({ status: "qa-passed", integration: "no" }), events: [verdict("PASS", SHA_A)] });
  const candidate = pr(16, { body: body({ status: "qa-passed", dependencies: "#15" }), events: [verdict("PASS", SHA_A)] });
  const queues = deriveQueues([dep, candidate]);
  assert.equal(queues.core.some((x) => x.id === 16), true);
  assert.equal(queues.items.find((x) => x.id === 16).recommended_action, "READY_FOR_CORE_REVIEW");
});

test("production numerical model promotion requires Founder approval", () => {
  const queues = deriveQueues([pr(17, {
    body: body({
      status: "waiting-founder",
      promotion: "production-numerical-model",
      promotionAuth: "yes",
      founderRequired: "production-model-promotion",
      founderGate: "production-model-promotion",
      founderDecision: "pending"
    }),
    events: [verdict("PASS", SHA_A)]
  })]);
  assert.equal(queues.founder.length, 1);
  assert.equal(queues.core.length, 0);
});

test("closed PR is excluded from actionable queues", () => {
  const queues = deriveQueues([pr(18, { state: "closed" })]);
  assert.equal(queues.qa.length, 0);
  assert.equal(queues.core.length, 0);
});

test("draft research PR remains research-only", () => {
  const queues = deriveQueues([pr(19, { draft: true, body: body({ status: "active", type: "research", integration: "no" }) })]);
  assert.equal(queues.research.length, 1);
  assert.equal(queues.core.length, 0);
});

test("candidate head movement is reported against declared SHA", () => {
  const item = normalizePr(pr(20, { head_sha: SHA_B, declared_candidate_sha: SHA_A }));
  assert.equal(item.head_matches_declared, false);
});

test("conflicted handoff is text-only and explicitly fail-closed", () => {
  const queues = deriveQueues([pr(21, { events: [verdict("PASS", SHA_A, "same"), verdict("FAIL", SHA_A, "same")] })]);
  const text = handoffFor(queues.items[0]);
  assert.match(text, /QA: CONFLICTED on a{40}/);
  assert.match(text, /Recommended next action: RETURN_TO_OWNER/);
});

test("handoff generation is text-only and fail-closed for legacy", () => {
  const queues = deriveQueues([pr(22, { body: "READY FOR QA" })]);
  const text = handoffFor(queues.items[0]);
  assert.match(text, /FAIL-CLOSED: legacy\/unstructured/);
  assert.match(text, /Recommended next action: NO_ACTION/);
});

test("status JSON contains queue counts and legacy items", () => {
  const queues = deriveQueues([pr(23), pr(24, { body: "MORE RESEARCH REQUIRED" })]);
  const status = statusSummary(queues, SHA_C);
  assert.equal(status.main_sha, SHA_C);
  assert.equal(status.counts.qa, 1);
  assert.equal(status.counts.legacy_unstructured, 1);
});

test("candidate SHA extraction recognizes exact handoff forms", () => {
  assert.equal(candidateShaFromText(`Exact candidate head: \`${SHA_B}\``), SHA_B);
  assert.equal(candidateShaFromText("READY FOR QA without sha"), null);
});

test("CLI human and JSON status are deterministic for a frozen fixture", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lv-orchestrator-v02-"));
  const fixture = path.join(temp, "fixture.json");
  fs.writeFileSync(fixture, `${JSON.stringify({ main_sha: SHA_C, prs: [pr(25)] })}\n`);
  const script = path.join(__dirname, "..", "scripts", "development-orchestrator-v02.js");
  const human1 = spawnSync(process.execPath, [script, "status", "--fixture", fixture], { encoding: "utf8" });
  const human2 = spawnSync(process.execPath, [script, "status", "--fixture", fixture], { encoding: "utf8" });
  assert.equal(human1.status, 0);
  assert.equal(human1.stdout, human2.stdout);
  assert.match(human1.stdout, /QA 1 \| Core 0/);
  const json1 = spawnSync(process.execPath, [script, "status", "--json", "--fixture", fixture], { encoding: "utf8" });
  const json2 = spawnSync(process.execPath, [script, "status", "--json", "--fixture", fixture], { encoding: "utf8" });
  assert.equal(json1.status, 0);
  assert.equal(json1.stdout, json2.stdout);
  assert.equal(JSON.parse(json1.stdout).main_sha, SHA_C);
});