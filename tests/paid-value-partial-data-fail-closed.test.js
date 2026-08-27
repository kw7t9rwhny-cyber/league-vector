const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Core = require("../core-v08.js");
const Data = require("../data-sources-v08.js");
const IdpFoundation = require("../idp-valuation-foundation-v01.js");

const league = {
  total_rosters: 12,
  roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN"],
  scoring_settings: { pass_yd: 1 },
};
const player = {
  full_name: "Audit Quarterback",
  position: "QB",
  fantasy_positions: ["QB"],
  years_exp: 3,
};
const market = { base: 8000, age: 27, ecr: 10, format: "1qb" };
const paidInput = { player, market, context: Core.leagueContext(league) };

function predecessorRows(weeks) {
  const rows = [];
  for (let week = 1; week <= weeks; week += 1) {
    rows.push({ player_id: "target", stats: { pass_yd: week === 1 ? 100 : 0 } });
    for (let index = 1; index <= 12; index += 1) {
      rows.push({ player_id: `replacement${index}`, stats: { pass_yd: week === 1 ? 1 : 10 } });
    }
  }
  return rows;
}

function predecessorValue(weeks) {
  const totals = {};
  for (const row of predecessorRows(weeks)) {
    totals[row.player_id] = (totals[row.player_id] || 0) + row.stats.pass_yd;
  }
  const targetPoints = totals.target;
  const replacement = Object.values(totals).sort((left, right) => right - left)[11] || 0;
  const rawAdjustment = targetPoints == null || targetPoints <= 0
    ? 0
    : ((targetPoints - replacement) / targetPoints) * 0.5;
  const projectionAdjustment = Math.min(0.16, Math.max(-0.1, rawAdjustment));
  return Math.round(market.base * (1 + 0.03 + projectionAdjustment));
}

function response(week, rows, overrides = {}) {
  return {
    week,
    ok: true,
    source: "network",
    provider: "sleeper-undocumented",
    schema_version: "legacy-weekly-v1",
    model_version: "not-declared-by-source",
    fetched_at: "2026-08-27T20:00:00.000Z",
    rows,
    ...overrides,
  };
}

function completeResponses() {
  return Array.from({ length: 18 }, (_, index) => response(index + 1, [
    { player_id: "target", stats: { pass_yd: index === 0 ? 100 : 0 } },
  ]));
}

function successor(context) {
  return Core.calculateValuation({
    ...paidInput,
    projection: context.projection || { points: 999999, pos: "QB" },
    neutralReplacement: context.neutralReplacement || { levels: { QB: -999999 } },
    leagueReplacement: context.leagueReplacement || { levels: { QB: 999999 } },
    legacyWeeklyProjectionContext: context,
  });
}

test("predecessor reproduces the audit's 18/18, 1/18, and 0/18 values", () => {
  assert.deepEqual({
    "18/18": predecessorValue(18),
    "1/18": predecessorValue(1),
    "0/18": predecessorValue(0),
  }, {
    "18/18": 7440,
    "1/18": 9520,
    "0/18": 8240,
  });
});

const complete = completeResponses();
const failureScenarios = [
  ["complete required coverage", { weekly_responses: complete }],
  ["one required player record missing", { weekly_responses: complete.map((item, index) => index === 4 ? response(5, []) : item) }],
  ["17/18 weekly coverage", { weekly_responses: complete.slice(0, 17) }],
  ["1/18 weekly coverage", { weekly_responses: complete.slice(0, 1) }],
  ["0/18 weekly coverage", { weekly_responses: [] }],
  ["one malformed response", { weekly_responses: complete.map((item, index) => index === 2 ? response(3, { malformed: true }) : item) }],
  ["one response mapped to the wrong player", { weekly_responses: complete.map((item, index) => index === 3 ? response(4, [{ player_id: "wrong-player", stats: { pass_yd: 100 } }]) : item) }],
  ["duplicate player response", { weekly_responses: complete.map((item, index) => index === 5 ? response(6, [{ player_id: "target", stats: {} }, { player_id: "target", stats: {} }]) : item) }],
  ["stale response", { weekly_responses: complete.map((item, index) => index === 6 ? response(7, item.rows, { fetched_at: "2020-01-01T00:00:00.000Z" }) : item) }],
  ["mixed source, schema, or model versions", { weekly_responses: complete.map((item, index) => index === 7 ? response(8, item.rows, { provider: "other", schema_version: "legacy-weekly-v2", model_version: "other" }) : item) }],
  ["timeout after partial success", { weekly_responses: [...complete.slice(0, 8), { week: 9, ok: false, error: "TimeoutError" }] }],
  ["source success with empty payload", { weekly_responses: complete.map((item, index) => index === 8 ? response(9, []) : item) }],
  ["cached old data combined with fresh data", { weekly_responses: complete.map((item, index) => index < 9 ? response(index + 1, item.rows, { source: "cache", fetched_at: "2020-01-01T00:00:00.000Z" }) : item) }],
  ["unsupported player identity", { weekly_responses: complete, unsupported_player_ids: ["target"] }],
  ["all projection requests fail", { weekly_responses: Array.from({ length: 18 }, (_, index) => ({ week: index + 1, ok: false, error: "source unavailable" })) }],
];

