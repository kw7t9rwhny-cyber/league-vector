const test = require('node:test');
const assert = require('node:assert/strict');
const Research = require('../idp-foundation-research-v03.js');

test('current eligibility fails closed for retired, inactive, missing status, and missing active', () => {
  assert.equal(Research.classifyCurrentEligibility({ active:false, status:'Retired', fantasy_positions:['LB'] }).eligible, false);
  assert.equal(Research.classifyCurrentEligibility({ active:true, status:'Retired', fantasy_positions:['LB'] }).eligible, false);
  assert.equal(Research.classifyCurrentEligibility({ active:true, status:'Inactive', fantasy_positions:['LB'] }).eligible, false);
  assert.equal(Research.classifyCurrentEligibility({ active:true, status:null, fantasy_positions:['DB'] }).reason, 'missing_status_fail_closed');
  assert.equal(Research.classifyCurrentEligibility({ status:'Active', fantasy_positions:['DL'] }).reason, 'missing_sleeper_active');
});

test('teamless Active players fail closed unless separately verified as current free agents', () => {
  const unsafe = Research.classifyCurrentEligibility({ active:true, status:'Active', team:null, fantasy_positions:['LB'] });
  assert.equal(unsafe.eligible, false);
  assert.equal(unsafe.current_class, 'teamless_unverified');
  assert.equal(unsafe.reason, 'teamless_active_unverified_fail_closed');
  const verified = Research.classifyCurrentEligibility({ active:true, status:'Active', team:null, fantasy_positions:['LB'] }, { freeAgentVerified:true });
  assert.equal(verified.eligible, true);
  assert.equal(verified.current_class, 'verified_free_agent');
});

test('active roster and IR/PUP/practice squad require safe current state', () => {
  const active = Research.classifyCurrentEligibility({ active:true, status:'Active', team:'GB', fantasy_positions:['LB'] });
  assert.equal(active.eligible, true);
  assert.equal(active.current_class, 'active_roster');
  const ir = Research.classifyCurrentEligibility({ active:true, status:'Injured Reserve', team:'GB', fantasy_positions:['DB'] });
  assert.equal(ir.eligible, true);
  assert.equal(ir.current_class, 'injured_roster');
  const pup = Research.classifyCurrentEligibility({ active:true, status:'PUP', team:'CHI', fantasy_positions:['DL'] });
  assert.equal(pup.eligible, true);
  assert.equal(pup.current_class, 'injured_roster');
  const ps = Research.classifyCurrentEligibility({ active:true, status:'Practice Squad', team:'MIN', fantasy_positions:['LB'] });
  assert.equal(ps.eligible, true);
  assert.equal(ps.current_class, 'practice_squad');
  assert.equal(Research.classifyCurrentEligibility({ active:true, status:'Practice Squad', team:null, fantasy_positions:['LB'] }).eligible, false);
});

test('verified free-agent IDs are explicit and do not weaken teamless fail-closed behavior', () => {
  const players = {
    '1': { active:true, status:'Active', team:null, fantasy_positions:['LB'] },
    '2': { active:true, status:'Active', team:null, fantasy_positions:['DB'] },
  };
  const snapshot = Research.buildCurrentEligibilitySnapshot(players, { verifiedFreeAgentIds:new Set(['2']) });
  assert.deepEqual(snapshot.included.map((x)=>x.sleeper_id), ['2']);
  assert.deepEqual(snapshot.excluded.map((x)=>x.sleeper_id), ['1']);
});

test('hybrid Sleeper positions preserve the full canonical eligibility set', () => {
  assert.deepEqual(Research.lineupEligibility({ fantasy_positions:['DE','LB'] }), ['DL','LB']);
  assert.deepEqual(Research.lineupEligibility({ fantasy_positions:['LB','DB'] }), ['DB','LB']);
  assert.deepEqual(Research.lineupEligibility({ fantasy_positions:['EDGE','OLB'] }), ['DL','LB']);
});

