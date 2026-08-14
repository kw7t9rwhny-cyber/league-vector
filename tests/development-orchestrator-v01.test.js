"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const O = require("../scripts/development-orchestrator-v01.js");

const base = {
  id: "x",
  title: "candidate",
  owner: "projection",
  risk: "high",
  type: "feature",
  status: "active",
  dependencies: [],
  integration_required: false,
  founder_decision_required: false,
  promotion_type: "none"
};
const passed = { head_sha: "abc", qa_tested_sha: "abc", qa_verdict: "pass" };

function transition(item, from, to, allItems = [item]) {
  return O.transitionAllowed(item, from, to, allItems);
}

test("structural transition topology is separate from authorization", () => {
  assert.equal(O.structuralTransitionAllowed("active", "ready-for-qa"), true);
  assert.equal(O.structuralTransitionAllowed("qa-passed", "ready-for-core"), true);
  assert.equal(O.structuralTransitionAllowed("qa-passed", "active"), false);
  assert.equal(O.structuralTransitionAllowed("closed", "active"), false);

  assert.equal(O.transitionAllowed(null, "active", "ready-for-qa"), false);
  assert.equal(O.transitionAllowed(null, "qa-passed", "ready-for-core"), false);
});

test("authorized ordinary transition requires item metadata", () => {
  const item = { ...base, status: "active" };
  assert.equal(transition(item, "active", "ready-for-qa"), true);
});

test("QA approval is exact-SHA bound and becomes stale after a commit", () => {
  assert.equal(O.qaIsFresh({ ...base, status: "qa-passed", ...passed }), true);
  assert.equal(O.qaIsFresh({ ...base, status: "qa-passed", ...passed, head_sha: "def" }), false);
});

test("qa-passed requires explicit PASS evidence", () => {
  const missing = { ...base, status: "qa-passed", head_sha: "abc", qa_tested_sha: "abc" };
  assert.deepEqual(O.validateItem(missing, [missing]), ["missing_qa_evidence"]);
});

