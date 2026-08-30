#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Data=require('../football-data-v08.js'),H=require('./ingest-historical-data.js');
const seasons=Array.from({length:11},(_,i)=>2015+i);
const dir=path.resolve(process.argv[2]||'.cache/lv-v04-canonical');
fs.mkdirSync(dir,{recursive:true});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
(async()=>{
  const files=[];
  for(const season of seasons){
    const url=Data.nflverseUrls(season).weeklyStats;
    const p=path.join(dir,`stats_player_week_${season}.csv`);
    const x=await H.fetchText(url,p,{refresh:true,timeoutMs:45000});
    files.push({season,kind:'weekly_stats',path:path.basename(p),source:url,bytes:Buffer.byteLength(x.text),sha256:sha(x.text)});
  }
  const playersUrl=Data.nflverseUrls(2015).players;
  const pp=path.join(dir,'players.csv');
  const px=await H.fetchText(playersUrl,pp,{refresh:true,timeoutMs:45000});
  files.push({season:null,kind:'players',path:'players.csv',source:playersUrl,bytes:Buffer.byteLength(px.text),sha256:sha(px.text)});
  const manifest={version:'lv-projection-v04-input-snapshot-v1',frozen_at:new Date().toISOString(),seasons,files};
  const stable=JSON.stringify({version:manifest.version,seasons,files},null,2)+'\n';
  manifest.snapshot_sha256=sha(stable);
  fs.writeFileSync(path.join(dir,'snapshot-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify(manifest,null,2));
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
