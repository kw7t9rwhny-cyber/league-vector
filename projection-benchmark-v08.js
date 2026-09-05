(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LeagueVectorProjectionBenchmark = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "lv-projection-benchmark-v0.1";
  const POSITIONS = ["QB", "RB", "WR", "TE", "DL", "LB", "DB"];
  const TARGETS = Object.freeze({
    QB: ["attempts", "completions", "passing_yards", "passing_td", "interceptions", "sacks", "carries", "rushing_yards", "rushing_td"],
    RB: ["carries", "rushing_yards", "rushing_td", "targets", "receptions", "receiving_yards", "receiving_td"],
    WR: ["targets", "receptions", "receiving_yards", "receiving_td"],
    TE: ["targets", "receptions", "receiving_yards", "receiving_td"],
    DL: ["solo_tackles", "assisted_tackles", "total_tackles", "tackles_for_loss", "sacks", "qb_hits", "interceptions", "passes_defended", "forced_fumbles", "fumble_recoveries", "defensive_td", "safeties"],
    LB: ["solo_tackles", "assisted_tackles", "total_tackles", "tackles_for_loss", "sacks", "qb_hits", "interceptions", "passes_defended", "forced_fumbles", "fumble_recoveries", "defensive_td", "safeties"],
    DB: ["solo_tackles", "assisted_tackles", "total_tackles", "tackles_for_loss", "sacks", "qb_hits", "interceptions", "passes_defended", "forced_fumbles", "fumble_recoveries", "defensive_td", "safeties"],
  });

  const LV_PPR = Object.freeze({
    passing_yards: 0.04, passing_td: 4, interceptions: -2,
    rushing_yards: 0.1, rushing_td: 6, receptions: 1,
    receiving_yards: 0.1, receiving_td: 6,
  });
  const LV_IDP = Object.freeze({
    solo_tackles: 1.5, assisted_tackles: 0.75, tackles_for_loss: 2,
    sacks: 4, qb_hits: 1, interceptions: 6, passes_defended: 1.5,
    forced_fumbles: 3, fumble_recoveries: 3, defensive_td: 6, safeties: 4,
  });

  function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
  function mean(values) { return values.length ? values.reduce((a,b)=>a+b,0) / values.length : null; }
  function median(values) {
    if (!values.length) return null;
    const x = [...values].sort((a,b)=>a-b); const m = Math.floor(x.length/2);
    return x.length % 2 ? x[m] : (x[m-1]+x[m])/2;
  }
  function quantile(values, q) {
    if (!values.length) return null;
    const x = [...values].sort((a,b)=>a-b); const p = (x.length-1)*q; const lo=Math.floor(p), hi=Math.ceil(p);
    return lo===hi ? x[lo] : x[lo] + (x[hi]-x[lo])*(p-lo);
  }
  function rank(values) {
    const order = values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v); const out = Array(values.length); let i=0;
    while (i<order.length) { let j=i; while (j+1<order.length && order[j+1].v===order[i].v) j++; const r=(i+j+2)/2; for(let k=i;k<=j;k++) out[order[k].i]=r; i=j+1; }
    return out;
  }
  function pearson(a,b) {
    if (a.length<2 || a.length!==b.length) return null; const ma=mean(a), mb=mean(b); let num=0,da=0,db=0;
    for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;num+=x*y;da+=x*x;db+=y*y;} return da&&db ? num/Math.sqrt(da*db) : null;
  }
  function spearman(actual,predicted){ return pearson(rank(actual),rank(predicted)); }

  function cellValue(cell) { return cell?.state === "value" && Number.isFinite(cell.value) ? cell.value : null; }
  function aggregatePlayerSeasons(observations) {
    return require('./projection-observations.js').aggregate(observations, TARGETS, POSITIONS);
  }

  function indexSeasons(rows) { const byPlayer=new Map(); for(const row of rows){const arr=byPlayer.get(row.gsis_id)||[];arr.push(row);byPlayer.set(row.gsis_id,arr);} for(const arr of byPlayer.values()) arr.sort((a,b)=>a.season-b.season); return byPlayer; }
  function historyBefore(index, gsisId, season, maxYears=3) { return (index.get(gsisId)||[]).filter(r=>r.season<season).slice(-maxYears).reverse(); }
  function positionAverage(rows, position, target, throughSeason) { const vals=rows.filter(r=>r.position===position&&r.season<=throughSeason&&Number.isFinite(r.totals[target])).map(r=>r.totals[target]); return mean(vals) ?? 0; }

  function predictRepeat(history,target){ return history[0] && Number.isFinite(history[0].totals[target]) ? history[0].totals[target] : null; }
  function predictPerGame(history,target,positionGames=17){ if(!history[0] || !Number.isFinite(history[0].per_game[target])) return null; const gamesHistory=history.map(x=>x.games).filter(Number.isFinite); const expected=Math.min(positionGames, Math.max(1, mean(gamesHistory) ?? history[0].games)); return history[0].per_game[target]*expected; }
  function weightedPrediction(history,target,weights){ let num=0,den=0; for(let i=0;i<Math.min(history.length,weights.length);i++){const v=history[i].totals[target]; if(Number.isFinite(v)){num+=v*weights[i];den+=weights[i];}} return den?num/den:null; }
  function predictUsageEfficiency(history,target){
    const h=history[0]; if(!h) return null;
    if(target==="receiving_yards" && Number.isFinite(h.totals.targets) && h.totals.targets>0) return h.totals.targets * (number(h.totals.receptions)/h.totals.targets) * (number(h.totals.receiving_yards)/Math.max(1,number(h.totals.receptions)));
    if(target==="rushing_yards" && Number.isFinite(h.totals.carries) && h.totals.carries>0) return h.totals.carries * (number(h.totals.rushing_yards)/h.totals.carries);
    if(target==="passing_yards" && Number.isFinite(h.totals.attempts) && h.totals.attempts>0) return h.totals.attempts * (number(h.totals.passing_yards)/h.totals.attempts);
    if(target==="total_tackles") return number(h.totals.solo_tackles)+number(h.totals.assisted_tackles);
    return null;
  }

  function buildPredictions(rows, targetSeason, weights=[0.6,0.3,0.1]) {
    const index=indexSeasons(rows); const actuals=rows.filter(r=>r.season===targetSeason); const out=[];
    for(const actual of actuals){ const targets=TARGETS[actual.position]||[]; const history=historyBefore(index,actual.gsis_id,targetSeason,3); if(!history.length) continue;
      for(const target of targets){ if(!Number.isFinite(actual.totals[target])) continue;
        const models={ repeat_last:predictRepeat(history,target), per_game:predictPerGame(history,target), weighted_603010:weightedPrediction(history,target,weights), usage_efficiency:predictUsageEfficiency(history,target) };
        for(const [model,prediction] of Object.entries(models)) if(Number.isFinite(prediction)) out.push({gsis_id:actual.gsis_id,position:actual.position,target,target_season:targetSeason,model,prediction,actual:actual.totals[target],history_seasons:history.map(x=>x.season)});
      }
    }
    return out;
  }

  function metrics(rows) {
    if(!rows.length) return {n:0,mae:null,rmse:null,median_ae:null,bias:null,spearman:null};
    const errors=rows.map(r=>r.prediction-r.actual), abs=errors.map(Math.abs);
    return { n:rows.length, mae:mean(abs), rmse:Math.sqrt(mean(errors.map(e=>e*e))), median_ae:median(abs), bias:mean(errors), spearman:spearman(rows.map(r=>r.actual),rows.map(r=>r.prediction)) };
  }
  function groupMetrics(predictions) {
    const groups=new Map(); for(const r of predictions){const key=`${r.position}|${r.target}|${r.model}|${r.target_season}`; const a=groups.get(key)||[];a.push(r);groups.set(key,a);} const out=[];
    for(const [key,rows] of groups){const [position,target,model,season]=key.split("|");out.push({position,target,model,target_season:Number(season),...metrics(rows)});} return out;
  }
  function scoreStatLine(totals, position, scoring=null) { const rules=scoring || (["DL","LB","DB"].includes(position)?LV_IDP:LV_PPR); let points=0; for(const [k,v] of Object.entries(rules)) points+=number(totals[k])*v; return points; }
  function fantasyPredictions(predictions, seasonRows) {
    const byKey=new Map(); for(const r of predictions){const key=`${r.gsis_id}|${r.position}|${r.target_season}|${r.model}`; const rec=byKey.get(key)||{gsis_id:r.gsis_id,position:r.position,target_season:r.target_season,model:r.model,pred:{},actual:{}};rec.pred[r.target]=r.prediction;rec.actual[r.target]=r.actual;byKey.set(key,rec);} return [...byKey.values()].map(r=>({...r,predicted_points:scoreStatLine(r.pred,r.position),actual_points:scoreStatLine(r.actual,r.position)}));
  }
  function uncertainty(predictions, lower=0.1, upper=0.9){ const groups=new Map(); for(const r of predictions){const key=`${r.position}|${r.target}|${r.model}`; const a=groups.get(key)||[];a.push(r.actual-r.prediction);groups.set(key,a);} return [...groups.entries()].map(([key,residuals])=>{const [position,target,model]=key.split("|");return {position,target,model,n:residuals.length,residual_q10:quantile(residuals,lower),residual_q90:quantile(residuals,upper),nominal_coverage:upper-lower};}); }
  function chooseWinners(metricRows){ const grouped=new Map(); for(const r of metricRows){const key=`${r.position}|${r.target}`; const a=grouped.get(key)||[];a.push(r);grouped.set(key,a);} const winners=[]; for(const [key,rows] of grouped){const models=new Map();for(const r of rows){const a=models.get(r.model)||[];a.push(r);models.set(r.model,a);} const scored=[...models.entries()].map(([model,rs])=>({model,folds:rs.length,mae:mean(rs.map(x=>x.mae).filter(Number.isFinite)),rmse:mean(rs.map(x=>x.rmse).filter(Number.isFinite)),spearman:mean(rs.map(x=>x.spearman).filter(Number.isFinite))})).filter(x=>Number.isFinite(x.mae)).sort((a,b)=>a.mae-b.mae); const [position,target]=key.split("|"); winners.push({position,target,winner:scored[0]||null,candidates:scored,production_eligible:false,reason:"Benchmark-only; promotion requires review and repeated unseen-season superiority."}); } return winners; }

  return { VERSION, POSITIONS, TARGETS, LV_PPR, LV_IDP, aggregatePlayerSeasons, buildPredictions, metrics, groupMetrics, scoreStatLine, fantasyPredictions, uncertainty, chooseWinners };
});