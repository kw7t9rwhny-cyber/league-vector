'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../projection-evaluation.js');
const F = require('./fixtures/projection-evaluation.js');

// New synthetic cases exercise the public reader with self-consistent hashes,
// and the public writer with exact rebound source records.
function input() {
  const x = F.fixture();
  for (const row of [...x.season_rows, ...x.origins.flatMap(o => [...o.universe.members, ...(o.outcomes || [])])]) row.player_id = `player:${row.gsis_id}`;
  const final = x.origins[2];
  final.target_season = 2026; final.forecast_cutoff = F.stamp(2026);
  final.target_start = F.stamp(2026, '09'); final.target_end = F.stamp(2027, '02');
  x.frozen_at = F.stamp(2026);
  delete final.universe.members.find(m => m.player_id === 'player:ROOKIE').gsis_id;
  return F.rebind(x);
}
function assessment(frozen) {
  const o = frozen.final_forecast.origin;
  const outcomes = o.universe.members.filter(m => m.player_id !== 'player:P23').map((m, i) => ({player_id: m.player_id, gsis_id: m.gsis_id ?? null,
    source_id: F.sourceId, target_season: o.target_season, universe_id: o.universe.id, available_at: F.stamp(2027, '03'),
    stats: Object.fromEntries(Object.keys(o.scoring.QB).map(k => [k, F.value(k === 'passing_yards' ? 3000 + i * 100 : 0)]))}));
  return F.rebindAssessment({forecast_sha256: frozen.artifact_sha256, universe_id: o.universe.id, evaluation_cutoff: F.stamp(2027, '04'), outcomes});
}
function rehash(frozen) {
  delete frozen.artifact_sha256;
  frozen.artifact_sha256 = E.hash(frozen);
  return frozen;
}
const frozen = E.freeze(input());
const ordinary = assessment(frozen);
const abstention = f => f.final_forecast.rows.find(r => r.player_id === 'player:ROOKIE');
const predicted = f => f.final_forecast.rows.find(r => r.player_id === 'player:P00');
const interval = f => predicted(f).intervals.passing_yards;
function rejectSaved(name, change, pattern) {
  test(`saved ledger rejects ${name} before reading outcomes`, () => {
    const f = JSON.parse(E.canonical(frozen)); change(f); rehash(f);
    assert.throws(() => E.verifyFrozen(f), pattern);
    assert.throws(() => E.assess(f, {...ordinary, forecast_sha256: f.artifact_sha256}), pattern);
  });
}
for (const [name, change, pattern] of [
  ['removed abstention', f => f.final_forecast.rows.splice(f.final_forecast.rows.indexOf(abstention(f)), 1), /exactly one/],
  ['duplicated abstention', f => f.final_forecast.rows.push(structuredClone(abstention(f))), /exactly one/],
  ['duplicate replacing another member', f => {f.final_forecast.rows[0] = structuredClone(abstention(f));}, /Duplicate forecast member/],
  ['extra member replacing an abstention', f => {abstention(f).player_id = 'player:outside';}, /outside frozen universe/],
  ['changed position on abstention', f => {abstention(f).position = 'LB';}, /position\/cohorts/],
  ['changed position on forecast', f => {predicted(f).position = 'LB';}, /position\/cohorts/],
  ['changed cohorts', f => {abstention(f).cohorts = ['established'];}, /position\/cohorts/],
  ['changed alias', f => {predicted(f).gsis_id = 'wrong';}, /alias differs/],
  ['invented rookie alias', f => {abstention(f).gsis_id = 'invented';}, /alias differs/],
  ['missing canonical ID', f => {delete predicted(f).player_id;}, /saved forecast row/],
  ['null forecast statistic', f => {predicted(f).projected_stats.passing_yards = null;}, /finite numbers/],
  ['string forecast statistic', f => {predicted(f).projected_stats.passing_yards = '0';}, /finite numbers/],
  ['changed abstention disposition', f => {abstention(f).missing_inputs = [];}, /missing-input disposition/],
  ['missing interval map', f => {delete abstention(f).intervals;}, /saved forecast row/],
  ['null interval map', f => {abstention(f).intervals = null;}, /interval map/],
  ['array interval map', f => {abstention(f).intervals = [];}, /interval map/],
  ['null band', f => {predicted(f).intervals.passing_yards = null;}, /saved interval/],
  ['missing endpoint with absent outcome', f => {delete f.final_forecast.rows.find(r => r.player_id === 'player:P23').intervals.passing_yards.p80_low;}, /saved interval/],
  ['interval without a forecast', f => {abstention(f).intervals.passing_yards = structuredClone(interval(f));}, /finite saved forecast/],
  ['calibrated interval type', f => {interval(f).type = 'calibrated_probability';}, /residual bands/],
  ['calibrated interval flag', f => {interval(f).calibrated_probability = true;}, /residual bands/],
  ['extra interval probability', f => {interval(f).probability = .9;}, /saved interval/],
  ['calibrated confidence object', f => {predicted(f).confidence = {label: '90%', type: 'CALIBRATED_PROBABILITY', probability: .9};}, /confidence/],
  ['heuristic confidence with probability', f => {abstention(f).confidence.probability = .9;}, /confidence/],
  ['probability confidence label', f => {predicted(f).confidence.label = '90%';}, /confidence/],
  ['null confidence', f => {abstention(f).confidence = null;}, /confidence/],
  ['probability artifact claims', f => {f.claims.heuristic_confidence = false;}, /frozen claims/],
  ['conflicting origin copies', f => {f.origins[2].format = 'another-format';}, /final origin/]
]) rejectSaved(name, change, pattern);

