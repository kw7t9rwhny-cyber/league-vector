const test = require('node:test');
const assert = require('node:assert/strict');
const Rankings = require('../idp-current-season-rankings-v01.js');

function league(overrides={}) {
  return {
    total_rosters: 1,
    roster_positions: ['DL','LB','DB','IDP_FLEX','BN'],
    scoring_settings: { idp_tkl_solo:1.5, idp_tkl_ast:0.75, idp_sack:4, idp_int:6, idp_pass_def:1.5, idp_ff:3, idp_fum_rec:3, idp_def_td:6, idp_safe:4, idp_qb_hit:1, idp_tkl_loss:2 },
    ...overrides,
  };
}
function sleeper() {
  return {
    '1': { active:true, status:'Active', team:'GB', fantasy_positions:['DE','LB'] },
    '2': { active:true, status:'Active', team:'CHI', fantasy_positions:['DL'] },
    '3': { active:true, status:'Active', team:'MIN', fantasy_positions:['LB'] },
    '4': { active:true, status:'Active', team:'DET', fantasy_positions:['DB'] },
    '5': { active:false, status:'Retired', team:null, fantasy_positions:['DB'] },
    '6': { active:true, status:'Active', team:null, fantasy_positions:['LB'] },
  };
}
function projection(id, position, pointsScale=1) {
  return {
    league_vector_player_id:`lv:${id}`, sleeper_id:String(id), gsis_id:`g${id}`, name:`P${id}`, team:'X', position,
    projection_status:'projection_ready',
    projected_stats:{
      solo_tackles:40*pointsScale, assisted_tackles:20*pointsScale, total_tackles:60*pointsScale,
      tackles_for_loss:5*pointsScale, sacks:2*pointsScale, qb_hits:4*pointsScale, interceptions:1*pointsScale,
      passes_defended:3*pointsScale, forced_fumbles:1*pointsScale, fumble_recoveries:1*pointsScale,
      defensive_td:0, safeties:0,
    },
  };
}

test('league scoring is applied directly and complete supported scoring is rankable', () => {
  const row = projection(1,'DL',1);
  const result = Rankings.scoreProjectedStats(row.projected_stats, league().scoring_settings);
  assert.equal(result.scoring_coverage.status, 'complete');
  assert.equal(result.ranking_eligible, true);
  assert.equal(result.projected_points, 113.5);
});

test('meaningful unsupported IDP scoring fails closed', () => {
  const rules = { ...league().scoring_settings, idp_blk_kick: 6 };
  const result = Rankings.scoreProjectedStats(projection(1,'DL').projected_stats, rules);
  assert.equal(result.projected_points, null);
  assert.equal(result.ranking_eligible, false);
  assert.deepEqual(result.scoring_coverage.unsupported_keys, ['idp_blk_kick']);
});

test('missing projected stat required by active scoring fails closed', () => {
  const stats = { ...projection(1,'DL').projected_stats };
  delete stats.sacks;
  const result = Rankings.scoreProjectedStats(stats, league().scoring_settings);
  assert.equal(result.ranking_eligible, false);
  assert.ok(result.scoring_coverage.missing_projected_stats.includes('sacks'));
});

test('league structure counts canonical DL LB DB and IDP flex deterministically', () => {
  const result = Rankings.leagueIdpStructure({
    total_rosters:14,
    roster_positions:['DE','DT','LB','LB','CB','S','IDP_FLEX','BN'],
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.dedicated, { DL:2, LB:2, DB:2 });
  assert.equal(result.flex, 1);
  assert.equal(result.teams, 14);
});

test('unknown IDP-like roster slot fails closed', () => {
  const result = Rankings.leagueIdpStructure({ total_rosters:12, roster_positions:['DL','LB','DB','IDP_SUPER_FLEX'] });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'unsupported_idp_roster_slots');
});

