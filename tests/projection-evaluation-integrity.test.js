'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../projection-evaluation.js');
const M = require('../projection-evaluation-metrics.js');
const P = require('../projection-v03.js');
const C = require('../projection-v03-complete.js');
const Data = require('../football-data-v08.js');
const Compact = require('../scripts/build-projection-frontend.js');
const PF = require('../projection-frontend-v03-contract.js');
const Idp = require('../idp-scoring-context-v01.js');
const F = require('./fixtures/projection-evaluation.js');

test('selection fold cannot be re-reported as final; previously consumed periods rejected', () => {
  const input = F.fixture(); input.origins[2].target_season = 2022;
  assert.throws(() => E.freeze(F.rebind(input)), /reuse a season/);
  const consumed = F.fixture(); consumed.consumed_periods.push(2025);
  assert.throws(() => E.freeze(consumed), /inspected period/);
  const real = F.fixture(); real.data_kind = 'real';
  assert.throws(() => E.freeze(real), /historical development/);
});
test('source manifest binds actual records, not just a claimed checksum', () => {
  const input = F.fixture(); input.season_rows[0].stats.passing_yards.value = 1e9;
  assert.throws(() => E.freeze(input), /not bound/);
  const input2 = F.fixture(); input2.sources[0].payload.records[0].games = 8;
  assert.throws(() => E.freeze(input2), /hash mismatch/);
});
test('final outcome poisoning cannot change saved selection, fitted predictions or intervals', () => {
  const frozen = E.freeze(F.fixture()), bytes = E.canonical(frozen);
  const normal = E.assess(frozen, F.assessment(frozen)), shifted = E.assess(frozen, F.assessment(frozen, 10000));
  assert.equal(E.canonical(frozen), bytes);
  assert.notEqual(normal.final_untouched_evaluation.metrics.mae, shifted.final_untouched_evaluation.metrics.mae);
  const passing = shifted.uncertainty_evaluation.find(r => r.target === 'passing_yards');
  assert.equal(passing.levels.p80.observed_coverage, 0);
  assert.equal(passing.calibrated_probability, false);
});
test('future membership, birth metadata, feature vintage and unmatured labels cannot leak', () => {
  const input = F.fixture(); input.origins[0].universe.members[0].available_at = F.stamp(2026);
  assert.throws(() => E.freeze(F.rebind(input)), /Future membership/);
  const badLabel = F.fixture(); badLabel.season_rows[0].label_available_at = F.stamp(2017);
  assert.throws(() => E.freeze(F.rebind(badLabel)), /not fully matured/);
  const futureBirth = F.fixture(); futureBirth.birth.P00 = {value: '1990-01-01', available_at: F.stamp(2026), source_id: F.sourceId};
  assert.throws(() => E.freeze(F.rebind(futureBirth)), /Future or unversioned birth/);
  const late = F.fixture();
  for (const row of late.season_rows.filter(r => r.gsis_id === 'P00')) {row.feature_available_at = F.stamp(2026); row.stats.passing_yards.value = 1e9;}
  const frozen = E.freeze(F.rebind(late));
  assert.deepEqual(frozen.final_forecast.rows.find(r => r.gsis_id === 'P00').projected_stats, {});
  assert.ok(frozen.final_forecast.history_exclusions.some(r => r.gsis_id === 'P00' && r.reason === 'future_feature_vintage'));
});
test('training examples use features that existed at each historical training origin', () => {
  const rows = [{gsis_id: 'P', season: 2020, position: 'QB', totals: {passing_yards: 1000}, games: 17, per_game: {passing_yards: 60}, timing: {feature_available_at: F.stamp(2025)}},
    {gsis_id: 'P', season: 2021, position: 'QB', forecast_cutoff: F.stamp(2021), totals: {passing_yards: 2000}, games: 17, per_game: {passing_yards: 120}, timing: {feature_available_at: F.stamp(2022)}}];
  assert.equal(P.train(rows, 'QB', 'passing_yards', 2025, {}, false).y.length, 0);
});
test('inner alpha validation training also purges labels that matured after its origin', () => {
  const rows = [
    {gsis_id: 'P', season: 2019, position: 'QB', totals: {passing_yards: 1000}, games: 17, per_game: {passing_yards: 60}, forecast_cutoff: F.stamp(2019), target_end: F.stamp(2020, '02'), label_available_at: F.stamp(2020, '03'), timing: {feature_available_at: F.stamp(2020, '03')}},
    {gsis_id: 'P', season: 2020, position: 'QB', totals: {passing_yards: 2000}, games: 17, per_game: {passing_yards: 120}, forecast_cutoff: F.stamp(2020), target_end: F.stamp(2021, '02'), label_available_at: F.stamp(2024), timing: {feature_available_at: F.stamp(2024)}},
    {gsis_id: 'P', season: 2023, position: 'QB', totals: {passing_yards: 3000}, games: 17, per_game: {passing_yards: 180}, forecast_cutoff: F.stamp(2023), target_end: F.stamp(2024, '02'), label_available_at: F.stamp(2024, '03'), timing: {feature_available_at: F.stamp(2024, '03')}}];
  assert.equal(P.train(rows, 'QB', 'passing_yards', 2023, {}, false).y.length, 0);
  const matured = structuredClone(rows); matured[1].label_available_at = F.stamp(2021, '03'); matured[1].timing.feature_available_at = F.stamp(2021, '03');
  assert.deepEqual(P.train(matured, 'QB', 'passing_yards', 2023, {}, false).y, [2000]);
});
test('rank metrics partition seasons and reject duplicate player-season credit', () => {
  const rows = [];
  for (const season of [2024, 2025]) for (let i = 0; i < 24; i++) {
    const high = (i < 12) === (season === 2024);
    rows.push({gsis_id: `P${i}`, position: 'QB', target_season: season, forecast_cutoff: F.stamp(season), format: 'synthetic-QB', universe_id: `universe-${season}`, actual_points: high ? 100 : 0, predicted_points: high ? 0 : 100});
  }
  const result = M.rankReport(rows);
  assert.equal(result.length, 2);
  assert.ok(result.every(r => r.top_n[0].precision === 0));
  assert.throws(() => M.rankReport([...rows, rows[0]]), /Duplicate player-season/);
  assert.throws(() => M.rankReport([{...rows[0], target_season: null}]), /target season/);
  assert.throws(() => M.rankReport([{...rows[0], forecast_cutoff: null}]), /forecast cutoff/);
});
test('matched comparison does not reward dropping the difficult baseline player', () => {
  const base = {position: 'QB', target: 'passing_yards', target_season: 2020, actual: 0};
  const rows = [{...base, gsis_id: 'easy', model: 'weighted_603010', prediction: 10}, {...base, gsis_id: 'hard', model: 'weighted_603010', prediction: 100},
    {...base, gsis_id: 'easy', model: 'ridge_noage_v03', prediction: 10}];
  const selection = C.compare(rows, [2020])[0];
  assert.equal(selection.selected.model, 'weighted_603010');
  assert.equal(selection.baseline.mae, 10);
  assert.equal(selection.candidates.find(r => r.model === 'weighted_603010').unmatched_n, 1);
  assert.equal(selection.evidence_role, 'selection_only');
  assert.throws(() => C.compare([...rows, rows[0]], [2020]), /Duplicate prediction/);
  assert.throws(() => C.compare(rows, [2019]), /outside/);
});
test('rookies, no-history, limited history and disappeared players remain in denominators', () => {
  const frozen = E.freeze(F.fixture()), result = E.assess(frozen, F.assessment(frozen)).final_untouched_evaluation;
  assert.equal(result.population.eligible, 27);
  assert.equal(result.population.abstentions, 2);
  assert.equal(result.population.unknown_outcomes, 1);
  assert.equal(result.population.evaluated, 24);
  assert.equal(result.cohorts.rookie.eligible, 1);
  assert.equal(result.cohorts.limited_history.forecastable, 1);
  assert.equal(result.ledger.find(r => r.gsis_id === 'P23').actual_points, null);
});
test('empty evaluation population returns null metrics and zero counts, never success percentages', () => {
  const input = F.fixture(); input.origins[2].universe.members = [];
  const frozen = E.freeze(F.rebind(input)), result = E.assess(frozen, F.assessment(frozen)).final_untouched_evaluation;
  assert.equal(result.status, 'empty_population'); assert.equal(result.metrics.mae, null); assert.equal(result.population.eligible, 0);
});
test('canonical rookie identity without a GSIS alias remains eligible and can join outcomes', () => {
  const input = F.fixture(), rookie = input.origins[2].universe.members.find(m => m.gsis_id === 'ROOKIE');
  rookie.player_id = 'lv:player:rookie'; delete rookie.gsis_id;
  const frozen = E.freeze(F.rebind(input)), row = frozen.final_forecast.rows.find(r => r.player_id === rookie.player_id);
  assert.equal(row.gsis_id, null); assert.ok(row.missing_inputs.length > 0);
  const outcome = {player_id: rookie.player_id, target_season: 2025, universe_id: frozen.final_forecast.origin.universe.id, source_id: F.sourceId, available_at: F.stamp(2026, '03'), stats: {passing_yards: F.value(0)}};
  const a = F.rebindAssessment({forecast_sha256: frozen.artifact_sha256, universe_id: frozen.final_forecast.origin.universe.id, evaluation_cutoff: F.stamp(2026, '04'), outcomes: [outcome]});
  const result = E.assess(frozen, a).final_untouched_evaluation;
  assert.equal(result.population.eligible, 27);
  assert.equal(result.ledger.find(r => r.player_id === rookie.player_id).outcome_status, 'supplied');
});
test('changed universe, mixed seasons and premature outcomes fail closed', () => {
  const frozen = E.freeze(F.fixture()), a = F.assessment(frozen); a.universe_id = 'another-universe';
  assert.throws(() => E.assess(frozen, a), /Changed assessment universe/);
  const b = F.assessment(frozen); b.outcomes[0].target_season--;
  assert.throws(() => E.assess(frozen, F.rebindAssessment(b)), /period\/universe mismatch/);
  const c = F.assessment(frozen); c.evaluation_cutoff = F.stamp(2025);
  assert.throws(() => E.assess(frozen, c), /complete target window/);
  const d = structuredClone(frozen); d.final_forecast.origin.universe.members.pop();
  assert.throws(() => E.assess(d, F.assessment(frozen)), /hash mismatch/);
});
test('uncertainty construction cannot be reused as final coverage', () => {
  const input = F.fixture(); input.origins[1].evaluation_cutoff = F.stamp(2026);
  assert.throws(() => E.freeze(F.rebind(input)), /Calibration evidence must mature/);
  const frozen = E.freeze(F.fixture());
  assert.ok(frozen.uncertainty_construction.length);
  for (const b of frozen.uncertainty_construction) { assert.equal(b.future_coverage_validated, false); assert.equal(b.observed_coverage, undefined); }
  const final = F.fixture(); final.origins[2].outcomes = [];
  assert.throws(() => E.freeze(F.rebind(final)), /Final outcomes cannot enter/);
});
test('strict values preserve zeros and unknowns through source, aggregate and compact transport', () => {
  for (const v of [null, '', ' ', false, [], {}, NaN]) assert.notEqual(Data.stateful(v).state, 'value');
  assert.equal(Data.stateful('12.5').value, 12.5); assert.equal(Data.stateful(0).value, 0);
  const raw = {player_id: 'A', position: 'QB', season: 2020, passing_yards: 200};
  const first = Data.normalizeObservation({...raw, week: 1}), second = Data.normalizeObservation({...raw, passing_yards: null, week: 2});
  const aggregate = C.aggregatePlayerSeasons([first, second])[0];
  assert.equal(aggregate.totals.passing_yards, null); assert.equal(aggregate.partial_totals.passing_yards, 200);
  assert.equal(aggregate.per_game.passing_yards, null); assert.equal(aggregate.field_coverage.passing_yards.known, 1);
  assert.throws(() => C.aggregatePlayerSeasons([first, first]), /Duplicate player-week/);
  for (const bad of [null, '', ' ', false, [], {}]) {
    const r = Compact.compactRecord({sleeper_id: '1', gsis_id: 'A', position: 'QB', projected_stats: {passing_yards: bad}, uncertainty: {passing_yards: {p80_low: bad, p80_high: 3}}, model_metadata: {passing_yards: {historical_mae: bad}}});
    assert.equal(r.x.py, undefined); assert.equal(r.u.py, undefined); assert.equal(r.e.py[1], null);
    const expanded = PF.normalizeArtifact({r: [{s: '1', p: 'QB', x: {py: bad}}]}).records[0];
    assert.equal(expanded.projected_stats.passing_yards, undefined);
  }
});
test('true structural zero needs a field-specific source/coverage rule and remains observed zero', () => {
  const input = F.fixture(), row = input.season_rows[0];
  row.stats.rushing_td = {...F.value(0), zero_basis: {field: 'rushing_td', rule: 'complete_verified_no_scoring_event', source_id: F.sourceId, coverage: 'complete'}};
  const result = E.freeze(F.rebind(input)); assert.equal(result.input_missingness.rushing_td.structural_zero, 1);
  row.stats.rushing_td.zero_basis.coverage = 'partial';
  assert.throws(() => E.freeze(F.rebind(input)), /Structural zero/);
});
test('independently verified zero outcome differs from an absent outcome', () => {
  const frozen = E.freeze(F.fixture()), a = F.assessment(frozen), origin = frozen.final_forecast.origin;
  const stats = Object.fromEntries(Object.keys(origin.scoring.QB).map(k => [k, {...F.value(0), zero_basis: {field: k, rule: 'verified_nonparticipant_complete_season', source_id: F.sourceId, coverage: 'complete'}}]));
  a.outcomes.push({gsis_id: 'P23', target_season: 2025, universe_id: origin.universe.id, available_at: F.stamp(2026, '03'), source_id: F.sourceId, stats});
  const result = E.assess(frozen, F.rebindAssessment(a)).final_untouched_evaluation;
  assert.equal(result.population.evaluated, 25); assert.equal(result.ledger.find(r => r.gsis_id === 'P23').actual_points, 0);
});
test('source IDP categories stay distinct; ambiguous scoring quantities are withheld', () => {
  const row = Data.normalizeObservation({player_id: 'A', position: 'LB', season: 2024, week: 1, def_tackles_solo: 2, def_tackles_with_assist: 1, def_tackle_assists: 3, def_fumbles: 4, fumble_recovery_opp: 1});
  assert.equal(row.stats.source_tackle_assists.value, 3); assert.equal(row.stats.source_tackle_with_assist.value, 1);
  assert.equal(row.stats.fumble_recoveries.value, null); assert.equal(row.stats.assisted_tackles.state, 'unsupported');
  assert.equal(C.aggregatePlayerSeasons([row])[0].totals.total_tackles, null);
  const profiles = Idp.buildHistoricalProfiles([{position: 'LB', season: 2024, games: 17, per_game: {sacks: 4}}, {position: 'LB', season: 2024, games: 17, per_game: {solo_tackles: 2, sacks: null}}]);
  assert.equal(profiles[0].stats.sacks, null); assert.deepEqual(profiles[0].support.sacks, {known: 1, expected: 2});
  assert.equal(Idp.scoringContext(profiles, {idp_sack: 4}).status, 'unavailable');
  const unknown = Idp.buildHistoricalProfiles([{position: 'LB', season: 2024, games: 17, per_game: {sacks: 4}}, {position: 'LB', season: 2024, games: 17, per_game: {}}]);
  assert.equal(unknown[0].sample_size, 2); assert.equal(unknown[0].stats.sacks, null);
});
test('heuristic confidence remains typed and cannot be claimed as calibrated', () => {
  const frozen = E.freeze(F.fixture()); assert.ok(frozen.final_forecast.rows.every(r => r.confidence.type === 'HEURISTIC'));
  assert.throws(() => E.assertClaims(['calibrated_probability']), /heuristic confidence/);
  const r = Compact.compactRecord({sleeper_id: '1', confidence: P.confidence(3, [], true)}); assert.equal(r.ct, 'HEURISTIC');
  const decoded = PF.buildIndex({r: [r]}).records[0]; assert.equal(decoded.confidence_type, 'HEURISTIC');
  assert.equal(PF.classifyMissing({years_exp: null}), 'identity_unresolved');
  const missingHistory = require('../scripts/projection-v03.js').projectionForIdentity({sleeper_id: 'fixture', sleeper_player: {years_exp: null}, mapping: {gsis_id: 'fixture'}, position: 'QB'}, {psIndex: new Map(), models: new Map(), uncMap: new Map()});
  assert.equal(missingHistory.status, 'insufficient_history');
});
test('deterministic repeated freeze and evaluation use identical canonical bytes', () => {
  const a = E.freeze(F.fixture()), b = E.freeze(F.fixture()); assert.equal(E.canonical(a), E.canonical(b));
  assert.equal(E.canonical(E.assess(a, F.assessment(a))), E.canonical(E.assess(b, F.assessment(b))));
});
test('coverage evaluates saved post-sanitation, rounded endpoints, not raw predictions', () => {
  const input = F.fixture();
  for (const r of input.season_rows) {r.stats.attempts = F.value(10); r.stats.completions = F.value(100);}
  for (const o of input.origins) for (const r of o.outcomes || []) {r.stats.attempts = F.value(10); r.stats.completions = F.value(10);}
  const frozen = E.freeze(F.rebind(input)), row = frozen.final_forecast.rows.find(r => r.gsis_id === 'P00');
  assert.equal(row.projected_stats.completions, 10);
  assert.equal(row.intervals.completions.p80_low, 10); assert.equal(row.intervals.completions.p80_high, 10);
  const a = F.assessment(frozen);
  for (const r of a.outcomes) {r.stats.attempts = F.value(100); r.stats.completions = F.value(100);}
  const coverage = E.assess(frozen, F.rebindAssessment(a)).uncertainty_evaluation.find(r => r.target === 'completions');
  assert.equal(coverage.levels.p80.observed_coverage, 0);
  assert.equal(coverage.cohorts.rookie.n, 0);
});
test('duplicate historical rows and multi-season labels fail before fitting', () => {
  const duplicate = F.fixture(); duplicate.season_rows.push(duplicate.season_rows[0]);
  assert.throws(() => E.freeze(F.rebind(duplicate)), /Duplicate player-season/);
  const multi = F.fixture(); multi.origins[2].horizon_seasons = 3;
  assert.throws(() => E.freeze(F.rebind(multi)), /one-season production only/);
  const training = F.fixture(); training.season_rows[0].target_end = F.stamp(2020, '02');
  assert.throws(() => E.freeze(F.rebind(training)), /Multi-season training targets/);
});
test('full scoring abstains on unsupported active components and accepts true zero weights', () => {
  const full = F.fixture(); for (const o of full.origins) o.scoring.QB.receiving_yards = .1;
  const frozen = E.freeze(F.rebind(full));
  assert.ok(frozen.final_forecast.rows.every(r => r.missing_inputs.includes('receiving_yards')));
  const result = E.assess(frozen, F.assessment(frozen)).final_untouched_evaluation;
  assert.equal(result.population.abstentions, 27); assert.equal(result.metrics.mae, null);
  const inactive = F.fixture(); for (const o of inactive.origins) o.scoring.QB.receiving_yards = 0;
  const accepted = E.freeze(F.rebind(inactive));
  assert.ok(!accepted.final_forecast.rows.find(r => r.gsis_id === 'P00').missing_inputs.includes('receiving_yards'));
});
test('source availability never falls back to retrieval time; schema aliases preserve loss yardage', () => {
  const row = Data.normalizeObservation({player_id: 'A', position: 'QB', season: 2024, sack_yards_lost: 17}, {retrieved_at: F.stamp(2025), feature_available_at: null});
  assert.equal(row.timing.feature_available_at, null); assert.equal(row.stats.sack_yards.value, 17);
  assert.equal(Data.temporalSplit([row], F.stamp(2026)).unknown.length, 1);
  const conflict = Data.normalizeObservation({player_id: 'A', position: 'QB', season: 2024, sack_yards: 10, sack_yards_lost: 17});
  assert.equal(conflict.stats.sack_yards.state, 'source_error');
  const audit = require('../scripts/ingest-historical-data.js').normalizeWeeklyRow({player_id: 'A', position: 'QB', season: 2024, sack_yards: 10, sack_yards_lost: 17}, {});
  assert.deepEqual(audit.stats.sack_yards, conflict.stats.sack_yards);
});
test('legacy active runner cannot fetch mutable data or emit reused final evidence', async () => {
  await assert.rejects(require('../scripts/projection-v03-fast.js').run(), /Frozen evaluationInput required/);
});
