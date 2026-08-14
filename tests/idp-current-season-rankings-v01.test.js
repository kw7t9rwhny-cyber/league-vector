const test = require('node:test');
const assert = require('node:assert/strict');
const Rankings = require('../idp-current-season-rankings-v01.js');

function league(overrides={}) {
  return {
    total_rosters: 1,
    roster_positions: ['DL','LB','DB','IDP_FLEX','BN'],
    scoring_settings: { tkl_solo:1.5, tkl_ast:0.75, sack:4, int:6, pass_def:1.5, ff:3, fum_rec:3, def_td:6, safe:4, qb_hit:1, tkl_loss:2 },
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
  const rules = { ...league().scoring_settings, blk_kick: 6 };
  const result = Rankings.scoreProjectedStats(projection(1,'DL').projected_stats, rules);
  assert.equal(result.projected_points, null);
  assert.equal(result.ranking_eligible, false);
  assert.deepEqual(result.scoring_coverage.unsupported_keys, ['blk_kick']);
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
    assert.ok(Number.isFinite(row.league_replacement_points));
    assert.ok(Number.isFinite(row.projected_surplus));
  }
  assert.equal(result.firewall.idp_dynasty_value_available, false);
  assert.equal(result.readiness.DL.dynasty_value, 'NOT_READY');
  assert.equal(result.readiness.LB.dynasty_value, 'NOT_READY');
  assert.equal(result.readiness.DB.dynasty_value, 'NOT_READY');
});

test('candidate blocks all ranking output when meaningful league scoring coverage is incomplete', () => {
  const l = league({ scoring_settings:{...league().scoring_settings, blk_kick:6} });
  const result = Rankings.buildCandidate({ league:l, sleeper_players:sleeper(), projections:[projection(1,'DL')] });
  assert.equal(result.status, 'blocked');
  assert.ok(result.blocked_reasons.includes('meaningful_unsupported_idp_scoring_keys'));
  assert.equal(result.players.length, 0);
});
