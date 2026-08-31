const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Paid = require("../paid-value-eligibility-v01.js");

function supportedValue(overrides = {}) {
  return {
    marketBaseline: 8000,
    finalValue: 8240,
    paidValueEligibility: Paid.contractFor("PAID_SUPPORTED"),
    ...overrides,
  };
}

function assertIneligibleEnvelope(envelope, valuationCount, checkedValueCount = valuationCount) {
  assert.equal(envelope.eligible, false);
  assert.equal(envelope.state, "PAID_VALUE_INELIGIBLE");
  assert.equal(envelope.numeric_paid_output_authorized, false);
  if (valuationCount !== undefined) assert.equal(envelope.valuation_count, valuationCount);
  if (checkedValueCount !== undefined) assert.equal(envelope.checked_value_count, checkedValueCount);
}

test("production contract is structurally valid but paid-ineligible while source rights remain unresolved", () => {
  const contract = Paid.productionContract();
  const result = Paid.validateContract(contract);
  assert.equal(result.valid, true);
  assert.equal(result.eligible, false);
  assert.equal(contract.state, "PAID_VALUE_INELIGIBLE");
  assert.equal(contract.numeric_offensive_paid_value_available, false);
  assert.equal(contract.source_rights_state, "UNRESOLVED");
  assert.equal(contract.paid_delivery_authorized, false);
  assert.deepEqual(contract.reason_codes, ["SOURCE_RIGHTS_UNRESOLVED"]);
});

test("synthetic PAID_SUPPORTED positive control is reachable without authorizing delivery", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const result = Paid.validateContract(contract);
  assert.equal(result.valid, true);
  assert.equal(result.eligible, true);
  assert.equal(contract.state, "PAID_VALUE_ELIGIBLE");
  assert.equal(contract.numeric_offensive_paid_value_available, true);
  assert.equal(contract.paid_delivery_authorized, false);
  assert.deepEqual(contract.reason_codes, []);
});

const contradictionMutations = [
  ["state", "PAID_VALUE_ELIGIBLE"],
  ["numeric_offensive_paid_value_available", true],
  ["projection_policy", "DRIFTED_UNSAFE_POLICY"],
  ["legacy_weekly_projection_requested_during_paid_value_analysis", true],
  ["legacy_weekly_projection_adjustment_applied", true],
  ["projection_data_can_affect_paid_value", true],
  ["projection_data_can_affect_player_values", true],
  ["projection_data_can_affect_team_totals", true],
  ["projection_data_can_affect_sorting_or_ranking", true],
  ["projection_data_can_appear_inside_paid_value_components", true],
  ["missing_projection_substituted_with_zero", true],
  ["projection_coverage_fabricated", true],
  ["safe_context_surfaces", ["league_and_scoring_inputs", "unauthorized_surface"]],
  ["idp_dynasty_value_available", true],
  ["offense_idp_combined_dynasty_rankings_available", true],
  ["paid_delivery_authorized", true],
  ["reason_codes", []],
];

for (const [field, value] of contradictionMutations) {
  test(`strict contract rejects contradictory ${field}`, () => {
    const contract = Paid.productionContract();
    contract[field] = value;
    const result = Paid.validateContract(contract);
    assert.equal(result.valid, false);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((reason) => reason.includes(field)));
  });
}

test("strict contract rejects missing and extra safety-bearing fields", () => {
  const missing = Paid.productionContract();
  delete missing.projection_data_can_affect_team_totals;
  assert.equal(Paid.validateContract(missing).valid, false);

  const extra = Paid.productionContract();
  extra.unreviewed_override = true;
  assert.equal(Paid.validateContract(extra).valid, false);
});

test("UNKNOWN source rights never become PAID_SUPPORTED", () => {
  const contract = Paid.productionContract();
  contract.source_rights_state = "UNKNOWN";
  const result = Paid.validateContract(contract);
  assert.equal(result.valid, false);
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes("SOURCE_RIGHTS_STATE_UNSUPPORTED"));
});

test("contract booleans cannot masquerade through caller-controlled toJSON hooks", () => {
  for (const field of [
    "projection_data_can_affect_paid_value",
    "paid_delivery_authorized",
    "missing_projection_substituted_with_zero",
  ]) {
    let toJSONCalls = 0;
    const contract = Paid.contractFor("PAID_SUPPORTED");
    contract[field] = {
      unsafe_truthy: true,
      toJSON() { toJSONCalls += 1; return false; },
    };
    const result = Paid.validateContract(contract);
    assert.equal(result.valid, false, field);
    assert.equal(result.eligible, false, field);
    assert.equal(toJSONCalls, 0, field);
    assert.ok(result.reasons.some((reason) => reason.startsWith("AUTHORITY_SNAPSHOT_UNSUPPORTED_VALUE:")), field);
  }
});

test("contract safety fields must be own data properties and accessors are never invoked", () => {
  let getterCalls = 0;
  const accessor = Paid.contractFor("PAID_SUPPORTED");
  Object.defineProperty(accessor, "paid_delivery_authorized", {
    enumerable: true,
    configurable: true,
    get() { getterCalls += 1; return false; },
  });
  const accessorResult = Paid.validateContract(accessor);
  assert.equal(accessorResult.valid, false);
  assert.equal(accessorResult.eligible, false);
  assert.equal(getterCalls, 0);
  assert.ok(accessorResult.reasons.includes("AUTHORITY_SNAPSHOT_ACCESSOR:envelope.contract.paid_delivery_authorized"));

  const inherited = Object.create(Paid.contractFor("PAID_SUPPORTED"));
  const inheritedResult = Paid.validateContract(inherited);
  assert.equal(inheritedResult.valid, false);
  assert.equal(inheritedResult.eligible, false);
  assert.ok(inheritedResult.reasons.some((reason) => reason.startsWith("AUTHORITY_SNAPSHOT_UNSUPPORTED_OBJECT:")));
});

