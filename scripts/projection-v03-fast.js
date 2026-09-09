const P=require('../projection-v03.js');const V1=require('./benchmark-projections.js');
const ZERO_FIELDS=['attempts','completions','passing_yards','passing_td','interceptions','sacks','sack_yards','carries','rushing_yards','rushing_td','rushing_fumbles','targets','receptions','receiving_yards','receiving_td','air_yards','yards_after_catch'];
const Complete=require('../projection-v03-complete.js');Complete.install();
const runner=require('./projection-v03.js');
if(require.main===module){const a={};for(let i=2;i<process.argv.length;i+=2)a[process.argv[i].replace(/^--/,'')]=process.argv[i+1];const seasons=(a.seasons||Array.from({length:11},(_,i)=>2015+i).join(',')).split(',').map(Number),folds=(a.folds||'2020,2021,2022,2023,2024,2025').split(',').map(Number);runner.run({evaluationInput:a.input,seasons,folds,cacheDir:a.cache,outputDir:a.outputDir,refresh:a.refresh==='true'}).then(x=>console.log(JSON.stringify(x.summary,null,2))).catch(e=>{console.error(e.stack||e);process.exit(1);});}
module.exports={run:runner.run,ZERO_FIELDS};
