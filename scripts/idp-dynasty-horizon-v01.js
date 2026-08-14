const POSITIONS=Object.freeze(['DL','LB','DB']);

function round(value,digits=4){if(!Number.isFinite(value))return null;const p=10**digits;return Math.round(value*p)/p;}
function quantile(values,q){const xs=(values||[]).filter(Number.isFinite).slice().sort((a,b)=>a-b);if(!xs.length)return null;const pos=(xs.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);return lo===hi?xs[lo]:xs[lo]+(xs[hi]-xs[lo])*(pos-lo);}
function thresholds(rows){const groups=new Map();for(const r of rows||[]){if(!POSITIONS.includes(r.model_position)||!Number.isFinite(r.reference_points))continue;const key=`${r.model_position}|${r.season}`;const xs=groups.get(key)||[];xs.push(r.reference_points);groups.set(key,xs);}const out=new Map();for(const [key,xs] of groups)out.set(key,{p50:quantile(xs,.5),p75:quantile(xs,.75)});return out;}
function mapRows(rows){return new Map((rows||[]).filter(r=>r.gsis_id&&Number.isInteger(r.season)).map(r=>[`${r.gsis_id}|${r.season}`,r]));}

function multiHorizonRelevanceSurvival(rows,maxHorizon=3){
  const t=thresholds(rows),map=mapRows(rows),maxSeason=Math.max(...rows.map(r=>r.season)),out={};
  for(const position of POSITIONS){
    out[position]={position,horizons:[],note:'Production-percentile relevance survival only; absence or position change counts as not production-relevant. This is not starter/depth/role survival.'};
    for(let h=1;h<=maxHorizon;h+=1){
      const eligible=rows.filter(r=>r.model_position===position&&Number.isFinite(r.reference_points)&&r.season<=maxSeason-h);
      const result={horizon_years:h,eligible_player_seasons:eligible.length};
      for(const label of ['p50','p75']){
        const current=eligible.filter(r=>{const x=t.get(`${position}|${r.season}`)?.[label];return Number.isFinite(x)&&r.reference_points>=x;});
        let survivor=0,observedSamePosition=0;
        for(const r of current){const n=map.get(`${r.gsis_id}|${r.season+h}`);if(!n||n.model_position!==position)continue;observedSamePosition+=1;const x=t.get(`${position}|${n.season}`)?.[label];if(Number.isFinite(x)&&n.reference_points>=x)survivor+=1;}
        result[`${label}_origin_n`]=current.length;
        result[`${label}_same_position_observed_rate`]=current.length?round(observedSamePosition/current.length):null;
        result[`${label}_relevance_survival_rate`]=current.length?round(survivor/current.length):null;
      }
      out[position].horizons.push(result);
    }
  }
  return out;
}

function ageDeclineEvidence(rows,minN=20){
  const by=new Map();
  for(const r of rows||[]){if(!POSITIONS.includes(r.model_position)||!Number.isInteger(r.player_season_age))continue;const key=`${r.model_position}|${r.player_season_age}`;const xs=by.get(key)||[];xs.push(r);by.set(key,xs);}
  const out={};
  for(const position of POSITIONS){
    const buckets=[];
    for(const [key,xs] of by){const [p,a]=key.split('|');if(p!==position||xs.length<minN)continue;const deltas=xs.map(r=>r.conditional_yoy_points_per_observed_week_delta).filter(Number.isFinite);const participation=xs.map(r=>r.next_season_any_idp_observed?1:0);const mean=v=>v.length?v.reduce((s,x)=>s+x,0)/v.length:null;buckets.push({age:Number(a),n:xs.length,next_season_participation_rate:round(mean(participation)),conditional_yoy_points_per_observed_week_delta:round(mean(deltas)),conditional_delta_n:deltas.length});}
    buckets.sort((a,b)=>a.age-b.age);
    const negative=buckets.filter(x=>x.conditional_delta_n>=minN&&Number.isFinite(x.conditional_yoy_points_per_observed_week_delta)&&x.conditional_yoy_points_per_observed_week_delta<0);
    const sustained=[];for(let i=0;i<negative.length;i+=1){const a=negative[i];const b=negative.find(x=>x.age===a.age+1);if(b)sustained.push(a.age);}
    out[position]={buckets,earliest_two_age_sustained_negative_delta:sustained.length?Math.min(...sustained):null,status:buckets.length?'DESCRIPTIVE_ONLY':'INSUFFICIENT_SAMPLE',note:'Age decline evidence is survivor-conditioned descriptive evidence, not a dynasty multiplier or causal role-survival curve.'};
  }
  return out;
}

