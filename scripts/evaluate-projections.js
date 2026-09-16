'use strict';
const fs = require('node:fs');
const path = require('node:path');
const E = require('../projection-evaluation.js');
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, value) { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, E.canonical(value) + '\n'); }
function run(options) {
  const frozen = E.freeze(read(options.evaluationInput));
  const file = path.join(options.outputDir || 'data/reports/projection-evaluation', 'frozen-evaluation.json');
  write(file, frozen);
  return {summary: {status: 'frozen_awaiting_separate_outcomes', artifact_sha256: frozen.artifact_sha256, file}};
}
if (require.main === module) {
  try {
    const args = {};
    for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
    if (args.forecast) {
      if (!args.assessment || !args.output) throw new Error('--forecast, --assessment and --output required');
      const result = E.assess(read(args.forecast), read(args.assessment));
      write(args.output, result);
      console.log(JSON.stringify({status: result.final_untouched_evaluation.status, artifact_sha256: result.artifact_sha256}));
    } else console.log(JSON.stringify(run({evaluationInput: args.input, outputDir: args.outputDir}).summary));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {run};
