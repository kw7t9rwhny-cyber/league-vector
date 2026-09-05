'use strict';

// Totals describe the supplied observation scope. A separate participation
// manifest is required to call that scope a complete season.
function aggregate(observations, targets, positions) {
  const groups = new Map(), seen = new Set();
  for (const row of observations || []) {
    if (!row?.gsis_id || !Number.isInteger(row.season) || !positions.includes(row.position_group)) continue;
    const key = `${row.gsis_id}|${row.season}|${row.position_group}`;
    const observationKey = `${row.gsis_id}|${row.season}|${row.season_type || 'REG'}|${row.week}`;
    if (seen.has(observationKey)) throw new Error(`Duplicate player-week: ${observationKey}`);
    seen.add(observationKey);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const out = [];
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.week - b.week);
    const first = rows[0], totals = {}, coverage = {}, partial = {};
    for (const field of targets[first.position_group] || []) {
      let known = 0, sum = 0;
      const states = {};
      for (const row of rows) {
        let cell = row.stats?.[field];
        if (field === 'total_tackles' && cell?.state !== 'value') {
          const solo = row.stats?.solo_tackles, assist = row.stats?.assisted_tackles;
          if (solo?.state === 'value' && assist?.state === 'value' && Number.isFinite(solo.value) && Number.isFinite(assist.value)) {
            cell = {state: 'value', value: solo.value + assist.value};
          }
        }
        const valid = cell?.state === 'value' && Number.isFinite(cell.value);
        const state = valid ? (cell.value === 0 ? (cell.zero_basis ? 'structural_zero' : 'observed_zero') : 'observed_value') : cell?.state || 'unavailable';
        states[state] = (states[state] || 0) + 1;
        if (valid) { known++; sum += cell.value; }
      }
      coverage[field] = {known, expected: rows.length, complete: known === rows.length, states};
      totals[field] = known === rows.length ? sum : null;
      partial[field] = known ? sum : null;
    }
    const times = rows.map(row => row.timing?.feature_available_at);
    const available = times.every(t => typeof t === 'string' && Number.isFinite(Date.parse(t))) ? new Date(Math.max(...times.map(Date.parse))).toISOString() : null;
    const games = new Set(rows.map(row => row.week).filter(Number.isInteger)).size;
    out.push({league_vector_player_id: first.league_vector_player_id, gsis_id: first.gsis_id,
      season: first.season, position: first.position_group, teams: [...new Set(rows.map(r => r.team).filter(Boolean))].sort(),
      games, observation_count: rows.length, participation_verified: rows.every(r => r.participation_verified === true),
      coverage_scope: 'supplied_player_weeks', totals, partial_totals: partial, field_coverage: coverage,
      per_game: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Number.isFinite(v) && games > 0 ? v / games : null])),
      timing: {feature_available_at: available}, source: first.source});
  }
  return out.sort((a, b) => a.season - b.season || a.gsis_id.localeCompare(b.gsis_id) || a.position.localeCompare(b.position));
}
module.exports = {aggregate};
