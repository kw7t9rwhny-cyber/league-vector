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