test("contract string arrays must be dense exact primitive arrays", () => {
  const cases = [];

  const sparseSurfaces = Paid.contractFor("PAID_SUPPORTED");
  sparseSurfaces.safe_context_surfaces = new Array(2);
  sparseSurfaces.safe_context_surfaces[0] = "league_and_scoring_inputs";
  cases.push(sparseSurfaces);

  const mistypedSurface = Paid.contractFor("PAID_SUPPORTED");
  mistypedSurface.safe_context_surfaces[1] = { toString: () => "separately_labeled_experimental_projection_board" };
  cases.push(mistypedSurface);

  const malformedReasons = Paid.productionContract();
  malformedReasons.reason_codes = { 0: "SOURCE_RIGHTS_UNRESOLVED", length: 1 };
  cases.push(malformedReasons);

  const extraArrayProperty = Paid.productionContract();
  extraArrayProperty.reason_codes.toJSON = () => ["SOURCE_RIGHTS_UNRESOLVED"];
  cases.push(extraArrayProperty);

  for (const contract of cases) {
    const result = Paid.validateContract(contract);
    assert.equal(result.valid, false);
    assert.equal(result.eligible, false);
  }
});

test("contract validation catches hostile reflection and remains deterministic", () => {
  const hostile = new Proxy(Paid.contractFor("PAID_SUPPORTED"), {
    ownKeys() { throw new Error("hostile ownKeys"); },
  });
  assert.deepEqual(Paid.validateContract(hostile), {
    valid: false,
    eligible: false,
    reasons: ["AUTHORITY_SNAPSHOT_PREFLIGHT_FAILED:envelope.contract"],
  });
});

test("paid valuation input strips every legacy projection-bearing input", () => {
  const input = {
    player: { position: "QB" },
    market: { base: 8000 },
    context: {},
    projection: { points: 999999 },
    neutralReplacement: { levels: { QB: -999999 } },
    leagueReplacement: { levels: { QB: 999999 } },
    legacyWeeklyProjectionContext: { rows: [1] },
    projectionResult: { status: "complete" },
    projectionCoverage: 1,
  };
  const sanitized = Paid.paidValuationInput(input);
  for (const field of [
    "projection",
    "neutralReplacement",
    "leagueReplacement",
    "legacyWeeklyProjectionContext",
    "projectionResult",
    "projectionCoverage",
  ]) assert.equal(field in sanitized, false);
  assert.deepEqual(sanitized.player, input.player);
  assert.deepEqual(sanitized.market, input.market);
});

test("paid valuation output strips all projection-derived value fields", () => {
  const result = Paid.sanitizeValuationResult({
    finalValue: 8240,
    projectionAdjustment: 0.16,
    projectedPoints: 500,
    neutralReplacementPoints: 200,
    leagueReplacementPoints: 250,
    neutralVorp: 300,
    leagueVorp: 250,
  }, Paid.contractFor("PAID_SUPPORTED"));
  for (const field of Paid.PROJECTION_VALUE_FIELDS) assert.equal(field in result, false);
  assert.equal(result.finalValue, 8240);
  assert.equal(Paid.validateValuation(result, Paid.contractFor("PAID_SUPPORTED")).eligible, true);
});

test("calculation wrapper prevents projection input from influencing the result", () => {
  const calculate = (input) => ({
    finalValue: input.projection ? 9520 : 8240,
    projectionAdjustment: input.projection ? 0.16 : 0,
    projectedPoints: input.projection?.points || 0,
  });
  const complete = Paid.calculatePaidValuation(calculate, {
    projection: { points: 500 },
    neutralReplacement: { levels: { QB: 200 } },
  }, Paid.contractFor("PAID_SUPPORTED"));
  const partial = Paid.calculatePaidValuation(calculate, {
    projection: { points: 1 },
  }, Paid.contractFor("PAID_SUPPORTED"));
  const absent = Paid.calculatePaidValuation(calculate, {}, Paid.contractFor("PAID_SUPPORTED"));
  assert.deepEqual([complete.finalValue, partial.finalValue, absent.finalValue], [8240, 8240, 8240]);
  for (const result of [complete, partial, absent]) {
    for (const field of Paid.PROJECTION_VALUE_FIELDS) assert.equal(field in result, false);
  }
});

test("analysis-wide positive control requires every value to share the exact eligible contract", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const values = [supportedValue(), supportedValue({ finalValue: 6000 })];
  const envelope = Paid.buildAnalysisEligibility(values, contract);
  assert.equal(envelope.eligible, true);
  assert.equal(envelope.state, "PAID_VALUE_ELIGIBLE");
  assert.equal(envelope.numeric_paid_output_authorized, true);
  assert.equal(envelope.valuation_count, 2);
  assert.deepEqual(envelope.reason_codes, []);
});

test("sparse valuation collections account for and reject every claimed slot", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const cases = [
    new Array(1),
    [supportedValue(), ,],
    [, supportedValue()],
    [supportedValue(), , supportedValue()],
  ];
  const expectedCounts = [1, 2, 2, 3];
  for (let index = 0; index < cases.length; index += 1) {
    const envelope = Paid.buildAnalysisEligibility(cases[index], contract);
    assertIneligibleEnvelope(envelope, expectedCounts[index], expectedCounts[index]);
    assert.ok(envelope.reason_codes.some((reason) => reason.includes("SPARSE_SLOT")));
  }
});

test("caller traversal overrides are never invoked and cannot suppress invalid values", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  let mapCalls = 0;
  const mapOverride = [supportedValue({ finalValue: 0 })];
  mapOverride.map = () => { mapCalls += 1; return []; };
  const mapEnvelope = Paid.buildAnalysisEligibility(mapOverride, contract);
  assertIneligibleEnvelope(mapEnvelope, 0, 0);
  assert.equal(mapCalls, 0);
  assert.ok(mapEnvelope.reason_codes.some((reason) => reason.startsWith("AUTHORITY_SNAPSHOT_UNSUPPORTED_VALUE:")));

  let iteratorCalls = 0;
  const iteratorOverride = [supportedValue({ finalValue: -1 })];
  iteratorOverride[Symbol.iterator] = function* hostileIterator() {
    iteratorCalls += 1;
    yield supportedValue();
  };
  const iteratorEnvelope = Paid.buildAnalysisEligibility(iteratorOverride, contract);
  assertIneligibleEnvelope(iteratorEnvelope, 0, 0);
  assert.equal(iteratorCalls, 0);
  assert.ok(iteratorEnvelope.reason_codes.some((reason) => reason.startsWith("AUTHORITY_SNAPSHOT_")));
});

