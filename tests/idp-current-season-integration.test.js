const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("approved IDP runtime assets are versioned and loaded in deterministic order", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const expected = [
    "idp-foundation-research-v03.js?v=0.3",
    "idp-current-season-rankings-v01.js?v=0.1",
    "idp-rankings-ui-v01.js?v=0.2",
    "idp-current-season-integration-v01.js?v=0.2",
  ];
  let prior = -1;
  for (const asset of expected) {
    const index = html.indexOf(asset);
    assert.ok(index > prior, `${asset} must be present after the prior dependency`);
    prior = index;
  }
  assert.doesNotMatch(html, /idp-current-season-integration-v01\.js\?v=0\.1/);
});

test("Core adapter reveals a fail-closed shell then builds only the approved current-season contract off the main thread", () => {
  const adapter = fs.readFileSync("idp-current-season-integration-v01.js", "utf8");
  const worker = fs.readFileSync("idp-current-season-worker-v01.js", "utf8");
  assert.match(adapter, /building_current_season_rankings/);
  assert.match(adapter, /renderLeagueVectorIdpRankings/);
  assert.match(adapter, /new Worker\("idp-current-season-worker-v01\.js\?v=0\.1"\)/);
  assert.match(adapter, /data\/experimental\/2026-projections\.json/);
  assert.match(adapter, /idp_dynasty_value_available:\s*false/);
  assert.match(adapter, /offense_idp_combined_dynasty_rankings_available:\s*false/);
  assert.match(adapter, /production_activation_authorized:\s*false/);
  assert.doesNotMatch(adapter, /calculateValuation|calculateDynasty|finalValue|dynasty_value:\s*[^n]/);
  assert.match(worker, /Rankings\.buildCandidate/);
  assert.match(worker, /idp-foundation-research-v03\.js\?v=0\.3/);
  assert.match(worker, /idp-current-season-rankings-v01\.js\?v=0\.1/);
  assert.doesNotMatch(worker, /calculateValuation|calculateDynasty|finalValue/);
});