test("qa-passed transition cannot omit exact-SHA metadata", () => {
  const missing = { ...base, status: "ready-for-qa" };
  assert.equal(transition(missing, "ready-for-qa", "qa-passed"), false);

  const stale = { ...base, status: "ready-for-qa", head_sha: "new", qa_tested_sha: "old", qa_verdict: "pass" };
  assert.equal(transition(stale, "ready-for-qa", "qa-passed"), false);

  const fresh = { ...base, status: "ready-for-qa", ...passed };
  assert.equal(transition(fresh, "ready-for-qa", "qa-passed"), true);
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

test("metadata omission cannot bypass Core eligibility", () => {
  assert.equal(O.structuralTransitionAllowed("qa-passed", "ready-for-core"), true);
  assert.equal(O.transitionAllowed(null, "qa-passed", "ready-for-core"), false);

  const incomplete = { ...base, status: "qa-passed", integration_required: true };
  assert.equal(transition(incomplete, "qa-passed", "ready-for-core"), false);
});

test("Founder-gated progression fails closed until approved", () => {
  const gated = { ...base, status: "waiting-founder", integration_required: true, founder_decision_required: true, founder_gate: "release", founder_decision: null, ...passed };
  assert.equal(transition(gated, "waiting-founder", "ready-for-core"), false);
  assert.equal(transition(gated, "waiting-founder", "live-test"), false);
  assert.equal(O.coreEligible({ ...gated, status: "qa-passed" }, {}), false);

  const ready = { ...gated, status: "ready-for-core" };
  assert.ok(O.validateItem(ready, [ready]).includes("founder_gate_not_approved"));

  const live = { ...gated, status: "live-test" };
  assert.ok(O.validateItem(live, [live]).includes("founder_gate_not_approved"));
});

test("metadata omission cannot bypass Founder gate", () => {
  assert.equal(O.structuralTransitionAllowed("waiting-founder", "ready-for-core"), true);
  assert.equal(O.transitionAllowed(null, "waiting-founder", "ready-for-core"), false);
  assert.equal(O.structuralTransitionAllowed("ready-for-core", "live-test"), true);
  assert.equal(O.transitionAllowed(null, "ready-for-core", "live-test"), false);
});

test("approved Founder gate allows intended progression", () => {
  const approvedWaiting = { ...base, status: "waiting-founder", integration_required: true, founder_decision_required: true, founder_gate: "release", founder_decision: "approved", ...passed };
  assert.equal(O.founderReleaseAllowed(approvedWaiting), true);
  assert.equal(transition(approvedWaiting, "waiting-founder", "ready-for-core"), true);

  const ready = { ...approvedWaiting, status: "ready-for-core" };
  assert.deepEqual(O.validateItem(ready, [ready]), []);
  assert.equal(transition(ready, "ready-for-core", "live-test"), true);
});

test("rejected Founder decision is blocked", () => {
  const rejected = { ...base, status: "waiting-founder", integration_required: true, founder_decision_required: true, founder_gate: "release", founder_decision: "rejected", ...passed };
  assert.equal(transition(rejected, "waiting-founder", "ready-for-core"), false);
  const candidate = { ...rejected, status: "ready-for-core" };
  assert.ok(O.validateItem(candidate, [candidate]).includes("founder_decision_rejected"));
  assert.equal(O.coreEligible(candidate, {}), false);
});

test("QA failure routes to original owner", () => {
  assert.equal(O.routeAfterQaFailure({ ...base, status: "qa-failed", owner: "rookie" }), "rookie");
});

test("dependency blocking prevents Core eligibility and transition", () => {
  const dependency = { ...base, id: "dep", status: "ready-for-qa", head_sha: "a" };
  const item = { ...base, id: "item", status: "qa-passed", head_sha: "b", qa_tested_sha: "b", qa_verdict: "pass", integration_required: true, dependencies: ["dep"] };
  assert.equal(O.coreEligible(item, { dep: dependency }), false);
  assert.equal(transition(item, "qa-passed", "ready-for-core", [item, dependency]), false);
});

test("Core eligibility requires fresh QA and satisfied dependencies", () => {
  const dependency = { ...base, id: "dep", status: "qa-passed", head_sha: "a", qa_tested_sha: "a", qa_verdict: "pass" };
  const item = { ...base, id: "item", status: "qa-passed", head_sha: "b", qa_tested_sha: "b", qa_verdict: "pass", integration_required: true, dependencies: ["dep"] };
  assert.equal(O.coreEligible(item, { dep: dependency }), true);
  assert.equal(transition(item, "qa-passed", "ready-for-core", [item, dependency]), true);
});

test("raw research cannot become Core eligible even with accidental integration flag", () => {
  const research = { ...base, type: "research", status: "qa-passed", integration_required: true, ...passed };
  assert.equal(O.researchPromotionSafe(research), false);
  assert.equal(O.coreEligible(research, {}), false);
  assert.equal(transition(research, "qa-passed", "ready-for-core"), false);

  const mislabeledReady = { ...research, status: "ready-for-core" };
  assert.ok(O.validateItem(mislabeledReady, [mislabeledReady]).includes("raw_research_or_unauthorized_promotion"));
});

test("metadata omission cannot bypass research firewall", () => {
  assert.equal(O.transitionAllowed(null, "qa-passed", "ready-for-core"), false);
  const researchMissingType = { ...base, status: "qa-passed", type: undefined, integration_required: true, ...passed };
  assert.equal(transition(researchMissingType, "qa-passed", "ready-for-core"), false);
});

test("separate authorized non-research promotion item may depend on validated research", () => {
  const research = { ...base, id: "research", type: "research", status: "qa-passed", ...passed };
  const promotion = {
    ...base,
    id: "promotion",
    type: "feature",
    status: "qa-passed",
    integration_required: true,
    dependencies: ["research"],
    promotion_type: "experimental-integration",
    promotion_authorized: true,
    ...passed
  };
  assert.equal(O.coreEligible(promotion, { research }), true);
  assert.equal(transition(promotion, "qa-passed", "ready-for-core", [promotion, research]), true);
});

test("unauthorized promotion cannot cross Core boundary", () => {
  const promotion = { ...base, status: "qa-passed", integration_required: true, promotion_type: "experimental-integration", promotion_authorized: false, ...passed };
  assert.ok(O.validateItem(promotion, [promotion]).includes("promotion_not_authorized"));
  assert.equal(O.coreEligible(promotion, {}), false);
  assert.equal(transition(promotion, "qa-passed", "ready-for-core"), false);
});

test("production numerical model promotion automatically requires Founder gate metadata", () => {
  const omitted = { ...base, status: "active", promotion_type: "production-numerical-model", promotion_authorized: true };
  const errors = O.validateItem(omitted, [omitted]);
  assert.ok(errors.includes("production_model_requires_founder_gate"));
  assert.ok(errors.includes("production_model_requires_promotion_gate_type"));

  const gated = {
    ...base,
    status: "waiting-founder",
    integration_required: true,
    promotion_type: "production-numerical-model",
    promotion_authorized: true,
    founder_decision_required: true,
    founder_gate: "production-model-promotion",
    founder_decision: null,
    ...passed
  };
  assert.equal(transition(gated, "waiting-founder", "ready-for-core"), false);

  const approved = { ...gated, founder_decision: "approved" };
  assert.equal(transition(approved, "waiting-founder", "ready-for-core"), true);
});

test("promotion_type metadata is required and omission cannot silently downgrade gate", () => {
  const missing = { ...base, promotion_type: undefined, status: "active" };
  assert.ok(O.validateItem(missing, [missing]).includes("missing_or_invalid_promotion_type"));
});

test("live-test boundary requires fresh QA and all applicable authorization metadata", () => {
  const ready = { ...base, status: "ready-for-core", integration_required: true, ...passed };
  assert.equal(transition(ready, "ready-for-core", "live-test"), true);

  assert.equal(O.transitionAllowed(null, "ready-for-core", "live-test"), false);
  assert.equal(transition({ ...ready, qa_tested_sha: "old" }, "ready-for-core", "live-test"), false);
  assert.equal(transition({ ...ready, type: "research" }, "ready-for-core", "live-test"), false);
});

test("risk tiers select deterministic QA depth", () => {
  assert.equal(O.qaDepth("low", true), "delta");
  assert.equal(O.qaDepth("medium"), "medium");
  assert.equal(O.qaDepth("high"), "exhaustive");
});

test("status validator catches stale QA and Founder gate violations", () => {
  const stale = { ...base, status: "qa-passed", head_sha: "new", qa_tested_sha: "old", qa_verdict: "pass" };
  assert.deepEqual(O.validateItem(stale, [stale]), ["stale_qa_sha"]);
  const gated = { ...base, status: "live-test", founder_decision_required: true, founder_gate: "release", founder_decision: null, ...passed };
  assert.deepEqual(O.validateItem(gated, [gated]), ["founder_gate_not_approved"]);
});

test("CLI validate-transition fails closed when metadata is omitted", () => {
  const script = path.resolve(__dirname, "../scripts/development-orchestrator-v01.js");
  for (const [from, to] of [
    ["qa-passed", "ready-for-core"],
    ["waiting-founder", "ready-for-core"],
    ["ready-for-core", "live-test"]
  ]) {
    const result = spawnSync(process.execPath, [script, "validate-transition", from, to], { encoding: "utf8" });
    assert.equal(result.status, 2);
    const output = JSON.parse(result.stdout.trim());
    assert.equal(output.structural, true);
    assert.equal(output.allowed, false);
  }
});

test("CLI validate-transition authorizes only with complete metadata", () => {
  const script = path.resolve(__dirname, "../scripts/development-orchestrator-v01.js");
  const item = { ...base, status: "qa-passed", integration_required: true, ...passed };
  const payload = JSON.stringify({ item, all_items: [item] });
  const result = spawnSync(process.execPath, [script, "validate-transition", "qa-passed", "ready-for-core", payload], { encoding: "utf8" });
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout.trim());
  assert.equal(output.structural, true);
  assert.equal(output.allowed, true);
});