test("non-array and hostile collection inputs fail closed without throwing", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  for (const input of [
    { 0: supportedValue(), length: 1 },
    {},
    "not-an-array",
    null,
    undefined,
  ]) {
    const envelope = Paid.buildAnalysisEligibility(input, contract);
    assertIneligibleEnvelope(envelope, 0, 0);
    assert.ok(envelope.reason_codes.includes("VALUATION_COLLECTION_NOT_ARRAY"));
  }

  const hostile = new Proxy([supportedValue()], {
    getOwnPropertyDescriptor(target, key) {
      if (key === "0") throw new Error("hostile index");
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const hostileEnvelope = Paid.buildAnalysisEligibility(hostile, contract);
  assertIneligibleEnvelope(hostileEnvelope, 0, 0);
  assert.ok(hostileEnvelope.reason_codes.some((reason) => reason.startsWith("AUTHORITY_SNAPSHOT_")));
});

test("ordinary dense collection snapshots every index exactly once and remains eligible", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const values = [supportedValue({ finalValue: 1 }), supportedValue({ finalValue: 2 })];
  const envelope = Paid.buildAnalysisEligibility(values, contract);
  assert.equal(envelope.eligible, true);
  assert.equal(envelope.state, "PAID_VALUE_ELIGIBLE");
  assert.equal(envelope.numeric_paid_output_authorized, true);
  assert.equal(envelope.valuation_count, 2);
  assert.equal(envelope.checked_value_count, 2);
  assert.deepEqual(envelope.reason_codes, []);
});

test("collection Proxy descriptor lies cannot replace an underlying zero valuation", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const target = [supportedValue({ finalValue: 0 })];
  const collection = new Proxy(target, {
    getOwnPropertyDescriptor(inner, key) {
      if (key === "0") {
        return {
          value: supportedValue({ finalValue: 1 }),
          enumerable: true,
          configurable: true,
          writable: true,
        };
      }
      return Reflect.getOwnPropertyDescriptor(inner, key);
    },
  });
  const envelope = Paid.buildAnalysisEligibility(collection, contract);
  assertIneligibleEnvelope(envelope, 0, 0);
  assert.equal(target[0].finalValue, 0);
  assert.ok(envelope.reason_codes.includes("AUTHORITY_SNAPSHOT_FAILED"));
});

test("collection Proxy traps cannot create analysis authority", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const trapCases = [
    ["ownKeys", (calls) => ({
      ownKeys(target) { calls.count += 1; return Reflect.ownKeys(target); },
    })],
    ["get", (calls) => ({
      get(target, key, receiver) { calls.count += 1; return Reflect.get(target, key, receiver); },
    })],
    ["getOwnPropertyDescriptor", (calls) => ({
      getOwnPropertyDescriptor(target, key) {
        calls.count += 1;
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    })],
    ["has", (calls) => ({
      has(target, key) { calls.count += 1; return Reflect.has(target, key); },
    })],
    ["iterator", (calls) => ({
      get(target, key, receiver) {
        if (key === Symbol.iterator) calls.count += 1;
        return Reflect.get(target, key, receiver);
      },
    })],
    ["length", (calls) => ({
      get(target, key, receiver) {
        if (key === "length") calls.count += 1;
        return Reflect.get(target, key, receiver);
      },
    })],
    ["mutation", (calls) => ({
      getOwnPropertyDescriptor(target, key) {
        if (key === "0") {
          calls.count += 1;
          target[0].finalValue = 2;
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    })],
  ];

  for (const [label, handlerFor] of trapCases) {
    const calls = { count: 0 };
    const collection = new Proxy([supportedValue({ finalValue: 0 })], handlerFor(calls));
    const envelope = Paid.buildAnalysisEligibility(collection, contract);
    assertIneligibleEnvelope(envelope, 0, 0);
    assert.ok(envelope.reason_codes.some((reason) => reason.startsWith("AUTHORITY_SNAPSHOT_")), label);
  }
});

test("contract Proxy descriptors cannot hide unsafe authority fields", () => {
  const target = Paid.contractFor("PAID_SUPPORTED");
  target.paid_delivery_authorized = true;
  const contract = new Proxy(target, {
    getOwnPropertyDescriptor(inner, key) {
      if (key === "paid_delivery_authorized") {
        return { value: false, enumerable: true, configurable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(inner, key);
    },
  });
  const result = Paid.validateContract(contract);
  assert.equal(result.valid, false);
  assert.equal(result.eligible, false);
  assert.equal(target.paid_delivery_authorized, true);
  assert.ok(result.reasons.includes("AUTHORITY_SNAPSHOT_FAILED"));
});

test("valuation Proxy descriptors cannot hide zero, projection, or conflicting surfaces", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const target = {
    finalValue: 0,
    projectionAdjustment: 99,
    paidValueEligibility: contract,
    components: {
      finalValue: 1,
      paidValueEligibility: Paid.productionContract(),
    },
  };
  const valuation = new Proxy(target, {
    ownKeys() { return ["finalValue", "paidValueEligibility"]; },
    getOwnPropertyDescriptor(inner, key) {
      if (key === "finalValue") {
        return { value: 1, enumerable: true, configurable: true, writable: true };
      }
      return Reflect.getOwnPropertyDescriptor(inner, key);
    },
    has(inner, key) {
      if (key === "projectionAdjustment" || key === "components") return false;
      return Reflect.has(inner, key);
    },
  });
  const envelope = Paid.buildAnalysisEligibility([valuation], contract);
  assertIneligibleEnvelope(envelope, 0, 0);
  assert.equal(target.finalValue, 0);
  assert.equal(target.projectionAdjustment, 99);
  assert.ok(envelope.reason_codes.includes("AUTHORITY_SNAPSHOT_FAILED"));
});

test("revoked Proxies and Proxies wrapping trusted records fail closed", () => {
  const trusted = Paid.contractFor("PAID_SUPPORTED");
  const wrapped = new Proxy(trusted, {});
  const wrappedResult = Paid.validateContract(wrapped);
  assert.equal(wrappedResult.valid, false);
  assert.equal(wrappedResult.eligible, false);

  const revocable = Proxy.revocable([supportedValue()], {});
  revocable.revoke();
  const envelope = Paid.buildAnalysisEligibility(revocable.proxy, trusted);
  assertIneligibleEnvelope(envelope, 0, 0);
  assert.ok(envelope.reason_codes.some((reason) => reason.startsWith("AUTHORITY_SNAPSHOT_")));
});

test("mutation of a later valuation during Proxy preflight cannot authorize", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const later = supportedValue({ finalValue: 0 });
  const first = supportedValue();
  first.paidValueEligibility = new Proxy(first.paidValueEligibility, {
    ownKeys(target) {
      later.finalValue = 2;
      return Reflect.ownKeys(target);
    },
  });
  const envelope = Paid.buildAnalysisEligibility([first, later], contract);
  assertIneligibleEnvelope(envelope, 0, 0);
  assert.equal(later.finalValue, 2);
  assert.ok(envelope.reason_codes.includes("AUTHORITY_SNAPSHOT_FAILED"));
});

test("snapshot failures are deterministic and the clone boundary has one call site", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const hostile = new Proxy([supportedValue()], {
    ownKeys() { throw new Error("snapshot denied"); },
  });
  assert.deepEqual(
    Paid.buildAnalysisEligibility(hostile, contract),
    Paid.buildAnalysisEligibility(hostile, contract),
  );

  const source = fs.readFileSync("paid-value-eligibility-v01.js", "utf8");
  assert.equal((source.match(/nativeStructuredClone\(envelope\)/g) || []).length, 1);
  assert.match(source, /cloneDataOnlyEnvelope\(\{ contract, valuations \}\)/);
  assert.match(source, /return buildDetachedAnalysisEligibility\(detached\.snapshot, trustedAuthority\)/);
});

test("post-initialization intrinsic tampering cannot manufacture authority", async () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  contract.paid_delivery_authorized = true;
  const values = [{ finalValue: 1, paidValueEligibility: contract }];
  const data = { request: async (url) => ({ value: url }) };
  Paid.hardenDataAdapter(data);
  const originals = {
    iterator: Array.prototype[Symbol.iterator],
    join: Array.prototype.join,
    push: Array.prototype.push,
    setHas: Set.prototype.has,
    weakSetHas: WeakSet.prototype.has,
    split: String.prototype.split,
    trim: String.prototype.trim,
    test: RegExp.prototype.test,
  };
  let envelope;
  let blockedRequest;
  try {
    Array.prototype[Symbol.iterator] = function* emptyIterator() {};
    Array.prototype.join = () => "/v1/state/nfl";
    Array.prototype.push = function ignoredPush() { return this.length; };
    Set.prototype.has = () => true;
    WeakSet.prototype.has = () => true;
    String.prototype.split = () => ["v1", "state", "nfl"];
    String.prototype.trim = function unsafeTrim() { return this; };
    RegExp.prototype.test = () => false;
    envelope = Paid.buildAnalysisEligibility(values, contract);
    blockedRequest = data.request("https://safe.test/projections/nfl/2026/1");
  } finally {
    Array.prototype[Symbol.iterator] = originals.iterator;
    Array.prototype.join = originals.join;
    Array.prototype.push = originals.push;
    Set.prototype.has = originals.setHas;
    WeakSet.prototype.has = originals.weakSetHas;
    String.prototype.split = originals.split;
    String.prototype.trim = originals.trim;
    RegExp.prototype.test = originals.test;
  }
  assertIneligibleEnvelope(envelope, 1, 1);
  assert.ok(envelope.reason_codes.includes("CONTRACT_FIELD_MISMATCH:paid_delivery_authorized"));
  await assert.rejects(
    () => blockedRequest,
    (error) => error.code === "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED",
  );
});

