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
  const MAX_SUPPORTED_VALUATIONS = 100000;
  const objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  const objectGetPrototypeOf = Object.getPrototypeOf;
  const reflectHas = Reflect.has;
  const reflectOwnKeys = Reflect.ownKeys;
  const arrayIsArray = Array.isArray;

  function uniqueReasons(reasons) {
    const seen = new Set();
    const unique = [];
    for (const reason of reasons) {
      if (!seen.has(reason)) {
        seen.add(reason);
        unique.push(reason);
      }
    }
    return unique;
  }

  function isPlainRecord(value) {
    return value !== null
      && typeof value === "object"
      && !arrayIsArray(value)
      && objectGetPrototypeOf(value) === Object.prototype;
  }

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

  function copyContractSnapshot(contract) {
    const copy = {};
    for (const key of REQUIRED_CONTRACT_KEYS) {
      const value = contract[key];
      copy[key] = arrayIsArray(value) ? value.slice() : value;
    }
    return copy;
  }

  function inspectExactStringArray(candidate, expected, field) {
    const reasons = [];
    const snapshot = [];
    if (!arrayIsArray(candidate) || objectGetPrototypeOf(candidate) !== Array.prototype) {
      return { valid: false, reasons: [`CONTRACT_FIELD_TYPE_MISMATCH:${field}`], snapshot: null };
    }

    const keys = reflectOwnKeys(candidate);
    if (keys.length !== expected.length + 1) reasons.push(`CONTRACT_FIELD_MISMATCH:${field}`);
    for (const key of keys) {
      if (key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key))) {
        reasons.push(`CONTRACT_FIELD_MISMATCH:${field}`);
      }
    }

    const lengthDescriptor = objectGetOwnPropertyDescriptor(candidate, "length");
    if (!lengthDescriptor || !("value" in lengthDescriptor) || lengthDescriptor.value !== expected.length) {
      reasons.push(`CONTRACT_FIELD_MISMATCH:${field}`);
    }
    for (let index = 0; index < expected.length; index += 1) {
      const descriptor = objectGetOwnPropertyDescriptor(candidate, String(index));
      if (!descriptor || !("value" in descriptor)) {
        reasons.push(`CONTRACT_FIELD_MISMATCH:${field}`);
        continue;
      }
      if (typeof descriptor.value !== "string" || descriptor.value !== expected[index]) {
        reasons.push(`CONTRACT_FIELD_MISMATCH:${field}`);
        continue;
      }
      snapshot.push(descriptor.value);
    }

    return {
      valid: reasons.length === 0,
      reasons: uniqueReasons(reasons),
      snapshot: reasons.length === 0 ? snapshot : null,
    };
  }

  function inspectContract(candidate) {
    const reasons = [];
    const raw = {};
    try {
      if (!isPlainRecord(candidate)) {
        return { valid: false, eligible: false, reasons: ["CONTRACT_NOT_PLAIN_OBJECT"], snapshot: null };
      }

      const keys = reflectOwnKeys(candidate);
      const keySet = new Set();
      for (const key of keys) {
        if (typeof key !== "string") reasons.push("CONTRACT_FIELD_SET_MISMATCH");
        else keySet.add(key);
      }
      if (keys.length !== REQUIRED_CONTRACT_KEYS.length) reasons.push("CONTRACT_FIELD_SET_MISMATCH");
      for (const key of REQUIRED_CONTRACT_KEYS) {
        if (!keySet.has(key)) reasons.push(`CONTRACT_FIELD_MISSING:${key}`);
      }
      for (const key of keys) {
        if (typeof key === "string" && !REQUIRED_CONTRACT_KEYS.includes(key)) {
          reasons.push(`CONTRACT_FIELD_EXTRA:${key}`);
        }
      }

      for (const key of REQUIRED_CONTRACT_KEYS) {
        const descriptor = objectGetOwnPropertyDescriptor(candidate, key);
        if (!descriptor) continue;
        if (!("value" in descriptor)) {
          reasons.push(`CONTRACT_FIELD_ACCESSOR:${key}`);
          continue;
        }
        raw[key] = descriptor.value;
      }

      const sourceRightsState = raw.source_rights_state;
      if (sourceRightsState !== "PAID_SUPPORTED" && sourceRightsState !== "UNRESOLVED") {
        reasons.push("SOURCE_RIGHTS_STATE_UNSUPPORTED");
      } else {
        const expected = contractFor(sourceRightsState);
        for (const key of REQUIRED_CONTRACT_KEYS) {
          if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
          if (arrayIsArray(expected[key])) {
            const arrayCheck = inspectExactStringArray(raw[key], expected[key], key);
            reasons.push(...arrayCheck.reasons);
            if (arrayCheck.valid) raw[key] = arrayCheck.snapshot;
          } else if (typeof raw[key] !== typeof expected[key] || raw[key] !== expected[key]) {
            reasons.push(`CONTRACT_FIELD_MISMATCH:${key}`);
          }
        }
      }
    } catch {
      reasons.push("CONTRACT_INSPECTION_FAILED");
    }

    const unique = uniqueReasons(reasons);
    const valid = unique.length === 0;
    const snapshot = valid ? copyContractSnapshot(raw) : null;
    return {
      valid,
      eligible: valid
        && snapshot.state === "PAID_VALUE_ELIGIBLE"
        && snapshot.numeric_offensive_paid_value_available === true
        && snapshot.source_rights_state === "PAID_SUPPORTED",
      reasons: unique,
      snapshot,
    };
  }

  function validateContract(candidate) {
    const inspection = inspectContract(candidate);
    return {
      valid: inspection.valid,
      eligible: inspection.eligible,
      reasons: inspection.reasons.slice(),
    };
  }

  function paidValuationInput(input = {}) {
    const sanitized = {};
    try {
      if (!isPlainRecord(input)) return sanitized;
      for (const key of reflectOwnKeys(input)) {
        if (typeof key !== "string") continue;
        const descriptor = objectGetOwnPropertyDescriptor(input, key);
        if (!descriptor || !("value" in descriptor)) return {};
        sanitized[key] = descriptor.value;
      }
    } catch {
      return {};
    }
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
    const sanitized = {};
    try {
      if (isPlainRecord(result)) {
        for (const key of reflectOwnKeys(result)) {
          if (typeof key !== "string" || PROJECTION_VALUE_FIELDS.includes(key)) continue;
          const descriptor = objectGetOwnPropertyDescriptor(result, key);
          if (!descriptor || !("value" in descriptor)) return {
            paidValueEligibility: productionContract(),
          };
          sanitized[key] = descriptor.value;
        }
      }
    } catch {
      return { paidValueEligibility: productionContract() };
    }
    const contractInspection = inspectContract(contract);
    sanitized.paidValueEligibility = contractInspection.valid
      ? copyContractSnapshot(contractInspection.snapshot)
      : productionContract();
    return sanitized;
  }

  function calculatePaidValuation(calculate, input, contract = productionContract()) {
    if (typeof calculate !== "function") throw new Error("PAID_VALUE_CALCULATOR_UNAVAILABLE");
    return sanitizeValuationResult(calculate(paidValuationInput(input)), contract);
  }

  function contractsEqual(left, right) {
    for (const key of REQUIRED_CONTRACT_KEYS) {
      const leftValue = left[key];
      const rightValue = right[key];
      if (arrayIsArray(leftValue) || arrayIsArray(rightValue)) {
        if (!arrayIsArray(leftValue) || !arrayIsArray(rightValue) || leftValue.length !== rightValue.length) {
          return false;
        }
        for (let index = 0; index < leftValue.length; index += 1) {
          if (leftValue[index] !== rightValue[index]) return false;
        }
      } else if (leftValue !== rightValue) {
        return false;
      }
    }
    return true;
  }

  function inspectForbiddenProjectionFields(record, surface, reasons) {
    for (const key of PROJECTION_VALUE_FIELDS) {
      const descriptor = objectGetOwnPropertyDescriptor(record, key);
      const label = surface ? `${surface}.${key}` : key;
      if (descriptor) reasons.push(`PROJECTION_FIELD_PRESENT:${label}`);
      else if (reflectHas(record, key)) reasons.push(`INHERITED_PROJECTION_FIELD:${label}`);
    }
  }

  function inspectValuation(value) {
    const reasons = [];
    let finalValue;
    let contractInspection = null;
    try {
      if (value === null || typeof value !== "object" || arrayIsArray(value)) {
        return {
          reasons: ["VALUATION_NOT_PLAIN_OBJECT"],
          finalValue: undefined,
          contractInspection: null,
        };
      }
      if (objectGetPrototypeOf(value) !== Object.prototype) reasons.push("VALUATION_NOT_PLAIN_OBJECT");

      const finalValueDescriptor = objectGetOwnPropertyDescriptor(value, "finalValue");
      if (!finalValueDescriptor) {
        reasons.push(reflectHas(value, "finalValue") ? "INHERITED_FINAL_VALUE" : "FINAL_VALUE_MISSING");
      } else if (!("value" in finalValueDescriptor)) {
        reasons.push("FINAL_VALUE_ACCESSOR");
      } else {
        finalValue = finalValueDescriptor.value;
      }

      const contractDescriptor = objectGetOwnPropertyDescriptor(value, "paidValueEligibility");
      if (!contractDescriptor) {
        reasons.push(reflectHas(value, "paidValueEligibility")
          ? "INHERITED_PAID_VALUE_ELIGIBILITY"
          : "PAID_VALUE_ELIGIBILITY_MISSING");
      } else if (!("value" in contractDescriptor)) {
        reasons.push("PAID_VALUE_ELIGIBILITY_ACCESSOR");
      } else {
        contractInspection = inspectContract(contractDescriptor.value);
        reasons.push(...contractInspection.reasons);
      }

      inspectForbiddenProjectionFields(value, "", reasons);

      const componentsDescriptor = objectGetOwnPropertyDescriptor(value, "components");
      if (!componentsDescriptor) {
        if (reflectHas(value, "components")) reasons.push("INHERITED_COMPONENTS_SURFACE");
      } else if (!("value" in componentsDescriptor)) {
        reasons.push("COMPONENTS_SURFACE_ACCESSOR");
      } else {
        reasons.push("COMPONENTS_SURFACE_UNSUPPORTED");
        const components = componentsDescriptor.value;
        if (components !== null && typeof components === "object" && !arrayIsArray(components)) {
          const nestedFinalValue = objectGetOwnPropertyDescriptor(components, "finalValue");
          if (nestedFinalValue || reflectHas(components, "finalValue")) {
            reasons.push(finalValueDescriptor
              ? "DUPLICATE_FINAL_VALUE_SURFACES"
              : "NESTED_FINAL_VALUE_SURFACE_UNSUPPORTED");
          }
          const nestedContract = objectGetOwnPropertyDescriptor(components, "paidValueEligibility");
          if (nestedContract || reflectHas(components, "paidValueEligibility")) {
            reasons.push(contractDescriptor
              ? "DUPLICATE_PAID_VALUE_ELIGIBILITY_SURFACES"
              : "NESTED_PAID_VALUE_ELIGIBILITY_SURFACE_UNSUPPORTED");
          }
          inspectForbiddenProjectionFields(components, "components", reasons);
        }
      }
    } catch {
      reasons.push("VALUATION_INSPECTION_FAILED");
    }

    return { reasons: uniqueReasons(reasons), finalValue, contractInspection };
  }

  function validateValuationWithExpectedSnapshot(value, expectedSnapshot) {
    const inspection = inspectValuation(value);
    const reasons = inspection.reasons.slice();
    const contractInspection = inspection.contractInspection;
    if (expectedSnapshot && contractInspection?.snapshot
      && !contractsEqual(contractInspection.snapshot, expectedSnapshot)) {
      reasons.push("VALUATION_CONTRACT_IDENTITY_MISMATCH");
    }
    if (!Number.isFinite(inspection.finalValue) || inspection.finalValue <= 0) {
      reasons.push("ELIGIBLE_VALUE_NOT_FINITE_NONNEGATIVE");
    }
    const unique = uniqueReasons(reasons);
    return {
      valid: unique.length === 0,
      eligible: unique.length === 0 && contractInspection?.eligible === true,
      reasons: unique,
    };
  }

  function validateValuation(value, expectedContract) {
    let expectedSnapshot = null;
    const expectedReasons = [];
    if (expectedContract !== undefined) {
      const expectedInspection = inspectContract(expectedContract);
      if (!expectedInspection.valid) {
        for (const reason of expectedInspection.reasons) {
          expectedReasons.push(`EXPECTED_CONTRACT_INVALID:${reason}`);
        }
      } else {
        expectedSnapshot = expectedInspection.snapshot;
      }
    }
    const result = validateValuationWithExpectedSnapshot(value, expectedSnapshot);
    if (expectedReasons.length === 0) return result;
    const reasons = uniqueReasons([...result.reasons, ...expectedReasons]);
    return { valid: false, eligible: false, reasons };
  }

  function inspectValuationCollection(valuations) {
    const reasons = [];
    const values = [];
    let valuationCount = 0;
    let checkedValueCount = 0;
    try {
      if (!arrayIsArray(valuations)) {
        return {
          valid: false,
          values,
          valuationCount,
          checkedValueCount,
          reasons: ["VALUATION_COLLECTION_NOT_ARRAY"],
        };
      }
      if (objectGetPrototypeOf(valuations) !== Array.prototype) {
        reasons.push("VALUATION_COLLECTION_NOT_PLAIN_ARRAY");
      }
      const lengthDescriptor = objectGetOwnPropertyDescriptor(valuations, "length");
      if (!lengthDescriptor || !("value" in lengthDescriptor)
        || !Number.isInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
        return {
          valid: false,
          values,
          valuationCount,
          checkedValueCount,
          reasons: ["VALUATION_COLLECTION_LENGTH_INVALID"],
        };
      }
      valuationCount = lengthDescriptor.value;
      if (valuationCount > MAX_SUPPORTED_VALUATIONS) {
        return {
          valid: false,
          values,
          valuationCount,
          checkedValueCount,
          reasons: ["VALUATION_COLLECTION_TOO_LARGE"],
        };
      }

      for (const key of reflectOwnKeys(valuations)) {
        if (key === "length") continue;
        const supportedIndex = typeof key === "string"
          && /^(0|[1-9]\d*)$/.test(key)
          && Number(key) < valuationCount;
        if (!supportedIndex) reasons.push("VALUATION_COLLECTION_UNSUPPORTED_OWN_PROPERTY");
      }

      for (let index = 0; index < valuationCount; index += 1) {
        const descriptor = objectGetOwnPropertyDescriptor(valuations, String(index));
        checkedValueCount += 1;
        if (!descriptor) {
          reasons.push(`VALUATION_${index}:SPARSE_SLOT`);
          values.push(undefined);
        } else if (!("value" in descriptor)) {
          reasons.push(`VALUATION_${index}:ACCESSOR_SLOT`);
          values.push(undefined);
        } else {
          values.push(descriptor.value);
        }
      }
    } catch {
      reasons.push("VALUATION_COLLECTION_INSPECTION_FAILED");
    }

    return {
      valid: reasons.length === 0 && checkedValueCount === valuationCount,
      values,
      valuationCount,
      checkedValueCount,
      reasons: uniqueReasons(reasons),
    };
  }

  function buildAnalysisEligibility(valuations, contract) {
    const contractInspection = inspectContract(contract);
    const collection = inspectValuationCollection(valuations);
    const reasons = [...contractInspection.reasons, ...collection.reasons];
    if (collection.valuationCount === 0) reasons.push("NO_ELIGIBLE_VALUATIONS");

    let allValuesEligible = collection.values.length === collection.valuationCount;
    for (let index = 0; index < collection.values.length; index += 1) {
      const check = validateValuationWithExpectedSnapshot(
        collection.values[index],
        contractInspection.valid ? contractInspection.snapshot : null,
      );
      for (const reason of check.reasons) reasons.push(`VALUATION_${index}:${reason}`);
      if (!check.valid || !check.eligible) {
        allValuesEligible = false;
        reasons.push(`VALUATION_${index}:INELIGIBLE`);
      }
    }
    if (contractInspection.valid && !contractInspection.eligible) {
      for (const reason of contractInspection.snapshot.reason_codes) reasons.push(reason);
    }

    const outputContract = contractInspection.valid
      ? copyContractSnapshot(contractInspection.snapshot)
      : productionContract();
    const reasonCodes = uniqueReasons(reasons);
    const eligible = contractInspection.valid
      && contractInspection.eligible
      && collection.valid
      && collection.valuationCount > 0
      && collection.checkedValueCount === collection.valuationCount
      && allValuesEligible;
    return {
      schema_version: ANALYSIS_VERSION,
      state: eligible ? "PAID_VALUE_ELIGIBLE" : "PAID_VALUE_INELIGIBLE",
      eligible,
      numeric_paid_output_authorized: eligible,
      contract: outputContract,
      valuation_count: collection.valuationCount,
      checked_value_count: collection.checkedValueCount,
      reason_codes: reasonCodes,
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

  function blockedProjectionRequest() {
    const error = new Error("PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED");
    error.code = "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED";
    return Promise.reject(error);
  }

  function canonicalPaidRequestUrl(input) {
    let raw;
    if (typeof input === "string") {
      raw = input;
    } else {
      if (typeof URL !== "function" || input === null || typeof input !== "object"
        || objectGetPrototypeOf(input) !== URL.prototype) return null;
      for (const key of ["href", "pathname", "toString"]) {
        if (objectGetOwnPropertyDescriptor(input, key)) return null;
      }
      const hrefDescriptor = objectGetOwnPropertyDescriptor(URL.prototype, "href");
      if (!hrefDescriptor || typeof hrefDescriptor.get !== "function") return null;
      raw = hrefDescriptor.get.call(input);
    }

    if (!raw || raw !== raw.trim() || /[\\\u0000-\u001f\u007f]/.test(raw)) return null;
    if (/%(?:25)*(?:2f|5c)/i.test(raw)) return null;

    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    let effectivePath = parsed.pathname;
    try {
      for (let pass = 0; pass < 4; pass += 1) {
        const decoded = decodeURIComponent(effectivePath);
        if (decoded === effectivePath) break;
        effectivePath = decoded;
      }
    } catch {
      return null;
    }
    if (effectivePath.includes("\\") || effectivePath.includes("//")) return null;
    if (/\/projections\/nfl(?:\/|$)/i.test(effectivePath)) return null;
    return parsed.href;
  }

  function hardenDataAdapter(data) {
    if (!data || data.__paidValueEligibilityV1DataBoundary) return data;
    const originalRequest = typeof data.request === "function" ? data.request.bind(data) : null;
    if (originalRequest) {
      data.request = (url, options) => {
        let canonicalUrl;
        try {
          canonicalUrl = canonicalPaidRequestUrl(url);
        } catch {
          canonicalUrl = null;
        }
        if (!canonicalUrl) return blockedProjectionRequest();
        return originalRequest(canonicalUrl, options);
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
    core.paidValueEligibility = () => copyContractSnapshot(runtime.contract);
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
      root.__leagueVectorPaidValueEligibility = {
        schema_version: envelope.schema_version,
        state: envelope.state,
        eligible: envelope.eligible,
        numeric_paid_output_authorized: envelope.numeric_paid_output_authorized,
        contract: copyContractSnapshot(envelope.contract),
        valuation_count: envelope.valuation_count,
        checked_value_count: envelope.checked_value_count,
        reason_codes: envelope.reason_codes.slice(),
      };
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
        contract: copyContractSnapshot(runtime.contract),
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
