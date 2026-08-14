const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../scripts/idp-dynasty-value-research-v01.js');
const Empirical=require('../scripts/idp-dynasty-empirical-v01.js');
const Horizon=require('../scripts/idp-dynasty-horizon-v01.js');

function row(id,season,position,points,age,exp,ppw=points/10){return {gsis_id:id,season,model_position:position,reference_points:points,points_per_observed_week:ppw,observed_week_availability_proxy:.8,player_season_age:age,experience_season:exp,next_season_any_idp_observed:false,next_season_same_model_position:false,conditional_yoy_points_per_observed_week_delta:null};}
function sample(){
  const rows=[];
  for(const p of ['DL','LB','DB']) for(let i=0;i<6;i+=1){
    const id=`${p}${i}`;
    const a=row(id,2022,p,50+i*10,24+i,1+i);
    const b=row(id,2023,p,55+i*9,25+i,2+i);
    const c=row(id,2024,p,58+i*8,26+i,3+i);
    a.next_season_any_idp_observed=true;a.next_season_same_model_position=true;a.conditional_yoy_points_per_observed_week_delta=b.points_per_observed_week-a.points_per_observed_week;
    b.next_season_any_idp_observed=true;b.next_season_same_model_position=true;b.conditional_yoy_points_per_observed_week_delta=c.points_per_observed_week-b.points_per_observed_week;
    rows.push(a,b,c);
  }
  return rows;
}

test('persistence is position-specific and chronological',()=>{
  const p=R.persistenceByPosition(sample(),2);
  assert.equal(p.DL[0].lag_years,1);
  assert.equal(p.LB[1].lag_years,2);
  assert.ok(p.DB[0].n>0);
  assert.ok(p.DL[0].total_points_spearman>0);
});

test('fantasy relevance is explicitly production-percentile survival, not role survival',()=>{
  const s=R.relevanceSurvival(sample());
  assert.match(s.DL.note,/not starter\/role survival/i);
  assert.ok(Number.isFinite(s.LB.p50_next_season_relevance_rate));
});

test('age and experience curves use player-season fields',()=>{
  const rows=sample();
  const ages=R.groupCurve(rows,'player_season_age');
  const exp=R.groupCurve(rows,'experience_season');
  assert.ok(ages.some(x=>x.position==='DB'&&x.player_season_age===24));
  assert.ok(exp.some(x=>x.position==='DL'&&x.experience_season===1));
});

test('experience metadata fails closed instead of coercing missing rookie year to zero',()=>{
  assert.equal(Empirical.safeExperience(null,2025),null);
  assert.equal(Empirical.safeExperience(undefined,2025),null);
  assert.equal(Empirical.safeExperience('',2025),null);
  assert.equal(Empirical.safeExperience(0,2025),null);
  assert.equal(Empirical.safeExperience(2030,2025),null);
  assert.equal(Empirical.safeExperience(2022,2025),4);
});

test('finer role audit distinguishes stable, multi-role, and unspecified player-seasons',()=>{
  const observations=[
    {gsis_id:'a',season:2024,position_group:'DL',role_hint:'EDGE'},
    {gsis_id:'a',season:2024,position_group:'DL',role_hint:'EDGE'},
    {gsis_id:'b',season:2024,position_group:'DB',role_hint:'CB'},
    {gsis_id:'b',season:2024,position_group:'DB',role_hint:'S'},
    {gsis_id:'c',season:2024,position_group:'LB',role_hint:null},
  ];
  const coverage=Empirical.roleCoverage(observations);
  assert.equal(coverage.player_seasons,3);
  assert.equal(coverage.stable_single_role_player_seasons,1);
  assert.equal(coverage.multi_role_player_seasons,1);
  assert.equal(coverage.unspecified_only_player_seasons,1);
  assert.equal(coverage.stable_role_player_seasons.EDGE,1);
});

test('uncertainty remains separate by DL LB DB',()=>{
  const u=R.uncertaintyByPosition(sample());
  assert.deepEqual(Object.keys(u),['DL','LB','DB']);
  assert.ok(u.DL.n_yoy_pairs>0);
  assert.match(u.DB.interpretation,/role-transition uncertainty/i);
});

