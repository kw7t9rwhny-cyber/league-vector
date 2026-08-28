const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const bridge = fs.readFileSync("command-center-bridge-v1a.js", "utf8");
const commandCenter = fs.readFileSync("command-center-v1a.js", "utf8");
const styles = fs.readFileSync("command-center-v1a.css", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const workflow = fs.readFileSync(".github/workflows/command-center-preview-v1a.yml", "utf8");

function countId(id) {
  return [...html.matchAll(new RegExp(`\\bid=["']${id}["']`, "g"))].length;
}

test("command center consumes a compact analyzer lifecycle without replacing protected inputs", () => {
  for (const id of ["leagueId", "go", "status", "results"]) {
    assert.equal(countId(id), 1, `Expected exactly one #${id}`);
  }
  assert.match(bridge, /emit\("analysis-start"/);
  assert.match(bridge, /emit\("analysis-ready", detail\)/);
  assert.match(bridge, /emit\("analysis-error"/);
  assert.match(bridge, /league-vector-command-center-v1a/);
  assert.match(bridge, /offensiveRank/);
  assert.match(bridge, /starterValue/);
  assert.match(bridge, /pickCount/);
  assert.match(bridge, /idpDynastyValue:\s*"unavailable"/);
  assert.match(bridge, /championshipProbability:\s*"unavailable"/);
  assert.doesNotMatch(bridge, /\bfetch\s*\(|XMLHttpRequest/);
  new vm.Script(bridge, { filename: "command-center-bridge-v1a.js" });
  assert.doesNotMatch(commandCenter, /\bfetch\s*\(|XMLHttpRequest/);
  new vm.Script(commandCenter, { filename: "command-center-v1a.js" });
});

test("command center provides team selection, remembered state, navigation and supported-only claims", () => {
  assert.match(commandCenter, /Which team is yours\?/);
  assert.match(commandCenter, /leagueVector\.commandCenter\.v1a/);
  assert.match(commandCenter, /data-command="change-team"/);
  assert.match(commandCenter, /data-command="run-another"/);
  for (const section of ["overview", "my-team", "league", "players", "idp", "draft-picks", "methodology"]) {
    assert.match(commandCenter, new RegExp(`data-command-section="${section}"`));
  }
  assert.match(commandCenter, /Supported offensive rank/);
  assert.match(commandCenter, /Numeric IDP dynasty value/);
  assert.match(commandCenter, /Trade recommendations/);
  assert.match(commandCenter, /Championship probability/);
  assert.match(commandCenter, /No win, playoff, or title probability is claimed/);
  assert.doesNotMatch(commandCenter, /\bcontender\b|\brebuilder\b|championship odds/i);
});

test("command center assets are versioned, responsive and included in deployable previews", () => {
  assert.match(html, /command-center-v1a\.css\?v=0\.1/);
  assert.match(html, /command-center-bridge-v1a\.js\?v=0\.1/);
  assert.match(html, /command-center-v1a\.js\?v=0\.1/);
  assert.match(html, /app\.js\?v=0\.8/);
  assert.ok(html.indexOf('src="app.js?v=0.8"') < html.indexOf('src="command-center-bridge-v1a.js?v=0.1"'));
  assert.ok(html.indexOf('src="command-center-bridge-v1a.js?v=0.1"') < html.indexOf('src="command-center-v1a.js?v=0.1"'));
  assert.match(packageJson.scripts.check, /node --check command-center-bridge-v1a\.js/);
  assert.match(packageJson.scripts.check, /node --check command-center-v1a\.js/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /overflow-x:\s*auto/);
  assert.match(workflow, /command-center-v1a\.css/);
  assert.match(workflow, /command-center-bridge-v1a\.js/);
  assert.match(workflow, /command-center-v1a\.js/);
  assert.match(workflow, /premium-homepage-truth\.css/);
});
