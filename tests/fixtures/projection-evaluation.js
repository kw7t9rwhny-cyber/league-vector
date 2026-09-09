'use strict';
const E = require('../../projection-evaluation.js');
const sourceId = 'synthetic-normalized-records';
const stamp = (year, month = '08', day = '01') => `${year}-${month}-${day}T00:00:00Z`;
const value = v => ({state: 'value', value: v});
function stats(i, season, shift = 0) {
  return Object.fromEntries(Object.entries({attempts: 400 + i, completions: 250 + i, passing_yards: 2800 + i * 37 + (season - 2017) * 45 + shift,
    passing_td: 20 + i % 6, interceptions: 8, sacks: 20, carries: 40, rushing_yards: 120 + i, rushing_td: 0}).map(([k, v]) => [k, value(v)]));
}
function member(gsis_id, cohorts = ['established']) { return {gsis_id, position: 'QB', cohorts, source_id: sourceId, available_at: stamp(2017)}; }
function rebind(input) {
  const records = [...input.season_rows, ...Object.values(input.birth || {})];
  for (const o of input.origins) {
    o.universe.id = E.universeId(o);
    for (const row of o.outcomes || []) row.universe_id = o.universe.id;
    records.push(o.universe, ...o.universe.members, ...o.universe.exclusions, ...(o.outcomes || []));
  }
  const payload = {records: structuredClone(records)};
  input.sources = [{id: sourceId, description: 'Deterministic synthetic fixtures; no real player data', sha256: E.hash(payload), payload}];
  return input;
}
function fixture() {
  const season_rows = [], members = Array.from({length: 24}, (_, i) => member(`P${String(i).padStart(2, '0')}`));
  function row(id, i, season) { return {gsis_id: id, position: 'QB', season, source_id: sourceId, forecast_cutoff: stamp(season),
    target_start: stamp(season, '09'), target_end: stamp(season + 1, '02'), label_available_at: stamp(season + 1, '03'),
    feature_available_at: stamp(season + 1, '03'), games: 17, participation_verified: true, stats: stats(i, season)}; }
  for (let season = 2017; season <= 2024; season++) for (let i = 0; i < members.length; i++) season_rows.push(row(members[i].gsis_id, i, season));
  season_rows.push(row('LIMITED', 3, 2024));
  const origins = [[2022, 'selection'], [2023, 'calibration'], [2025, 'final']].map(([season, stage]) => {
    const universeMembers = structuredClone(members);
    if (stage === 'final') universeMembers.push(member('ROOKIE', ['rookie']), member('NO_HISTORY', ['insufficient_history']), member('LIMITED', ['limited_history', 'depth']));
    const o = {id: `${stage}-${season}`, stage, forecast_cutoff: stamp(season), target_season: season, target_start: stamp(season, '09'),
      target_end: stamp(season + 1, '02'), horizon_seasons: 1, format: 'reference-QB-pass-rush-subset',
      scoring: {QB: {passing_yards: .04, passing_td: 4, interceptions: -2, rushing_yards: .1, rushing_td: 6}}, eligibility_rule: 'synthetic-preseason-census-v1',
      universe: {id: '', members: universeMembers, exclusions: [], source_id: sourceId, available_at: stamp(season)}};
    o.universe.id = E.universeId(o);
    if (stage !== 'final') {
      o.evaluation_cutoff = stamp(season + 1, '04');
      o.outcomes = members.map((m, i) => ({gsis_id: m.gsis_id, target_season: season, universe_id: o.universe.id, source_id: sourceId,
        available_at: stamp(season + 1, '03'), stats: stats(i, season)}));
    }
    return o;
  });
  return rebind({version: E.VERSION, data_kind: 'synthetic', frozen_at: stamp(2025), consumed_periods: [2022, 2023], season_rows, origins, birth: {}});
}
function assessment(frozen, shift = 0) {
  const o = frozen.final_forecast.origin;
  const outcomes = o.universe.members.filter(m => m.gsis_id !== 'P23').map((m, i) => ({gsis_id: m.gsis_id, target_season: o.target_season, universe_id: o.universe.id,
    source_id: sourceId, available_at: stamp(2026, '03'), stats: stats(i, 2025, shift)}));
  return rebindAssessment({forecast_sha256: frozen.artifact_sha256, universe_id: o.universe.id, evaluation_cutoff: stamp(2026, '04'), outcomes});
}
function rebindAssessment(a) {
  const payload = {records: structuredClone(a.outcomes)};
  a.sources = [{id: sourceId, description: 'Separate synthetic final outcomes', sha256: E.hash(payload), payload}];
  return a;
}
module.exports = {fixture, assessment, rebind, rebindAssessment, value, sourceId, stamp};