const rejectedFinalValueCases = [
  ["zero", () => supportedValue({ finalValue: 0 })],
  ["negative zero", () => supportedValue({ finalValue: -0 })],
  ["missing", () => {
    const value = supportedValue();
    delete value.finalValue;
    return value;
  }],
  ["numeric string", () => supportedValue({ finalValue: "1" })],
  ["NaN", () => supportedValue({ finalValue: Number.NaN })],
  ["positive Infinity", () => supportedValue({ finalValue: Number.POSITIVE_INFINITY })],
  ["negative Infinity", () => supportedValue({ finalValue: Number.NEGATIVE_INFINITY })],
  ["smallest-magnitude negative finite value", () => supportedValue({ finalValue: -Number.MIN_VALUE })],
  ["ordinary negative finite value", () => supportedValue({ finalValue: -1 })],
  ["largest-magnitude negative finite value", () => supportedValue({ finalValue: -Number.MAX_VALUE })],
];

for (const [label, makeValue] of rejectedFinalValueCases) {
  test(`finalValue ${label} fails closed and invalidates the analysis-wide envelope`, () => {
    const contract = Paid.contractFor("PAID_SUPPORTED");
    const rejected = makeValue();
    const valueCheck = Paid.validateValuation(rejected, contract);
    assert.equal(valueCheck.valid, false);
    assert.equal(valueCheck.eligible, false);
    assert.ok(valueCheck.reasons.includes("ELIGIBLE_VALUE_NOT_FINITE_NONNEGATIVE"));

    const envelope = Paid.buildAnalysisEligibility([
      supportedValue({ finalValue: 1 }),
      rejected,
    ], contract);
    assert.equal(envelope.eligible, false);
    assert.equal(envelope.state, "PAID_VALUE_INELIGIBLE");
    assert.equal(envelope.numeric_paid_output_authorized, false);
    assert.equal(envelope.valuation_count, 2);
    assert.equal(envelope.checked_value_count, 2);
    assert.ok(envelope.reason_codes.includes("VALUATION_1:ELIGIBLE_VALUE_NOT_FINITE_NONNEGATIVE"));
    assert.ok(envelope.reason_codes.includes("VALUATION_1:INELIGIBLE"));
  });
}

const acceptedPositiveFinalValueCases = [
  ["smallest positive finite value", Number.MIN_VALUE],
  ["positive fraction", 0.000001],
  ["positive integer", 1],
  ["largest positive finite value", Number.MAX_VALUE],
];

