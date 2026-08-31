const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
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
    assert.ok(result.reasons.includes(`CONTRACT_FIELD_MISMATCH:${field}`), field);
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
  assert.ok(accessorResult.reasons.includes("CONTRACT_FIELD_ACCESSOR:paid_delivery_authorized"));

  const inherited = Object.create(Paid.contractFor("PAID_SUPPORTED"));
  const inheritedResult = Paid.validateContract(inherited);
  assert.equal(inheritedResult.valid, false);
  assert.equal(inheritedResult.eligible, false);
  assert.ok(inheritedResult.reasons.includes("CONTRACT_NOT_PLAIN_OBJECT"));
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
    reasons: ["CONTRACT_INSPECTION_FAILED"],
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
  assertIneligibleEnvelope(mapEnvelope, 1, 1);
  assert.equal(mapCalls, 0);
  assert.ok(mapEnvelope.reason_codes.includes("VALUATION_COLLECTION_UNSUPPORTED_OWN_PROPERTY"));
  assert.ok(mapEnvelope.reason_codes.includes("VALUATION_0:ELIGIBLE_VALUE_NOT_FINITE_NONNEGATIVE"));

  let iteratorCalls = 0;
  const iteratorOverride = [supportedValue({ finalValue: -1 })];
  iteratorOverride[Symbol.iterator] = function* hostileIterator() {
    iteratorCalls += 1;
    yield supportedValue();
  };
  const iteratorEnvelope = Paid.buildAnalysisEligibility(iteratorOverride, contract);
  assertIneligibleEnvelope(iteratorEnvelope, 1, 1);
  assert.equal(iteratorCalls, 0);
  assert.ok(iteratorEnvelope.reason_codes.includes("VALUATION_COLLECTION_UNSUPPORTED_OWN_PROPERTY"));
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
  assertIneligibleEnvelope(hostileEnvelope, 1, 0);
  assert.ok(hostileEnvelope.reason_codes.includes("VALUATION_COLLECTION_INSPECTION_FAILED"));
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
  assertIneligibleEnvelope(finalEnvelope, 1, 1);
  assert.equal(finalValueReads, 0);
  assert.ok(finalEnvelope.reason_codes.includes("VALUATION_0:FINAL_VALUE_ACCESSOR"));

  let contractReads = 0;
  const contractAccessor = supportedValue();
  Object.defineProperty(contractAccessor, "paidValueEligibility", {
    enumerable: true,
    configurable: true,
    get() { contractReads += 1; return contract; },
  });
  const contractEnvelope = Paid.buildAnalysisEligibility([contractAccessor], contract);
  assertIneligibleEnvelope(contractEnvelope, 1, 1);
  assert.equal(contractReads, 0);
  assert.ok(contractEnvelope.reason_codes.includes("VALUATION_0:PAID_VALUE_ELIGIBILITY_ACCESSOR"));
});

test("inherited valuation safety fields cannot establish eligibility", () => {
  const contract = Paid.contractFor("PAID_SUPPORTED");
  const inheritedFinalValue = Object.create({ finalValue: 1 });
  inheritedFinalValue.paidValueEligibility = contract;
  const inheritedContract = Object.create({ paidValueEligibility: contract });
  inheritedContract.finalValue = 1;

  const finalEnvelope = Paid.buildAnalysisEligibility([inheritedFinalValue], contract);
  assertIneligibleEnvelope(finalEnvelope, 1, 1);
  assert.ok(finalEnvelope.reason_codes.includes("VALUATION_0:INHERITED_FINAL_VALUE"));

  const contractEnvelope = Paid.buildAnalysisEligibility([inheritedContract], contract);
  assertIneligibleEnvelope(contractEnvelope, 1, 1);
  assert.ok(contractEnvelope.reason_codes.includes("VALUATION_0:INHERITED_PAID_VALUE_ELIGIBILITY"));
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
  assert.ok(result.reasons.includes("VALUATION_INSPECTION_FAILED"));
});

test("malformed expected contracts make direct valuation validation fail closed", () => {
  for (const expected of [null, 0, []]) {
    const result = Paid.validateValuation(supportedValue(), expected);
    assert.equal(result.valid, false);
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((reason) => reason.startsWith("EXPECTED_CONTRACT_INVALID:")));
  }
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
  const allowedUrl = await data.request(new URL("https://api.sleeper.app/v1/players/nfl"));
  assert.equal(allowedUrl.value, "https://api.sleeper.app/v1/players/nfl");
  assert.deepEqual(calls, [
    "https://api.sleeper.app/v1/state/nfl",
    "https://api.sleeper.app/v1/players/nfl",
  ]);
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

test("backslash projection URL cannot reach a local downstream server while an allowed URL can", async () => {
  const receivedPaths = [];
  const server = http.createServer((request, response) => {
    receivedPaths.push(request.url);
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    const port = address.port;
    let originalCalls = 0;
    const data = {
      request: (url) => new Promise((resolve, reject) => {
        originalCalls += 1;
        const request = http.get(url, (response) => {
          response.resume();
          response.once("end", () => resolve({ status: response.statusCode }));
        });
        request.once("error", reject);
      }),
    };
    Paid.hardenDataAdapter(data);

    await assert.rejects(
      () => data.request(`http://127.0.0.1:${port}\\projections\\nfl\\2026\\1`),
      (error) => error.code === "PAID_BETA_LEGACY_WEEKLY_PROJECTION_REQUEST_BLOCKED",
    );
    assert.equal(originalCalls, 0);
    assert.deepEqual(receivedPaths, []);

    const allowed = await data.request(`http://127.0.0.1:${port}/v1/state/nfl`);
    assert.equal(allowed.status, 200);
    assert.equal(originalCalls, 1);
    assert.deepEqual(receivedPaths, ["/v1/state/nfl"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
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
