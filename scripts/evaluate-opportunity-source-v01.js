#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { sportradarAdapter, validateSnapshotSet, prospectiveManifest } = require('../research/opportunity-point-in-time-v01');

function sha256(buf){return crypto.createHash('sha256').update(buf).digest('hex');}
function usage(){console.error('usage: node scripts/evaluate-opportunity-source-v01.js <sportradar-json> <meta-json> <out-json>'); process.exit(2);}
const [inputPath,metaPath,outPath]=process.argv.slice(2); if(!inputPath||!metaPath||!outPath) usage();
const raw=fs.readFileSync(inputPath); const payload=JSON.parse(raw); const meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));
const rows=validateSnapshotSet(sportradarAdapter(payload,meta),{allow_multi_snapshot:true,allow_multi_asof:true});
const result={
  evaluator:'projection-opportunity-source-v01', input_sha256:sha256(raw), accepted_for_modeling:false,
  reason:'Schema normalization passed; historical point-in-time semantics and commercial derived-model rights require separate Founder/vendor confirmation.',
  normalized_manifest:prospectiveManifest(rows,{source:'sportradar-sample-evaluation'}),
  coverage:{teams:[...new Set(rows.map(r=>r.team))].sort(),players:rows.length,ordered_depth_rows:rows.filter(r=>r.depth_rank!=null).length,
    mapped_gsis_rows:rows.filter(r=>r.identity.gsis_id).length,minimum_identity_confidence:Math.min(...rows.map(r=>r.identity.mapping_confidence))}
};
fs.mkdirSync(path.dirname(outPath),{recursive:true}); fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