for (const [label, finalValue] of acceptedPositiveFinalValueCases) {
  test(`finalValue ${label} remains eligible in the synthetic PAID_SUPPORTED path`, () => {
    const contract = Paid.contractFor("PAID_SUPPORTED");
    const valuation = supportedValue({ finalValue });
    const valueCheck = Paid.validateValuation(valuation, contract);
    assert.equal(valueCheck.valid, true);
    assert.equal(valueCheck.eligible, true);
    assert.deepEqual(valueCheck.reasons, []);

    const envelope = Paid.buildAnalysisEligibility([
      valuation,
      supportedValue({ finalValue: 1 }),
    ], contract);
    assert.equal(envelope.eligible, true);
    assert.equal(envelope.state, "PAID_VALUE_ELIGIBLE");
    assert.equal(envelope.numeric_paid_output_authorized, true);
    assert.deepEqual(envelope.reason_codes, []);
    assert.equal(contract.paid_delivery_authorized, false);
  });
}

test("one contradictory value invalidates the entire analysis", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const bad = supportedValue();
  bad.paidValueEligibility.projection_data_can_affect_player_values = true;
  const envelope = Paid.buildAnalysisEligibility([supportedValue(), bad], contract);
  assert.equal(envelope.eligible, false);
  assert.equal(envelope.state, "PAID_VALUE_INELIGIBLE");
  assert.equal(envelope.numeric_paid_output_authorized, false);
  assert.ok(envelope.reason_codes.some((reason) => reason.includes("projection_data_can_affect_player_values")));
});

test("one mismatched contract invalidates the entire analysis", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const mismatched = supportedValue({ paidValueEligibility: Paid.productionContract() });
  const envelope = Paid.buildAnalysisEligibility([supportedValue(), mismatched], contract);
  assert.equal(envelope.eligible, false);
  assert.ok(envelope.reason_codes.some((reason) => reason.includes("VALUATION_CONTRACT_IDENTITY_MISMATCH")));
});

test("projection fields on one value invalidate the entire analysis", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const envelope = Paid.buildAnalysisEligibility([
    supportedValue(),
    supportedValue({ projectionAdjustment: 0 }),
  ], contract);
  assert.equal(envelope.eligible, false);
  assert.ok(envelope.reason_codes.some((reason) => reason.includes("PROJECTION_FIELD_PRESENT:projectionAdjustment")));
});

test("mixed outer and components safety surfaces cannot be combined", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const mixed = {
    finalValue: 0,
    projectionAdjustment: 99,
    paidValueEligibility: contract,
    components: {
      finalValue: 1,
      paidValueEligibility: Paid.productionContract(),
    },
  };
  const envelope = Paid.buildAnalysisEligibility([mixed], contract);
  assertIneligibleEnvelope(envelope, 1, 1);
  for (const reason of [
    "VALUATION_0:DUPLICATE_FINAL_VALUE_SURFACES",
    "VALUATION_0:DUPLICATE_PAID_VALUE_ELIGIBILITY_SURFACES",
    "VALUATION_0:PROJECTION_FIELD_PRESENT:projectionAdjustment",
    "VALUATION_0:ELIGIBLE_VALUE_NOT_FINITE_NONNEGATIVE",
  ]) assert.ok(envelope.reason_codes.includes(reason), reason);
});

test("duplicate and conflicting numeric or contract surfaces are always rejected", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const cases = [
    supportedValue({ components: { finalValue: 8240 } }),
    supportedValue({ components: { paidValueEligibility: contract } }),
    supportedValue({ components: { finalValue: 1 } }),
    supportedValue({ components: { paidValueEligibility: Paid.productionContract() } }),
  ];
  for (const value of cases) {
    const envelope = Paid.buildAnalysisEligibility([value], contract);
    assertIneligibleEnvelope(envelope, 1, 1);
    assert.ok(envelope.reason_codes.includes("VALUATION_0:COMPONENTS_SURFACE_UNSUPPORTED"));
  }
});

test("forbidden projection, replacement, and VORP fields are rejected on every result surface", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const outer = supportedValue({
    projectionAdjustment: 0,
    components: {},
  });
  const nested = supportedValue({
    components: {
      projectedPoints: 1,
      neutralReplacementPoints: 2,
      leagueReplacementPoints: 3,
      neutralVorp: 4,
      leagueVorp: 5,
    },
  });
  for (const value of [outer, nested]) {
    const envelope = Paid.buildAnalysisEligibility([value], contract);
    assertIneligibleEnvelope(envelope, 1, 1);
    assert.ok(envelope.reason_codes.some((reason) => reason.includes("PROJECTION_FIELD_PRESENT")));
  }
});

test("volatile valuation accessors are rejected without being invoked", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  let finalValueReads = 0;
  const finalValueAccessor = supportedValue();
  Object.defineProperty(finalValueAccessor, "finalValue", {
    enumerable: true,
    configurable: true,
    get() { finalValueReads += 1; return finalValueReads === 1 ? 1 : 0; },
  });
  const finalEnvelope = Paid.buildAnalysisEligibility([finalValueAccessor], contract);
  assertIneligibleEnvelope(finalEnvelope, 0, 0);
  assert.equal(finalValueReads, 0);
  assert.ok(finalEnvelope.reason_codes.includes("AUTHORITY_SNAPSHOT_ACCESSOR:envelope.valuations.0.finalValue"));

  let contractReads = 0;
  const contractAccessor = supportedValue();
  Object.defineProperty(contractAccessor, "paidValueEligibility", {
    enumerable: true,
    configurable: true,
    get() { contractReads += 1; return contract; },
  });
  const contractEnvelope = Paid.buildAnalysisEligibility([contractAccessor], contract);
  assertIneligibleEnvelope(contractEnvelope, 0, 0);
  assert.equal(contractReads, 0);
  assert.ok(contractEnvelope.reason_codes.includes("AUTHORITY_SNAPSHOT_ACCESSOR:envelope.valuations.0.paidValueEligibility"));
});

