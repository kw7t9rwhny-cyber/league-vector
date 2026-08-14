const fs = require('node:fs');
const path = require('node:path');
const Core = require('../core-v08.js');
const Data = require('../football-data-v08.js');
const Ingest = require('./ingest-historical-data.js');
const Foundation = require('../idp-foundation-research-v03.js');

const DEFAULT_SEASONS = [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];
const REFERENCE_IDP = Object.freeze({
  solo_tackles:1.5, assisted_tackles:0.75, tackles_for_loss:2, sacks:4, qb_hits:1,
  interceptions:6, passes_defended:1.5, forced_fumbles:3, fumble_recoveries:3, defensive_td:6, safeties:4,
});

function parseArgs(values) {
  const out = { seasons: DEFAULT_SEASONS.join(','), output: 'data/reports/idp-foundation-v03/idp-player-season-age-curves.json' };
  for (let i=0;i<values.length;i+=1) {
    if (!values[i].startsWith('--')) continue;
    out[values[i].slice(2)] = values[i+1]; i += 1;
  }
  return out;
}
function ensureDir(dir) { fs.mkdirSync(dir, { recursive:true }); }
function value(cell) { return cell?.state === Data.DATA_STATE.VALUE && Number.isFinite(cell.value) ? cell.value : null; }
function score(stats) { return Object.entries(REFERENCE_IDP).reduce((sum,[key,w]) => sum + (value(stats?.[key]) ?? 0) * w, 0); }
function gameCeiling(season) { return Number(season) >= 2021 ? 17 : 16; }
function mean(values) { const xs=values.filter(Number.isFinite); return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null; }
function round(value, digits=4) { if (!Number.isFinite(value)) return null; const p=10**digits; return Math.round(value*p)/p; }
function modePosition(rows) {
  const counts={}; for (const row of rows) if (Foundation.IDP_GROUPS.includes(row.position_group)) counts[row.position_group]=(counts[row.position_group]||0)+1;
  return Object.entries(counts).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null;
}

function buildPlayerSeasons(observations, playerBio) {
  const buckets = new Map();
  for (const row of observations) {
    if (!Foundation.IDP_GROUPS.includes(row.position_group) || !row.gsis_id || !Number.isInteger(row.season)) continue;
    const key = `${row.gsis_id}|${row.season}`;
    const xs=buckets.get(key)||[]; xs.push(row); buckets.set(key,xs);
  }
  const seasons=[];
  for (const [key, rows] of buckets) {
    const [gsisId, seasonText]=key.split('|'), season=Number(seasonText), bio=playerBio.get(gsisId);
    const position=modePosition(rows);
    const birthDate=bio?.bio?.birth_date || null;
    const age=Foundation.playerSeasonAge(birthDate, season);
    const experience=Foundation.experienceSeason(bio?.bio?.rookie_year, season);
    const weeks=[...new Set(rows.map((r)=>r.week).filter(Number.isInteger))];
    let defensiveSnaps=0, snapRows=0;
    for (const row of rows) { const snaps=value(row.stats?.defensive_snaps); if (snaps != null) { defensiveSnaps += snaps; snapRows += 1; } }
    const points=rows.reduce((sum,row)=>sum+score(row.stats),0);
    seasons.push({
      gsis_id:gsisId, season, model_position:position, birth_date:birthDate, player_season_age:age, experience_season:experience,
      reference_points:round(points), observed_stat_weeks:weeks.length,
      points_per_observed_week:weeks.length ? round(points/weeks.length) : null,
      observed_week_availability_proxy:round(Math.min(1,weeks.length/gameCeiling(season))),
      defensive_snaps:snapRows ? defensiveSnaps : null,
      opportunity_status:snapRows ? 'defensive_snaps_available' : 'defensive_snaps_unavailable',
    });
  }
  seasons.sort((a,b)=>a.season-b.season || a.gsis_id.localeCompare(b.gsis_id));
  const byKey=new Map(seasons.map((x)=>[`${x.gsis_id}|${x.season}`,x]));
  for (const row of seasons) {
    const next=byKey.get(`${row.gsis_id}|${row.season+1}`) || null;
    row.next_season_any_idp_observed=Boolean(next);
    row.next_season_same_model_position=Boolean(next && next.model_position===row.model_position);
    row.next_season_points_per_observed_week=next?.points_per_observed_week ?? null;
    row.conditional_yoy_points_per_observed_week_delta=next && Number.isFinite(row.points_per_observed_week) && Number.isFinite(next.points_per_observed_week)
      ? round(next.points_per_observed_week-row.points_per_observed_week) : null;
  }
  return seasons;
}