function horizonReadiness(persistence,multiSurvival,uncertainty){
  const out={};
  for(const position of POSITIONS){const p=persistence?.[position]||[],s=multiSurvival?.[position]?.horizons||[];out[position]={status:'UNFROZEN',observed_rank_persistence:Object.fromEntries(p.map(x=>[`y${x.lag_years}`,x.total_points_spearman])),p50_relevance_survival:Object.fromEntries(s.map(x=>[`y${x.horizon_years}`,x.p50_relevance_survival_rate])),p75_relevance_survival:Object.fromEntries(s.map(x=>[`y${x.horizon_years}`,x.p75_relevance_survival_rate])),yoy_delta_stdev:uncertainty?.[position]?.yoy_total_points_delta_stdev??null,decision_rule:'No horizon is frozen until a chronological multi-year forecast backtest shows that including that horizon improves out-of-sample dynasty-relevant ranking/error for this position.',offense_horizon_inherited:false};}
  return out;
}

function roleSplitReadiness(roleCoverage,minStablePlayerSeasons=250){
  const supported=['EDGE','INTERIOR','INTERIOR_DL','IDL','DT','DE','OFF_BALL','OFF_BALL_LB','ILB','OLB','CB','S'];
  const counts=roleCoverage?.stable_role_player_seasons||{};
  const groups={EDGE:['EDGE','DE'],INTERIOR_DL:['INTERIOR','INTERIOR_DL','IDL','DT'],OFF_BALL_LB:['OFF_BALL','OFF_BALL_LB','ILB'],CB:['CB'],S:['S']};
  const out={};
  for(const [group,aliases] of Object.entries(groups)){const n=aliases.reduce((s,a)=>s+(counts[a]||0),0);out[group]={stable_player_seasons:n,status:n>=minStablePlayerSeasons?'SAMPLE_GATE_ONLY':'INSUFFICIENT_STABLE_SAMPLE',empirically_justified:false,note:'Even a passing sample gate does not authorize role-split dynasty modeling without stable point-in-time role provenance and chronological performance gain over DL/LB/DB.'};}
  return {minimum_stable_player_seasons:minStablePlayerSeasons,normalized_roles_considered:supported,groups:out,production_role_inference_authorized:false};
}

function sensitivityReadiness(){return {
  replacement_level:{status:'DETERMINISTIC_SENSITIVITY_SUPPORTED',note:'League size and dedicated starter demand can be varied without historical depth charts; this is not role survival.'},
  league_scoring:{status:'REQUIRES_HISTORICAL_STAT_RESCORING',note:'Persistence/survival must be re-estimated from the same player-seasons after deterministic re-scoring under target Sleeper settings; reference-scoring coefficients must not be transferred blindly.'},
  starter_count:{status:'DETERMINISTIC_REPLACEMENT_SENSITIVITY_SUPPORTED',note:'Starter counts alter replacement demand only.'},
  idp_flex:{status:'CURRENT_CONSTRAINED_ASSIGNMENT_SUPPORTED_HISTORICAL_EFFECT_BLOCKED',note:'Current league FLEX effects can be solved with current eligibility, but historical FLEX/hybrid effects require point-in-time historical eligibility.'},
  hybrid_positions:{status:'HISTORICAL_POINT_IN_TIME_ELIGIBILITY_REQUIRED',note:'Current hybrid labels are never projected backward.'}
};}

function surplusArchitecture(){return {status:'ARCHITECTURE_ONLY',candidate_equation:'sum_h discount_position(h) * P(fantasy_relevant at h | information available at valuation time) * max(0, expected_league_scored_points_h - league_replacement_points_h)',alternative_signed_surplus_equation:'sum_h discount_position(h) * P(relevant_h) * (expected_league_scored_points_h - league_replacement_points_h)',research_question:'Compare zero-clipped versus signed surplus only in chronological backtests; do not choose based on face validity.',required_validation:['position-specific chronological forecast','multi-horizon production-relevance survival','league-scoring-specific rescoring','replacement sensitivity','uncertainty calibration','point-in-time role/opportunity once licensed'],blocked_assumptions:['offensive dynasty horizon','offensive discount curve','starter-role survival inferred from fantasy points','historical hybrid eligibility inferred from current Sleeper labels'],production_numeric_output:false};}

module.exports={POSITIONS,round,quantile,multiHorizonRelevanceSurvival,ageDeclineEvidence,horizonReadiness,roleSplitReadiness,sensitivityReadiness,surplusArchitecture};
