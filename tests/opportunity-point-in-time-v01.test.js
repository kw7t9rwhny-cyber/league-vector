'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../research/opportunity-point-in-time-v01');

function row(overrides={}) {
  return {
    provider:'TEST', provider_snapshot_id:'s1', acquired_at:'2026-09-01T12:00:00Z', data_as_of:'2026-09-01T12:00:00Z',
    season:2026, season_type:'PRE', team:'GB', identity:{provider_player_id:'p1',gsis_id:'g1',mapping_method:'test',mapping_confidence:1},
    player_name:'Player One', position:'WR', provider_depth_position:'WR-X', depth_rank:2, roster_status:'ACTIVE', source_quality:'TEST',
    provenance:{source_uri:'fixture://test',license_basis:'TEST_ONLY'}, ...overrides
  };
}

test('canonical row derives starter and normalizes reserve states', () => {
  const r=m.canonicalSnapshotRow(row({depth_rank:1,roster_status:'physically unable to perform'}));
  assert.equal(r.starter,true); assert.equal(r.roster_status,m.STATUS.PUP);
});

test('cutoff rejects post-kickoff snapshot and selects last pre-kickoff team snapshot', () => {
  const rows=[row({provider_snapshot_id:'a',data_as_of:'2026-09-01T12:00:00Z'}),row({provider_snapshot_id:'b',data_as_of:'2026-09-05T12:00:00Z'}),row({provider_snapshot_id:'c',data_as_of:'2026-09-07T21:00:00Z'})];
  const out=m.choosePreseasonCutoff(rows,{GB:'2026-09-07T20:00:00Z'});
  assert.equal(out.rows.length,1); assert.equal(out.rows[0].provider_snapshot_id,'b');
});

test('backup to starter and starter to backup transitions are explicit', () => {
  const prev=[row({depth_rank:2})]; const curr=[row({provider_snapshot_id:'s2',depth_rank:1,data_as_of:'2026-09-02T12:00:00Z'})];
  assert.equal(m.deriveDepthTransitions(prev,curr)[0].transition,'BACKUP_TO_STARTER');
  assert.equal(m.deriveDepthTransitions(curr,prev)[0].transition,'STARTER_TO_BACKUP');
});

test('team change does not count prior opportunity as retained on old team', () => {
  const current=[row({team:'CHI'})];
  const vac=m.deriveVacatedOpportunity([{team:'GB',gsis_id:'g1',targets:100,carries:4,pass_attempts:0}],current);
  assert.equal(vac.GB.vacated_targets,100); assert.equal(vac.GB.vacated_targets_share,1);
});

test('role stability measures rank and starter volatility without awarding point bonuses', () => {
  const hist=[row({depth_rank:2}),row({provider_snapshot_id:'s2',data_as_of:'2026-09-02T12:00:00Z',depth_rank:1}),row({provider_snapshot_id:'s3',data_as_of:'2026-09-03T12:00:00Z',depth_rank:1})];
  const f=m.roleStabilityFeatures(hist)[0];
  assert.equal(f.rank_changes,1); assert.equal(f.starter_state_changes,1); assert.equal(f.starter_share_of_snapshots,2/3);
});

test('year-2/year-3 cohorts are diagnostics, including limited history', () => {
  assert.equal(m.cohortForPlayer({years_exp_at_cutoff:1,prior_opportunity:0}).second_year,true);
  assert.equal(m.cohortForPlayer({years_exp_at_cutoff:2,prior_opportunity:12}).third_year,true);
});

test('chronological folds never train on validation/future seasons and exclude 2025+', () => {
  const rec=[]; for(let s=2018;s<=2026;s++) rec.push({season:s,id:s});
  const folds=m.buildChronologicalFolds(rec,{selection_end_season:2024,minimum_train_seasons:3});
  assert.deepEqual(folds.map(f=>f.validation_season),[2021,2022,2023,2024]);
  for(const f of folds) assert.ok(f.train.every(r=>r.season<f.validation_season));
});

test('prospective manifest hashes point-in-time rows', () => {
  const manifest=m.prospectiveManifest([row()]);
  assert.equal(manifest.row_count,1); assert.equal(manifest.raw_rows_sha256.length,64);
});

test('Sportradar sample adapter fails closed without required snapshot metadata', () => {
  assert.throws(()=>m.sportradarAdapter({teams:[]},{}),/meta needs/);
});