for (const endpoint of ['p80_low', 'p80_high', 'p90_low', 'p90_high']) {
  for (const value of [null, '0', false, [], {}]) rejectSaved(`${endpoint} = ${JSON.stringify(value)}`, f => {interval(f)[endpoint] = value;}, /finite ordered numbers/);
  rejectSaved(`missing ${endpoint}`, f => {delete interval(f)[endpoint];}, /saved interval/);
}
for (const level of ['p80', 'p90']) rejectSaved(`reversed ${level} endpoints`, f => {interval(f)[`${level}_low`] = 10; interval(f)[`${level}_high`] = 0;}, /finite ordered numbers/);
for (const value of [NaN, Infinity, -Infinity]) test(`nonfinite interval ${value} is not admissible evidence`, () => {
  const f = structuredClone(frozen); interval(f).p80_low = value;
  assert.throws(() => E.verifyFrozen(f), /finite JSON/);
});

for (const [name, change] of [
  ['swapped canonical IDs retaining original aliases and statistics', a => {[a.outcomes[0].player_id, a.outcomes[1].player_id] = [a.outcomes[1].player_id, a.outcomes[0].player_id];}],
  ['swapped aliases retaining canonical IDs', a => {[a.outcomes[0].gsis_id, a.outcomes[1].gsis_id] = [a.outcomes[1].gsis_id, a.outcomes[0].gsis_id];}],
  ['duplicate supplied alias', a => {a.outcomes[1].gsis_id = a.outcomes[0].gsis_id;}],
  ['unknown alias contradicting known canonical binding', a => {a.outcomes[0].gsis_id = 'new-conflicting-alias';}],
  ['wrong identity despite matching position', a => {a.outcomes[0].gsis_id = a.outcomes[1].gsis_id; a.outcomes[0].position = 'QB';}]
]) test(`outcome reconciliation rejects ${name}`, () => {
  const a = structuredClone(ordinary); change(a);
  assert.throws(() => E.assess(frozen, F.rebindAssessment(a)), /Conflicting .*alias/);
});
test('historical alias conflicts fail even across different seasons', () => {
  const x = input(); x.season_rows[0].gsis_id = 'different-alias';
  assert.throws(() => E.freeze(F.rebind(x)), /Conflicting .*alias/);
  const y = input(); y.season_rows[0].gsis_id = y.season_rows.find(r => r.season === 2024 && r.player_id === 'player:P01').gsis_id;
  assert.throws(() => E.freeze(F.rebind(y)), /alias/);
});
test('swapped historical canonical IDs fail before fitting', () => {
  const x = input();
  for (const r of x.season_rows) if (r.player_id === 'player:P00') r.player_id = 'player:P01'; else if (r.player_id === 'player:P01') r.player_id = 'player:P00';
  assert.throws(() => E.freeze(F.rebind(x)), /Conflicting .*alias/);
});
test('development outcomes and universe mappings reconcile across origins', () => {
  const x = input(); x.origins[0].outcomes[0].gsis_id = 'different-alias';
  assert.throws(() => E.freeze(F.rebind(x)), /Conflicting .*alias/);
  const y = input(); y.origins[2].universe.members[0].gsis_id = 'different-alias';
  assert.throws(() => E.freeze(F.rebind(y)), /Conflicting .*alias/);
});
test('historical binding survives a missing universe alias into final assessment', () => {
  const x = input(); for (const o of x.origins) for (const m of o.universe.members) delete m.gsis_id;
  const f = E.freeze(F.rebind(x)), a = assessment(f); a.outcomes[0].gsis_id = 'conflicting-alias';
  assert.throws(() => E.assess(f, F.rebindAssessment(a)), /Conflicting .*alias/);
  a.outcomes[0].gsis_id = 'P00';
  assert.equal(E.assess(f, F.rebindAssessment(a)).final_untouched_evaluation.population.eligible, 27);
});
test('duplicate newly supplied aliases fail when all construction aliases were absent', () => {
  const x = input();
  for (const r of [...x.season_rows, ...x.origins.flatMap(o => [...o.universe.members, ...(o.outcomes || [])])]) delete r.gsis_id;
  const f = E.freeze(F.rebind(x)), a = assessment(f);
  a.outcomes[0].gsis_id = a.outcomes[1].gsis_id = 'duplicate-new-alias';
  assert.throws(() => E.assess(f, F.rebindAssessment(a)), /Conflicting external alias/);
});
for (const alias of ['', 0, false, [], {}]) test(`malformed supplied alias ${JSON.stringify(alias)} fails`, () => {
  const a = structuredClone(ordinary); a.outcomes[0].gsis_id = alias;
  assert.throws(() => E.assess(frozen, F.rebindAssessment(a)), /optional external alias/);
});
test('optional outcome position asserts cutoff board membership', () => {
  const a = structuredClone(ordinary); a.outcomes[0].position = 'LB';
  assert.throws(() => E.assess(frozen, F.rebindAssessment(a)), /position conflicts/);
  a.outcomes[0].position = 'QB';
  assert.equal(E.assess(frozen, F.rebindAssessment(a)).final_untouched_evaluation.population.eligible, 27);
});
test('legitimate historical position changes do not rebind a player or alter final position', () => {
  const x = input(); x.season_rows[0].position = 'RB';
  const f = E.freeze(F.rebind(x));
  assert.equal(predicted(f).position, 'QB');
  assert.equal(E.assess(f, assessment(f)).final_untouched_evaluation.population.eligible, 27);
});
test('missing optional aliases preserve canonical joins and a no-GSIS rookie', () => {
  const a = structuredClone(ordinary); for (const r of a.outcomes) delete r.gsis_id;
  const r = E.assess(frozen, F.rebindAssessment(a)).final_untouched_evaluation;
  assert.deepEqual(r.population, {eligible: 27, forecastable: 25, observed_outcomes: 26, evaluated: 24, abstentions: 2, unknown_outcomes: 1, absent_from_outcome_data: 1});
  const rookie = r.ledger.find(row => row.player_id === 'player:ROOKIE');
  assert.equal(rookie.gsis_id, null); assert.equal(rookie.outcome_status, 'supplied');
  assert.equal(rookie.predicted_points, null); assert.deepEqual(rookie.intervals, {});
  assert.equal(r.ledger.find(row => row.player_id === 'player:P00').actual.passing_yards, 3000);
});
test('all alias-free histories and universes remain supported without inventing GSIS', () => {
  const x = input();
  for (const row of [...x.season_rows, ...x.origins.flatMap(o => [...o.universe.members, ...(o.outcomes || [])])]) delete row.gsis_id;
  const f = E.freeze(F.rebind(x));
  assert.ok(f.final_forecast.rows.every(r => r.gsis_id === null));
  assert.equal(E.assess(f, assessment(f)).final_untouched_evaluation.population.evaluated, 24);
});

