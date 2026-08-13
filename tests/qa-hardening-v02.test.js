const test = require('node:test');
const assert = require('node:assert/strict');
const PF = require('../projection-frontend-v03-contract.js');
const Core = require('../core-v08.js');

function record(s, g, extra = {}) {
  return {
    s: String(s), l: `lv:gsis:${g}`, g, p: 'LB', z: 'projection_ready',
    x: { ts: 80 }, ex: true, pe: false, de: false, ...extra,
  };
}

function artifact(records, aliases = []) {
  return { v: 'qa', m: 'm', d: '2026-08-13T00:00:00Z', aliases, r: records };
}

test('alias chains resolve every alias to the same canonical projection', () => {
  const index = PF.buildIndex(artifact([record('10', 'g1')], [['30', '20'], ['20', '10']]));
  assert.equal(index.bySleeper.get('10'), index.bySleeper.get('20'));
  assert.equal(index.bySleeper.get('20'), index.bySleeper.get('30'));
  assert.equal(index.bySleeper.get('30').sleeper_id, '10');
});

test('valid alias collapse is independent of record and alias declaration order', () => {
  const a = PF.buildIndex(artifact([record('10', 'g1'), record('20', 'g1')], [['20', '10']]));
  const b = PF.buildIndex(artifact([record('20', 'g1'), record('10', 'g1')], [['20', '10']]));
  assert.equal(a.bySleeper.get('20').sleeper_id, '10');
  assert.equal(b.bySleeper.get('20').sleeper_id, '10');
  assert.deepEqual(a.bySleeper.get('10').projected_stats, b.bySleeper.get('10').projected_stats);
});

test('similar-looking Sleeper IDs are never collapsed without explicit alias proof', () => {
  const index = PF.buildIndex(artifact([record('1001', 'g1'), record('10010', 'g2')]));
  assert.notEqual(index.bySleeper.get('1001'), index.bySleeper.get('10010'));
  assert.equal(index.byGsis.size, 2);
});

test('explicit alias cannot collapse genuinely different stable identities', () => {
  assert.throws(
    () => PF.buildIndex(artifact([record('10', 'g1'), record('20', 'g2')], [['20', '10']])),
    /unresolved duplicate alias identity/i,
  );
});

test('crosswalk conflict on an alias fails closed rather than returning canonical data', () => {
  const index = PF.buildIndex(artifact([record('10', 'g1')], [['20', '10']]));
  const resolved = PF.resolveProjectionRecord('20', index, { mappings: { '20': { gsis_id: 'g2' } } });
  assert.equal(resolved.record, null);
  assert.equal(resolved.status, 'identity_unresolved');
  assert.equal(resolved.identity_method, 'crosswalk_conflict');
});

test('negative scoring remains arithmetic rather than being silently discarded', () => {
  const r = {
    sleeper_id: '1', gsis_id: 'g1', position: 'QB', projection_status: 'projection_ready',
    projected_stats: { passing_yards: 4000, passing_td: 30, interceptions: 12 },
    experimental: true, production_projection_eligible: false, dynasty_value_eligible: false,
  };
  const scored = PF.scoreProjection(r, { pass_yd: 0.04, pass_td: 4, pass_int: -3 });
  assert.equal(scored.points, 244);
  assert.equal(scored.completeness, 'complete');
});

test('zero PPR half PPR and full PPR remain monotonic for the same receiver', () => {
  const r = {
    sleeper_id: '1', gsis_id: 'g1', position: 'WR', projection_status: 'projection_ready',
    projected_stats: { receptions: 80, receiving_yards: 1000, receiving_td: 8 },
    experimental: true, production_projection_eligible: false, dynasty_value_eligible: false,
  };
  const standard = PF.scoreProjection(r, { rec: 0, rec_yd: 0.1, rec_td: 6 }).points;
  const half = PF.scoreProjection(r, { rec: 0.5, rec_yd: 0.1, rec_td: 6 }).points;
  const full = PF.scoreProjection(r, { rec: 1, rec_yd: 0.1, rec_td: 6 }).points;
  assert.ok(standard < half && half < full);
});

test.todo('small leagues should receive structurally lower scarcity than otherwise-identical 12-team leagues');
test.todo('IDP structural pressure should be invariant when only scoring keys change');
test.todo('IDP_FLEX should contribute to displayed defensive starter demand without triple counting');
test.todo('partial experimental team totals should not receive normal ordinal rankings');
test.todo('taxi and IR players should not be counted again as ordinary bench/depth');

// Current behavior captured for diagnosis: team count below 12 is not discounted.
test('diagnostic: current 4-team and 12-team QB structural scores are identical with same lineup', () => {
  const base = { roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN'], scoring_settings: { rec: 1 } };
  const four = Core.leagueContext({ ...base, total_rosters: 4 });
  const twelve = Core.leagueContext({ ...base, total_rosters: 12 });
  assert.equal(four.values.QB.structuralScore, twelve.values.QB.structuralScore);
});
