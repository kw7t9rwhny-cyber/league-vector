const test = require("node:test");
const assert = require("node:assert/strict");
const Data = require("../football-data-v08.js");

test("normalizes names without treating normalization as proof", () => {
  assert.equal(Data.normalizeName("Odell Beckham Jr."), "odell beckham");
  assert.equal(Data.normalizeName("D.J. Moore"), "d j moore");
  assert.equal(Data.normalizeName("Amon-Ra St. Brown"), "amon ra st brown");
  assert.equal(Data.normalizeName("Amon Ra St Brown"), "amon ra st brown");
});

test("normalizes team aliases but keeps a canonical current code", () => {
  assert.equal(Data.normalizeTeam("JAC"), "JAX");
  assert.equal(Data.normalizeTeam("WAS"), "WSH");
  assert.equal(Data.normalizeTeam("OAK"), "LV");
  assert.equal(Data.normalizeTeam("SD"), "LAC");
});

test("preserves defensive source position and role hint", () => {
  assert.deepEqual(Data.normalizePosition("OLB"), { source_position: "OLB", normalized_position: "LB", role_hint: "UNKNOWN_LB_ROLE" });
  assert.deepEqual(Data.normalizePosition("DE"), { source_position: "DE", normalized_position: "DL", role_hint: "EDGE" });
  assert.deepEqual(Data.normalizePosition("CB"), { source_position: "CB", normalized_position: "DB", role_hint: "CB" });
});

test("prefers exact GSIS identity over fallback matching", () => {
  const rows = [{ gsis_id: "00-0033873", display_name: "Patrick Mahomes", position: "QB", team: "KC" }];
  const index = Data.indexPlayers(rows.map(Data.normalizeNflversePlayer));
  const match = Data.matchSleeperPlayer("4046", { full_name: "Different Name", position: "QB", gsis_id: "00-0033873", team: "KC" }, index);
  assert.equal(match.status, "exact_stable_id");
  assert.equal(match.method, "exact_gsis");
});

test("manual GSIS override wins", () => {
  const rows = [{ gsis_id: "00-001", display_name: "Player One", position: "WR", team: "GB" }];
  const index = Data.indexPlayers(rows.map(Data.normalizeNflversePlayer));
  const match = Data.matchSleeperPlayer("s1", { full_name: "Wrong Name", position: "WR" }, index, { s1: { gsis_id: "00-001" } });
  assert.equal(match.status, "manual");
});

test("ambiguous name matches never resolve silently", () => {
  const rows = [
    { gsis_id: "00-001", display_name: "Chris Smith", position: "LB", team: "A" },
    { gsis_id: "00-002", display_name: "Chris Smith", position: "LB", team: "B" },
  ];
  const index = Data.indexPlayers(rows.map(Data.normalizeNflversePlayer));
  const match = Data.matchSleeperPlayer("s1", { full_name: "Chris Smith", position: "LB" }, index);
  assert.equal(match.status, "ambiguous");
});

test("fallback requires team corroboration when team is supplied", () => {
  const rows = [{ gsis_id: "00-001", display_name: "Brian Robinson Jr.", position: "RB", team: "WSH" }];
  const index = Data.indexPlayers(rows.map(Data.normalizeNflversePlayer));
  assert.equal(Data.matchSleeperPlayer("s1", { full_name: "Brian Robinson", position: "RB", team: "WAS" }, index).status, "verified_fallback");
  assert.equal(Data.matchSleeperPlayer("s1", { full_name: "Brian Robinson", position: "RB", team: "DAL" }, index).status, "unmatched");
});

test("crosswalk report counts unresolved players instead of dropping them", () => {
  const report = Data.buildCrosswalk({
    s1: { full_name: "Player One", position: "WR", gsis_id: "00-001" },
    s2: { full_name: "Missing Player", position: "WR" },
  }, [{ gsis_id: "00-001", display_name: "Player One", position: "WR", team: "GB" }], {}, "2026-08-13T00:00:00Z");
  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.exact_stable_id, 1);
  assert.equal(report.summary.unmatched, 1);
  assert.equal(Object.keys(report.mappings).length, 1);
});

test("missing statistics remain unavailable while known zero remains zero", () => {
  const observation = Data.normalizeObservation({ player_id: "00-001", season: 2024, week: 1, position: "WR", receptions: 0, receiving_yards: "" });
  assert.deepEqual(observation.stats.receptions, { state: "value", value: 0 });
  assert.deepEqual(observation.stats.receiving_yards, { state: "null", value: null });
  assert.deepEqual(observation.stats.targets, { state: "unavailable", value: null });
});

test("SportsDataIO free-trial records are never training eligible", () => {
  const manifest = Data.sportsDataIoTrialManifest("2026-08-13T00:00:00Z");
  assert.equal(manifest.training_eligible, false);
  assert.equal(manifest.production_projection_eligible, false);
  assert.equal(manifest.schema_testing_only, true);
  assert.equal(manifest.license_classification, "DEVELOPMENT_ONLY");
});

test("legal review manifests cannot become training eligible by flag alone", () => {
  const manifest = Data.createManifest({ provider: "unknown", dataset: "x", license_classification: Data.LICENSE.LEGAL_REVIEW_REQUIRED, training_eligible: true });
  assert.equal(manifest.training_eligible, false);
});

test("temporal splits withhold future data and quarantine unknown availability", () => {
  const rows = [
    { id: 1, timing: { feature_available_at: "2023-09-01T00:00:00Z" } },
    { id: 2, timing: { feature_available_at: "2024-09-01T00:00:00Z" } },
    { id: 3, timing: {} },
  ];
  const split = Data.temporalSplit(rows, "2024-01-01T00:00:00Z");
  assert.deepEqual(split.eligible.map((x) => x.id), [1]);
  assert.deepEqual(split.withheld.map((x) => x.id), [2]);
  assert.deepEqual(split.unknown.map((x) => x.id), [3]);
});

test("nflverse URL builder uses release assets and season-specific files", () => {
  const urls = Data.nflverseUrls(2024);
  assert.match(urls.players, /releases\/download\/players\/players\.csv$/);
  assert.match(urls.weeklyStats, /stats_player_week_2024\.csv$/);
  assert.match(urls.weeklyRosters, /roster_weekly_2024\.csv$/);
});

test("observation validation catches missing identity and impossible weeks", () => {
  const result = Data.validateObservation(Data.normalizeObservation({ season: 2024, week: 99, position: "WR" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("missing_player_identity"));
  assert.ok(result.errors.includes("invalid_week"));
});
