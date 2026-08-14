const fs=require('node:fs');
const path=require('node:path');
const Core=require('../core-v08.js');
const Data=require('../football-data-v08.js');
const Ingest=require('./ingest-historical-data.js');
const Foundation=require('../idp-foundation-research-v03.js');
const Age=require('./idp-age-curves-v03.js');
const Dynasty=require('./idp-dynasty-value-research-v01.js');

function parseArgs(values){const out={seasons:Age.DEFAULT_SEASONS.join(','),output:'data/reports/idp-dynasty-value-v01/idp-dynasty-value-research.json'};for(let i=0;i<values.length;i+=1)if(values[i].startsWith('--')){out[values[i].slice(2)]=values[i+1];i+=1;}return out;}
function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});}
function safeExperience(rookieYear,season){if(rookieYear===null||rookieYear===undefined||rookieYear==='')return null;const rookie=Number(rookieYear),year=Number(season);if(!Number.isInteger(rookie)||!Number.isInteger(year)||rookie<1900||rookie>year)return null;return year-rookie+1;}
async function buildHistoricalPlayerSeasons(options={}){
  const seasons=(options.seasons||Age.DEFAULT_SEASONS).map(Number).filter(Number.isInteger).sort((a,b)=>a-b);
  if(!seasons.length)throw new Error('No valid seasons');
  const root=options.root||process.cwd(),cacheDir=path.resolve(root,options.cacheDir||'.cache/league-vector/idp-dynasty-v01');ensureDir(cacheDir);
  const retrievedAt=new Date().toISOString();
  const playerUrl=Data.nflverseUrls(seasons[0]).players;
  const playerDownload=await Ingest.fetchText(playerUrl,path.join(cacheDir,'nflverse-players.csv'),options);
  const playerRows=Core.parseCsv(playerDownload.text);
  const playerBio=new Map(playerRows.map(Data.normalizeNflversePlayer).filter(p=>p.identity?.gsis_id).map(p=>[p.identity.gsis_id,p]));
  const observations=[];
  for(const season of seasons){
    const url=Data.nflverseUrls(season).weeklyStats;
    const download=await Ingest.fetchText(url,path.join(cacheDir,`stats_player_week_${season}.csv`),options);
    const rows=Core.parseCsv(download.text);if(!rows.length)throw new Error(`stats_player_week_${season} parsed to zero rows`);
    for(const raw of rows){const normalized=Ingest.normalizeWeeklyRow(raw,{provider:'nflverse',dataset:'stats_player_week',source_version:'stats_player',retrieved_at:retrievedAt,source_url_or_identifier:url,license_classification:Data.LICENSE.APPROVED_WITH_ATTRIBUTION});if(normalized.season_type==='REG'&&Foundation.IDP_GROUPS.includes(normalized.position_group))observations.push(normalized);}
  }
  const playerSeasons=Age.buildPlayerSeasons(observations,playerBio);
  let validExperienceRows=0;
  for(const row of playerSeasons){const rookieYear=playerBio.get(row.gsis_id)?.bio?.rookie_year;row.experience_season=safeExperience(rookieYear,row.season);if(Number.isInteger(row.experience_season))validExperienceRows+=1;}
  const biosWithRookieYear=[...playerBio.values()].filter(p=>Number.isInteger(p?.bio?.rookie_year)&&p.bio.rookie_year>=1900).length;
  return {seasons,retrievedAt,observations:observations.length,playerSeasons,experienceCoverage:{player_bios:playerBio.size,bios_with_valid_rookie_year:biosWithRookieYear,player_seasons_with_valid_experience:validExperienceRows}};
}
async function run(options={}){
  const historical=await buildHistoricalPlayerSeasons(options);
  const report=Dynasty.buildFromPlayerSeasons(historical.playerSeasons,{generated_at:historical.retrievedAt,seasons:historical.seasons});
  report.sample.normalized_weekly_observations=historical.observations;
  report.sample.experience_coverage=historical.experienceCoverage;
  report.experience_contract=historical.experienceCoverage.player_seasons_with_valid_experience>0?'Experience is computed only from a valid explicit rookie_year/entry_year in the normalized player bio. Missing metadata remains null.':'BLOCKED: the current normalized player-bio source provides no valid rookie_year/entry_year coverage for these IDP rows; experience is not inferred from first observed season.';
  report.source_contract='nflverse normalized weekly REG IDP observations using the existing approved-with-attribution research ingestion contract; no current depth chart is used retrospectively.';
  return report;
}
async function main(){const args=parseArgs(process.argv.slice(2));const seasons=args.seasons.split(',').map(Number).filter(Number.isInteger);const result=await run({seasons,cacheDir:args.cache,refresh:args.refresh==='true'});const output=path.resolve(process.cwd(),args.output);ensureDir(path.dirname(output));fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(`IDP_DYNASTY_RESEARCH_SUMMARY ${JSON.stringify({sample:result.sample,persistence:result.production_persistence,survival:result.fantasy_relevance_survival,uncertainty:result.uncertainty,experience_contract:result.experience_contract})}`);console.log(output);}
if(require.main===module)main().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
module.exports={parseArgs,safeExperience,buildHistoricalPlayerSeasons,run};
