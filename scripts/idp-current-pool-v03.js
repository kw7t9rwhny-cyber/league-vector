const fs = require('node:fs');
const path = require('node:path');
const Foundation = require('../idp-foundation-research-v03.js');
const Ingest = require('./ingest-historical-data.js');

const SLEEPER_PLAYERS_URL = 'https://api.sleeper.app/v1/players/nfl';

function parseArgs(values) {
  const out={ input:'data/reports/projection-v03/2026-projections.json', output:'data/reports/idp-foundation-v03/current-idp-eligibility.json' };
  for (let i=0;i<values.length;i+=1) { if (!values[i].startsWith('--')) continue; out[values[i].slice(2)]=values[i+1]; i+=1; }
  return out;
}
function countBy(rows,keyFn) { const out={}; for (const row of rows) { const key=keyFn(row)||'unknown'; out[key]=(out[key]||0)+1; } return out; }
function ensureDir(dir) { fs.mkdirSync(dir,{recursive:true}); }

async function run(options={}) {
  const input=options.input;
  if (!input || !fs.existsSync(input)) throw new Error(`Projection input not found: ${input}`);
  const parsed=JSON.parse(fs.readFileSync(input,'utf8'));
  const projections=Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : Array.isArray(parsed?.projections) ? parsed.projections : null;
  if (!projections) throw new Error('Projection input is not a recognized projection-row array');
  const sleeperDownload=await Ingest.fetchText(SLEEPER_PLAYERS_URL,options.cacheFile||null,{refresh:options.refresh===true});
  const sleeperPlayers=JSON.parse(sleeperDownload.text);
  const crosswalkByGsis={};
  for (const [sleeperId,player] of Object.entries(sleeperPlayers||{})) {
    if (player?.gsis_id) crosswalkByGsis[String(player.gsis_id)]={sleeper_id:String(sleeperId)};
  }
  const pool=Foundation.filterProjectionPool(projections,sleeperPlayers,crosswalkByGsis);
  const idpProjectionReady=projections.filter((r)=>r?.projection_status==='projection_ready' && Foundation.IDP_GROUPS.includes(r?.position));
  const hybrid=pool.included.filter((r)=>Array.isArray(r.lineup_eligibility)&&r.lineup_eligibility.length>1);
  return {
    version:'lv-idp-current-eligibility-audit-v0.3', generated_at:new Date().toISOString(), source:SLEEPER_PLAYERS_URL,
    source_contract:'Full current Sleeper player snapshot; current eligibility requires active===true plus a recognized status. Missing/unknown states fail closed.',
    counts:{
      projection_ready_idp:idpProjectionReady.length,
      included:pool.included.length,
      excluded:pool.excluded.length,
      hybrids:hybrid.length,
    },
    included_by_position:countBy(pool.included,(r)=>r.position),
    included_by_current_class:countBy(pool.included,(r)=>r.current_eligibility_class),
    hybrid_eligibility_sets:countBy(hybrid,(r)=>r.lineup_eligibility.join('/')),
    excluded_by_reason:countBy(pool.excluded,(r)=>r.reason),
    excluded_sample:pool.excluded.slice(0,100).map((x)=>({ gsis_id:x.row?.gsis_id||null,sleeper_id:x.sleeper_id||x.row?.sleeper_id||null,name:x.row?.name||null,position:x.row?.position||null,reason:x.reason })),
    production_eligible:false,
    dynasty_value_eligible:false,
  };
}

async function main() {
  const cli=parseArgs(process.argv.slice(2));
  const output=path.resolve(process.cwd(),cli.output);
  const result=await run({input:path.resolve(process.cwd(),cli.input),cacheFile:cli.cache,refresh:cli.refresh==='true'});
  ensureDir(path.dirname(output)); fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n'); process.stdout.write(`${output}\n`);
}
if (require.main===module) main().catch((error)=>{console.error(error.stack||error.message);process.exit(1);});
module.exports={SLEEPER_PLAYERS_URL,parseArgs,countBy,run};
