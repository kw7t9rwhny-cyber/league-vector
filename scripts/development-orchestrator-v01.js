"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "config/development-orchestrator-v01.json"), "utf8"));

const QA_REQUIRED_STATES = new Set(["qa-passed", "ready-for-core", "live-test"]);
const FOUNDER_GATED_STATES = new Set(["ready-for-core", "live-test"]);
const PROMOTION_TYPES = new Set(CONFIG.promotion_types || []);

function structuralTransitionAllowed(from, to) {
  return Boolean(CONFIG.transitions[from] && CONFIG.transitions[from].includes(to));
}

function qaEvidencePresent(item) {
  return Boolean(item && item.qa_verdict === "pass" && item.qa_tested_sha);
}

function qaIsFresh(item) {
  if (!item) return false;
  if (!QA_REQUIRED_STATES.has(item.status)) return true;
  return Boolean(item.head_sha && qaEvidencePresent(item) && item.head_sha === item.qa_tested_sha);
}

function productionModelPromotion(item) {
  return Boolean(item && item.promotion_type === "production-numerical-model");
}

function founderDecisionRequiredByContract(item) {
  return Boolean(item && (item.founder_decision_required === true || productionModelPromotion(item)));
}

function founderReleaseAllowed(item) {
  if (!item) return false;
  if (!founderDecisionRequiredByContract(item)) return true;
  return item.founder_decision === "approved";
}

function promotionAuthorized(item) {
  if (!item || !PROMOTION_TYPES.has(item.promotion_type)) return false;
  if (item.promotion_type === "none") return true;
  return item.promotion_authorized === true;
}

function researchPromotionSafe(item) {
  if (!item || item.type === "research") return false;
  if (item.promotion_type === "experimental-integration" || item.promotion_type === "production-numerical-model") {
    return promotionAuthorized(item);
  }
  return true;
}

function dependenciesSatisfied(item, byId) {
  if (!item || !Array.isArray(item.dependencies)) return false;
  return item.dependencies.every((id) => {
    const dependency = byId[id];
    if (!dependency) return false;
    const advanced = ["qa-passed", "ready-for-core", "waiting-founder", "live-test", "closed"].includes(dependency.status);
    if (!advanced) return false;
    if (QA_REQUIRED_STATES.has(dependency.status) && !qaIsFresh(dependency)) return false;
    return true;
  });
}

function coreEligible(item, byId = {}) {
  if (!item) return false;
  const eligibleState = item.status === "qa-passed" || item.status === "ready-for-core";
  return item.integration_required === true &&
    eligibleState &&
    qaIsFresh(item) &&
    dependenciesSatisfied(item, byId) &&
    founderReleaseAllowed(item) &&
    researchPromotionSafe(item) &&
    promotionAuthorized(item);
}

function validateItem(item, allItems = []) {
  const errors = [];
  if (!item || typeof item !== "object") return ["missing_item_metadata"];
  const byId = Object.fromEntries(allItems.map((entry) => [entry.id, entry]));

  if (!CONFIG.states.includes(item.status)) errors.push("invalid_status");
  if (!CONFIG.owners.includes(item.owner)) errors.push("invalid_owner");
  if (!CONFIG.risks.includes(item.risk)) errors.push("invalid_risk");
  if (!CONFIG.types.includes(item.type)) errors.push("invalid_type");
  if (!PROMOTION_TYPES.has(item.promotion_type)) errors.push("missing_or_invalid_promotion_type");
  if (!Array.isArray(item.dependencies)) errors.push("missing_dependencies_metadata");

  if (item.promotion_type && item.promotion_type !== "none" && item.promotion_authorized !== true) {
    errors.push("promotion_not_authorized");
  }

  if (productionModelPromotion(item)) {
    if (item.founder_decision_required !== true) errors.push("production_model_requires_founder_gate");
    if (item.founder_gate !== "production-model-promotion") errors.push("production_model_requires_promotion_gate_type");
  }

  if (QA_REQUIRED_STATES.has(item.status)) {
    if (!qaEvidencePresent(item) || !item.head_sha) errors.push("missing_qa_evidence");
    else if (item.head_sha !== item.qa_tested_sha) errors.push("stale_qa_sha");
  }

  if (founderDecisionRequiredByContract(item) && item.founder_decision === "rejected") {
    errors.push("founder_decision_rejected");
  } else if (FOUNDER_GATED_STATES.has(item.status) && !founderReleaseAllowed(item)) {
    errors.push("founder_gate_not_approved");
  }

  if (item.status === "ready-for-core") {
    if (!dependenciesSatisfied(item, byId)) errors.push("blocked_dependency");
    if (!item.integration_required) errors.push("integration_not_required");
    if (!researchPromotionSafe(item)) errors.push("raw_research_or_unauthorized_promotion");
  }

  return errors;
}

function transitionAllowed(item, from, to, allItems = []) {
  if (!structuralTransitionAllowed(from, to)) return false;
  if (!item || typeof item !== "object") return false;
  if (item.status !== from) return false;

  const candidate = { ...item, status: to };
  const validationErrors = validateItem(candidate, allItems.map((entry) => entry.id === item.id ? candidate : entry));
  if (validationErrors.length) return false;

  if (to === "ready-for-core") {
    const byId = Object.fromEntries(allItems.map((entry) => [entry.id, entry]));
    return coreEligible(candidate, byId);
  }

  if (to === "live-test") {
    return qaIsFresh(candidate) && founderReleaseAllowed(candidate) && promotionAuthorized(candidate) && researchPromotionSafe(candidate);
  }

  return true;
}

function routeAfterQaFailure(item) {
  if (!item || item.status !== "qa-failed") return null;
  return item.owner;
}

function qaDepth(risk, remediation = false) {
  if (risk === "high") return "exhaustive";
  if (risk === "medium") return "medium";
  if (risk === "low") return remediation ? "delta" : "low";
  throw new Error(`Unknown risk: ${risk}`);
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

module.exports = {
  CONFIG,
  QA_REQUIRED_STATES,
  FOUNDER_GATED_STATES,
  structuralTransitionAllowed,
  transitionAllowed,
  qaEvidencePresent,
  qaIsFresh,
  dependenciesSatisfied,
  productionModelPromotion,
  founderDecisionRequiredByContract,
  promotionAuthorized,
  researchPromotionSafe,
  coreEligible,
  routeAfterQaFailure,
  founderReleaseAllowed,
  qaDepth,
  validateItem,
  founderBrief
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "validate-transition") {
    const from = args[1];
    const to = args[2];
    let item = null;
    let allItems = [];

    if (args[3]) {
      try {
        const parsed = JSON.parse(args[3]);
        item = parsed.item || parsed;
        allItems = Array.isArray(parsed.all_items) ? parsed.all_items : [item];
      } catch (error) {
        process.stdout.write(JSON.stringify({ from, to, allowed: false, error: "invalid_item_metadata_json" }) + "\n");
        process.exit(2);
      }
    }

    const structural = structuralTransitionAllowed(from, to);
    const allowed = transitionAllowed(item, from, to, allItems);
    process.stdout.write(JSON.stringify({ from, to, structural, allowed }) + "\n");
    process.exit(allowed ? 0 : 2);
  }

  process.stdout.write(JSON.stringify({ version: CONFIG.version, states: CONFIG.states }, null, 2) + "\n");
}
