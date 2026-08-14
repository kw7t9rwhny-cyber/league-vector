const fs = require('node:fs');
const path = require('node:path');
const Foundation = require('../idp-foundation-research-v03.js');
const Ingest = require('./ingest-historical-data.js');

const SLEEPER_PLAYERS_URL = 'https://api.sleeper.app/v1/players/nfl';
const REFERENCE_IDP = Object.freeze({
  solo_tackles:1.5, assisted_tackles:0.75, tackles_for_loss:2, sacks:4, qb_hits:1,
  interceptions:6, passes_defended:1.5, forced_fumbles:3, fumble_recoveries:3, defensive_td:6, safeties:4,
});
const DEFAULT_CONFIGS = Object.freeze({
  shallow_12:{ teams:12, dedicated:{DL:1,LB:1,DB:1}, flex:1 },
  balanced_12:{ teams:12, dedicated:{DL:2,LB:2,DB:2}, flex:2 },
  deep_14:{ teams:14, dedicated:{DL:2,LB:3,DB:2}, flex:2 },
});

function parseArgs(values) {
  const out={ input:'data/reports/projection-v03/2026-projections.json', output:'data/reports/idp-foundation-v03/idp-replacement-sensitivity.json' };
  for (let i=0;i<values.length;i+=1) { if (!values[i].startsWith('--')) continue; out[values[i].slice(2)]=values[i+1]; i+=1; }
  return out;
}
function ensureDir(dir) { fs.mkdirSync(dir,{recursive:true}); }
function readJson(file) { return JSON.parse(fs.readFileSync(file,'utf8')); }
function projectionRows(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.rows)) return parsed.rows;
  if (Array.isArray(parsed?.projections)) return parsed.projections;
  throw new Error('Projection input is not a recognized projection-row array');
}
function scoreProjection(row, rules) {
  return Object.entries(rules || {}).reduce((sum,[key,weight]) => {
    const value=Number(row?.projected_stats?.[key]);
    return sum + (Number.isFinite(value) ? value * Number(weight || 0) : 0);
  },0);
}
function assignmentCounts(assignments) {
  const out={}; for (const row of assignments || []) out[row.slot_group]=(out[row.slot_group]||0)+1; return out;
}
function overlap(a,b) { const s=new Set(a||[]); return (b||[]).filter((id)=>s.has(id)).length; }
function roundDeep(value) {
  if (Array.isArray(value)) return value.map(roundDeep);
  if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,roundDeep(v)]));
  return Number.isFinite(value) ? Math.round(value*1000)/1000 : value;
}
function validateConfig(name,config) {
  if (!Number.isInteger(config?.teams) || config.teams<1) throw new Error(`${name}: teams must be a positive integer`);
  for (const pos of Foundation.IDP_GROUPS) if (Number(config?.dedicated?.[pos]||0)<0) throw new Error(`${name}: negative ${pos} starters`);
  if (Number(config?.flex||0)<0) throw new Error(`${name}: negative flex starters`);
}

