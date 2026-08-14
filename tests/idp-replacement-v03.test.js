const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../scripts/idp-replacement-v03.js');

test('reference scoring is deterministic and IDP-only', () => {
  const row={projected_stats:{solo_tackles:10,sacks:2,interceptions:1,receptions:99}};
  assert.equal(R.scoreProjection(row,R.REFERENCE_IDP),29);
});

test('projection rows accept the raw v0.3 array contract and reject unknown wrappers', () => {
  const rows=[{projection_status:'projection_ready'}];
  assert.equal(R.projectionRows(rows),rows);
  assert.equal(R.projectionRows({projections:rows}),rows);
  assert.throws(()=>R.projectionRows({x:rows}),/recognized projection-row array/);
});

test('representative replacement configs require valid league sizes and nonnegative slots', () => {
  assert.doesNotThrow(()=>R.validateConfig('x',{teams:12,dedicated:{DL:2,LB:2,DB:2},flex:2}));
  assert.throws(()=>R.validateConfig('x',{teams:0,dedicated:{},flex:0}),/positive integer/);
  assert.throws(()=>R.validateConfig('x',{teams:12,dedicated:{DL:-1},flex:0}),/negative DL/);
});

test('assignment counts preserve dedicated and flex slot labels', () => {
  assert.deepEqual(R.assignmentCounts([{slot_group:'DL'},{slot_group:'IDP_FLEX'},{slot_group:'DL'}]),{DL:2,IDP_FLEX:1});
});
