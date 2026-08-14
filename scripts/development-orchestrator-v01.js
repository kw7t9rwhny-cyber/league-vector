"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "config/development-orchestrator-v01.json"), "utf8"));

function transitionAllowed(from, to) {
  return Boolean(CONFIG.transitions[from] && CONFIG.transitions[from].includes(to));
}

function qaIsFresh(item) {
  if (item.status !== "qa-passed") return true;
  return Boolean(item.head_sha && item.qa_tested_sha && item.head_sha === item.qa_tested_sha);
}

function dependenciesSatisfied(item, byId) {
  return (item.dependencies || []).every((id) => {
    const dependency = byId[id];
    return dependency && ["qa-passed", "ready-for-core", "waiting-founder", "live-test", "closed"].includes(dependency.status) && qaIsFresh(dependency);
  });
}

function coreEligible(item, byId) {
  return item.integration_required === true && item.status === "qa-passed" && qaIsFresh(item) && dependenciesSatisfied(item, byId) && !item.founder_decision_required;
}

function routeAfterQaFailure(item) {
  if (item.status !== "qa-failed") return null;
  return item.owner;
}

function founderReleaseAllowed(item) {
  if (!item.founder_decision_required) return true;
  return item.founder_decision === "approved";
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
  if (item.status === "qa-passed" && !qaIsFresh(item)) errors.push("stale_qa_sha");
  if (item.status === "ready-for-core" && !dependenciesSatisfied(item, byId)) errors.push("blocked_dependency");
  if (item.status === "live-test" && !founderReleaseAllowed(item)) errors.push("founder_gate_not_approved");
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

module.exports = { CONFIG, transitionAllowed, qaIsFresh, dependenciesSatisfied, coreEligible, routeAfterQaFailure, founderReleaseAllowed, qaDepth, validateItem, founderBrief };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "validate-transition") {
    const ok = transitionAllowed(args[1], args[2]);
    process.stdout.write(JSON.stringify({ from: args[1], to: args[2], allowed: ok }) + "\n");
    process.exit(ok ? 0 : 2);
  }
  process.stdout.write(JSON.stringify({ version: CONFIG.version, states: CONFIG.states }, null, 2) + "\n");
}
