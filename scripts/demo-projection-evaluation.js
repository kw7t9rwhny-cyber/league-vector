'use strict';
// Purely synthetic reproducibility example. It never reads online football data.
const fs = require('node:fs');
const path = require('node:path');
const E = require('../projection-evaluation.js');
const F = require('../tests/fixtures/projection-evaluation.js');
const {run} = require('./evaluate-projections.js');
function demo(dir) {
  fs.mkdirSync(dir, {recursive: true});
  const write = (name, value) => fs.writeFileSync(path.join(dir, name), E.canonical(value) + '\n');
  const input = F.fixture(); write('input.json', input);
  run({evaluationInput: path.join(dir, 'input.json'), outputDir: dir});
  const frozen = JSON.parse(fs.readFileSync(path.join(dir, 'frozen-evaluation.json'), 'utf8'));
  const assessment = F.assessment(frozen), shift = F.assessment(frozen, 10000);
  write('assessment-input.json', assessment);
  write('assessment.json', E.assess(frozen, assessment));
  write('shift-assessment-input.json', shift);
  write('shift-assessment.json', E.assess(frozen, shift));
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'manifest.json').sort();
  const crypto = require('node:crypto');
  const manifest = Object.fromEntries(files.map(file => {const bytes = fs.readFileSync(path.join(dir, file)); return [file, {bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')}];}));
  write('manifest.json', manifest);
  return manifest;
}
if (require.main === module) console.log(JSON.stringify(demo(path.resolve(process.argv[2] || 'data/reports/projection-evaluation-demo')), null, 2));
module.exports = {demo};
