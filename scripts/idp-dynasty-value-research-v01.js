const fs = require('node:fs');
const path = require('node:path');
const Age = require('./idp-age-curves-v03.js');

const POSITIONS = Object.freeze(['DL','LB','DB']);
const DEFAULT_SEASONS = Age.DEFAULT_SEASONS;

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}
function mean(values) {
  const xs = values.filter(Number.isFinite);
  return xs.length ? xs.reduce((a,b)=>a+b,0) / xs.length : null;
}
function quantile(values, q) {
  const xs = values.filter(Number.isFinite).slice().sort((a,b)=>a-b);
  if (!xs.length) return null;
  const pos = (xs.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return xs[lo];
  return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo);
}
function pearson(xs, ys) {
  const pairs = xs.map((x,i)=>[x,ys[i]]).filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y));
  if (pairs.length < 3) return null;
  const ax = mean(pairs.map(([x])=>x));
  const ay = mean(pairs.map(([,y])=>y));
  let num=0, dx=0, dy=0;
  for (const [x,y] of pairs) { const a=x-ax,b=y-ay; num+=a*b; dx+=a*a; dy+=b*b; }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx*dy) : null;
}
function ranks(values) {
  const indexed = values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v || a.i-b.i);
  const out = Array(values.length);
  let i=0;
  while (i<indexed.length) {
    let j=i+1; while (j<indexed.length && indexed[j].v===indexed[i].v) j+=1;
    const r=(i+j-1)/2+1; for (let k=i;k<j;k+=1) out[indexed[k].i]=r; i=j;
  }
  return out;
}
function spearman(xs, ys) {
  const pairs = xs.map((x,i)=>[x,ys[i]]).filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y));
  if (pairs.length < 3) return null;
  return pearson(ranks(pairs.map(([x])=>x)), ranks(pairs.map(([,y])=>y)));
}
function rmse(values) {
  const xs=values.filter(Number.isFinite);
  return xs.length ? Math.sqrt(xs.reduce((s,x)=>s+x*x,0)/xs.length) : null;
}
function stdev(values) {
  const xs=values.filter(Number.isFinite); if (xs.length < 2) return null;
  const m=mean(xs); return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1));
}
function byKey(rows) { return new Map(rows.map(r=>[`${r.gsis_id}|${r.season}`,r])); }
function positionSeasonThresholds(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!POSITIONS.includes(row.model_position) || !Number.isFinite(row.reference_points)) continue;
    const key=`${row.model_position}|${row.season}`;
    const xs=groups.get(key)||[]; xs.push(row.reference_points); groups.set(key,xs);
  }
  const out=new Map();
  for (const [key,xs] of groups) out.set(key,{p50:quantile(xs,.5),p75:quantile(xs,.75)});
  return out;
}
function lagPairs(rows, lag) {
  const map=byKey(rows), out=[];
  for (const row of rows) {
    const next=map.get(`${row.gsis_id}|${row.season+lag}`);
    if (!next || next.model_position!==row.model_position) continue;
    out.push({position:row.model_position, from:row, to:next});
  }
  return out;
}
function persistenceByPosition(rows, maxLag=3) {
  const result={};
  for (const position of POSITIONS) {
    result[position]=[];
    for (let lag=1;lag<=maxLag;lag+=1) {
      const pairs=lagPairs(rows,lag).filter(x=>x.position===position);
      const xTotal=pairs.map(x=>x.from.reference_points), yTotal=pairs.map(x=>x.to.reference_points);
      const xRate=pairs.map(x=>x.from.points_per_observed_week), yRate=pairs.map(x=>x.to.points_per_observed_week);
      result[position].push({
        lag_years:lag,
        n:pairs.length,
        total_points_pearson:round(pearson(xTotal,yTotal)),
        total_points_spearman:round(spearman(xTotal,yTotal)),
        points_per_observed_week_pearson:round(pearson(xRate,yRate)),
        points_per_observed_week_spearman:round(spearman(xRate,yRate)),
        mean_absolute_total_points_change:round(mean(pairs.map(x=>Math.abs(x.to.reference_points-x.from.reference_points)))),
      });
    }
  }
  return result;
}
function relevanceSurvival(rows) {
  const thresholds=positionSeasonThresholds(rows), map=byKey(rows), result={};
  for (const position of POSITIONS) {
    const base=rows.filter(r=>r.model_position===position && Number.isFinite(r.reference_points));
    const exposure=base.filter(r=>map.has(`${r.gsis_id}|${r.season+1}`));
    const eligible=base.filter(r=>r.season < Math.max(...rows.map(x=>x.season)));
    const stats={position, player_seasons:base.length, next_season_exposure_n:eligible.length};
    for (const label of ['p50','p75']) {
      const starters=eligible.filter(r=>r.reference_points >= thresholds.get(`${position}|${r.season}`)?.[label]);
      const survivors=starters.filter(r=>{
        const n=map.get(`${r.gsis_id}|${r.season+1}`));
        if (!n || n.model_position!==position) return false;
        const t=thresholds.get(`${position}|${n.season}`)?.[label];
        return Number.isFinite(t) && n.reference_points >= t;
      });
      stats[`${label}_current_relevant_n`]=starters.length;
      stats[`${label}_next_season_relevance_rate`]=starters.length ? round(survivors.length/starters.length) : null;
    }
    stats.note='Production-percentile persistence only; not starter/role survival.';
    result[position]=stats;
  }
  return result;
}
function groupCurve(rows, field) {
  const groups=new Map();
  for (const r of rows) {
    if (!POSITIONS.includes(r.model_position) || !Number.isInteger(r[field])) continue;
    const key=`${r.model_position}|${r[field]}`; const xs=groups.get(key)||[]; xs.push(r); groups.set(key,xs);
  }
  return [...groups.entries()].map(([key,xs])=>{
    const [position,bucket]=key.split('|');
    const next=xs.filter(r=>Number.isFinite(r.conditional_yoy_points_per_observed_week_delta));
    return {
      position,
      [field]:Number(bucket),
      n_player_seasons:xs.length,
      mean_reference_points:round(mean(xs.map(r=>r.reference_points))),
      mean_points_per_observed_week:round(mean(xs.map(r=>r.points_per_observed_week))),
      mean_observed_week_availability_proxy:round(mean(xs.map(r=>r.observed_week_availability_proxy))),
      next_season_participation_rate:round(mean(xs.map(r=>r.next_season_any_idp_observed ? 1 : 0))),
      conditional_mean_yoy_points_per_observed_week_delta:round(mean(next.map(r=>r.conditional_yoy_points_per_observed_week_delta))),
      conditional_yoy_delta_stdev:round(stdev(next.map(r=>r.conditional_yoy_points_per_observed_week_delta))),
    };
  }).sort((a,b)=>a.position.localeCompare(b.position)||a[field]-b[field]);
}
function uncertaintyByPosition(rows) {
  const map=byKey(rows), out={};
  for (const position of POSITIONS) {
    const deltas=[];
    for (const r of rows) {
      if (r.model_position!==position) continue;
      const n=map.get(`${r.gsis_id}|${r.season+1}`);
      if (!n || n.model_position!==position || !Number.isFinite(r.reference_points)||!Number.isFinite(n.reference_points)) continue;
      deltas.push(n.reference_points-r.reference_points);
    }
    out[position]={
      n_yoy_pairs:deltas.length,
      yoy_total_points_delta_mean:round(mean(deltas)),
      yoy_total_points_delta_stdev:round(stdev(deltas)),
      yoy_total_points_delta_rmse_from_zero:round(rmse(deltas)),
      p10_delta:round(quantile(deltas,.1)),
      p50_delta:round(quantile(deltas,.5)),
      p90_delta:round(quantile(deltas,.9)),
      interpretation:'Historical production volatility only; does not include explicit role-transition uncertainty because historical role data is unavailable.',
    };
  }
  return out;
}
function replacementSensitivity(rows, leagueSizes=[10,12,14], starters=[1,2,3]) {
  const latest=Math.max(...rows.map(r=>r.season));
  const current=rows.filter(r=>r.season===latest && POSITIONS.includes(r.model_position) && Number.isFinite(r.reference_points));
  const out=[];
  for (const position of POSITIONS) {
    const pool=current.filter(r=>r.model_position===position).sort((a,b)=>b.reference_points-a.reference_points||a.gsis_id.localeCompare(b.gsis_id));
    for (const teams of leagueSizes) for (const perTeam of starters) {
      const demand=teams*perTeam;
      out.push({position,season:latest,teams,starters_per_team:perTeam,demand,replacement_reference_points:pool.length>=demand?round(pool[demand-1].reference_points):null,pool_n:pool.length,status:pool.length>=demand?'available':'insufficient_pool'});
    }
  }
  return out;
}
function candidateHorizonEvidence(persistence, survival) {
  const out={};
  for (const position of POSITIONS) {
    const rows=persistence[position]||[];
    out[position]={
      directly_observed_lags:rows.map(r=>({lag_years:r.lag_years,n:r.n,rank_stability:r.total_points_spearman})),
      next_season_p50_relevance_rate:survival[position]?.p50_next_season_relevance_rate ?? null,
      next_season_p75_relevance_rate:survival[position]?.p75_next_season_relevance_rate ?? null,
      proposed_research_horizon_status:'UNFROZEN',
      note:'Do not choose a dynasty discount horizon from offense defaults. Freeze only after chronological backtesting compares position-specific horizons against unseen seasons.',
    };
  }
  return out;
}
function multiYearSurplusArchitecture() {
  return {
    status:'ARCHITECTURE_ONLY',
    equation:'sum_{h=0..H_position} survival_probability(h) * expected_scored_points(h) - league_replacement_points(h), with a separately validated discount function applied only after backtest evidence',
    required_inputs:['current-season league-scored projection','position-specific multi-year production model','position-specific fantasy-relevance survival','league-specific replacement by season','uncertainty distribution'],
    explicitly_blocked_inputs:['starter-role survival inferred from fantasy points','snap survival inferred from tackles','offense-derived horizon','offense-derived discount rate','offense-vs-IDP normalization'],
    future_opportunity_adapter:{required_fields:['player_id','season','week_or_snapshot_date','team','position_eligibility','depth_position_or_role','starter_flag_or_depth_order','defensive_snaps_if_licensed','source_timestamp','source_provenance'],join_contract:'stable player identity + point-in-time season/week; never overwrite historical state with current state'},
  };
}