test('replacement sensitivity changes with league size and starter demand',()=>{
  const rows=sample();
  const sens=R.replacementSensitivity(rows,[1,2],[1,2]);
  const dl=sens.filter(x=>x.position==='DL'&&x.status==='available');
  const shallow=dl.find(x=>x.teams===1&&x.starters_per_team===1);
  const deeper=dl.find(x=>x.teams===2&&x.starters_per_team===2);
  assert.ok(shallow.replacement_reference_points>=deeper.replacement_reference_points);
});

test('multi-year surplus architecture never enables dynasty value or imports offense assumptions',()=>{
  const out=R.buildFromPlayerSeasons(sample());
  assert.equal(out.idp_dynasty_value_available,false);
  assert.equal(out.multi_year_surplus_architecture.status,'ARCHITECTURE_ONLY');
  assert.ok(out.multi_year_surplus_architecture.explicitly_blocked_inputs.includes('offense-derived horizon'));
  assert.ok(out.blockers.includes('historical point-in-time depth charts'));
  for(const p of ['DL','LB','DB']) assert.equal(out.horizon_evidence[p].proposed_research_horizon_status,'UNFROZEN');
});

test('hybrid and IDP flex effects are not reconstructed retrospectively from current eligibility',()=>{
  const out=R.buildFromPlayerSeasons(sample());
  assert.match(out.idp_flex_effects.status,/HISTORICAL_EFFECT_BLOCKED/);
  assert.match(out.hybrid_position_effects.status,/CURRENT_ONLY/);
});

test('multi-horizon relevance survival exposes year+1 year+2 year+3 without calling it role survival',()=>{
  const s=Horizon.multiHorizonRelevanceSurvival(sample(),3);
  for(const p of ['DL','LB','DB']){
    assert.deepEqual(s[p].horizons.map(x=>x.horizon_years),[1,2,3]);
    assert.match(s[p].note,/not starter\/depth\/role survival/i);
    assert.ok(Number.isFinite(s[p].horizons[0].p50_relevance_survival_rate));
  }
});

test('position horizon readiness remains unfrozen and never inherits offense horizon',()=>{
  const rows=sample();
  const ready=Horizon.horizonReadiness(R.persistenceByPosition(rows,3),Horizon.multiHorizonRelevanceSurvival(rows,3),R.uncertaintyByPosition(rows));
  for(const p of ['DL','LB','DB']){
    assert.equal(ready[p].status,'UNFROZEN');
    assert.equal(ready[p].offense_horizon_inherited,false);
    assert.ok(Object.hasOwn(ready[p].p50_relevance_survival,'y1'));
  }
});

test('finer role splits require both sample and provenance and never authorize production inference',()=>{
  const coverage={stable_role_player_seasons:{EDGE:300,DT:260,ILB:280,CB:500,S:450}};
  const ready=Horizon.roleSplitReadiness(coverage,250);
  assert.equal(ready.groups.EDGE.status,'SAMPLE_GATE_ONLY');
  assert.equal(ready.groups.INTERIOR_DL.status,'SAMPLE_GATE_ONLY');
  assert.equal(ready.groups.OFF_BALL_LB.status,'SAMPLE_GATE_ONLY');
  assert.equal(ready.production_role_inference_authorized,false);
  for(const group of Object.values(ready.groups)) assert.equal(group.empirically_justified,false);
});

test('candidate surplus architecture is research-only and explicitly compares clipped vs signed surplus',()=>{
  const a=Horizon.surplusArchitecture();
  assert.equal(a.status,'ARCHITECTURE_ONLY');
  assert.equal(a.production_numeric_output,false);
  assert.match(a.candidate_equation,/P\(fantasy_relevant at h/i);
  assert.match(a.alternative_signed_surplus_equation,/expected_league_scored_points_h - league_replacement_points_h/i);
  assert.ok(a.blocked_assumptions.includes('offensive dynasty horizon'));
});

test('scoring FLEX and hybrid sensitivity contracts fail closed where historical point-in-time evidence is missing',()=>{
  const s=Horizon.sensitivityReadiness();
  assert.match(s.league_scoring.status,/REQUIRES_HISTORICAL_STAT_RESCORING/);
  assert.match(s.idp_flex.status,/HISTORICAL_EFFECT_BLOCKED/);
  assert.match(s.hybrid_positions.status,/HISTORICAL_POINT_IN_TIME_ELIGIBILITY_REQUIRED/);
});
