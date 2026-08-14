const test = require('node:test');
const assert = require('node:assert/strict');
const Research = require('../idp-foundation-research-v03.js');

test('current eligibility fails closed for retired, inactive, missing status, and missing active', () => {
  assert.equal(Research.classifyCurrentEligibility({ active:false, status:'Retired', fantasy_positions:['LB'] }).eligible, false);
  assert.equal(Research.classifyCurrentEligibility({ active:true, status:'Retired', fantasy_positions:['LB'] }).eligible, false);
  assert.equal(Research.classifyCurrentEligibility({ active:true, status:null, fantasy_positions:['DB'] }).reason, 'missing_status_fail_closed');
  assert.equal(Research.classifyCurrentEligibility({ status:'Active', fantasy_positions:['DL'] }).reason, 'missing_sleeper_active');
});

test('active teamless players are free agents and IR/PUP/practice squad require a team', () => {
  const fa = Research.classifyCurrentEligibility({ active:true, status:'Active', team:null, fantasy_positions:['LB'] });
  assert.equal(fa.eligible, true);
  assert.equal(fa.current_class, 'free_agent');
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