async function run(options={}) {
  const age=await Age.run(options);
  // Rebuild the same player-season rows once so persistence research is based on the exact age-contract source.
  // Age.run intentionally exposes aggregates only, so callers may pass prebuilt playerSeasons in tests.
  const rows=options.playerSeasons || [];
  if (!rows.length) {
    return {
      version:'lv-idp-dynasty-value-research-v0.1', generated_at:new Date().toISOString(),
      status:'ARCHITECTURE_READY_EMPIRICAL_ROWS_REQUIRED',
      foundation_age_summary:age.sample,
      idp_dynasty_value_available:false,
      note:'CLI empirical execution uses buildFromPlayerSeasons after constructing player seasons; run() remains dependency-safe for unit tests.',
      multi_year_surplus_architecture:multiYearSurplusArchitecture(),
    };
  }
  return buildFromPlayerSeasons(rows,{generated_at:age.generated_at,seasons:age.seasons});
}
function buildFromPlayerSeasons(rows, meta={}) {
  const maxSeason=Math.max(...rows.map(r=>r.season));
  const persistence=persistenceByPosition(rows,3);
  const survival=relevanceSurvival(rows);
  return {
    version:'lv-idp-dynasty-value-research-v0.1', generated_at:meta.generated_at||new Date().toISOString(), seasons:meta.seasons||[...new Set(rows.map(r=>r.season))].sort(),
    status:'RESEARCH_ONLY', idp_dynasty_value_available:false,
    contracts:{
      production_persistence:'Observed historical fantasy production persistence by model position only.',
      fantasy_relevance:'Percentile-based production relevance sensitivity; never labeled starter or role survival.',
      opportunity:'Historical snaps/depth/starter-role unavailable in current approved normalized source; no proxy substitution.',
      finer_roles:'EDGE/interior DL/off-ball LB/CB/S remain exploratory until stable historical role identity and adequate sample sizes are proven.',
    },
    sample:{player_seasons:rows.length,latest_season:maxSeason,by_position:Object.fromEntries(POSITIONS.map(p=>[p,rows.filter(r=>r.model_position===p).length]))},
    production_persistence:persistence,
    fantasy_relevance_survival:survival,
    age_curves:groupCurve(rows,'player_season_age'),
    experience_curves:groupCurve(rows,'experience_season'),
    uncertainty:uncertaintyByPosition(rows),
    replacement_sensitivity:replacementSensitivity(rows),
    horizon_evidence:candidateHorizonEvidence(persistence,survival),
    multi_year_surplus_architecture:multiYearSurplusArchitecture(),
    scoring_sensitivity:{status:'ADAPTER_DEFINED_NOT_FROZEN',note:'Re-score the same historical stat lines under the target Sleeper league scoring. Do not transfer reference-scoring persistence coefficients blindly across leagues.'},
    starter_count_sensitivity:{status:'SUPPORTED_AS_REPLACEMENT_SENSITIVITY_ONLY',note:'Starter counts change replacement demand; historical starter-role labels remain unavailable.'},
    idp_flex_effects:{status:'CURRENT_ELIGIBILITY_ARCHITECTURE_AVAILABLE_HISTORICAL_EFFECT_BLOCKED',note:'Current Sleeper hybrids/flex can be solved with constrained assignment, but retrospective hybrid eligibility must not be reconstructed from current eligibility.'},
    hybrid_position_effects:{status:'CURRENT_ONLY_UNTIL_POINT_IN_TIME_ELIGIBILITY_EXISTS',note:'Do not apply current hybrid labels retrospectively.'},
    blockers:['historical defensive snaps','historical point-in-time depth charts','historical starter/reserve roles','historical point-in-time hybrid eligibility','chronological multi-year projection backtest','position-specific horizon validation','discount-function validation','offense-vs-IDP normalization'],
  };
}