test("inherited valuation safety fields cannot establish eligibility", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const inheritedFinalValue = Object.create({ finalValue: 1 });
  inheritedFinalValue.paidValueEligibility = contract;
  const inheritedContract = Object.create({ paidValueEligibility: contract });
  inheritedContract.finalValue = 1;

  const finalEnvelope = Paid.buildAnalysisEligibility([inheritedFinalValue], contract);
  assertIneligibleEnvelope(finalEnvelope, 0, 0);
  assert.ok(finalEnvelope.reason_codes.some((reason) => reason.startsWith("AUTHORITY_SNAPSHOT_UNSUPPORTED_OBJECT:")));

  const contractEnvelope = Paid.buildAnalysisEligibility([inheritedContract], contract);
  assertIneligibleEnvelope(contractEnvelope, 0, 0);
  assert.ok(contractEnvelope.reason_codes.some((reason) => reason.startsWith("AUTHORITY_SNAPSHOT_UNSUPPORTED_OBJECT:")));
});

test("canonical direct valuation shape remains accepted after ambiguity hardening", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const value = supportedValue({ finalValue: Number.MIN_VALUE });
  assert.deepEqual(Paid.validateValuation(value, contract), {
    valid: true,
    eligible: true,
    reasons: [],
  });
  const envelope = Paid.buildAnalysisEligibility([value], contract);
  assert.equal(envelope.eligible, true);
  assert.equal(envelope.numeric_paid_output_authorized, true);
  assert.equal(envelope.contract.paid_delivery_authorized, false);
});

test("no values is fail-closed rather than a numeric zero result", () => {
  const envelope = Paid.buildAnalysisEligibility([], Paid.contractFor("PAID_SUPPORTED"));
  assert.equal(envelope.eligible, false);
  assert.equal(envelope.numeric_paid_output_authorized, false);
  assert.ok(envelope.reason_codes.includes("NO_ELIGIBLE_VALUATIONS"));
});

test("unresolved production contract invalidates the entire analysis even when internal values exist", () => {
  const contract = Paid.productionContract();
  const value = {
    finalValue: 8240,
    paidValueEligibility: contract,
  };
  const envelope = Paid.buildAnalysisEligibility([value], contract);
  assert.equal(envelope.eligible, false);
  assert.equal(envelope.state, "PAID_VALUE_INELIGIBLE");
  assert.ok(envelope.reason_codes.includes("SOURCE_RIGHTS_UNRESOLVED"));
});

test("malformed direct contract inputs return a stable non-authorizing fallback envelope", () => {
  for (const contract of [null, 0, [], undefined]) {
    const envelope = Paid.buildAnalysisEligibility([supportedValue()], contract);
    assertIneligibleEnvelope(envelope, 1, 1);
    assert.equal(envelope.contract.state, "PAID_VALUE_INELIGIBLE");
    assert.equal(envelope.contract.numeric_offensive_paid_value_available, false);
    assert.equal(envelope.contract.source_rights_state, "UNRESOLVED");
    assert.equal(envelope.contract.paid_delivery_authorized, false);
    assert.ok(envelope.reason_codes.includes("CONTRACT_NOT_PLAIN_OBJECT"));
  }
});

test("exported valuation validation is total for malformed and hostile values", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  for (const value of [null, undefined, 0, "value", [], {}]) {
    const result = Paid.validateValuation(value, contract);
    assert.equal(result.valid, false);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.length > 0);
  }

  const hostile = new Proxy(supportedValue(), {
    getOwnPropertyDescriptor() { throw new Error("hostile valuation"); },
  });
  const result = Paid.validateValuation(hostile, contract);
  assert.equal(result.valid, false);
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.some((reason) => reason.startsWith("AUTHORITY_SNAPSHOT_")));
});

test("malformed expected contracts make direct valuation validation fail closed", () => {
  for (const expected of [null, 0, []]) {
    const result = Paid.validateValuation(supportedValue(), expected);
    assert.equal(result.valid, false);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((reason) => reason.startsWith("EXPECTED_CONTRACT_INVALID:")));
  }
});

test("every exported caller-facing helper is total across the malformed-input matrix", () => {
  const cyclic = { label: "cycle" };
  cyclic.self = cyclic;
  let getterCalls = 0;
  const throwingGetter = {};
  Object.defineProperty(throwingGetter, "location", {
    enumerable: true,
    get() { getterCalls += 1; throw new Error("hostile getter"); },
  });
  const hostile = new Proxy({}, {
    get() { throw new Error("hostile get"); },
    getPrototypeOf() { throw new Error("hostile prototype"); },
    ownKeys() { throw new Error("hostile ownKeys"); },
    getOwnPropertyDescriptor() { throw new Error("hostile descriptor"); },
  });
  const revocable = Proxy.revocable({}, {});
  revocable.revoke();
  const frozen = Object.freeze({ marker: "unchanged" });
  const malformed = [
    null,
    undefined,
    false,
    true,
    0,
    1,
    "value",
    Symbol("value"),
    1n,
    [],
    function malformedFunction() {},
    frozen,
    cyclic,
    hostile,
    revocable.proxy,
    throwingGetter,
  ];
  const helpers = [
    ["validateContract", (value) => Paid.validateContract(value)],
    ["paidValuationInput", (value) => Paid.paidValuationInput(value)],
    ["sanitizeValuationResult", (value) => Paid.sanitizeValuationResult(value, value)],
    ["calculatePaidValuation", (value) => Paid.calculatePaidValuation(value, value, value)],
    ["validateValuation", (value) => Paid.validateValuation(value, value)],
    ["buildAnalysisEligibility", (value) => Paid.buildAnalysisEligibility(value, value)],
    ["hardenDataAdapter", (value) => Paid.hardenDataAdapter(value)],
    ["isPaidMode", (value) => Paid.isPaidMode(value)],
    ["install", (value) => Paid.install(value, value)],
  ];

  for (const [helperName, invoke] of helpers) {
    for (const value of malformed) {
      let result;
      assert.doesNotThrow(() => { result = invoke(value); }, `${helperName}:${typeof value}`);
      if (result && typeof result === "object") {
        assert.notEqual(result.eligible, true, helperName);
        assert.notEqual(result.numeric_paid_output_authorized, true, helperName);
        assert.notEqual(result.state, "PAID_VALUE_ELIGIBLE", helperName);
      }
    }
  }
  assert.deepEqual(frozen, { marker: "unchanged" });
  assert.ok(getterCalls >= 0);
});

