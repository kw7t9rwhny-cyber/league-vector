const test = require("node:test");
const assert = require("node:assert/strict");
const Data = require("../football-data-v08.js");
const Ingest = require("../scripts/ingest-historical-data.js");

test("duplicate audit uses provider dataset player season week and team", () => {
  const base = {
    league_vector_player_id: "lv:gsis:00-1",
    gsis_id: "00-1",
    season: 2024,
    week: 3,
    team: "GB",
    source: { provider: "nflverse", dataset: "stats_player_week" },
  };
  const duplicates = Ingest.duplicateAudit([base, { ...base }, { ...base, week: 4 }]);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].count, 2);
});

test("field coverage preserves known zero separately from unavailable", () => {
  const rows = [
    { stats: { interceptions: { state: Data.DATA_STATE.VALUE, value: 0 } } },
    { stats: { interceptions: { state: Data.DATA_STATE.VALUE, value: 2 } } },
    { stats: { interceptions: { state: Data.DATA_STATE.UNAVAILABLE, value: null } } },
  ];
  const coverage = Ingest.fieldCoverage(rows, ["interceptions"]).interceptions;
  assert.equal(coverage.value, 2);
  assert.equal(coverage.zero, 1);
  assert.equal(coverage.unavailable, 1);
  assert.equal(coverage.availability, "partially_available");
});

test("SportsDataIO trial manifest remains ineligible for training", () => {
  const manifest = Data.sportsDataIoTrialManifest("2026-08-13T00:00:00Z");
  assert.equal(manifest.training_eligible, false);
  assert.equal(manifest.production_projection_eligible, false);
  assert.equal(manifest.schema_testing_only, true);
});

test("current historical seasons default to 2022 through 2024", () => {
  assert.deepEqual(Ingest.DEFAULT_SEASONS, [2022, 2023, 2024]);
});
