const test = require("node:test");
const assert = require("node:assert/strict");
const Data = require("../football-data-v08.js");

test("normalizes identity helpers deterministically", () => {
  assert.equal(Data.normalizeName("Odell Beckham Jr."), "odell beckham");
  assert.equal(Data.normalizeName("Amon-Ra St. Brown"), Data.normalizeName("Amon Ra St Brown"));
  assert.equal(Data.normalizeTeam("JAC"), "JAX");
  assert.deepEqual(Data.normalizePosition("DE"), { source_position: "DE", normalized_position: "DL", role_hint: "EDGE" });
});

test("exact GSIS match wins", () => {
  const index = Data.indexPlayers([{ gsis_id: "00-1", display_name: "Player", position: "QB", team: "KC" }].map(Data.normalizeNflversePlayer));
  const match = Data.matchSleeperPlayer("s1", { full_name: "Wrong", position: "QB", gsis_id: "00-1" }, index);
  assert.equal(match.method, "exact_gsis");
});

test("ambiguous candidates are not silently matched", () => {
  const rows = [
    { gsis_id: "00-1", display_name: "Chris Smith", position: "LB", team: "GB" },
    { gsis_id: "00-2", display_name: "Chris Smith", position: "LB", team: "CHI" },
  ];
  const match = Data.matchSleeperPlayer("s1", { full_name: "Chris Smith", position: "LB" }, Data.indexPlayers(rows.map(Data.normalizeNflversePlayer)));
  assert.equal(match.status, "ambiguous");
});

test("manual overrides take precedence", () => {
  const index = Data.indexPlayers([{ gsis_id: "00-1", display_name: "Player", position: "WR" }].map(Data.normalizeNflversePlayer));
  assert.equal(Data.matchSleeperPlayer("s1", { full_name: "No Match", position: "WR" }, index, { s1: { gsis_id: "00-1" } }).status, "manual");
});

test("crosswalk reports unresolved players", () => {
  const report = Data.buildCrosswalk({ s1: { full_name: "Player", position: "WR", gsis_id: "00-1" }, s2: { full_name: "Missing", position: "WR" } }, [{ gsis_id: "00-1", display_name: "Player", position: "WR" }], {}, "2026-08-13T00:00:00Z");
  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.unmatched, 1);
});

test("data states distinguish zero, null and unavailable", () => {
  assert.deepEqual(Data.stateful(0), { state: "value", value: 0 });
  assert.deepEqual(Data.stateful(null), { state: "null", value: null });
  assert.deepEqual(Data.stateful(undefined), { state: "unavailable", value: null });
});

test("trial and unresolved-license datasets cannot train", () => {
  assert.equal(Data.sportsDataIoTrialManifest().training_eligible, false);
  assert.equal(Data.createManifest({ provider: "x", dataset: "x", license_classification: Data.LICENSE.LEGAL_REVIEW_REQUIRED, training_eligible: true }).training_eligible, false);
});

test("temporal split withholds future and unknown rows", () => {
  const split = Data.temporalSplit([{ id: 1, timing: { feature_available_at: "2023-01-01" } }, { id: 2, timing: { feature_available_at: "2025-01-01" } }, { id: 3, timing: {} }], "2024-01-01");
  assert.deepEqual(split.eligible.map((x) => x.id), [1]);
  assert.deepEqual(split.withheld.map((x) => x.id), [2]);
  assert.deepEqual(split.unknown.map((x) => x.id), [3]);
});

test("observation validation catches bad identity and week", () => {
  const result = Data.validateObservation(Data.normalizeObservation({ season: 2024, week: 99, position: "WR" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("missing_player_identity"));
  assert.ok(result.errors.includes("invalid_week"));
});
