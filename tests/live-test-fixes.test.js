const assert = require('node:assert/strict');
const Core = require('../core-v08.js');
const Fixes = require('../live-test-fixes-v01.js');

function league({ teams = 12, slots = [], scoring = {} } = {}) {
  return { total_rosters: teams, roster_positions: slots, scoring_settings: scoring };
}

function corrected(input) {
  return Fixes.correctedLeagueContext(input, Core.leagueContext);
}

{
  const ctx = corrected(league({
    teams: 14,
    slots: ['DL','DL','DL','LB','LB','LB','DB','DB','DB','IDP_FLEX','IDP_FLEX','BN'],
    scoring: { idp_tkl_solo: 2, idp_tkl_ast: 1, idp_sack: 4, idp_int: 5 },
  }));
  assert.equal(ctx.values.DL.structuralScore, 124);
  assert.equal(ctx.values.LB.structuralScore, 124);
  assert.equal(ctx.values.DB.structuralScore, 124);
  assert.equal(ctx.values.DL.scoringScore, 0);
  assert.equal(ctx.values.DL.scoringContributionStatus, 'not-modeled');
  assert.equal(ctx.values.DL.dedicatedDemand, 42);
  assert.equal(ctx.idpPressureAudit.totalFlexibleDemand, 28);
  const allocated = ['DL','LB','DB'].reduce((sum, pos) => sum + ctx.values[pos].flexDemandShare, 0);
  assert.equal(Math.round(allocated), 28, 'one generic IDP flex opportunity must be shared rather than counted for every position');
}

{
  const ctx = corrected(league({
    slots: ['DL','DL','LB','LB','LB','DB','IDP_FLEX'],
    scoring: { idp_tkl_solo: 2 },
  }));
  assert.notEqual(ctx.values.DL.structuralScore, ctx.values.LB.structuralScore);
  assert.notEqual(ctx.values.LB.structuralScore, ctx.values.DB.structuralScore);
  assert.ok(ctx.values.LB.structuralScore > ctx.values.DL.structuralScore);
  assert.ok(ctx.values.DL.structuralScore > ctx.values.DB.structuralScore);
}

{
  const ctx = corrected(league({ slots: ['QB','RB','RB','WR','WR','TE','FLEX','BN'] }));
  assert.equal(ctx.values.DL.structuralScore, 100);
  assert.equal(ctx.values.LB.structuralScore, 100);
  assert.equal(ctx.values.DB.structuralScore, 100);
  assert.equal(ctx.values.DL.demand, 0);
  assert.equal(ctx.values.RB.structuralScore, Core.leagueContext(league({ slots: ['QB','RB','RB','WR','WR','TE','FLEX','BN'] })).values.RB.structuralScore);
}

{
  const base = Core.leagueContext(league({ slots: ['QB','SUPER_FLEX','RB','RB','WR','WR','TE'] }));
  const fixed = corrected(league({ slots: ['QB','SUPER_FLEX','RB','RB','WR','WR','TE'] }));
  assert.equal(fixed.values.QB.structuralScore, base.values.QB.structuralScore, 'superflex offense behavior remains unchanged in this focused fix');
}

{
  const parsed = Fixes.parseCoverageText('Applied keys: pass_yd, pass_td, rec, idp_int\nUnsupported/non-matching keys: bonus_pass_yd_300, idp_sack, fgm');
  assert.deepEqual(parsed.applied, ['pass_yd','pass_td','rec','idp_int']);
  assert.deepEqual(parsed.unsupported, ['bonus_pass_yd_300','idp_sack','fgm']);
  const appliedCategories = Fixes.uniqueCategories(parsed.applied);
  assert.ok(appliedCategories.includes('Passing'));
  assert.ok(appliedCategories.includes('Receiving'));
  assert.ok(appliedCategories.includes('IDP turnovers / plays'));
  const unsupportedCategories = Fixes.uniqueCategories(parsed.unsupported);
  assert.ok(unsupportedCategories.includes('IDP sacks / pressure'));
  assert.ok(unsupportedCategories.includes('Kicking'));
}

console.log('live-test-fixes tests passed');
