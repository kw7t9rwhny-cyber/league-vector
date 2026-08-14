const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../scripts/idp-dynasty-value-research-v01.js');
const Empirical=require('../scripts/idp-dynasty-empirical-v01.js');

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