for (const periods of [[2026], ['2026'], [null], [{season: 2026}], [2022, '2026'], [2022, null], [2022, {}], [2022, 2022], [-2026], [0], [2026.5], [10000], [true], ['2022'], null, '2022']) test(`consumed periods reject ${JSON.stringify(periods)}`, () => {
  const x = input(); x.data_kind = 'real'; x.consumed_periods = periods;
  assert.throws(() => E.freeze(x), /consumed|inspected/);
});
for (const periods of [[], [2021, 2022, 2023], [2025]]) test(`valid other inspected seasons ${JSON.stringify(periods)} remain supported`, () => {
  const x = input(); x.data_kind = 'real'; x.consumed_periods = periods;
  assert.equal(E.freeze(x).final_untouched_evaluation.status, 'awaiting_separate_outcomes');
});
test('exact normal positive control and repeated serialized runs preserve evidence', () => {
  const again = E.freeze(input());
  assert.equal(E.canonical(frozen), E.canonical(again));
  const a = E.assess(JSON.parse(E.canonical(frozen)), JSON.parse(E.canonical(ordinary))), b = E.assess(JSON.parse(E.canonical(again)), JSON.parse(E.canonical(ordinary)));
  assert.equal(E.canonical(a), E.canonical(b));
  assert.equal(a.final_untouched_evaluation.population.eligible, 27);
  assert.equal(a.final_untouched_evaluation.population.abstentions, 2);
  assert.ok(a.final_untouched_evaluation.ledger.every(r => r.confidence.type === 'HEURISTIC'));
  const before = E.canonical(frozen), shifted = structuredClone(ordinary);
  for (const r of shifted.outcomes) r.stats.passing_yards.value += 100000;
  const scored = E.assess(frozen, F.rebindAssessment(shifted));
  assert.equal(E.canonical(frozen), before);
  assert.equal(scored.uncertainty_evaluation.find(r => r.target === 'passing_yards').levels.p80.hits, 0);
});
