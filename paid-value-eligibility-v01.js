(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LeagueVectorPaidValueEligibility = api;
  if (root.document && root.LeagueVectorCore && root.LeagueVectorData) api.install(root, root.document);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONTRACT_VERSION = "lv-paid-value-eligibility-v1";
  const ANALYSIS_VERSION = "lv-paid-value-analysis-eligibility-v1";
  const PAID_MODE_PARAMETER = "paid_beta";
  const SAFE_CONTEXT_SURFACES = Object.freeze([
    "league_and_scoring_inputs",
    "separately_labeled_experimental_projection_board",
  ]);
  const PROJECTION_VALUE_FIELDS = Object.freeze([
    "projectionAdjustment",
    "projectedPoints",
    "neutralReplacementPoints",
    "leagueReplacementPoints",
    "neutralVorp",
    "leagueVorp",
  ]);
  const REQUIRED_CONTRACT_KEYS = Object.freeze([
    "contract_version",
    "state",
    "numeric_offensive_paid_value_available",
    "projection_policy",
    "legacy_weekly_projection_requested_during_paid_value_analysis",
    "legacy_weekly_projection_adjustment_applied",
    "projection_data_can_affect_paid_value",
    "projection_data_can_affect_player_values",
    "projection_data_can_affect_team_totals",
    "projection_data_can_affect_sorting_or_ranking",
    "projection_data_can_appear_inside_paid_value_components",
    "missing_projection_substituted_with_zero",
    "projection_coverage_fabricated",
    "safe_context_surfaces",
    "idp_dynasty_value_available",
    "offense_idp_combined_dynasty_rankings_available",
    "source_rights_state",
    "paid_delivery_authorized",
    "reason_codes",
  ].sort());

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const canonical = (value) => JSON.stringify(value, Object.keys(value || {}).sort());

  function contractFor(sourceRightsState = "UNRESOLVED") {
    const supported = sourceRightsState === "PAID_SUPPORTED";
    return {
      contract_version: CONTRACT_VERSION,
      state: supported ? "PAID_VALUE_ELIGIBLE" : "PAID_VALUE_INELIGIBLE",
      numeric_offensive_paid_value_available: supported,
      projection_policy: "CONTEXT_ONLY_NOT_IN_VALUATION",
      legacy_weekly_projection_requested_during_paid_value_analysis: false,
      legacy_weekly_projection_adjustment_applied: false,
      projection_data_can_affect_paid_value: false,
      projection_data_can_affect_player_values: false,
      projection_data_can_affect_team_totals: false,
      projection_data_can_affect_sorting_or_ranking: false,
      projection_data_can_appear_inside_paid_value_components: false,
      missing_projection_substituted_with_zero: false,
      projection_coverage_fabricated: false,
      safe_context_surfaces: [...SAFE_CONTEXT_SURFACES],
      idp_dynasty_value_available: false,
      offense_idp_combined_dynasty_rankings_available: false,
      source_rights_state: supported ? "PAID_SUPPORTED" : "UNRESOLVED",
      paid_delivery_authorized: false,
      reason_codes: supported ? [] : ["SOURCE_RIGHTS_UNRESOLVED"],
    };
  }

  function productionContract() {
    return contractFor("UNRESOLVED");
  }

  function validateContract(candidate) {
    const reasons = [];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return { valid: false, eligible: false, reasons: ["CONTRACT_NOT_OBJECT"] };
    }
    const keys = Object.keys(candidate).sort();
    if (JSON.stringify(keys) !== JSON.stringify(REQUIRED_CONTRACT_KEYS)) reasons.push("CONTRACT_FIELD_SET_MISMATCH");
    if (!["PAID_SUPPORTED", "UNRESOLVED"].includes(candidate.source_rights_state)) {
      reasons.push("SOURCE_RIGHTS_STATE_UNSUPPORTED");
    } else {
      const expected = contractFor(candidate.source_rights_state);
      for (const key of REQUIRED_CONTRACT_KEYS) {
        if (JSON.stringify(candidate[key]) !== JSON.stringify(expected[key])) reasons.push(`CONTRACT_FIELD_MISMATCH:${key}`);
      }
    }
    const valid = reasons.length === 0;
    return {
      valid,
      eligible: valid
        && candidate.state === "PAID_VALUE_ELIGIBLE"
        && candidate.numeric_offensive_paid_value_available === true
        && candidate.source_rights_state === "PAID_SUPPORTED",
      reasons,
    };
  }

  function paidValuationInput(input = {}) {
    const sanitized = { ...input };
    for (const key of [
      "projection",
      "neutralReplacement",
      "leagueReplacement",
      "legacyWeeklyProjectionContext",
      "projectionResult",
      "projectionCoverage",
    ]) delete sanitized[key];
    return sanitized;
  }

  function sanitizeValuationResult(result, contract = productionContract()) {
    const sanitized = { ...(result || {}) };
    for (const key of PROJECTION_VALUE_FIELDS) delete sanitized[key];
    sanitized.paidValueEligibility = clone(contract);
    return sanitized;
  }

  function calculatePaidValuation(calculate, input, contract = productionContract()) {
    if (typeof calculate !== "function") throw new Error("PAID_VALUE_CALCULATOR_UNAVAILABLE");
    return sanitizeValuationResult(calculate(paidValuationInput(input)), contract);
  }

  function contractFromValuation(value) {
    return value?.paidValueEligibility || value?.components?.paidValueEligibility || null;
  }

  function validateValuation(value, expectedContract) {
    const contract = contractFromValuation(value);
    const check = validateContract(contract);
    const reasons = [...check.reasons];
    if (expectedContract && JSON.stringify(contract) !== JSON.stringify(expectedContract)) {
      reasons.push("VALUATION_CONTRACT_IDENTITY_MISMATCH");
    }
    const result = value?.components || value;
    for (const key of PROJECTION_VALUE_FIELDS) {
      if (result && Object.prototype.hasOwnProperty.call(result, key)) reasons.push(`PROJECTION_FIELD_PRESENT:${key}`);
    }
    if (check.eligible && (!Number.isFinite(result?.finalValue) || result.finalValue <= 0)) {
      reasons.push("ELIGIBLE_VALUE_NOT_FINITE_NONNEGATIVE");
    }
    return {
      valid: reasons.length === 0,
      eligible: reasons.length === 0 && check.eligible,
      reasons,
    };
  }

  function buildAnalysisEligibility(valuations = [], contract = productionContract()) {
    const contractCheck = validateContract(contract);
    const valueChecks = (valuations || []).map((value) => validateValuation(value, contract));
    const reasons = [...contractCheck.reasons];
    if (!valuations.length) reasons.push("NO_ELIGIBLE_VALUATIONS");
    valueChecks.forEach((check, index) => {
      for (const reason of check.reasons) reasons.push(`VALUATION_${index}:${reason}`);
      if (!check.eligible) reasons.push(`VALUATION_${index}:INELIGIBLE`);
    });
    if (!contractCheck.eligible) reasons.push(...contract.reason_codes);
    const uniqueReasons = [...new Set(reasons)];
    const eligible = contractCheck.valid
      && contractCheck.eligible
      && valuations.length > 0
      && valueChecks.every((check) => check.valid && check.eligible);
    return {
      schema_version: ANALYSIS_VERSION,
      state: eligible ? "PAID_VALUE_ELIGIBLE" : "PAID_VALUE_INELIGIBLE",
      eligible,
      numeric_paid_output_authorized: eligible,
      contract: clone(contract),
      valuation_count: valuations.length,
      checked_value_count: valueChecks.length,
      reason_codes: uniqueReasons,
    };
  }

  function isPaidMode(root) {
    try {
      return new URLSearchParams(root.location?.search || "").get(PAID_MODE_PARAMETER) === "1";
    } catch {
      return false;
    }
  }

  function excludedProjectionResult() {
    return {
      rows: [],
      failures: [],
      status: "excluded",
      source: "PAID_BETA_EXCLUDED_LEGACY_WEEKLY_PROJECTIONS",
      documented: false,
      requested: false,
      projection_policy: "CONTEXT_ONLY_NOT_IN_VALUATION",
    };
  }

  function hardenDataAdapter(data) {
    if (!data || data.__paidValueEligibilityV1DataBoundary) return data;
    const originalRequest = typeof data.request === "function" ? data.request.bind(data) : null;
    if (originalRequest) {
      data.request = (url, options) => {
        if (/\/projections\/nfl\//i.test(String(url || ""))) {
          const error = new Error("PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED");
          error.code = "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED";
          return Promise.reject(error);
        }
        return originalRequest(url, options);
      };
    }
    data.seasonProjections = async () => excludedProjectionResult();
    if (Object.prototype.hasOwnProperty.call(data, "projectionWeek")) delete data.projectionWeek;
    Object.defineProperty(data, "__paidValueEligibilityV1DataBoundary", {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return data;
  }

  function installCoreBoundary(core, runtime) {
    if (!core || core.__paidValueEligibilityV1CoreBoundary) return;
    const originalCalculate = core.calculateValuation.bind(core);
    core.calculateValuation = (input) => {
      const result = calculatePaidValuation(originalCalculate, input, runtime.contract);
      runtime.valuations.push(result);
      return result;
    };
    core.paidValueEligibility = () => clone(runtime.contract);
    core.validatePaidValueEligibility = validateContract;
    core.buildPaidValueAnalysisEligibility = buildAnalysisEligibility;
    Object.defineProperty(core, "__paidValueEligibilityV1CoreBoundary", {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }

  function installLastAnalysisGate(root, runtime) {
    const descriptor = Object.getOwnPropertyDescriptor(root, "LeagueVectorLastAnalysis");
    if (descriptor && descriptor.configurable === false) return;
    let accepted = null;
    Object.defineProperty(root, "LeagueVectorLastAnalysis", {
      configurable: true,
      enumerable: true,
      get() { return accepted; },
      set(value) {
        const envelope = buildAnalysisEligibility(runtime.valuations, runtime.contract);
        runtime.lastEnvelope = envelope;
        accepted = envelope.eligible ? value : null;
      },
    });

    if (typeof root.dispatchEvent === "function" && !runtime.originalDispatchEvent) {
      runtime.originalDispatchEvent = root.dispatchEvent.bind(root);
      root.dispatchEvent = (event) => {
        if (event?.type === "leaguevector:analysis-ready") {
          const envelope = buildAnalysisEligibility(runtime.valuations, runtime.contract);
          runtime.lastEnvelope = envelope;
          if (!envelope.eligible) {
            accepted = null;
            if (typeof root.CustomEvent === "function") {
              return runtime.originalDispatchEvent(new root.CustomEvent("leaguevector:analysis-blocked", {
                detail: {
                  state: envelope.state,
                  reason_codes: [...envelope.reason_codes],
                },
              }));
            }
            return false;
          }
        }
        return runtime.originalDispatchEvent(event);
      };
    }
  }

  function setStaticPaidModeCopy(document) {
    document.documentElement.dataset.paidBetaMode = "1";
    for (const element of document.querySelectorAll(".section-sub")) {
      if (/Final value =/i.test(element.textContent || "")) {
        element.textContent = "Paid-beta values exclude legacy weekly projections. Numeric paid output is shown only after one analysis-wide eligibility contract validates every value and all required source-rights gates.";
      }
    }
    for (const element of document.querySelectorAll(".source-note")) {
      if (/Existing valuation projection adapter:/i.test(element.textContent || "")) {
        element.textContent = "Paid-beta mode does not request the undocumented legacy weekly projection source. Numeric IDP dynasty value remains unavailable. Paid delivery remains blocked until the separate source-rights gate is resolved.";
      }
    }
  }

  function ensureNotice(document, envelope) {
    let notice = document.getElementById("paidValueEligibility");
    if (!notice) {
      notice = document.createElement("aside");
      notice.id = "paidValueEligibility";
      notice.className = "warning-panel";
      notice.setAttribute("aria-live", "polite");
      const results = document.getElementById("results");
      const summary = results?.querySelector(".summary");
      if (results) results.insertBefore(notice, summary || results.firstChild);
    }
    notice.hidden = false;
    notice.dataset.state = envelope.state;
    notice.dataset.contractVersion = envelope.contract.contract_version;
    notice.dataset.projectionPolicy = envelope.contract.projection_policy;
    notice.dataset.sourceRightsState = envelope.contract.source_rights_state;
    notice.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = envelope.eligible ? "Paid-value eligibility verified" : "Paid-value output unavailable";
    const copy = document.createElement("p");
    copy.textContent = envelope.eligible
      ? "The analysis-wide contract and every value passed the paid-value gate. Founder review is still required before delivery."
      : `Numeric paid values were withheld. ${envelope.reason_codes.join(", ") || "Eligibility was not established."}`;
    notice.append(heading, copy);
  }

  function removeLegacyProjectionWarning(document) {
    for (const item of document.querySelectorAll("#warningList li")) {
      if (/Projection source is excluded/i.test(item.textContent || "")) item.remove();
    }
    const warningList = document.getElementById("warningList");
    const panel = document.getElementById("analysisWarnings");
    if (warningList && panel && warningList.children.length === 0) panel.hidden = true;
  }

  function unavailableBlock(document, targetId, message) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const paragraph = document.createElement("p");
    paragraph.className = "availability-warning";
    paragraph.textContent = message;
    target.replaceChildren(paragraph);
  }

  function applyAnalysisGate(root, document, runtime) {
    if (runtime.applying) return;
    const status = document.getElementById("status");
    const results = document.getElementById("results");
    if (!status || !results || results.hidden || !status.classList.contains("success")) return;
    runtime.applying = true;
    try {
      const envelope = buildAnalysisEligibility(runtime.valuations, runtime.contract);
      runtime.lastEnvelope = envelope;
      root.__leagueVectorPaidValueEligibility = clone(envelope);
      results.dataset.paidValueState = envelope.state;
      results.dataset.projectionPolicy = envelope.contract.projection_policy;
      ensureNotice(document, envelope);
      removeLegacyProjectionWarning(document);

      const projectionStatus = document.getElementById("projectionStatus");
      if (projectionStatus) {
        projectionStatus.textContent = "CONTEXT_ONLY_NOT_IN_VALUATION • The undocumented legacy weekly projection source was not requested in paid-beta mode.";
        projectionStatus.dataset.liveFixProjection = "1";
      }

      if (!envelope.eligible) {
        unavailableBlock(document, "playerValues", "Paid player values unavailable because the analysis-wide paid-value gate did not pass.");
        unavailableBlock(document, "teamAnalysis", "Paid team values and ranks unavailable because the analysis-wide paid-value gate did not pass.");
        for (const value of document.querySelectorAll("#teams .roster-value")) {
          value.textContent = "LV unavailable";
          value.classList.remove("roster-value");
          value.classList.add("paid-value-unavailable");
          value.dataset.paidValueSuppressed = "1";
        }
        const identity = document.getElementById("identityStatus");
        if (identity) identity.textContent = "Identity evidence was inspected, but no numeric paid value was authorized.";
        const scoring = document.getElementById("scoringCoverage");
        if (scoring) {
          scoring.textContent = "League scoring remains visible as context. It did not authorize a numeric paid value.";
          scoring.dataset.liveFixScoring = "1";
        }
        const quality = document.getElementById("dataQuality");
        if (quality) quality.textContent = "Paid numeric output was withheld. Weekly projections were excluded; numeric IDP dynasty value remains unavailable.";
        const searchStatus = document.getElementById("dynastySearchStatus");
        if (searchStatus) searchStatus.textContent = "Paid dynasty values are unavailable until the eligibility gate passes.";
        status.classList.remove("success");
        status.classList.add("blocked");
        status.textContent = "Paid-beta values withheld — source-rights approval remains unresolved.";
        root.LeagueVectorLastAnalysis = null;
      }
    } finally {
      runtime.applying = false;
    }
  }

  function install(root, document) {
    if (!isPaidMode(root) || root.__paidValueEligibilityV1Installed) return false;
    const runtime = {
      contract: productionContract(),
      valuations: [],
      lastEnvelope: null,
      applying: false,
      originalDispatchEvent: null,
    };
    root.__paidValueEligibilityV1Installed = true;
    root.__paidValueEligibilityV1Runtime = runtime;
    hardenDataAdapter(root.LeagueVectorData);
    installCoreBoundary(root.LeagueVectorCore, runtime);
    installLastAnalysisGate(root, runtime);
    setStaticPaidModeCopy(document);

    const reset = () => {
      runtime.valuations = [];
      runtime.lastEnvelope = null;
      root.__leagueVectorPaidValueEligibility = {
        schema_version: ANALYSIS_VERSION,
        state: "PENDING",
        eligible: false,
        numeric_paid_output_authorized: false,
        contract: clone(runtime.contract),
        valuation_count: 0,
        checked_value_count: 0,
        reason_codes: ["ANALYSIS_NOT_COMPLETED"],
      };
      const notice = document.getElementById("paidValueEligibility");
      if (notice) notice.remove();
    };

    document.getElementById("go")?.addEventListener("click", reset, { capture: true });
    document.getElementById("leagueId")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") reset();
    }, { capture: true });

    const observer = new MutationObserver(() => applyAnalysisGate(root, document, runtime));
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: ["class", "hidden"],
    });
    reset();
    return true;
  }

  return {
    CONTRACT_VERSION,
    ANALYSIS_VERSION,
    PAID_MODE_PARAMETER,
    SAFE_CONTEXT_SURFACES,
    PROJECTION_VALUE_FIELDS,
    contractFor,
    productionContract,
    validateContract,
    paidValuationInput,
    sanitizeValuationResult,
    calculatePaidValuation,
    validateValuation,
    buildAnalysisEligibility,
    excludedProjectionResult,
    hardenDataAdapter,
    isPaidMode,
    install,
  };
});