test("invalid and throwing calculators return deterministic ineligible results", () => {
  for (const calculate of [null, undefined, 0, "calculate", {}, []]) {
    const result = Paid.calculatePaidValuation(calculate, {}, Paid.contractFor("PAID_SUPPORTED"));
    assert.equal(result.finalValue, undefined);
    assert.equal(result.paidValueEligibility.source_rights_state, "UNRESOLVED");
    assert.deepEqual(result.reason_codes, ["PAID_VALUE_CALCULATOR_UNAVAILABLE"]);
  }

  const throwing = () => { throw new Error("calculator failed"); };
  const first = Paid.calculatePaidValuation(throwing, {}, Paid.contractFor("PAID_SUPPORTED"));
  const second = Paid.calculatePaidValuation(throwing, {}, Paid.contractFor("PAID_SUPPORTED"));
  assert.deepEqual(first, second);
  assert.equal(first.paidValueEligibility.source_rights_state, "UNRESOLVED");
  assert.deepEqual(first.reason_codes, ["PAID_VALUE_CALCULATION_FAILED"]);
});

test("malformed paid-mode roots and documents cannot escape install", () => {
  const paidRoot = {
    location: { search: "?paid_beta=1" },
    LeagueVectorCore: {},
    LeagueVectorData: {},
    MutationObserver: function MutationObserver() {},
  };
  for (const document of [null, undefined, 0, {}, { documentElement: null }]) {
    assert.doesNotThrow(() => Paid.install(paidRoot, document));
    assert.equal(Paid.install(paidRoot, document), false);
  }
  assert.equal(Object.prototype.hasOwnProperty.call(paidRoot, "__paidValueEligibilityV1Installed"), false);
});

test("frozen and hostile data adapters return inert wrappers without mutation", async () => {
  const request = async () => ({ unsafe: true });
  const frozen = Object.freeze({ request, marker: "unchanged" });
  const hardenedFrozen = Paid.hardenDataAdapter(frozen);
  assert.notEqual(hardenedFrozen, frozen);
  assert.equal(frozen.request, request);
  assert.equal(frozen.marker, "unchanged");
  await assert.rejects(
    () => hardenedFrozen.request("https://api.sleeper.app/v1/state/nfl"),
    (error) => error.code === "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED",
  );

  const hostile = new Proxy({}, {
    getPrototypeOf() { throw new Error("hostile adapter"); },
  });
  let wrapper;
  assert.doesNotThrow(() => { wrapper = Paid.hardenDataAdapter(hostile); });
  await assert.rejects(
    () => wrapper.request("https://api.sleeper.app/v1/state/nfl"),
    (error) => error.code === "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED",
  );
});

test("paid data boundary returns excluded projection evidence without network work", async () => {
  let calls = 0;
  const data = {
    request: async () => { calls += 1; return { value: {} }; },
    seasonProjections: async () => { calls += 1; return { status: "complete" }; },
    projectionWeek: async () => { calls += 1; return []; },
  };
  Paid.hardenDataAdapter(data);
  const result = await data.seasonProjections(2026);
  assert.equal(result.status, "excluded");
  assert.equal(result.requested, false);
  assert.deepEqual(result.rows, []);
  assert.equal(calls, 0);
  assert.equal(data.projectionWeek, undefined);
});

test("paid data boundary rejects every direct legacy projection URL", async () => {
  const data = {
    request: async (url) => ({ value: url }),
  };
  Paid.hardenDataAdapter(data);
  await assert.rejects(
    () => data.request("https://api.sleeper.app/projections/nfl/2026/1"),
    (error) => error.code === "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED",
  );
  const safe = await data.request("https://api.sleeper.app/v1/state/nfl");
  assert.equal(safe.value, "https://api.sleeper.app/v1/state/nfl");
});

test("paid data boundary blocks canonical, mixed-case, ambiguous, and encoded projection paths", async () => {
  const calls = [];
  const data = {
    request: async (url) => { calls.push(url); return { value: url }; },
  };
  Paid.hardenDataAdapter(data);
  const blocked = [
    "https://api.sleeper.app/projections/nfl/2026/1",
    "https://api.sleeper.app/PrOjEcTiOnS/NfL/2026/1",
    "https://api.sleeper.app\\projections\\nfl\\2026\\1",
    "https://api.sleeper.app/allowed\\projections/nfl/2026/1",
    "https://api.sleeper.app/projections%2Fnfl/2026/1",
    "https://api.sleeper.app/projections%5Cnfl/2026/1",
    "https://api.sleeper.app/%70rojections/nfl/2026/1",
    "https://api.sleeper.app//projections/nfl/2026/1",
    "not a valid absolute URL",
  ];
  for (const url of blocked) {
    await assert.rejects(
      () => data.request(url),
      (error) => error.code === "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED",
      url,
    );
  }
  assert.deepEqual(calls, []);

  const allowedString = await data.request("https://api.sleeper.app/v1/state/nfl");
  assert.equal(allowedString.value, "https://api.sleeper.app/v1/state/nfl");
  await assert.rejects(
    () => data.request(new URL("https://api.sleeper.app/v1/players/nfl")),
    (error) => error.code === "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED",
  );
  assert.deepEqual(calls, ["https://api.sleeper.app/v1/state/nfl"]);
});

