#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||'data/reports/projection-v04-canonical');
const c=JSON.parse(fs.readFileSync(path.join(root,'run-a','canonical-summary.json'),'utf8'));
const v=JSON.parse(fs.readFileSync(path.join(root,'v03','summary.json'),'utf8'));
const cr=JSON.parse(fs.readFileSync(path.join(root,'run-a','candidate-player-seasons.json'),'utf8'));
const vr=JSON.parse(fs.readFileSync(path.join(root,'v03','player-seasons.json'),'utf8'));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function rank(v){const o=v.map((x,i)=>({x,i})).sort((a,b)=>a.x-b.x),r=[];let i=0;while(i<o.length){let j=i;while(j+1<o.length&&o[j+1].x===o[i].x)j++;const q=(i+j+2)/2;for(let k=i;k<=j;k++)r[o[k].i]=q;i=j+1;}return r;}
function cor(a,b){if(a.length<2)return null;const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return da&&db?n/Math.sqrt(da*db):null;}
function metrics(rows,pred='pred'){if(!rows.length)return{n:0,mae:null,rmse:null,spearman:null};const e=rows.map(x=>x[pred]-x.act);return{n:rows.length,mae:mean(e.map(Math.abs)),rmse:Math.sqrt(mean(e.map(x=>x*x))),spearman:cor(rank(rows.map(x=>x.act)),rank(rows.map(x=>x[pred])))};}
function pct(oldv,newv){return Number.isFinite(oldv)&&oldv?100*(oldv-newv)/oldv:null;}
const cm=new Map(cr.map(r=>[`${r.id}|${r.pos}|${r.y}`,r])),vm=new Map(vr.map(r=>[`${r.id}|${r.pos}|${r.y}`,r]));
const rows=[];for(const [k,a] of cm){const b=vm.get(k);if(b)rows.push({id:a.id,pos:a.pos,y:a.y,act:a.act,v04:a.pred,v03:b.pred});}
const dev=[];for(const pos of ['QB','RB','WR','TE']){const folds=[];for(const y of [2020,2021,2022,2023,2024]){const b=c.baseline.find(x=>x.position===pos&&x.season===y),q=c.candidate.find(x=>x.position===pos&&x.season===y);folds.push({season:y,baseline_mae:b?.mae,candidate_mae:q?.mae,mae_gain_pct:pct(b?.mae,q?.mae),spearman_change:(q?.spearman??0)-(b?.spearman??0)});}const evalFolds=folds.filter(x=>x.season>2020),wins=evalFolds.filter(x=>x.mae_gain_pct>0).length;dev.push({position:pos,folds,wins_post_initial:wins,losses_post_initial:evalFolds.length-wins,mean_mae_gain_pct_post_initial:mean(evalFolds.map(x=>x.mae_gain_pct)),policy_assessment:pos==='QB'?'baseline retained; no richer QB model activated':wins>=3?'pre-2025 evidence supports retaining the experimental family':'pre-2025 evidence is not strong enough for a broad family claim'});}
const retrospective=[];for(const pos of ['QB','RB','WR','TE']){const r=rows.filter(x=>x.y===2025&&x.pos===pos),a=metrics(r,'v03'),b=metrics(r,'v04');retrospective.push({position:pos,n:r.length,v03:a,v04:b,mae_gain_pct:pct(a.mae,b.mae),rmse_gain_pct:pct(a.rmse,b.rmse),spearman_change:b.spearman-a.spearman});}
const all25=rows.filter(x=>x.y===2025),a=metrics(all25,'v03'),b=metrics(all25,'v04');
const result={version:'lv-projection-v04-canonical-handoff-v1',input_snapshot_sha256:c.input_snapshot_sha256,selection_evidence_scope:'2020-2024 only',retrospective_only_season:2025,holdout_claim:false,development_policy_evidence:dev,retrospective_2025_vs_selection_safe_v03:{by_position:retrospective,pooled:{n:all25.length,v03:a,v04:b,mae_gain_pct:pct(a.mae,b.mae),rmse_gain_pct:pct(a.rmse,b.rmse),spearman_change:b.spearman-a.spearman}},te_ranking_audit:c.te_ranking_audit,rookie_policy:c.rookie_policy,limited_history_policy:c.limited_history_policy,flags:{experimental:true,production_projection_eligible:false,dynasty_value_eligible:false},interpretation:'2025 was observed before this canonicalization and is retrospective evidence only. No candidate feature family, target gate, or threshold may be changed using 2025 in this checkpoint.'};
fs.writeFileSync(path.join(root,'canonical-handoff.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
