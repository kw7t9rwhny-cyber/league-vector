#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(process.argv[2]||'data/reports/projection-v03');
const projections=JSON.parse(fs.readFileSync(path.join(dir,'2026-projections.json'),'utf8'));
const selection=JSON.parse(fs.readFileSync(path.join(dir,'model-selection.json'),'utf8'));
const IDP=['DL','LB','DB'];
const RULES={solo_tackles:1.5,assisted_tackles:.75,tackles_for_loss:2,sacks:4,qb_hits:1,interceptions:6,passes_defended:1.5,forced_fumbles:3,fumble_recoveries:3,defensive_td:6,safeties:4};
const scenarios={
  '12_balanced':{teams:12,dedicated:{DL:2,LB:2,DB:2},flex:2,bench:4},
  '14_deep':{teams:14,dedicated:{DL:2,LB:3,DB:2},flex:2,bench:5},
  '10_shallow':{teams:10,dedicated:{DL:1,LB:2,DB:1},flex:1,bench:2},
};
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2;};
function score(p,rules=RULES){return Object.entries(rules).reduce((s,[k,w])=>s+(Number(p.projected_stats?.[k])||0)*w,0);}
function ageSignal(){const out={};for(const pos of IDP){const rows=selection.filter(r=>r.position===pos);const rel=rows.map(r=>{const a=r.age_ablation||{};return Number.isFinite(a.with_age_mae)&&Number.isFinite(a.without_age_mae)&&a.without_age_mae?100*(a.without_age_mae-a.with_age_mae)/a.without_age_mae:null;}).filter(Number.isFinite);out[pos]={targets:rows.length,age_better_targets:rows.filter(r=>r.age_ablation?.preferred==='with_age').length,mean_relative_mae_improvement_pct:mean(rel),median_relative_mae_improvement_pct:median(rel),status:'predictive_age_signal_only_no_fitted_dynasty_curve'};}return out;}
function recency(){const out={};for(const pos of IDP){const rows=projections.filter(p=>p.position===pos),last=rows.map(p=>Math.max(...(p.history_seasons||[0])));out[pos]={n:rows.length,hist2025:last.filter(y=>y>=2025).length,hist2024plus:last.filter(y=>y>=2024).length,stale_pre2024:last.filter(y=>y<2024).length,team_null:rows.filter(p=>!p.team).length};}return out;}
function recentPool(rules=RULES){return projections.filter(p=>IDP.includes(p.position)&&Math.max(...(p.history_seasons||[0]))>=2024).map(p=>({id:p.league_vector_player_id,position:p.position,points:score(p,rules),p}));}
function allocate(pool,s){const selected=new Set(),assigned=[];for(const [pos,npt] of Object.entries(s.dedicated)){const n=s.teams*npt;const cand=pool.filter(x=>x.position===pos&&!selected.has(x.id)).sort((a,b)=>b.points-a.points).slice(0,n);for(const x of cand){selected.add(x.id);assigned.push({...x,type:'dedicated'});}}for(const [type,n] of [['flex',s.teams*s.flex],['bench',s.teams*s.bench]]){const cand=pool.filter(x=>!selected.has(x.id)).sort((a,b)=>b.points-a.points).slice(0,n);for(const x of cand){selected.add(x.id);assigned.push({...x,type});}}const out={};for(const pos of IDP){const starters=assigned.filter(x=>x.position===pos&&x.type!=='bench'),rostered=assigned.filter(x=>x.position===pos);out[pos]={starter_count:starters.length,starter_boundary_points:starters.length?Math.min(...starters.map(x=>x.points)):null,rostered_count:rostered.length,rosterable_boundary_points:rostered.length?Math.min(...rostered.map(x=>x.points)):null};out[pos].blended_boundary_points=Number.isFinite(out[pos].starter_boundary_points)&&Number.isFinite(out[pos].rosterable_boundary_points)?(out[pos].starter_boundary_points+out[pos].rosterable_boundary_points)/2:null;}return out;}
function rank(values){const order=values.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v),out=Array(values.length);let i=0;while(i<order.length){let j=i;while(j+1<order.length&&order[j+1].v===order[i].v)j++;const r=(i+j+2)/2;for(let k=i;k<=j;k++)out[order[k].i]=r;i=j+1;}return out;}
function pearson(a,b){const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;n+=x*y;da+=x*x;db+=y*y;}return da&&db?n/Math.sqrt(da*db):null;}
function sensitivity(pool,s,bounds){const methods=['starter','blended','rosterable'],ranks={};for(const m of methods){const vals=pool.map(x=>x.points-bounds[x.position][m]);ranks[m]=rank(vals);}const pairs=[['starter','blended'],['starter','rosterable'],['blended','rosterable']],out=[];for(const [a,b] of pairs){const ra=ranks[a],rb=ranks[b];const top=(r,n)=>new Set(r.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]).slice(0,n).map(x=>x[1]));const overlap=n=>{const A=top(ra,n),B=top(rb,n);return [...A].filter(x=>B.has(x)).length/n;};out.push({definition_a:a,definition_b:b,spearman_all:pearson(ra,rb),top50_overlap:overlap(50),top100_overlap:overlap(100)});}return out;}
const pool=recentPool();
const replacement=[];const replacementSensitivity=[];
for(const [name,s] of Object.entries(scenarios)){const a=allocate(pool,s),bounds={};for(const pos of IDP){replacement.push({scenario:name,position:pos,...a[pos]});bounds[pos]={starter:a[pos].starter_boundary_points,rosterable:a[pos].rosterable_boundary_points,blended:a[pos].blended_boundary_points};}replacementSensitivity.push(...sensitivity(pool,s,bounds).map(x=>({scenario:name,...x})));}
const result={version:'lv-idp-research-v0.2',age_signal:ageSignal(),projection_pool_recency_audit:recency(),replacement_scenarios:replacement,replacement_definition_sensitivity:replacementSensitivity,limitations:['This script consumes retained v0.3 artifacts; it does not refit raw player-season age curves.','Whole-player empirical coverage requires matched historical player-season residuals not retained in the current artifact.','Hybrid eligibility is not present in the compact projection artifact and must be supplied by a separate lineup-eligibility contract.']};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
