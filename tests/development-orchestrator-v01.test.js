"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const O = require("../scripts/development-orchestrator-v01.js");

const base = { id: "x", title: "candidate", owner: "projection", risk: "high", status: "active", dependencies: [], integration_required: false, founder_decision_required: false };

test("valid and invalid state transitions", () => {
  assert.equal(O.transitionAllowed("active", "ready-for-qa"), true);
  assert.equal(O.transitionAllowed("ready-for-qa", "qa-passed"), true);
  assert.equal(O.transitionAllowed("qa-passed", "active"), false);
  assert.equal(O.transitionAllowed("closed", "active"), false);
});

test("QA approval is exact-SHA bound and becomes stale after a commit", () => {
  assert.equal(O.qaIsFresh({ ...base, status: "qa-passed", head_sha: "abc", qa_tested_sha: "abc" }), true);
  assert.equal(O.qaIsFresh({ ...base, status: "qa-passed", head_sha: "def", qa_tested_sha: "abc" }), false);
});

test("Founder-gated release fails closed until approved", () => {
  const waiting = { ...base, founder_decision_required: true, founder_decision: null };
  assert.equal(O.founderReleaseAllowed(waiting), false);
  assert.equal(O.founderReleaseAllowed({ ...waiting, founder_decision: "approved" }), true);
});

test("QA failure routes to original owner", () => {
  assert.equal(O.routeAfterQaFailure({ ...base, status: "qa-failed", owner: "rookie" }), "rookie");
});

test("dependency blocking prevents Core eligibility", () => {
  const dependency = { ...base, id: "dep", status: "ready-for-qa", head_sha: "a" };
  const item = { ...base, id: "item", status: "qa-passed", head_sha: "b", qa_tested_sha: "b", integration_required: true, dependencies: ["dep"] };
  assert.equal(O.coreEligible(item, { dep: dependency }), false);
});

test("Core eligibility requires QA-passed exact head and satisfied dependencies", () => {
  const dependency = { ...base, id: "dep", status: "qa-passed", head_sha: "a", qa_tested_sha: "a" };
  const item = { ...base, id: "item", status: "qa-passed", head_sha: "b", qa_tested_sha: "b", integration_required: true, dependencies: ["dep"] };
  assert.equal(O.coreEligible(item, { dep: dependency }), true);
});

test("research-only candidate does not enter Core queue", () => {
  const item = { ...base, status: "qa-passed", head_sha: "a", qa_tested_sha: "a", integration_required: false };
  assert.equal(O.coreEligible(item, {}), false);
});

test("risk tiers select deterministic QA depth", () => {
  assert.equal(O.qaDepth("low", true), "delta");
  assert.equal(O.qaDepth("medium"), "medium");
  assert.equal(O.qaDepth("high"), "exhaustive");
});

test("status validator catches stale QA and Founder gate violations", () => {
  const stale = { ...base, status: "qa-passed", head_sha: "new", qa_tested_sha: "old" };
  assert.deepEqual(O.validateItem(stale, [stale]), ["stale_qa_sha"]);
  const gated = { ...base, status: "live-test", founder_decision_required: true, founder_decision: null };
  assert.deepEqual(O.validateItem(gated, [gated]), ["founder_gate_not_approved"]);
});