test('hybrid replacement threshold uses exact eligibility set rather than max positional VORP', () => {
  const players = [
    { id:'dl1', points:117, lineup_eligibility:['DL'] },
    { id:'dl2', points:44, lineup_eligibility:['DL'] },
    { id:'dl3', points:117, lineup_eligibility:['DL'] },
    { id:'hybrid', points:104, lineup_eligibility:['DL','LB'] },
    { id:'lb1', points:75, lineup_eligibility:['LB'] },
    { id:'lb2', points:93, lineup_eligibility:['LB'] },
  ];
  const config = { teams:1, dedicated:{DL:1,LB:1,DB:0}, flex:1 };
  const hybrid = Rankings.replacementEntryThreshold(players, config, ['DL','LB']);
  const dl = Rankings.replacementEntryThreshold(players, config, ['DL']);
  const lb = Rankings.replacementEntryThreshold(players, config, ['LB']);
  assert.ok(Number.isFinite(hybrid));
  assert.ok(Number.isFinite(dl));
  assert.ok(Number.isFinite(lb));
  assert.ok(hybrid < Math.max(dl, lb));
});

test('negative supported scoring is preserved and replacement can be negative', () => {
  const scored = Rankings.scoreProjectedStats({ solo_tackles:5 }, { idp_tkl_solo:-1 });
  assert.equal(scored.ranking_eligible, true);
  assert.equal(scored.projected_points, -5);

  const players = [
    { id:'lb-a', points:-5, lineup_eligibility:['LB'] },
    { id:'lb-b', points:-10, lineup_eligibility:['LB'] },
  ];
  const result = Rankings.replacementEntryThresholdResult(players, { teams:1, dedicated:{DL:0,LB:1,DB:0}, flex:0 }, ['LB']);
  assert.equal(result.status, 'available');
  assert.ok(result.value < 0);
  assert.ok(Math.abs(result.value - (-5)) < 0.01);
});

test('deep demand makes replacement unavailable instead of fabricating zero', () => {
  const players = [{ id:'lb-a', points:-5, lineup_eligibility:['LB'] }];
  const result = Rankings.replacementEntryThresholdResult(players, { teams:1, dedicated:{DL:0,LB:2,DB:0}, flex:0 }, ['LB']);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.value, null);
  assert.equal(result.reason, 'insufficient_current_pool_for_replacement');
});

test('equal-point assignment ties resolve deterministically by stable id', () => {
  const players = [
    { id:'b', points:10, lineup_eligibility:['LB'] },
    { id:'a', points:10, lineup_eligibility:['LB'] },
  ];
  const config = { teams:1, dedicated:{DL:0,LB:1,DB:0}, flex:0 };
  const first = Rankings.maximumWeightAssignmentSigned(players, config);
  const second = Rankings.maximumWeightAssignmentSigned([...players].reverse(), config);
  assert.deepEqual(first.selected_player_ids, ['a']);
  assert.deepEqual(second.selected_player_ids, ['a']);
});

test('candidate excludes retired and unverified teamless players and never emits dynasty value', () => {
  const projections = [projection(1,'DL',1.2),projection(2,'DL',1),projection(3,'LB',1),projection(4,'DB',1),projection(5,'DB',2),projection(6,'LB',2)];
  const result = Rankings.buildCandidate({ league:league(), sleeper_players:sleeper(), projections });
  assert.equal(result.status, 'ready_experimental');
  assert.equal(result.counts.safely_ranked, 4);
  assert.ok(!result.players.some((row)=>row.sleeper_id==='5'));
  assert.ok(!result.players.some((row)=>row.sleeper_id==='6'));
  assert.ok(result.players.some((row)=>row.sleeper_id==='1' && row.eligible_positions.join('/')==='DL/LB'));
  for (const row of result.players) {
    assert.equal(row.eligibility_verified, true);
    assert.equal(row.idp_dynasty_value_available, false);
    assert.equal(row.dynasty_value, null);
    assert.equal(row.role_confidence, 'limited');
    assert.equal(row.historical_role_model_available, false);
    assert.ok(Number.isFinite(row.projected_points));
  }
  assert.equal(result.firewall.idp_dynasty_value_available, false);
  assert.equal(result.readiness.DL.dynasty_value, 'NOT_READY');
  assert.equal(result.readiness.LB.dynasty_value, 'NOT_READY');
  assert.equal(result.readiness.DB.dynasty_value, 'NOT_READY');
});

test('displayed current team comes from verified Sleeper authority, not stale projection team', () => {
  const result = Rankings.buildCandidate({ league:league(), sleeper_players:sleeper(), projections:[projection(1,'DL'),projection(2,'DL'),projection(3,'LB'),projection(4,'DB')] });
  const row = result.players.find((item)=>item.sleeper_id==='1');
  assert.equal(row.team, 'GB');
  assert.equal(row.team_source, 'verified_current_sleeper_eligibility_authority');
  assert.notEqual(row.team, 'X');
});

