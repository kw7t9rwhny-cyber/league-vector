const fs=require('node:fs');
const input=process.argv[2];
const output=process.argv[3]||'idp-cycle2-sensitivity.json';
if(!input) throw new Error('usage: node idp-cycle2-sensitivity.js <2026-projections.json> [output]');
const rows=JSON.parse(fs.readFileSync(input,'utf8')).filter(r=>r.projection_status==='projection_ready');
const IDP={solo_tackles:1.5,assisted_tackles:.75,tackles_for_loss:2,sacks:4,qb_hits:1,interceptions:6,passes_defended:1.5,forced_fumbles:3,fumble_recoveries:3,defensive_td:6,safeties:4};
const OFF={passing_yards:.04,passing_td:4,interceptions:-2,rushing_yards:.1,rushing_td:6,receptions:1,receiving_yards:.1,receiving_td:6};
function score(r){const rules=['DL','LB','DB'].includes(r.position)?IDP:OFF;return Object.entries(rules).reduce((s,[k,w])=>s+(Number.isFinite(r.projected_stats?.[k])?r.projected_stats[k]*w:0),0);}
const pool=rows.map((r,i)=>({id:r.gsis_id||r.sleeper_id||String(i),name:r.name,position:r.position,points:score(r),team:r.team,history_seasons:r.history_seasons||[]}));
function allocate(teams,dedicated,flex,eligible){const p=pool.filter(x=>eligible.includes(x.position));const selected=new Set(),counts={};for(const pos of eligible){const n=(dedicated[pos]||0)*teams;const xs=p.filter(x=>x.position===pos).sort((a,b)=>b.points-a.points).slice(0,n);counts[pos]=xs.length;xs.forEach(x=>selected.add(x.id));}const remain=p.filter(x=>!selected.has(x.id)).sort((a,b)=>b.points-a.points).slice(0,teams*flex);for(const x of remain){selected.add(x.id);counts[x.position]=(counts[x.position]||0)+1;}const starter={},roster15={},roster20={};for(const pos of eligible){const xs=p.filter(x=>x.position===pos).sort((a,b)=>b.points-a.points);const available=xs.filter(x=>!selected.has(x.id));starter[pos]=available[0]?.points??0;roster15[pos]=xs[Math.min(xs.length-1,Math.max(0,Math.ceil((counts[pos]||0)*1.5)-1))]?.points??0;roster20[pos]=xs[Math.min(xs.length-1,Math.max(0,Math.ceil((counts[pos]||0)*2)-1))]?.points??0;}return{starter_counts:counts,replacement:{starter,rosterable_1_5x:roster15,rosterable_2x:roster20,blended:Object.fromEntries(eligible.map(pos=>[pos,(starter[pos]+roster15[pos])/2]))}};}
function ranked(levels,eligible){return pool.filter(x=>eligible.includes(x.position)).map(x=>({...x,surplus:x.points-levels[x.position]})).sort((a,b)=>b.surplus-a.surplus);}
function overlap(a,b,n){const s=new Set(a.slice(0,n).map(x=>x.id));return b.slice(0,n).filter(x=>s.has(x.id)).length;}
const configs={
  shallow_12:{teams:12,idp:{dedicated:{DL:1,LB:1,DB:1},flex:1}},
  balanced_12:{teams:12,idp:{dedicated:{DL:2,LB:2,DB:2},flex:2},offense:{dedicated:{QB:1,RB:2,WR:3,TE:1},flex:2}},
  deep_14:{teams:14,idp:{dedicated:{DL:2,LB:3,DB:2},flex:2},offense:{dedicated:{QB:1,RB:2,WR:3,TE:1},flex:2}},
};
const out={version:'lv-idp-research-cycle2-sensitivity-v0.1',input_contract:'v0.3 projection_ready records',reference_scoring:{idp:IDP,offense:OFF},limitations:['single normalized position only; hybrid eligibility is not present in this input','current projection-ready pool requires independent active/retired eligibility validation before product ranking','one-year surplus only; multi-year dynasty surplus requires validated age/survival curves'],configs:{}};
for(const [name,c] of Object.entries(configs)){const idp=allocate(c.teams,c.idp.dedicated,c.idp.flex,['DL','LB','DB']);const ranks={};for(const [method,levels] of Object.entries(idp.replacement))ranks[method]=ranked(levels,['DL','LB','DB']);const sensitivity={};for(const method of Object.keys(ranks)){sensitivity[method]={top50_overlap_vs_starter:overlap(ranks.starter,ranks[method],50),top24_overlap_vs_starter:overlap(ranks.starter,ranks[method],24)};}const row={teams:c.teams,idp,ranking_sensitivity:sensitivity,top_idp_by_starter_surplus:ranks.starter.slice(0,25)};if(c.offense){const off=allocate(c.teams,c.offense.dedicated,c.offense.flex,['QB','RB','WR','TE']);const repl={...off.replacement.starter,...idp.replacement.starter};row.offense=off;row.top_combined_one_year_surplus=ranked(repl,['QB','RB','WR','TE','DL','LB','DB']).slice(0,40);}out.configs[name]=row;}
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(output);
