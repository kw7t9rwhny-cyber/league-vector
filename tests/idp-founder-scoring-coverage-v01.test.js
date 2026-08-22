const test = require('node:test');
const assert = require('node:assert/strict');
const Rankings = require('../idp-current-season-rankings-v01.js');

const FOUNDER_SCORING_SHAPE = Object.freeze({
  blk_kick:2, bonus_sack_2p:2, def_st_ff:1, def_st_fum_rec:1, def_st_td:6, def_st_tkl_solo:2,
  def_td:6, ff:1, fum_rec:2, fum_rec_td:6, idp_blk_kick:3, idp_def_td:6, idp_ff:4,
  idp_fum_rec:2, idp_fum_ret_yd:0.1, idp_int:6, idp_int_ret_yd:0.1, idp_pass_def:3,
  idp_pass_def_3p:2, idp_qb_hit:0.5, idp_sack:5, idp_sack_yd:0.1, idp_safe:6,
  idp_tkl:1.25, idp_tkl_ast:0.75, idp_tkl_loss:3, idp_tkl_solo:1.75,
  sack:1, safe:2, st_ff:1, st_fum_rec:1, st_td:6,
});

const PROJECTED = Object.freeze({
  solo_tackles:60, assisted_tackles:30, total_tackles:90, tackles_for_loss:10,
  sacks:5, qb_hits:10, interceptions:2, passes_defended:8, forced_fumbles:2,
  fumble_recoveries:1, defensive_td:1, safeties:0,
});

const EXPECTED_SUPPORTED = [
  'idp_def_td','idp_ff','idp_fum_rec','idp_int','idp_pass_def','idp_qb_hit','idp_sack',
  'idp_safe','idp_tkl','idp_tkl_ast','idp_tkl_loss','idp_tkl_solo',
].sort();
const EXPECTED_NON_PLAYER = [
  'blk_kick','def_st_ff','def_st_fum_rec','def_st_td','def_st_tkl_solo','def_td','ff','fum_rec','sack','safe',
].sort();
const EXPECTED_UNSUPPORTED_PLAYER = [
  'bonus_sack_2p','fum_rec_td','idp_blk_kick','idp_fum_ret_yd','idp_int_ret_yd',
  'idp_pass_def_3p','idp_sack_yd','st_ff','st_fum_rec','st_td',
].sort();

test('Founder scoring shape distinguishes individual IDP, non-player defense, and unprojected player categories', () => {
  const coverage = Rankings.scoringCoverage(FOUNDER_SCORING_SHAPE, PROJECTED);
  assert.equal(coverage.status, 'partial');
  assert.equal(coverage.meaningful_incomplete, true);
  assert.deepEqual(coverage.supported_keys, EXPECTED_SUPPORTED);
  assert.deepEqual(coverage.non_player_keys, EXPECTED_NON_PLAYER);
  assert.deepEqual(coverage.unsupported_keys, EXPECTED_UNSUPPORTED_PLAYER);
  assert.deepEqual(coverage.missing_projected_stats, []);
});

test('team-defense weights never double count an individual IDP projection', () => {
  const scoring = { idp_sack:5, idp_tkl_solo:-1, idp_ff:0, sack:100, ff:100, def_td:100, safe:100 };
  const result = Rankings.scoreProjectedStats({ sacks:2, solo_tackles:3, forced_fumbles:1, defensive_td:1, safeties:1 }, scoring);
  assert.equal(result.ranking_eligible, true);
  assert.equal(result.projected_points, 7);
  assert.deepEqual(result.scoring_coverage.supported_keys, ['idp_sack','idp_tkl_solo']);
  assert.deepEqual(result.scoring_coverage.non_player_keys, ['def_td','ff','sack','safe']);
});

test('Sleeper tackle categories intentionally stack when explicitly active', () => {
  const result = Rankings.scoreProjectedStats(
    { total_tackles:10, solo_tackles:6, assisted_tackles:4 },
    { idp_tkl:1.25, idp_tkl_solo:1.75, idp_tkl_ast:0.75 },
  );
  assert.equal(result.ranking_eligible, true);
  assert.equal(result.projected_points, 26);
});

test('zero-valued unsupported player categories do not create false incompleteness', () => {
  const coverage = Rankings.scoringCoverage({ idp_sack:5, idp_blk_kick:0, st_td:0 }, PROJECTED);
  assert.equal(coverage.status, 'complete');
  assert.deepEqual(coverage.unsupported_keys, []);
});

test('Founder scoring shape remains fail-closed until every meaningful player category has a defensible projection', () => {
  const result = Rankings.scoreProjectedStats(PROJECTED, FOUNDER_SCORING_SHAPE);
  assert.equal(result.ranking_eligible, false);
  assert.equal(result.projected_points, null);
  assert.deepEqual(result.scoring_coverage.unsupported_keys, EXPECTED_UNSUPPORTED_PLAYER);
});