for (const [name, context] of failureScenarios) {
  test(`${name} cannot change or appear inside a paid value`, () => {
    const result = successor(context);
    assert.equal(result.finalValue, 8240);
    assert.equal(result.paidValueEligibility.state, "PAID_VALUE_ELIGIBLE");
    assert.equal(result.paidValueEligibility.projection_policy, "CONTEXT_ONLY_NOT_IN_VALUATION");
    assert.equal(result.paidValueEligibility.legacy_weekly_projection_adjustment_applied, false);
    assert.equal(result.paidValueEligibility.missing_projection_substituted_with_zero, false);
    for (const forbidden of [
      "projectionAdjustment",
      "projectedPoints",
      "neutralReplacementPoints",
      "leagueReplacementPoints",
      "neutralVorp",
      "leagueVorp",
    ]) assert.equal(forbidden in result, false, `${forbidden} leaked into paid value components`);
  });
}

test("complete positive control remains reachable and is byte-reproducible", () => {
  const first = successor({ weekly_responses: complete });
  const second = successor({ weekly_responses: structuredClone(complete) });
  assert.equal(first.finalValue, 8240);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("all predecessor coverage scenarios converge to the same successor value", () => {
  const values = [18, 1, 0].map((weeks) => successor({
    weekly_responses: complete.slice(0, weeks),
    projection: { points: weeks === 18 ? 100 : weeks === 1 ? 100 : 0 },
  }).finalValue);
  assert.deepEqual(values, [8240, 8240, 8240]);
});

test("legacy weekly retrieval and cache path is absent from production data adapter", () => {
  const source = fs.readFileSync(require.resolve("../data-sources-v08.js"), "utf8");
  assert.equal(Data.seasonProjections, undefined);
  assert.equal(Data.projectionWeek, undefined);
  assert.doesNotMatch(source, /\/projections\/nfl\//);
  assert.doesNotMatch(source, /SLEEPER_UNDOCUMENTED_API/);
});

test("machine-readable contract matches runtime and preserves the IDP firewall", () => {
  const contract = JSON.parse(fs.readFileSync("docs/paid-data-eligibility-contract-v01.json", "utf8"));
  const runtime = Core.paidValueEligibility();
  assert.equal(contract.paid_value_state, runtime.state);
  assert.equal(contract.projection_policy, runtime.projection_policy);
  assert.equal(contract.legacy_weekly_projection_adjustment_applied, false);
  assert.equal(contract.projection_data_can_affect_player_values, false);
  assert.equal(contract.projection_data_can_affect_team_totals, false);
  assert.equal(contract.projection_data_can_affect_sorting_or_ranking, false);
  assert.equal(contract.projection_data_can_appear_inside_paid_value_components, false);
  assert.equal(runtime.legacy_weekly_projection_requested_during_paid_value_analysis, false);
  assert.equal(runtime.projection_data_can_affect_player_values, false);
  assert.equal(runtime.projection_data_can_affect_team_totals, false);
  assert.equal(runtime.projection_data_can_affect_sorting_or_ranking, false);
  assert.equal(runtime.projection_data_can_appear_inside_paid_value_components, false);
  assert.equal(runtime.idp_dynasty_value_available, false);
  assert.equal(IdpFoundation.FIREWALL.idp_dynasty_value_available, false);
  const idpState = IdpFoundation.candidateDynastyState({});
  assert.equal(idpState.dynasty_value, null);
  assert.equal(idpState.combined_ranking_available, false);
});

test("unrelated offensive age, structure, rookie-floor, and trade math remains active", () => {
  const result = Core.calculateValuation({
    player: { position: "RB", years_exp: 4 },
    market: { base: 6000, age: 26, ecr: 18, format: "1qb" },
    context: { values: { RB: { structuralScore: 107 } } },
    tradeCount: 2,
  });
  assert.equal(result.ageAdjustment, 0.01);
  assert.equal(result.leagueAdjustment, 0.0126);
  assert.equal(result.totalAdjustment, 0.0226);
  assert.equal(result.finalValue, 6136);
  assert.deepEqual(result.tradeActivity, { count: 2, appliedToValue: false });
});

test("production rendering has no legacy projection value, total, or ranking path", () => {
  const app = fs.readFileSync(require.resolve("../app.js"), "utf8");
  assert.doesNotMatch(app, /seasonProjections|aggregateSeasonProjections|buildProjectionScores|replacementLevels|projectionAdjustment|leagueVorp/);
  assert.match(app, /Weekly projections excluded from paid value/);
  assert.match(app, /dataset\.paidValueState/);
  assert.match(app, /__leagueVectorPaidValueEligibility/);
});