function parseArgs(values) {
  const out={input:null,output:'data/reports/idp-dynasty-value-v01/idp-dynasty-value-research.json'};
  for (let i=0;i<values.length;i+=1) if (values[i].startsWith('--')) { out[values[i].slice(2)]=values[i+1]; i+=1; }
  return out;
}
function main() {
  const args=parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error('Provide --input path to a player-season JSON array produced by the historical IDP pipeline');
  const parsed=JSON.parse(fs.readFileSync(path.resolve(args.input),'utf8'));
  const rows=Array.isArray(parsed)?parsed:parsed.player_seasons;
  if (!Array.isArray(rows)||!rows.length) throw new Error('Input must contain non-empty player_seasons array');
  const result=buildFromPlayerSeasons(rows);
  const output=path.resolve(args.output); fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  process.stdout.write(`${output}\n`);
}
if (require.main===module) { try { main(); } catch (error) { console.error(error.stack||error.message); process.exit(1); } }
module.exports={POSITIONS,round,mean,quantile,pearson,spearman,positionSeasonThresholds,lagPairs,persistenceByPosition,relevanceSurvival,groupCurve,uncertaintyByPosition,replacementSensitivity,candidateHorizonEvidence,multiYearSurplusArchitecture,buildFromPlayerSeasons,run};