test("pathname-only canonicalization rejects decoded forbidden paths and allows harmless query data", async () => {
  const calls = [];
  const data = {
    request: async (url) => { calls.push(url); return { value: url }; },
  };
  Paid.hardenDataAdapter(data);
  const blocked = [
    "https://safe.test/projections/nfl/2026/1",
    "https://safe.test/PrOjEcTiOnS/NfL/2026/1",
    "https://safe.test/projections//nfl/2026/1",
    "https://safe.test/projections\\nfl/2026/1",
    "https://safe.test/projections%2fnfl/2026/1",
    "https://safe.test/projections%252fnfl/2026/1",
    "https://safe.test/projections%5cnfl/2026/1",
    "https://safe.test/projections%255cnfl/2026/1",
    "https://safe.test/projections/placeholder/../nfl/2026/1",
    "https://safe.test/projections/placeholder/%2e%2e/nfl/2026/1",
    "https://safe.test/projections/placeholder/%252e%252e/nfl/2026/1",
    "https://safe.test/%70rojections/nfl/2026/1",
    "https://safe.test/v1/../projections/nfl/2026/1",
    "https://safe.test/v1/%2e%2e/projections/nfl/2026/1",
    "https://safe.test/v1/%252e%252e/projections/nfl/2026/1",
    " https://safe.test/v1/state/nfl",
    "https://safe.test/v1/state/nfl ",
    "https://safe.test/v1/state/\tnfl",
    "https://safe.test/v1/state/%00nfl",
    "https://safe.test/v1/state/%2500nfl",
    "not-an-absolute-url",
    "/projections/nfl/2026/1",
    "//safe.test/projections/nfl/2026/1",
  ];
  for (const url of blocked) {
    await assert.rejects(
      () => data.request(url),
      (error) => error.code === "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED",
      url,
    );
  }
  assert.deepEqual(calls, []);

  const allowed = [
    "https://safe.test/v1/state/nfl?next=/projections/nfl/2026/1",
    "https://safe.test/v1/state/nfl?next=%2Fprojections%2Fnfl%2F2026%2F1",
    "https://safe.test/v1/state/nfl?next=%252Fprojections%252Fnfl",
    "https://safe.test/v1/state/nfl#%2Fprojections%2Fnfl%2F2026%2F1",
    "https://safe.test/v1/projections-note/nfl",
  ];
  for (const url of allowed) {
    const result = await data.request(url);
    assert.equal(result.value, new URL(url).href);
  }
  assert.deepEqual(calls, allowed.map((url) => new URL(url).href));
});

test("paid data boundary never trusts a caller-controlled URL toString hook", async () => {
  let toStringCalls = 0;
  let requestCalls = 0;
  const data = {
    request: async () => { requestCalls += 1; return {}; },
  };
  Paid.hardenDataAdapter(data);
  await assert.rejects(
    () => data.request({
      toString() { toStringCalls += 1; return "https://api.sleeper.app/v1/state/nfl"; },
    }),
    (error) => error.code === "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED",
  );
  assert.equal(toStringCalls, 0);
  assert.equal(requestCalls, 0);
});

test("forbidden effective paths never reach a deterministic downstream adapter", async () => {
  const receivedPaths = [];
  const data = {
    request: async (url) => {
      let pathname = new URL(url).pathname;
      for (let pass = 0; pass < 6; pass += 1) {
        const decoded = decodeURIComponent(pathname);
        if (decoded === pathname) break;
        pathname = decoded;
      }
      const normalized = new URL(pathname, "https://downstream.test").pathname;
      receivedPaths.push(normalized);
      return { status: 200, pathname: normalized };
    },
  };
  Paid.hardenDataAdapter(data);

  await assert.rejects(
    () => data.request("https://safe.test/projections/placeholder/%252e%252e/nfl/2026/1"),
    (error) => error.code === "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED",
  );
  assert.deepEqual(receivedPaths, []);

  const allowed = await data.request("https://safe.test/v1/state/nfl");
  assert.equal(allowed.status, 200);
  assert.deepEqual(receivedPaths, ["/v1/state/nfl"]);
});

test("machine-readable contract matches the production runtime contract", () => {
  const contract = JSON.parse(fs.readFileSync("docs/paid-data-eligibility-contract-v01.json", "utf8"));
  assert.deepEqual(contract, Paid.productionContract());
  assert.equal(contract.idp_dynasty_value_available, false);
  assert.equal(contract.offense_idp_combined_dynasty_rankings_available, false);
  assert.equal(contract.paid_delivery_authorized, false);
});

test("source contains a single paid-mode activation parameter and no query override for source rights", () => {
  const runtimeSource = fs.readFileSync("paid-value-eligibility-v01.js", "utf8");
  const loaderSource = fs.readFileSync("scoring-coverage-v032.js", "utf8");
  assert.match(runtimeSource, /const PAID_MODE_PARAMETER = "paid_beta"/);
  assert.doesNotMatch(runtimeSource, /get\(["']source_rights/);
  assert.match(runtimeSource, /productionContract\(\)/);
  assert.match(runtimeSource, /SOURCE_RIGHTS_UNRESOLVED/);
  assert.match(loaderSource, /paid-value-eligibility-v01\.js\?v=0\.1/);
  assert.match(loaderSource, /Paid-beta eligibility runtime unavailable/);
});

test("source keeps paid authority in closure-owned branded snapshots", () => {
  const runtimeSource = fs.readFileSync("paid-value-eligibility-v01.js", "utf8");
  assert.match(runtimeSource, /const nativeStructuredClone =/);
  assert.match(runtimeSource, /const trustedRuntimeContracts = new WeakSet\(\)/);
  assert.match(runtimeSource, /const trustedRuntimeValuations = new WeakSet\(\)/);
  assert.match(runtimeSource, /const trustedRuntimes = new WeakSet\(\)/);
  assert.match(runtimeSource, /const runtimeByRoot = new WeakMap\(\)/);
  assert.match(runtimeSource, /ledger: \[\]/);
  assert.doesNotMatch(runtimeSource, /root\.__paidValueEligibilityV1Runtime\s*=/);
  assert.doesNotMatch(runtimeSource, /JSON\.stringify|JSON\.parse/);
});

test("paid loader precommits a non-configurable sink for mutable runtime authority", () => {
  const loaderSource = fs.readFileSync("scoring-coverage-v032.js", "utf8");
  assert.match(loaderSource, /const runtimeSlot = "__paidValueEligibilityV1Runtime"/);
  assert.match(loaderSource, /Object\.defineProperty\(window, runtimeSlot/);
  assert.match(loaderSource, /configurable: false/);
  assert.match(loaderSource, /enumerable: false/);
  assert.match(loaderSource, /get\(\) \{ return undefined; \}/);
  assert.match(loaderSource, /set\(\) \{\}/);
  assert.match(loaderSource, /Object\.prototype\.hasOwnProperty\.call\(window, runtimeSlot\)/);
  assert.match(loaderSource, /window\[runtimeSlot\] !== undefined/);
  assert.match(loaderSource, /validation\?\.valid \|\| !validation\?\.eligible/);
  assert.match(loaderSource, /Paid-beta source-rights gate remains unresolved\. No analysis was started\./);
});
