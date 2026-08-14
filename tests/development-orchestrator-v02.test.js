"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
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

function verdict(verdictName, sha, when = "2026-08-14T10:00:00Z") {
  return { body: `QA ${verdictName} — tested head ${sha}`, created_at: when, source: "comment" };
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
    verdict("PASS", SHA_A, "3")
  ]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].tested_sha, SHA_A);
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

test("latest current-SHA FAIL overrides earlier current-SHA PASS", () => {
  const item = normalizePr(pr(3, { events: [verdict("PASS", SHA_A, "1"), verdict("FAIL", SHA_A, "2")] }));
  assert.equal(item.qa_failed_current, true);
  assert.equal(item.qa_fresh, false);
});

test("QA FAIL followed by new candidate returns to owner only when failure is current", () => {
  const moved = deriveQueues([pr(4, { head_sha: SHA_B, declared_candidate_sha: SHA_B, body: body({ status: "ready-for-qa" }), events: [verdict("FAIL", SHA_A)] })]);
  assert.equal(moved.remediation.length, 0);
  assert.equal(moved.qa.length, 1);
  assert.equal(moved.qa[0].qa_stale, true);
});

test("current QA FAIL enters remediation queue", () => {
  const queues = deriveQueues([pr(5, { body: body({ status: "qa-failed" }), events: [verdict("FAIL", SHA_A)] })]);
  assert.equal(queues.remediation.length, 1);
  assert.equal(queues.remediation[0].recommended_action, "RETURN_TO_OWNER");
});

test("raw research marked integration_required never becomes Core eligible", () => {
  const queues = deriveQueues([pr(6, {
    body: body({ status: "qa-passed", type: "research", integration: "yes", promotion: "none" }),
    events: [verdict("PASS", SHA_A)]
  })]);
  assert.equal(queues.core.length, 0);
  assert.equal(queues.research.length, 1);
  assert.equal(queues.research[0].recommended_action, "MORE_RESEARCH_REQUIRED");
});

test("Founder-gated item without approval enters Founder queue and cannot enter Core", () => {
  const queues = deriveQueues([pr(7, {
    body: body({ status: "waiting-founder", founderRequired: "release", founderGate: "release", founderDecision: "pending" }),
    events: [verdict("PASS", SHA_A)]
  })]);
  assert.equal(queues.founder.length, 1);
  assert.equal(queues.core.length, 0);
  assert.equal(queues.founder[0].recommended_action, "WAITING_ON_FOUNDER");
});

test("rejected Founder decision remains blocked", () => {
  const queues = deriveQueues([pr(8, {
    body: body({ status: "waiting-founder", founderRequired: "release", founderGate: "release", founderDecision: "rejected" }),
    events: [verdict("PASS", SHA_A)]
  })]);
  assert.equal(queues.core.length, 0);
  assert.equal(queues.founder.length, 1);
});

test("unsatisfied dependency blocks progression", () => {
  const queues = deriveQueues([pr(9, {
    body: body({ status: "qa-passed", dependencies: "#99" }),
    events: [verdict("PASS", SHA_A)]
  })]);
  assert.equal(queues.core.length, 0);
  assert.equal(queues.items[0].recommended_action, "BLOCKED_DEPENDENCY");
});

test("satisfied dependency plus fresh QA produces Core queue item", () => {
  const dep = pr(10, { body: body({ status: "qa-passed", integration: "no" }), events: [verdict("PASS", SHA_A)] });
  const candidate = pr(11, { body: body({ status: "qa-passed", dependencies: "#10" }), events: [verdict("PASS", SHA_A)] });
  const queues = deriveQueues([dep, candidate]);
  assert.equal(queues.core.some((x) => x.id === 11), true);
  assert.equal(queues.items.find((x) => x.id === 11).recommended_action, "READY_FOR_CORE_REVIEW");
});

test("production numerical model promotion requires Founder approval", () => {
  const queues = deriveQueues([pr(12, {
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
  const queues = deriveQueues([pr(13, { state: "closed" })]);
  assert.equal(queues.qa.length, 0);
  assert.equal(queues.core.length, 0);
});

test("draft research PR remains research-only", () => {
  const queues = deriveQueues([pr(14, { draft: true, body: body({ status: "active", type: "research", integration: "no" }) })]);
  assert.equal(queues.research.length, 1);
  assert.equal(queues.core.length, 0);
});

test("candidate head movement is reported against declared SHA", () => {
  const item = normalizePr(pr(15, { head_sha: SHA_B, declared_candidate_sha: SHA_A }));
  assert.equal(item.head_matches_declared, false);
});

test("handoff generation is text-only and fail-closed for legacy", () => {
  const queues = deriveQueues([pr(16, { body: "READY FOR QA" })]);
  const text = handoffFor(queues.items[0]);
  assert.match(text, /FAIL-CLOSED: legacy\/unstructured/);
  assert.match(text, /Recommended next action: NO_ACTION/);
});

test("status JSON contains queue counts and legacy items", () => {
  const queues = deriveQueues([pr(17), pr(18, { body: "MORE RESEARCH REQUIRED" })]);
  const status = statusSummary(queues, SHA_C);
  assert.equal(status.main_sha, SHA_C);
  assert.equal(status.counts.qa, 1);
  assert.equal(status.counts.legacy_unstructured, 1);
});

test("candidate SHA extraction recognizes exact handoff forms", () => {
  assert.equal(candidateShaFromText(`Exact candidate head: \`${SHA_B}\``), SHA_B);
  assert.equal(candidateShaFromText("READY FOR QA without sha"), null);
});
