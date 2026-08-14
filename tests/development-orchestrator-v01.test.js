"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const O = require("../scripts/development-orchestrator-v01.js");

const base = { id: "x", title: "candidate", owner: "projection", risk: "high", type: "feature", status: "active", dependencies: [], integration_required: false, founder_decision_required: false };
const passed = { head_sha: "abc", qa_tested_sha: "abc", qa_verdict: "pass" };

test("valid and invalid state transitions", () => {
  assert.equal(O.transitionAllowed("active", "ready-for-qa"), true);
  assert.equal(O.transitionAllowed("ready-for-qa", "qa-passed"), true);
  assert.equal(O.transitionAllowed("qa-passed", "active"), false);
  assert.equal(O.transitionAllowed("closed", "active"), false);
});

test("QA approval is exact-SHA bound and becomes stale after a commit", () => {
  assert.equal(O.qaIsFresh({ ...base, status: "qa-passed", ...passed }), true);
  assert.equal(O.qaIsFresh({ ...base, status: "qa-passed", ...passed, head_sha: "def" }), false);
});

test("qa-passed requires explicit PASS evidence", () => {
  const missing = { ...base, status: "qa-passed", head_sha: "abc", qa_tested_sha: "abc" };
  assert.deepEqual(O.validateItem(missing, [missing]), ["missing_qa_evidence"]);
});

test("ready-for-core fails closed on missing or stale QA evidence", () => {
  const missing = { ...base, status: "ready-for-core", integration_required: true, head_sha: "abc" };
  assert.ok(O.validateItem(missing, [missing]).includes("missing_qa_evidence"));
  assert.equal(O.coreEligible(missing, {}), false);

  const stale = { ...base, status: "ready-for-core", integration_required: true, ...passed, head_sha: "new" };
  assert.ok(O.validateItem(stale, [stale]).includes("stale_qa_sha"));
  assert.equal(O.coreEligible(stale, {}), false);
});

test("head change after QA PASS becomes invalid even after ready-for-core transition", () => {
  const fresh = { ...base, status: "ready-for-core", integration_required: true, ...passed };
  assert.deepEqual(O.validateItem(fresh, [fresh]), []);
  assert.equal(O.coreEligible(fresh, {}), true);

  const changed = { ...fresh, head_sha: "new-head" };
  assert.deepEqual(O.validateItem(changed, [changed]), ["stale_qa_sha"]);
  assert.equal(O.coreEligible(changed, {}), false);
});

test("Founder-gated progression fails closed until approved", () => {
  const gated = { ...base, integration_required: true, founder_decision_required: true, founder_decision: null, ...passed };
  assert.equal(O.transitionAllowed("waiting-founder", "ready-for-core", gated), false);
  assert.equal(O.transitionAllowed("waiting-founder", "live-test", gated), false);
  assert.equal(O.coreEligible({ ...gated, status: "qa-passed" }, {}), false);

  const ready = { ...gated, status: "ready-for-core" };
  assert.ok(O.validateItem(ready, [ready]).includes("founder_gate_not_approved"));

  const live = { ...gated, status: "live-test" };
  assert.ok(O.validateItem(live, [live]).includes("founder_gate_not_approved"));
});

test("approved Founder gate allows intended progression", () => {
  const approved = { ...base, status: "qa-passed", integration_required: true, founder_decision_required: true, founder_decision: "approved", ...passed };
  assert.equal(O.founderReleaseAllowed(approved), true);
  assert.equal(O.transitionAllowed("waiting-founder", "ready-for-core", approved), true);
  assert.equal(O.coreEligible(approved, {}), true);

  const ready = { ...approved, status: "ready-for-core" };
  assert.deepEqual(O.validateItem(ready, [ready]), []);
  assert.equal(O.transitionAllowed("ready-for-core", "live-test", ready), true);
});

test("rejected Founder decision is blocked", () => {
  const rejected = { ...base, status: "ready-for-core", integration_required: true, founder_decision_required: true, founder_decision: "rejected", ...passed };
  assert.ok(O.validateItem(rejected, [rejected]).includes("founder_decision_rejected"));
  assert.equal(O.coreEligible(rejected, {}), false);
  assert.equal(O.transitionAllowed("waiting-founder", "ready-for-core", rejected), false);
});

test("QA failure routes to original owner", () => {
  assert.equal(O.routeAfterQaFailure({ ...base, status: "qa-failed", owner: "rookie" }), "rookie");
});

test("dependency blocking prevents Core eligibility", () => {
  const dependency = { ...base, id: "dep", status: "ready-for-qa", head_sha: "a" };
  const item = { ...base, id: "item", status: "qa-passed", head_sha: "b", qa_tested_sha: "b", qa_verdict: "pass", integration_required: true, dependencies: ["dep"] };
  assert.equal(O.coreEligible(item, { dep: dependency }), false);
});

test("Core eligibility requires fresh QA and satisfied dependencies", () => {
  const dependency = { ...base, id: "dep", status: "qa-passed", head_sha: "a", qa_tested_sha: "a", qa_verdict: "pass" };
  const item = { ...base, id: "item", status: "qa-passed", head_sha: "b", qa_tested_sha: "b", qa_verdict: "pass", integration_required: true, dependencies: ["dep"] };
  assert.equal(O.coreEligible(item, { dep: dependency }), true);
});

test("raw research cannot become Core eligible even with accidental integration flag", () => {
  const research = { ...base, type: "research", status: "qa-passed", integration_required: true, ...passed };
  assert.equal(O.researchPromotionSafe(research), false);
  assert.equal(O.coreEligible(research, {}), false);
  assert.equal(O.transitionAllowed("qa-passed", "ready-for-core", research), false);

  const mislabeledReady = { ...research, status: "ready-for-core" };
  assert.ok(O.validateItem(mislabeledReady, [mislabeledReady]).includes("raw_research_not_core_eligible"));
});

test("separate non-research promotion item may depend on validated research", () => {
  const research = { ...base, id: "research", type: "research", status: "qa-passed", ...passed };
  const promotion = { ...base, id: "promotion", type: "feature", status: "qa-passed", integration_required: true, dependencies: ["research"], ...passed };
  assert.equal(O.coreEligible(promotion, { research }), true);
});

test("risk tiers select deterministic QA depth", () => {
  assert.equal(O.qaDepth("low", true), "delta");
  assert.equal(O.qaDepth("medium"), "medium");
  assert.equal(O.qaDepth("high"), "exhaustive");
});

test("status validator catches stale QA and Founder gate violations", () => {
  const stale = { ...base, status: "qa-passed", head_sha: "new", qa_tested_sha: "old", qa_verdict: "pass" };
  assert.deepEqual(O.validateItem(stale, [stale]), ["stale_qa_sha"]);
  const gated = { ...base, status: "live-test", founder_decision_required: true, founder_decision: null, ...passed };
  assert.deepEqual(O.validateItem(gated, [gated]), ["founder_gate_not_approved"]);
});
