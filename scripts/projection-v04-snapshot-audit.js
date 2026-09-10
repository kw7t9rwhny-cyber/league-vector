#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const Core=require('../core-v08.js'),Data=require('../football-data-v08.js');
const POS=new Set(['QB','RB','WR','TE']);
const cache=path.resolve(process.argv[2]||'.cache/lv-v04-canonical');
const out=path.resolve(process.argv[3]||'data/reports/projection-v04-canonical/snapshot-audit.json');
const manifest=JSON.parse(fs.readFileSync(path.join(cache,'snapshot-manifest.json'),'utf8'));
const states={},raw={rows:0,regular_rows:0,offense_regular_rows:0,missing_player_id:0,duplicate_player_week_keys:[]};
const seen=new Map();
for(const season of manifest.seasons){
  const rows=Core.parseCsv(fs.readFileSync(path.join(cache,`stats_player_week_${season}.csv`),'utf8'));
  raw.rows+=rows.length;
  for(const r of rows){
    if(String(r.season_type||'REG').toUpperCase()!=='REG')continue;
    raw.regular_rows++;
    const obs=Data.normalizeObservation(r,{season});
    if(!POS.has(obs.position_group))continue;
    raw.offense_regular_rows++;
    if(!obs.gsis_id)raw.missing_player_id++;
    const wk=`${obs.gsis_id||'MISSING'}|${obs.season}|${obs.week}|${obs.position_group}`;
    seen.set(wk,(seen.get(wk)||0)+1);
    for(const [stat,cell] of Object.entries(obs.stats||{})){
      let bucket=cell?.state||'missing_state';
      if(bucket==='value')bucket=Object.is(Number(cell.value),0)?'value_zero':'value_nonzero';
      const k=`${obs.season}|${obs.position_group}|${stat}|${bucket}`;
      states[k]=(states[k]||0)+1;
    }
  }
}
raw.duplicate_player_week_keys=[...seen].filter(([,n])=>n>1).map(([key,count])=>({key,count}));
const players=Core.parseCsv(fs.readFileSync(path.join(cache,'players.csv'),'utf8')).map(Data.normalizeNflversePlayer);
const gsis=new Map();let playerRowsMissingGsis=0;
for(const p of players){const id=p.identity.gsis_id;if(!id){playerRowsMissingGsis++;continue;}gsis.set(id,(gsis.get(id)||0)+1);}
const playerDirectory={rows:players.length,missing_gsis:playerRowsMissingGsis,duplicate_gsis:[...gsis].filter(([,n])=>n>1).map(([gsis_id,count])=>({gsis_id,count}))};
const required={QB:['attempts','completions','passing_yards','passing_td','interceptions','carries','rushing_yards','rushing_td'],RB:['carries','rushing_yards','rushing_td','targets','receptions','receiving_yards','receiving_td'],WR:['targets','receptions','receiving_yards','receiving_td'],TE:['targets','receptions','receiving_yards','receiving_td']};
const requiredStateSummary={};
for(const pos of Object.keys(required)){const c={value_zero:0,value_nonzero:0,unavailable:0,null:0,not_applicable:0,source_error:0,other:0};for(const [k,n] of Object.entries(states)){const [,p,stat,bucket]=k.split('|');if(p!==pos||!required[pos].includes(stat))continue;if(bucket in c)c[bucket]+=n;else c.other+=n;}requiredStateSummary[pos]=c;}
const result={version:'lv-projection-v04-snapshot-audit-v1',snapshot_sha256:manifest.snapshot_sha256,semantics:'value_zero is an explicit numeric 0 from the frozen source; unavailable/null/not_applicable/source_error are never coerced to zero',raw_weekly:raw,player_directory:playerDirectory,required_stat_state_summary:requiredStateSummary,state_counts:Object.fromEntries(Object.entries(states).sort())};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({snapshot_sha256:result.snapshot_sha256,raw_weekly:raw,player_directory:playerDirectory,required_stat_state_summary:requiredStateSummary},null,2));