async function run(options={}) {
  const parsed=readJson(options.input);
  const projections=projectionRows(parsed);
  const scoring=options.scoring || REFERENCE_IDP;
  const configs=options.configs || DEFAULT_CONFIGS;
  for (const [name,config] of Object.entries(configs)) validateConfig(name,config);

  const sleeperDownload=await Ingest.fetchText(SLEEPER_PLAYERS_URL,options.cacheFile||null,{refresh:options.refresh===true});
  const sleeperPlayers=JSON.parse(sleeperDownload.text);
  const byGsis={};
  for (const [sleeperId,player] of Object.entries(sleeperPlayers||{})) if (player?.gsis_id) byGsis[String(player.gsis_id)]={sleeper_id:String(sleeperId)};
  const pool=Foundation.filterProjectionPool(projections,sleeperPlayers,byGsis,{ verifiedFreeAgentIds:options.verifiedFreeAgentIds });
  const players=pool.included.map((row)=>({
    id:String(row.sleeper_id), sleeper_id:String(row.sleeper_id), gsis_id:row.gsis_id||null, name:row.name||null,
    model_position:row.position, lineup_eligibility:row.lineup_eligibility.slice(), points:scoreProjection(row,scoring),
  }));
  const canonicalPlayers=players.map((row)=>({...row,lineup_eligibility:[row.model_position]}));
  const hybridPlayers=players.filter((row)=>row.lineup_eligibility.length>1);

  const results={};
  for (const [name,config] of Object.entries(configs)) {
    const hybridAware=Foundation.maximumWeightAssignment(players,config);
    const canonical=Foundation.maximumWeightAssignment(canonicalPlayers,config);
    const hybridShadow=Foundation.replacementShadowPrices(players,config);
    const canonicalShadow=Foundation.replacementShadowPrices(canonicalPlayers,config);
    const selectedHybridIds=hybridAware.selected_player_ids.filter((id)=>hybridPlayers.some((p)=>p.id===id));
    results[name]={
      config,
      hybrid_aware:{
        total_starter_points:hybridAware.total_points,
        selected_count:hybridAware.assignments.length,
        assignment_counts:assignmentCounts(hybridAware.assignments),
        replacement_shadow_price:hybridShadow.replacement_shadow_price,
        selected_hybrid_count:selectedHybridIds.length,
      },
      canonical_single_position_counterfactual:{
        total_starter_points:canonical.total_points,
        selected_count:canonical.assignments.length,
        assignment_counts:assignmentCounts(canonical.assignments),
        replacement_shadow_price:canonicalShadow.replacement_shadow_price,
      },
      hybrid_effect:{
        starter_points_delta:hybridAware.total_points-canonical.total_points,
        selected_player_overlap:overlap(hybridAware.selected_player_ids,canonical.selected_player_ids),
        selected_count:hybridAware.assignments.length,
      },
    };
  }

  return roundDeep({
    version:'lv-idp-replacement-sensitivity-v0.3', generated_at:new Date().toISOString(),
    source:SLEEPER_PLAYERS_URL,
    methodology:'One constrained maximum-weight starter assignment across dedicated DL/LB/DB plus shared IDP FLEX. Each player occupies at most one slot. Replacement shadow price is the incremental optimized starter-pool score from adding exactly one slot of the named type; it is regenerated per scoring/configuration and is not a universal constant.',
    scoring,
    pool:{
      current_eligible_projection_players:players.length,
      excluded_projection_players:pool.excluded.length,
      hybrid_players:hybridPlayers.length,
      hybrid_eligibility_sets:Object.fromEntries([...new Set(hybridPlayers.map((p)=>p.lineup_eligibility.join('/')))].sort().map((set)=>[set,hybridPlayers.filter((p)=>p.lineup_eligibility.join('/')===set).length])),
    },
    configs:results,
    limitations:[
      'Teamless Active players are excluded unless separately verified as current free agents.',
      'Reference scoring is diagnostic only unless a league-specific scoring JSON is supplied.',
      'This is one-season within-IDP replacement evidence, not a dynasty value.',
      'True role survival and calibrated multi-year aging remain blocked.',
    ],
    production_eligible:false,
    dynasty_value_eligible:false,
  });
}

async function main() {
  const cli=parseArgs(process.argv.slice(2));
  const input=path.resolve(process.cwd(),cli.input), output=path.resolve(process.cwd(),cli.output);
  const configFile=cli.config ? readJson(path.resolve(process.cwd(),cli.config)) : {};
  const result=await run({
    input,
    scoring:configFile.scoring || undefined,
    configs:configFile.configs || undefined,
    verifiedFreeAgentIds:new Set((configFile.verified_free_agent_ids||[]).map(String)),
    cacheFile:cli.cache,
    refresh:cli.refresh==='true',
  });
  ensureDir(path.dirname(output)); fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n'); process.stdout.write(`${output}\n`);
}
if (require.main===module) main().catch((error)=>{console.error(error.stack||error.message);process.exit(1);});
module.exports={SLEEPER_PLAYERS_URL,REFERENCE_IDP,DEFAULT_CONFIGS,parseArgs,projectionRows,scoreProjection,assignmentCounts,validateConfig,run};
