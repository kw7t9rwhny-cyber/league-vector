(function (root, factory) {
  const browserRuntime = Boolean(root && root.document);
  const commonJs = !browserRuntime && typeof module === "object" && module && module.exports;
  const api = factory({ testHarness: Boolean(commonJs) });
  if (commonJs) module.exports = api;
  root.LeagueVectorPaidValueEligibility = api;
  if (root.document && root.LeagueVectorCore && root.LeagueVectorData) api.install(root, root.document);
})(typeof globalThis !== "undefined" ? globalThis : this, function (options) {
  "use strict";

  const testHarness = Boolean(options && options.testHarness);

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
  ]);
  const MAX_SUPPORTED_VALUATIONS = 100000;
  const MAX_SNAPSHOT_NODES = 500000;
  const MAX_PATH_DECODE_PASSES = 4;
  const objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  const objectGetPrototypeOf = Object.getPrototypeOf;
  const objectPrototype = Object.prototype;
  const arrayPrototype = Array.prototype;
  const objectDefineProperty = Object.defineProperty;
  const objectDefineProperties = Object.defineProperties;
  const objectIsExtensible = Object.isExtensible;
  const objectFreeze = Object.freeze;
  const hasOwn = Function.call.bind(Object.prototype.hasOwnProperty);
  const arrayJoin = Function.call.bind(Array.prototype.join);
  const arrayPush = Function.call.bind(Array.prototype.push);
  const arraySlice = Function.call.bind(Array.prototype.slice);
  const setAdd = Function.call.bind(Set.prototype.add);
  const setDelete = Function.call.bind(Set.prototype.delete);
  const setHas = Function.call.bind(Set.prototype.has);
  const weakSetAdd = Function.call.bind(WeakSet.prototype.add);
  const weakSetHas = Function.call.bind(WeakSet.prototype.has);
  const weakMapSet = Function.call.bind(WeakMap.prototype.set);
  const stringSplit = Function.call.bind(String.prototype.split);
  const stringTrim = Function.call.bind(String.prototype.trim);
  const regExpTest = Function.call.bind(RegExp.prototype.test);
  const reflectOwnKeys = Reflect.ownKeys;
  const reflectApply = Reflect.apply;
  const arrayIsArray = Array.isArray;
  const numberIsFinite = Number.isFinite;
  const numberIsInteger = Number.isInteger;
  const nativeNumber = Number;
  const nativeError = Error;
  const nativeSet = Set;
  const nativePromiseReject = Promise.reject.bind(Promise);
  const nativeDecodeURIComponent = decodeURIComponent;
  const nativeURL = typeof URL === "function" ? URL : null;
  const nativeURLSearchParams = typeof URLSearchParams === "function" ? URLSearchParams : null;
  const urlProtocolGetter = nativeURL
    ? objectGetOwnPropertyDescriptor(nativeURL.prototype, "protocol")?.get
    : null;
  const urlPathnameGetter = nativeURL
    ? objectGetOwnPropertyDescriptor(nativeURL.prototype, "pathname")?.get
    : null;
  const urlHrefGetter = nativeURL
    ? objectGetOwnPropertyDescriptor(nativeURL.prototype, "href")?.get
    : null;
  const urlSearchParamsGet = nativeURLSearchParams?.prototype?.get;
  const cloneHost = typeof globalThis !== "undefined" ? globalThis : null;
  const nativeStructuredClone = cloneHost && typeof cloneHost.structuredClone === "function"
    ? cloneHost.structuredClone.bind(cloneHost)
    : null;

  const trustedTestContracts = new WeakSet();
  const trustedRuntimeContracts = new WeakSet();
  const trustedRuntimeValuations = new WeakSet();
  const trustedRuntimes = new WeakSet();
  const installedRoots = new WeakSet();
  const runtimeByRoot = new WeakMap();
  const hardenedAdapters = new WeakSet();
  const inertAdapters = new WeakSet();
  const hardenedCores = new WeakSet();

  function arrayContains(array, expected) {
    for (let index = 0; index < array.length; index += 1) {
      if (array[index] === expected) return true;
    }
    return false;
  }

  function appendAll(target, values) {
    for (let index = 0; index < values.length; index += 1) {
      arrayPush(target, values[index]);
    }
  }

  function uniqueReasons(reasons) {
    const seen = new nativeSet();
    const unique = [];
    for (let index = 0; index < reasons.length; index += 1) {
      const reason = reasons[index];
      if (!setHas(seen, reason)) {
        setAdd(seen, reason);
        arrayPush(unique, reason);
      }
    }
    return unique;
  }

  function isObjectLike(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
  }

  function isPlainRecord(value) {
    return value !== null
      && typeof value === "object"
      && !arrayIsArray(value)
      && objectGetPrototypeOf(value) === objectPrototype;
  }

  function createContract(sourceRightsState = "UNRESOLVED") {
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
      safe_context_surfaces: arraySlice(SAFE_CONTEXT_SURFACES),
      idp_dynasty_value_available: false,
      offense_idp_combined_dynasty_rankings_available: false,
      source_rights_state: supported ? "PAID_SUPPORTED" : "UNRESOLVED",
      paid_delivery_authorized: false,
      reason_codes: supported ? [] : ["SOURCE_RIGHTS_UNRESOLVED"],
    };
  }

  function contractFor(sourceRightsState = "UNRESOLVED") {
    const supported = testHarness && sourceRightsState === "PAID_SUPPORTED";
    const contract = createContract(supported ? "PAID_SUPPORTED" : "UNRESOLVED");
    if (supported) weakSetAdd(trustedTestContracts, contract);
    return contract;
  }

  function productionContract() {
    return createContract("UNRESOLVED");
  }

  function internalProductionContract() {
    const contract = createContract("UNRESOLVED");
    weakSetAdd(trustedRuntimeContracts, contract);
    return contract;
  }

  function copyContractSnapshot(contract) {
    const copy = {};
    for (let index = 0; index < REQUIRED_CONTRACT_KEYS.length; index += 1) {
      const key = REQUIRED_CONTRACT_KEYS[index];
      const value = contract[key];
      copy[key] = arrayIsArray(value) ? arraySlice(value) : value;
    }
    return copy;
  }

  function snapshotFailure(reasons) {
    return { ok: false, snapshot: null, reasons: uniqueReasons(reasons) };
  }

  function preflightDataOnlyGraph(value) {
    const reasons = [];
    const seen = new nativeSet();
    const active = new nativeSet();
    let nodeCount = 0;

    function visit(current, path) {
      if (current === null) return;
      const type = typeof current;
      if (type === "undefined" || type === "string" || type === "boolean"
        || type === "number" || type === "bigint") return;
      if (type !== "object") {
        arrayPush(reasons, `AUTHORITY_SNAPSHOT_UNSUPPORTED_VALUE:${path}`);
        return;
      }
      if (setHas(active, current)) {
        arrayPush(reasons, `AUTHORITY_SNAPSHOT_CYCLIC:${path}`);
        return;
      }
      if (setHas(seen, current)) return;
      setAdd(seen, current);
      setAdd(active, current);
      nodeCount += 1;
      if (nodeCount > MAX_SNAPSHOT_NODES) {
        arrayPush(reasons, "AUTHORITY_SNAPSHOT_TOO_LARGE");
        return;
      }

      let prototype;
      let keys;
      try {
        prototype = objectGetPrototypeOf(current);
        keys = reflectOwnKeys(current);
      } catch {
        arrayPush(reasons, `AUTHORITY_SNAPSHOT_PREFLIGHT_FAILED:${path}`);
        return;
      }
      const isArray = arrayIsArray(current);
      if ((!isArray && prototype !== objectPrototype) || (isArray && prototype !== arrayPrototype)) {
        arrayPush(reasons, `AUTHORITY_SNAPSHOT_UNSUPPORTED_OBJECT:${path}`);
        return;
      }

      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        if (typeof key !== "string") {
          arrayPush(reasons, `AUTHORITY_SNAPSHOT_SYMBOL_KEY:${path}`);
          continue;
        }
        let descriptor;
        try {
          descriptor = objectGetOwnPropertyDescriptor(current, key);
        } catch {
          arrayPush(reasons, `AUTHORITY_SNAPSHOT_PREFLIGHT_FAILED:${path}.${key}`);
          continue;
        }
        if (!descriptor) {
          arrayPush(reasons, `AUTHORITY_SNAPSHOT_UNSTABLE_PROPERTY:${path}.${key}`);
          continue;
        }
        if (!("value" in descriptor)) {
          arrayPush(reasons, `AUTHORITY_SNAPSHOT_ACCESSOR:${path}.${key}`);
          continue;
        }
        if (isArray && key === "length") continue;
        visit(descriptor.value, `${path}.${key}`);
      }
      setDelete(active, current);
    }

    try {
      visit(value, "envelope");
    } catch {
      arrayPush(reasons, "AUTHORITY_SNAPSHOT_PREFLIGHT_FAILED:envelope");
    }
    return { valid: reasons.length === 0, reasons: uniqueReasons(reasons) };
  }

  function cloneDataOnlyEnvelope(envelope) {
    if (!nativeStructuredClone) return snapshotFailure(["AUTHORITY_SNAPSHOT_UNAVAILABLE"]);
    const preflight = preflightDataOnlyGraph(envelope);
    if (!preflight.valid) return snapshotFailure(preflight.reasons);
    try {
      return { ok: true, snapshot: nativeStructuredClone(envelope), reasons: [] };
    } catch {
      return snapshotFailure(["AUTHORITY_SNAPSHOT_FAILED"]);
    }
  }

  function isTrustedTestContract(candidate) {
    if (!testHarness || !isObjectLike(candidate)) return false;
    try {
      return weakSetHas(trustedTestContracts, candidate);
    } catch {
      return false;
    }
  }

  function inspectExactStringArray(candidate, expected, field) {
    const reasons = [];
    const snapshot = [];
    if (!arrayIsArray(candidate) || objectGetPrototypeOf(candidate) !== arrayPrototype) {
      return { valid: false, reasons: [`CONTRACT_FIELD_TYPE_MISMATCH:${field}`], snapshot: null };
    }

    const keys = reflectOwnKeys(candidate);
    if (keys.length !== expected.length + 1) arrayPush(reasons, `CONTRACT_FIELD_MISMATCH:${field}`);
    for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      const key = keys[keyIndex];
      if (key !== "length" && (typeof key !== "string"
        || !regExpTest(/^(0|[1-9]\d*)$/, key))) {
        arrayPush(reasons, `CONTRACT_FIELD_MISMATCH:${field}`);
      }
    }

    const lengthDescriptor = objectGetOwnPropertyDescriptor(candidate, "length");
    if (!lengthDescriptor || !("value" in lengthDescriptor) || lengthDescriptor.value !== expected.length) {
      arrayPush(reasons, `CONTRACT_FIELD_MISMATCH:${field}`);
    }
    for (let index = 0; index < expected.length; index += 1) {
      const descriptor = objectGetOwnPropertyDescriptor(candidate, String(index));
      if (!descriptor || !("value" in descriptor)) {
        arrayPush(reasons, `CONTRACT_FIELD_MISMATCH:${field}`);
        continue;
      }
      if (typeof descriptor.value !== "string" || descriptor.value !== expected[index]) {
        arrayPush(reasons, `CONTRACT_FIELD_MISMATCH:${field}`);
        continue;
      }
      arrayPush(snapshot, descriptor.value);
    }

    return {
      valid: reasons.length === 0,
      reasons: uniqueReasons(reasons),
      snapshot: reasons.length === 0 ? snapshot : null,
    };
  }

  function inspectDetachedContract(candidate) {
    const reasons = [];
    const raw = {};
    try {
      if (!isPlainRecord(candidate)) {
        return { valid: false, eligible: false, reasons: ["CONTRACT_NOT_PLAIN_OBJECT"], snapshot: null };
      }

      const keys = reflectOwnKeys(candidate);
      const keySet = new nativeSet();
      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        if (typeof key !== "string") arrayPush(reasons, "CONTRACT_FIELD_SET_MISMATCH");
        else setAdd(keySet, key);
      }
      if (keys.length !== REQUIRED_CONTRACT_KEYS.length) arrayPush(reasons, "CONTRACT_FIELD_SET_MISMATCH");
      for (let index = 0; index < REQUIRED_CONTRACT_KEYS.length; index += 1) {
        const key = REQUIRED_CONTRACT_KEYS[index];
        if (!setHas(keySet, key)) arrayPush(reasons, `CONTRACT_FIELD_MISSING:${key}`);
      }
      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        if (typeof key === "string" && !arrayContains(REQUIRED_CONTRACT_KEYS, key)) {
          arrayPush(reasons, `CONTRACT_FIELD_EXTRA:${key}`);
        }
      }

      for (let index = 0; index < REQUIRED_CONTRACT_KEYS.length; index += 1) {
        const key = REQUIRED_CONTRACT_KEYS[index];
        const descriptor = objectGetOwnPropertyDescriptor(candidate, key);
        if (!descriptor) continue;
        if (!("value" in descriptor)) {
          arrayPush(reasons, `CONTRACT_FIELD_ACCESSOR:${key}`);
          continue;
        }
        raw[key] = descriptor.value;
      }

      const sourceRightsState = raw.source_rights_state;
      if (sourceRightsState !== "PAID_SUPPORTED" && sourceRightsState !== "UNRESOLVED") {
        arrayPush(reasons, "SOURCE_RIGHTS_STATE_UNSUPPORTED");
      } else {
        const expected = createContract(sourceRightsState);
        for (let index = 0; index < REQUIRED_CONTRACT_KEYS.length; index += 1) {
          const key = REQUIRED_CONTRACT_KEYS[index];
          if (!hasOwn(raw, key)) continue;
          if (arrayIsArray(expected[key])) {
            const arrayCheck = inspectExactStringArray(raw[key], expected[key], key);
            appendAll(reasons, arrayCheck.reasons);
            if (arrayCheck.valid) raw[key] = arrayCheck.snapshot;
          } else if (typeof raw[key] !== typeof expected[key] || raw[key] !== expected[key]) {
            arrayPush(reasons, `CONTRACT_FIELD_MISMATCH:${key}`);
          }
        }
      }
    } catch {
      arrayPush(reasons, "CONTRACT_INSPECTION_FAILED");
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
    const trustedAuthority = isTrustedTestContract(candidate);
    const detached = cloneDataOnlyEnvelope({ contract: candidate, valuations: [] });
    if (!detached.ok) return { valid: false, eligible: false, reasons: arraySlice(detached.reasons) };
    const inspection = inspectDetachedContract(detached.snapshot.contract);
    const trusted = inspection.snapshot?.source_rights_state !== "PAID_SUPPORTED" || trustedAuthority;
    return {
      valid: inspection.valid,
      eligible: inspection.eligible && trusted,
      reasons: inspection.valid && inspection.eligible && !trusted
        ? ["UNTRUSTED_PAID_AUTHORITY"]
        : arraySlice(inspection.reasons),
    };
  }

  function paidValuationInput(input = {}) {
    const sanitized = {};
    const detached = cloneDataOnlyEnvelope({ input });
    if (!detached.ok || !isPlainRecord(detached.snapshot.input)) return sanitized;
    const inputKeys = reflectOwnKeys(detached.snapshot.input);
    for (let index = 0; index < inputKeys.length; index += 1) {
      const key = inputKeys[index];
      if (typeof key !== "string") continue;
      sanitized[key] = detached.snapshot.input[key];
    }
    const excludedInputFields = [
      "projection",
      "neutralReplacement",
      "leagueReplacement",
      "legacyWeeklyProjectionContext",
      "projectionResult",
      "projectionCoverage",
    ];
    for (let index = 0; index < excludedInputFields.length; index += 1) {
      delete sanitized[excludedInputFields[index]];
    }
    return sanitized;
  }

  function sanitizeValuationResult(result, contract = productionContract()) {
    const sanitized = {};
    const trustedAuthority = isTrustedTestContract(contract);
    const detached = cloneDataOnlyEnvelope({ contract, valuations: [result] });
    if (!detached.ok) return { paidValueEligibility: productionContract() };
    const detachedResult = detached.snapshot.valuations[0];
    if (isPlainRecord(detachedResult)) {
      const resultKeys = reflectOwnKeys(detachedResult);
      for (let index = 0; index < resultKeys.length; index += 1) {
        const key = resultKeys[index];
        if (typeof key !== "string" || key === "paidValueEligibility"
          || arrayContains(PROJECTION_VALUE_FIELDS, key)) continue;
        sanitized[key] = detachedResult[key];
      }
    }
    const contractInspection = inspectDetachedContract(detached.snapshot.contract);
    const contractTrusted = contractInspection.snapshot?.source_rights_state !== "PAID_SUPPORTED"
      || trustedAuthority;
    sanitized.paidValueEligibility = contractInspection.valid && contractTrusted
      ? copyContractSnapshot(contractInspection.snapshot)
      : productionContract();
    return sanitized;
  }

  function calculatePaidValuation(calculate, input, contract = productionContract()) {
    if (typeof calculate !== "function") {
      return {
        paidValueEligibility: productionContract(),
        reason_codes: ["PAID_VALUE_CALCULATOR_UNAVAILABLE"],
      };
    }
    try {
      return sanitizeValuationResult(
        reflectApply(calculate, undefined, [paidValuationInput(input)]),
        contract,
      );
    } catch {
      return {
        paidValueEligibility: productionContract(),
        reason_codes: ["PAID_VALUE_CALCULATION_FAILED"],
      };
    }
  }

  function contractsEqual(left, right) {
    for (let keyIndex = 0; keyIndex < REQUIRED_CONTRACT_KEYS.length; keyIndex += 1) {
      const key = REQUIRED_CONTRACT_KEYS[keyIndex];
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
    for (let index = 0; index < PROJECTION_VALUE_FIELDS.length; index += 1) {
      const key = PROJECTION_VALUE_FIELDS[index];
      const label = surface ? `${surface}.${key}` : key;
      if (hasOwn(record, key)) arrayPush(reasons, `PROJECTION_FIELD_PRESENT:${label}`);
    }
  }

  function inspectDetachedValuation(value) {
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
      if (objectGetPrototypeOf(value) !== objectPrototype) arrayPush(reasons, "VALUATION_NOT_PLAIN_OBJECT");

      if (!hasOwn(value, "finalValue")) arrayPush(reasons, "FINAL_VALUE_MISSING");
      else finalValue = value.finalValue;

      if (!hasOwn(value, "paidValueEligibility")) {
        arrayPush(reasons, "PAID_VALUE_ELIGIBILITY_MISSING");
      } else {
        contractInspection = inspectDetachedContract(value.paidValueEligibility);
        appendAll(reasons, contractInspection.reasons);
      }

      inspectForbiddenProjectionFields(value, "", reasons);

      if (hasOwn(value, "components")) {
        arrayPush(reasons, "COMPONENTS_SURFACE_UNSUPPORTED");
        const components = value.components;
        if (components !== null && typeof components === "object" && !arrayIsArray(components)) {
          if (hasOwn(components, "finalValue")) {
            arrayPush(reasons, hasOwn(value, "finalValue")
              ? "DUPLICATE_FINAL_VALUE_SURFACES"
              : "NESTED_FINAL_VALUE_SURFACE_UNSUPPORTED");
          }
          if (hasOwn(components, "paidValueEligibility")) {
            arrayPush(reasons, hasOwn(value, "paidValueEligibility")
              ? "DUPLICATE_PAID_VALUE_ELIGIBILITY_SURFACES"
              : "NESTED_PAID_VALUE_ELIGIBILITY_SURFACE_UNSUPPORTED");
          }
          inspectForbiddenProjectionFields(components, "components", reasons);
        }
      }
    } catch {
      arrayPush(reasons, "VALUATION_INSPECTION_FAILED");
    }

    return { reasons: uniqueReasons(reasons), finalValue, contractInspection };
  }

  function validateDetachedValuation(value, expectedSnapshot, supportedAuthorityTrusted) {
    const inspection = inspectDetachedValuation(value);
    const reasons = arraySlice(inspection.reasons);
    const contractInspection = inspection.contractInspection;
    if (expectedSnapshot && contractInspection?.snapshot
      && !contractsEqual(contractInspection.snapshot, expectedSnapshot)) {
      arrayPush(reasons, "VALUATION_CONTRACT_IDENTITY_MISMATCH");
    }
    if (!numberIsFinite(inspection.finalValue) || inspection.finalValue <= 0) {
      arrayPush(reasons, "ELIGIBLE_VALUE_NOT_FINITE_NONNEGATIVE");
    }
    if (contractInspection?.eligible && !supportedAuthorityTrusted) {
      arrayPush(reasons, "UNTRUSTED_PAID_AUTHORITY");
    }
    const unique = uniqueReasons(reasons);
    return {
      valid: unique.length === 0,
      eligible: unique.length === 0 && contractInspection?.eligible === true,
      reasons: unique,
    };
  }

  function validateValuation(value, expectedContract) {
    const trustedAuthority = expectedContract !== undefined && isTrustedTestContract(expectedContract);
    const detached = cloneDataOnlyEnvelope({
      contract: expectedContract === undefined ? null : expectedContract,
      valuations: [value],
    });
    if (!detached.ok) return { valid: false, eligible: false, reasons: arraySlice(detached.reasons) };

    let expectedSnapshot = null;
    const expectedReasons = [];
    if (expectedContract !== undefined) {
      const expectedInspection = inspectDetachedContract(detached.snapshot.contract);
      if (!expectedInspection.valid) {
        for (let index = 0; index < expectedInspection.reasons.length; index += 1) {
          arrayPush(expectedReasons, `EXPECTED_CONTRACT_INVALID:${expectedInspection.reasons[index]}`);
        }
      } else {
        expectedSnapshot = expectedInspection.snapshot;
      }
    }
    const result = validateDetachedValuation(
      detached.snapshot.valuations[0],
      expectedSnapshot,
      trustedAuthority,
    );
    if (expectedReasons.length === 0) return result;
    const combinedReasons = arraySlice(result.reasons);
    appendAll(combinedReasons, expectedReasons);
    const reasons = uniqueReasons(combinedReasons);
    return { valid: false, eligible: false, reasons };
  }

  function inspectDetachedValuationCollection(valuations) {
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
      if (objectGetPrototypeOf(valuations) !== arrayPrototype) {
        arrayPush(reasons, "VALUATION_COLLECTION_NOT_PLAIN_ARRAY");
      }
      const lengthDescriptor = objectGetOwnPropertyDescriptor(valuations, "length");
      if (!lengthDescriptor || !("value" in lengthDescriptor)
        || !numberIsInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
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

      const keys = reflectOwnKeys(valuations);
      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        if (key === "length") continue;
        const supportedIndex = typeof key === "string"
          && regExpTest(/^(0|[1-9]\d*)$/, key)
          && nativeNumber(key) < valuationCount;
        if (!supportedIndex) arrayPush(reasons, "VALUATION_COLLECTION_UNSUPPORTED_OWN_PROPERTY");
      }

      for (let index = 0; index < valuationCount; index += 1) {
        const descriptor = objectGetOwnPropertyDescriptor(valuations, String(index));
        checkedValueCount += 1;
        if (!descriptor) {
          arrayPush(reasons, `VALUATION_${index}:SPARSE_SLOT`);
          arrayPush(values, undefined);
        } else if (!("value" in descriptor)) {
          arrayPush(reasons, `VALUATION_${index}:ACCESSOR_SLOT`);
          arrayPush(values, undefined);
        } else {
          arrayPush(values, descriptor.value);
        }
      }
    } catch {
      arrayPush(reasons, "VALUATION_COLLECTION_INSPECTION_FAILED");
    }

    return {
      valid: reasons.length === 0 && checkedValueCount === valuationCount,
      values,
      valuationCount,
      checkedValueCount,
      reasons: uniqueReasons(reasons),
    };
  }

  function buildDetachedAnalysisEligibility(detachedEnvelope, supportedAuthorityTrusted) {
    const contractInspection = inspectDetachedContract(detachedEnvelope.contract);
    const collection = inspectDetachedValuationCollection(detachedEnvelope.valuations);
    const reasons = arraySlice(contractInspection.reasons);
    appendAll(reasons, collection.reasons);
    if (collection.valuationCount === 0) arrayPush(reasons, "NO_ELIGIBLE_VALUATIONS");

    let allValuesEligible = collection.values.length === collection.valuationCount;
    for (let index = 0; index < collection.values.length; index += 1) {
      const check = validateDetachedValuation(
        collection.values[index],
        contractInspection.valid ? contractInspection.snapshot : null,
        supportedAuthorityTrusted,
      );
      for (let reasonIndex = 0; reasonIndex < check.reasons.length; reasonIndex += 1) {
        arrayPush(reasons, `VALUATION_${index}:${check.reasons[reasonIndex]}`);
      }
      if (!check.valid || !check.eligible) {
        allValuesEligible = false;
        arrayPush(reasons, `VALUATION_${index}:INELIGIBLE`);
      }
    }
    if (contractInspection.valid && !contractInspection.eligible) {
      appendAll(reasons, contractInspection.snapshot.reason_codes);
    }
    if (contractInspection.eligible && !supportedAuthorityTrusted) {
      arrayPush(reasons, "UNTRUSTED_PAID_AUTHORITY");
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
      && allValuesEligible
      && supportedAuthorityTrusted;
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

  function failedAnalysisEligibility(reasons) {
    return {
      schema_version: ANALYSIS_VERSION,
      state: "PAID_VALUE_INELIGIBLE",
      eligible: false,
      numeric_paid_output_authorized: false,
      contract: productionContract(),
      valuation_count: 0,
      checked_value_count: 0,
      reason_codes: uniqueReasons(reasons),
    };
  }

  function buildAnalysisEligibility(valuations, contract) {
    const trustedAuthority = isTrustedTestContract(contract);
    const detached = cloneDataOnlyEnvelope({ contract, valuations });
    if (!detached.ok) return failedAnalysisEligibility(detached.reasons);
    return buildDetachedAnalysisEligibility(detached.snapshot, trustedAuthority);
  }

  function buildRuntimeAnalysisEligibility(runtime) {
    let trusted = false;
    try {
      trusted = weakSetHas(trustedRuntimes, runtime)
        && weakSetHas(trustedRuntimeContracts, runtime.contract);
      for (let index = 0; index < runtime.ledger.length; index += 1) {
        if (!weakSetHas(trustedRuntimeValuations, runtime.ledger[index])) trusted = false;
      }
    } catch {
      return failedAnalysisEligibility(["INTERNAL_AUTHORITY_INVALID"]);
    }
    const detached = cloneDataOnlyEnvelope({ contract: runtime.contract, valuations: runtime.ledger });
    if (!detached.ok) return failedAnalysisEligibility(detached.reasons);
    const envelope = buildDetachedAnalysisEligibility(detached.snapshot, trusted);
    if (!trusted) {
      envelope.eligible = false;
      envelope.state = "PAID_VALUE_INELIGIBLE";
      envelope.numeric_paid_output_authorized = false;
      const reasons = arraySlice(envelope.reason_codes);
      arrayPush(reasons, "INTERNAL_AUTHORITY_INVALID");
      envelope.reason_codes = uniqueReasons(reasons);
    }
    return envelope;
  }

  function isPaidMode(root) {
    try {
      if (!nativeURLSearchParams || typeof urlSearchParamsGet !== "function"
        || !isObjectLike(root)) return false;
      const search = root.location?.search;
      if (typeof search !== "string") return false;
      const params = new nativeURLSearchParams(search);
      return reflectApply(urlSearchParamsGet, params, [PAID_MODE_PARAMETER]) === "1";
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
    const error = new nativeError("PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED");
    error.code = "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED";
    return nativePromiseReject(error);
  }

  function normalizePathname(pathname) {
    const segments = stringSplit(pathname, "/");
    const normalized = [];
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (!segment || segment === ".") continue;
      if (segment === "..") {
        if (normalized.length > 0) normalized.length -= 1;
      }
      else arrayPush(normalized, segment);
    }
    return `/${arrayJoin(normalized, "/")}`;
  }

  function isForbiddenProjectionPath(pathname) {
    return regExpTest(/\/projections\/nfl(?:\/|$)/i, normalizePathname(pathname));
  }

  function canonicalPaidRequestUrl(input) {
    if (typeof input !== "string" || !nativeURL) return null;
    const raw = input;
    if (!raw || raw !== stringTrim(raw)
      || regExpTest(/[\\\s\u0000-\u001f\u007f]/, raw)) return null;

    let parsed;
    try {
      parsed = new nativeURL(raw);
    } catch {
      return null;
    }
    if (!urlProtocolGetter || !urlPathnameGetter || !urlHrefGetter) return null;
    let protocol;
    let href;
    let effectivePath;
    try {
      protocol = reflectApply(urlProtocolGetter, parsed, []);
      effectivePath = reflectApply(urlPathnameGetter, parsed, []);
      href = reflectApply(urlHrefGetter, parsed, []);
    } catch {
      return null;
    }
    if (protocol !== "http:" && protocol !== "https:") return null;

    for (let pass = 0; pass <= MAX_PATH_DECODE_PASSES; pass += 1) {
      if (regExpTest(/[\\\s\u0000-\u001f\u007f]/, effectivePath)
        || isForbiddenProjectionPath(effectivePath)) return null;
      let decoded;
      try {
        decoded = nativeDecodeURIComponent(effectivePath);
      } catch {
        return null;
      }
      if (decoded === effectivePath) return href;
      if (pass === MAX_PATH_DECODE_PASSES) return null;
      effectivePath = decoded;
    }
    return href;
  }

  function inertDataAdapter() {
    const adapter = {
      request: () => blockedProjectionRequest(),
      seasonProjections: async () => excludedProjectionResult(),
    };
    weakSetAdd(inertAdapters, adapter);
    return objectFreeze(adapter);
  }

  function hardenDataAdapter(data) {
    try {
      if (!isPlainRecord(data)) return inertDataAdapter();
      if (weakSetHas(hardenedAdapters, data)) return data;
      const requestDescriptor = objectGetOwnPropertyDescriptor(data, "request");
      const seasonDescriptor = objectGetOwnPropertyDescriptor(data, "seasonProjections");
      const projectionWeekDescriptor = objectGetOwnPropertyDescriptor(data, "projectionWeek");
      const originalRequest = requestDescriptor && "value" in requestDescriptor
        && typeof requestDescriptor.value === "function"
        ? requestDescriptor.value
        : null;
      if (!originalRequest) return inertDataAdapter();
      const canReplaceRequest = requestDescriptor.configurable || requestDescriptor.writable;
      const canReplaceSeason = !seasonDescriptor
        ? objectIsExtensible(data)
        : seasonDescriptor.configurable || seasonDescriptor.writable;
      const canRemoveProjectionWeek = !projectionWeekDescriptor || projectionWeekDescriptor.configurable;
      if (!canReplaceRequest || !canReplaceSeason || !canRemoveProjectionWeek) return inertDataAdapter();

      const guardedRequest = (url, options) => {
        const canonicalUrl = canonicalPaidRequestUrl(url);
        if (!canonicalUrl) return blockedProjectionRequest();
        try {
          return reflectApply(originalRequest, data, [canonicalUrl, options]);
        } catch (error) {
          return nativePromiseReject(error);
        }
      };
      objectDefineProperties(data, {
        request: {
          value: guardedRequest,
          enumerable: requestDescriptor.enumerable,
          configurable: requestDescriptor.configurable,
          writable: requestDescriptor.writable,
        },
        seasonProjections: {
          value: async () => excludedProjectionResult(),
          enumerable: seasonDescriptor?.enumerable ?? true,
          configurable: seasonDescriptor?.configurable ?? true,
          writable: seasonDescriptor?.writable ?? true,
        },
      });
      if (projectionWeekDescriptor) delete data.projectionWeek;
      weakSetAdd(hardenedAdapters, data);
      return data;
    } catch {
      return inertDataAdapter();
    }
  }

  function installCoreBoundary(core, runtime) {
    try {
      if (!isPlainRecord(core) || weakSetHas(hardenedCores, core)) return false;
      const calculateDescriptor = objectGetOwnPropertyDescriptor(core, "calculateValuation");
      if (!calculateDescriptor || !("value" in calculateDescriptor)
        || typeof calculateDescriptor.value !== "function" || !objectIsExtensible(core)) return false;
      const originalCalculate = calculateDescriptor.value;
      const wrappedCalculate = (input) => {
        const result = calculatePaidValuation(
          (safeInput) => reflectApply(originalCalculate, core, [safeInput]),
          input,
          runtime.contract,
        );
        const detached = cloneDataOnlyEnvelope({ contract: runtime.contract, valuations: [result] });
        if (detached.ok) {
          const snapshot = detached.snapshot.valuations[0];
          weakSetAdd(trustedRuntimeValuations, snapshot);
          arrayPush(runtime.ledger, snapshot);
        } else {
          arrayPush(runtime.ledger, {
            paidValueEligibility: productionContract(),
            reason_codes: arraySlice(detached.reasons),
          });
        }
        return result;
      };
      objectDefineProperties(core, {
        calculateValuation: {
          value: wrappedCalculate,
          enumerable: calculateDescriptor.enumerable,
          configurable: calculateDescriptor.configurable,
          writable: calculateDescriptor.writable,
        },
        paidValueEligibility: {
          value: () => copyContractSnapshot(runtime.contract),
          enumerable: true,
          configurable: true,
          writable: true,
        },
        validatePaidValueEligibility: {
          value: validateContract,
          enumerable: true,
          configurable: true,
          writable: true,
        },
        buildPaidValueAnalysisEligibility: {
          value: buildAnalysisEligibility,
          enumerable: true,
          configurable: true,
          writable: true,
        },
      });
      weakSetAdd(hardenedCores, core);
      return true;
    } catch {
      return false;
    }
  }

  function installLastAnalysisGate(root, runtime) {
    try {
      const descriptor = objectGetOwnPropertyDescriptor(root, "LeagueVectorLastAnalysis");
      if (descriptor && descriptor.configurable === false) return false;
      let accepted = null;
      objectDefineProperty(root, "LeagueVectorLastAnalysis", {
        configurable: true,
        enumerable: true,
        get() { return accepted; },
        set(value) {
          const envelope = buildRuntimeAnalysisEligibility(runtime);
          runtime.lastEnvelope = envelope;
          accepted = envelope.eligible ? value : null;
        },
      });

      if (typeof root.dispatchEvent === "function" && !runtime.originalDispatchEvent) {
        const originalDispatchEvent = root.dispatchEvent;
        runtime.originalDispatchEvent = (event) => reflectApply(originalDispatchEvent, root, [event]);
        root.dispatchEvent = (event) => {
          if (event?.type === "leaguevector:analysis-ready") {
            const envelope = buildRuntimeAnalysisEligibility(runtime);
            runtime.lastEnvelope = envelope;
            if (!envelope.eligible) {
              accepted = null;
              if (typeof root.CustomEvent === "function") {
                return runtime.originalDispatchEvent(new root.CustomEvent("leaguevector:analysis-blocked", {
                  detail: {
                    state: envelope.state,
                    reason_codes: arraySlice(envelope.reason_codes),
                  },
                }));
              }
              return false;
            }
          }
          return runtime.originalDispatchEvent(event);
        };
      }
      return true;
    } catch {
      return false;
    }
  }

  function setStaticPaidModeCopy(document) {
    document.documentElement.dataset.paidBetaMode = "1";
    const sectionSubtitles = document.querySelectorAll(".section-sub");
    for (let index = 0; index < sectionSubtitles.length; index += 1) {
      const element = sectionSubtitles[index];
      if (regExpTest(/Final value =/i, element.textContent || "")) {
        element.textContent = "Paid-beta values exclude legacy weekly projections. Numeric paid output is shown only after one analysis-wide eligibility contract validates every value and all required source-rights gates.";
      }
    }
    const sourceNotes = document.querySelectorAll(".source-note");
    for (let index = 0; index < sourceNotes.length; index += 1) {
      const element = sourceNotes[index];
      if (regExpTest(/Existing valuation projection adapter:/i, element.textContent || "")) {
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
      : `Numeric paid values were withheld. ${arrayJoin(envelope.reason_codes, ", ") || "Eligibility was not established."}`;
    notice.append(heading, copy);
  }

  function removeLegacyProjectionWarning(document) {
    const warningItems = document.querySelectorAll("#warningList li");
    for (let index = 0; index < warningItems.length; index += 1) {
      const item = warningItems[index];
      if (regExpTest(/Projection source is excluded/i, item.textContent || "")) item.remove();
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
      const envelope = buildRuntimeAnalysisEligibility(runtime);
      runtime.lastEnvelope = envelope;
      root.__leagueVectorPaidValueEligibility = {
        schema_version: envelope.schema_version,
        state: envelope.state,
        eligible: envelope.eligible,
        numeric_paid_output_authorized: envelope.numeric_paid_output_authorized,
        contract: copyContractSnapshot(envelope.contract),
        valuation_count: envelope.valuation_count,
        checked_value_count: envelope.checked_value_count,
        reason_codes: arraySlice(envelope.reason_codes),
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
        const rosterValues = document.querySelectorAll("#teams .roster-value");
        for (let index = 0; index < rosterValues.length; index += 1) {
          const value = rosterValues[index];
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
    try {
      if (!isObjectLike(root) || !isObjectLike(document) || !isPaidMode(root)
        || weakSetHas(installedRoots, root)) return false;
      if (typeof document.getElementById !== "function"
        || typeof document.querySelectorAll !== "function"
        || typeof document.createElement !== "function"
        || !document.documentElement
        || typeof root.MutationObserver !== "function") return false;
      if (hasOwn(root, "__paidValueEligibilityV1Installed")) return false;

      const runtime = {
        contract: internalProductionContract(),
        ledger: [],
        lastEnvelope: null,
        applying: false,
        originalDispatchEvent: null,
        observer: null,
      };
      weakSetAdd(trustedRuntimes, runtime);

      const hardenedData = hardenDataAdapter(root.LeagueVectorData);
      if (weakSetHas(inertAdapters, hardenedData)) return false;
      if (!installCoreBoundary(root.LeagueVectorCore, runtime)) return false;
      if (!installLastAnalysisGate(root, runtime)) return false;
      setStaticPaidModeCopy(document);

      const reset = () => {
        runtime.ledger.length = 0;
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

      const observer = new root.MutationObserver(() => applyAnalysisGate(root, document, runtime));
      observer.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
        attributeFilter: ["class", "hidden"],
      });
      runtime.observer = observer;
      weakSetAdd(installedRoots, root);
      weakMapSet(runtimeByRoot, root, runtime);
      objectDefineProperty(root, "__paidValueEligibilityV1Installed", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false,
      });
      reset();
      return true;
    } catch {
      return false;
    }
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
