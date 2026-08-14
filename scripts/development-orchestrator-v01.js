"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "config/development-orchestrator-v01.json"), "utf8"));

const QA_REQUIRED_STATES = new Set(["qa-passed", "ready-for-core", "live-test"]);
const FOUNDER_GATED_STATES = new Set(["ready-for-core", "live-test"]);

function qaEvidencePresent(item) {
  return item.qa_verdict === "pass" && Boolean(item.qa_tested_sha);
}

function qaIsFresh(item) {
  if (!QA_REQUIRED_STATES.has(item.status)) return true;
  return Boolean(item.head_sha && qaEvidencePresent(item) && item.head_sha === item.qa_tested_sha);
}

function founderReleaseAllowed(item) {
  if (!item.founder_decision_required) return true;
  return item.founder_decision === "approved";
}

function researchPromotionSafe(item) {
  return item.type !== "research";
}

function transitionAllowed(from, to, item = null) {
  const structurallyAllowed = Boolean(CONFIG.transitions[from] && CONFIG.transitions[from].includes(to));
  if (!structurallyAllowed) return false;
  if (!item) return true;
  if (FOUNDER_GATED_STATES.has(to) && !founderReleaseAllowed(item)) return false;
  if (to === "ready-for-core" && !researchPromotionSafe(item)) return false;
  return true;
}

function dependenciesSatisfied(item, byId) {
  return (item.dependencies || []).every((id) => {
    const dependency = byId[id];
    if (!dependency) return false;
    const advanced = ["qa-passed", "ready-for-core", "waiting-founder", "live-test", "closed"].includes(dependency.status);
    if (!advanced) return false;
    if (QA_REQUIRED_STATES.has(dependency.status) && !qaIsFresh(dependency)) return false;
    return true;
  });
}

function coreEligible(item, byId) {
  const eligibleState = item.status === "qa-passed" || item.status === "ready-for-core";
  return item.integration_required === true &&
    eligibleState &&
    qaIsFresh(item) &&
    dependenciesSatisfied(item, byId) &&
    founderReleaseAllowed(item) &&
    researchPromotionSafe(item);
}

function routeAfterQaFailure(item) {
  if (item.status !== "qa-failed") return null;
  return item.owner;
}

function qaDepth(risk, remediation = false) {
  if (risk === "high") return "exhaustive";
  if (risk === "medium") return "medium";
  if (risk === "low") return remediation ? "delta" : "low";
  throw new Error(`Unknown risk: ${risk}`);
}

function validateItem(item, allItems = []) {
  const errors = [];
  const byId = Object.fromEntries(allItems.map((entry) => [entry.id, entry]));
  if (!CONFIG.states.includes(item.status)) errors.push("invalid_status");
  if (!CONFIG.owners.includes(item.owner)) errors.push("invalid_owner");
  if (!CONFIG.risks.includes(item.risk)) errors.push("invalid_risk");
  if (!CONFIG.types.includes(item.type)) errors.push("invalid_type");

  if (QA_REQUIRED_STATES.has(item.status)) {
    if (!qaEvidencePresent(item)) errors.push("missing_qa_evidence");
    else if (!item.head_sha || item.head_sha !== item.qa_tested_sha) errors.push("stale_qa_sha");
  }

  if (item.founder_decision_required && item.founder_decision === "rejected") {
    errors.push("founder_decision_rejected");
  } else if (FOUNDER_GATED_STATES.has(item.status) && !founderReleaseAllowed(item)) {
    errors.push("founder_gate_not_approved");
  }

  if (item.status === "ready-for-core") {
    if (!dependenciesSatisfied(item, byId)) errors.push("blocked_dependency");
    if (!item.integration_required) errors.push("integration_not_required");
    if (!researchPromotionSafe(item)) errors.push("raw_research_not_core_eligible");
  }

  return errors;
}

function founderBrief(items, mainSha) {
  const section = (status) => items.filter((item) => item.status === status).map((item) => ({ id: item.id, title: item.title, owner: item.owner, risk: item.risk }));
  return {
    version: CONFIG.version,
    generated_from: "deterministic-work-item-metadata",
    production: { main_sha: mainSha },
    active: section("active"),
    qa_queue: section("ready-for-qa"),
    core_queue: section("ready-for-core"),
    blocked: section("blocked"),
    founder_decisions: section("waiting-founder"),
    live_test: section("live-test")
  };
}

module.exports = { CONFIG, QA_REQUIRED_STATES, FOUNDER_GATED_STATES, transitionAllowed, qaEvidencePresent, qaIsFresh, dependenciesSatisfied, researchPromotionSafe, coreEligible, routeAfterQaFailure, founderReleaseAllowed, qaDepth, validateItem, founderBrief };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "validate-transition") {
    const ok = transitionAllowed(args[1], args[2]);
    process.stdout.write(JSON.stringify({ from: args[1], to: args[2], allowed: ok }) + "\n");
    process.exit(ok ? 0 : 2);
  }
  process.stdout.write(JSON.stringify({ version: CONFIG.version, states: CONFIG.states }, null, 2) + "\n");
}