function groupCurves(playerSeasons, maxSeason) {
  const groups=new Map();
  for (const row of playerSeasons) {
    if (!Foundation.IDP_GROUPS.includes(row.model_position) || !Number.isInteger(row.player_season_age)) continue;
    const key=`${row.model_position}|${row.player_season_age}`;
    const xs=groups.get(key)||[]; xs.push(row); groups.set(key,xs);
  }
  return [...groups.entries()].map(([key,rows])=>{
    const [position,ageText]=key.split('|'), age=Number(ageText);
    const survivalExposure=rows.filter((r)=>r.season<maxSeason);
    const survivors=survivalExposure.filter((r)=>r.next_season_any_idp_observed);
    const samePos=survivalExposure.filter((r)=>r.next_season_same_model_position);
    const snapRows=rows.filter((r)=>Number.isFinite(r.defensive_snaps));
    return {
      position, age, n_player_seasons:rows.length,
      mean_reference_points:round(mean(rows.map((r)=>r.reference_points))),
      mean_points_per_observed_week:round(mean(rows.map((r)=>r.points_per_observed_week))),
      mean_observed_week_availability_proxy:round(mean(rows.map((r)=>r.observed_week_availability_proxy))),
      participation_survival_exposure_n:survivalExposure.length,
      next_season_any_idp_observed_rate:survivalExposure.length ? round(survivors.length/survivalExposure.length) : null,
      next_season_same_model_position_rate:survivalExposure.length ? round(samePos.length/survivalExposure.length) : null,
      conditional_mean_yoy_points_per_observed_week_delta:round(mean(survivors.map((r)=>r.conditional_yoy_points_per_observed_week_delta))),
      opportunity_n_with_defensive_snaps:snapRows.length,
      mean_defensive_snaps:snapRows.length ? round(mean(snapRows.map((r)=>r.defensive_snaps))) : null,
      role_survival_status:'BLOCKED_WITHOUT_POINT_IN_TIME_ROLE_OR_SNAP_AUTHORITY',
    };
  }).sort((a,b)=>a.position.localeCompare(b.position)||a.age-b.age);
}

async function run(options={}) {
  const seasons=(options.seasons||DEFAULT_SEASONS).map(Number).filter(Number.isInteger).sort((a,b)=>a-b);
  if (!seasons.length) throw new Error('No valid seasons');
  const root=options.root||process.cwd(), cacheDir=path.resolve(root,options.cacheDir||'.cache/league-vector/idp-age-v03');
  ensureDir(cacheDir);
  const retrievedAt=new Date().toISOString();
  const playerUrl=Data.nflverseUrls(seasons[0]).players;
  const playerDownload=await Ingest.fetchText(playerUrl,path.join(cacheDir,'nflverse-players.csv'),options);
  const playerRows=Core.parseCsv(playerDownload.text);
  const playerBio=new Map(playerRows.map(Data.normalizeNflversePlayer).filter((p)=>p.identity?.gsis_id).map((p)=>[p.identity.gsis_id,p]));
  const observations=[];
  for (const season of seasons) {
    const url=Data.nflverseUrls(season).weeklyStats;
    const download=await Ingest.fetchText(url,path.join(cacheDir,`stats_player_week_${season}.csv`),options);
    const rows=Core.parseCsv(download.text);
    if (!rows.length) throw new Error(`stats_player_week_${season} parsed to zero rows`);
    for (const raw of rows) {
      const normalized=Ingest.normalizeWeeklyRow(raw,{ provider:'nflverse',dataset:'stats_player_week',source_version:'stats_player',retrieved_at:retrievedAt,source_url_or_identifier:url,license_classification:Data.LICENSE.APPROVED_WITH_ATTRIBUTION });
      if (normalized.season_type==='REG' && Foundation.IDP_GROUPS.includes(normalized.position_group)) observations.push(normalized);
    }
  }
  const playerSeasons=buildPlayerSeasons(observations,playerBio);
  const eligibleAgeRows=playerSeasons.filter((r)=>Number.isInteger(r.player_season_age));
  const output={
    version:'lv-idp-player-season-age-curves-v0.3', generated_at:retrievedAt, seasons,
    age_contract:'Age is calculated from birth_date at September 1 of each historical season. Current age is never applied retrospectively.',
    experience_contract:'experience_season = season - rookie_year + 1 when rookie_year is known; missing rookie_year stays null.',
    production_scoring:REFERENCE_IDP,
    availability_contract:'observed_stat_weeks / historical regular-season game ceiling is retained only as a participation-data proxy, not a medical availability or games-played claim.',
    opportunity_contract:'defensive snaps are reported only where the approved normalized source actually provides them; missing snaps are not imputed.',
    role_survival_contract:'True role survival remains blocked without point-in-time role/depth/snap authority. next-season statistical participation and same-model-position persistence are diagnostic proxies only.',
    sample:{ observations:observations.length, player_seasons:playerSeasons.length, player_seasons_with_age:eligibleAgeRows.length, missing_age:playerSeasons.length-eligibleAgeRows.length },
    curves:groupCurves(playerSeasons,Math.max(...seasons)),
  };
  return output;
}

async function main() {
  const cli=parseArgs(process.argv.slice(2));
  const seasons=cli.seasons.split(',').map(Number).filter(Number.isInteger);
  const output=path.resolve(process.cwd(),cli.output);
  const result=await run({seasons,cacheDir:cli.cache,refresh:cli.refresh==='true'});
  ensureDir(path.dirname(output)); fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  process.stdout.write(`${output}\n`);
}
if (require.main===module) main().catch((error)=>{ console.error(error.stack||error.message); process.exit(1); });
module.exports={DEFAULT_SEASONS,REFERENCE_IDP,parseArgs,score,gameCeiling,buildPlayerSeasons,groupCurves,run};