test('duplicate current identities fail closed before replacement or display', () => {
  const duplicate = { ...projection(1,'DL'), league_vector_player_id:'lv:duplicate-copy', gsis_id:'g-duplicate-copy' };
  const result = Rankings.buildCandidate({ league:league(), sleeper_players:sleeper(), projections:[projection(1,'DL'),duplicate,projection(2,'DL'),projection(3,'LB'),projection(4,'DB')] });
  assert.equal(result.status, 'blocked');
  assert.ok(result.blocked_reasons.includes('duplicate_current_projection_identity_fail_closed'));
  assert.equal(result.identity_audit.valid, false);
  assert.ok(result.identity_audit.duplicates.some((item)=>item.dimension==='sleeper_id' && item.value==='1'));
  assert.equal(result.players.length, 0);
  assert.deepEqual(result.replacement_points_by_eligibility, {});
});

test('all current rows missing required projection stats is explicitly unavailable', () => {
  const rows = [projection(1,'DL'),projection(2,'DL'),projection(3,'LB'),projection(4,'DB')].map((row) => {
    const copy = { ...row, projected_stats:{...row.projected_stats} };
    delete copy.projected_stats.sacks;
    return copy;
  });
  const result = Rankings.buildCandidate({ league:league(), sleeper_players:sleeper(), projections:rows });
  assert.equal(result.status, 'unavailable');
  assert.ok(result.unavailable_reasons.includes('no_rankable_current_idp_players'));
  assert.equal(result.players.length, 0);
  assert.equal(result.counts.safely_ranked, 0);
  assert.equal(result.readiness.DL.current_season_ranking, 'NOT_READY');
  assert.equal(result.readiness.LB.current_season_ranking, 'NOT_READY');
  assert.equal(result.readiness.DB.current_season_ranking, 'NOT_READY');
});

test('deep league demand keeps points ranking but marks surplus unavailable', () => {
  const l = league({ roster_positions:['LB','LB','BN'], scoring_settings:{idp_tkl_solo:1} });
  const s = { '3': sleeper()['3'] };
  const result = Rankings.buildCandidate({ league:l, sleeper_players:s, projections:[projection(3,'LB')] });
  assert.equal(result.status, 'ready_experimental');
  assert.equal(result.players.length, 1);
  assert.equal(result.players[0].current_season_ranking_available, true);
  assert.equal(result.players[0].current_season_surplus_available, false);
  assert.equal(result.players[0].league_replacement_points, null);
  assert.equal(result.players[0].replacement_availability.reason, 'insufficient_current_pool_for_replacement');
});

test('candidate sorting remains deterministic for equal projected points and surplus', () => {
  const s = {
    '10': { active:true, status:'Active', team:'GB', fantasy_positions:['LB'] },
    '11': { active:true, status:'Active', team:'CHI', fantasy_positions:['LB'] },
    '12': { active:true, status:'Active', team:'MIN', fantasy_positions:['LB'] },
  };
  const rows = [projection(11,'LB'), projection(10,'LB'), projection(12,'LB')];
  const l = league({ roster_positions:['LB','BN'], scoring_settings:{idp_tkl_solo:1} });
  const first = Rankings.buildCandidate({ league:l, sleeper_players:s, projections:rows });
  const second = Rankings.buildCandidate({ league:l, sleeper_players:s, projections:[...rows].reverse() });
  assert.deepEqual(first.players.map((row)=>row.player_id), ['lv:10','lv:11','lv:12']);
  assert.deepEqual(second.players.map((row)=>row.player_id), ['lv:10','lv:11','lv:12']);
});

test('candidate blocks all ranking output when meaningful league scoring coverage is incomplete', () => {
  const l = league({ scoring_settings:{...league().scoring_settings, idp_blk_kick:6} });
  const result = Rankings.buildCandidate({ league:l, sleeper_players:sleeper(), projections:[projection(1,'DL')] });
  assert.equal(result.status, 'blocked');
  assert.ok(result.blocked_reasons.includes('meaningful_unsupported_idp_scoring_keys'));
  assert.equal(result.players.length, 0);
});