test('hybrid assignment never double-counts a player and can reassign to preserve the stronger lineup', () => {
  const players = [
    { id:'hybrid', points:100, lineup_eligibility:['DL','LB'] },
    { id:'dl', points:95, lineup_eligibility:['DL'] },
    { id:'lb', points:20, lineup_eligibility:['LB'] },
  ];
  const result = Research.maximumWeightAssignment(players, { teams:1, dedicated:{DL:1,LB:1,DB:0}, flex:0 });
  assert.equal(result.assignments.length, 2);
  assert.equal(new Set(result.selected_player_ids).size, 2);
  assert.equal(result.total_points, 195);
  assert.ok(result.selected_player_ids.includes('hybrid'));
  assert.ok(result.selected_player_ids.includes('dl'));
});

test('IDP FLEX shares one pool and a hybrid still occupies only one slot', () => {
  const players = [
    { id:'hybrid', points:100, lineup_eligibility:['DL','LB'] },
    { id:'dl', points:95, lineup_eligibility:['DL'] },
    { id:'lb', points:90, lineup_eligibility:['LB'] },
    { id:'db', points:85, lineup_eligibility:['DB'] },
  ];
  const result = Research.maximumWeightAssignment(players, { teams:1, dedicated:{DL:1,LB:1,DB:0}, flex:1 });
  assert.equal(result.assignments.length, 3);
  assert.equal(new Set(result.selected_player_ids).size, 3);
  assert.equal(result.total_points, 285);
});

test('player marginal starter value uses optimized reassignment rather than max positional VORP', () => {
  const players = [
    { id:'hybrid', points:100, lineup_eligibility:['DL','LB'] },
    { id:'dl', points:95, lineup_eligibility:['DL'] },
    { id:'lb', points:90, lineup_eligibility:['LB'] },
    { id:'db', points:80, lineup_eligibility:['DB'] },
  ];
  const config = { teams:1, dedicated:{DL:1,LB:1,DB:0}, flex:0 };
  assert.equal(Research.maximumWeightAssignment(players, config).total_points, 195);
  assert.equal(Research.playerMarginalStarterValue(players, config, 'hybrid'), 10);
});

test('slot shadow prices are league-structure outputs rather than constants', () => {
  const players = [
    { id:'dl1', points:100, lineup_eligibility:['DL'] },
    { id:'dl2', points:70, lineup_eligibility:['DL'] },
    { id:'lb1', points:90, lineup_eligibility:['LB'] },
    { id:'lb2', points:60, lineup_eligibility:['LB'] },
  ];
  const shallow = Research.replacementShadowPrices(players, { teams:1, dedicated:{DL:1,LB:1,DB:0}, flex:0 });
  const deeper = Research.replacementShadowPrices(players, { teams:1, dedicated:{DL:2,LB:1,DB:0}, flex:0 });
  assert.equal(shallow.replacement_shadow_price.DL, 70);
  assert.equal(deeper.replacement_shadow_price.DL, 0);
});

test('player-season age is evaluated at that season cutoff, not with current age', () => {
  assert.equal(Research.playerSeasonAge('1995-09-15', 2020), 24);
  assert.equal(Research.playerSeasonAge('1995-08-15', 2020), 25);
  assert.equal(Research.playerSeasonAge('1995-09-15', 2024), 28);
  assert.equal(Research.experienceSeason(2018, 2020), 3);
});

test('projection pool fails closed without a current Sleeper identity', () => {
  const projections = [
    { gsis_id:'a', sleeper_id:'1', position:'LB', projection_status:'projection_ready' },
    { gsis_id:'b', sleeper_id:'2', position:'DB', projection_status:'projection_ready' },
    { gsis_id:'c', position:'DL', projection_status:'projection_ready' },
  ];
  const sleeper = {
    '1': { active:true, status:'Active', team:'GB', fantasy_positions:['LB'] },
    '2': { active:false, status:'Retired', team:null, fantasy_positions:['DB'] },
  };
  const result = Research.filterProjectionPool(projections, sleeper);
  assert.equal(result.included.length, 1);
  assert.equal(result.excluded.length, 2);
  assert.equal(result.included[0].sleeper_id, '1');
});
