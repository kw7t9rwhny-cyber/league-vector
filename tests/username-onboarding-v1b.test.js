const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const onboarding = fs.readFileSync("username-onboarding-v1b.js", "utf8");
const styles = fs.readFileSync("username-onboarding-v1b.css", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const workflow = fs.readFileSync(".github/workflows/username-onboarding-preview-v1b.yml", "utf8");

function countId(id) {
  return [...html.matchAll(new RegExp(`\\bid=["']${id}["']`, "g"))].length;
}

test("username-first onboarding preserves the existing analyzer contract", () => {
  for (const id of ["leagueId", "go", "status", "results"]) {
    assert.equal(countId(id), 1, `Expected exactly one #${id}`);
  }
  assert.doesNotMatch(onboarding, /id=["'](?:leagueId|go|status|results)["']/);
  assert.match(onboarding, /document\.getElementById\("leagueId"\)/);
  assert.match(onboarding, /document\.getElementById\("go"\)/);
  assert.match(onboarding, /analyzeButton\.click\(\)/);
  assert.match(onboarding, /Advanced: import by league ID or URL/);
  assert.match(onboarding, /advancedSlot\.append\(originalImport, analyzerStatus\)/);
  assert.doesNotMatch(onboarding, /type=["']password["']|api[_ -]?token|authorization/i);
  new vm.Script(onboarding, { filename: "username-onboarding-v1b.js" });
});

test("onboarding uses documented Sleeper discovery endpoints and automatic roster matching", () => {
  assert.match(onboarding, /\/state\/nfl/);
  assert.match(onboarding, /\/user\/\$\{encodeURIComponent\(username\)\}/);
  assert.match(onboarding, /\/user\/\$\{encodeURIComponent\(user\.user_id\)\}\/leagues\/nfl\/\$\{encodeURIComponent\(activeSeason\)\}/);
  assert.match(onboarding, /\/league\/\$\{leagueId\}\/rosters/);
  assert.match(onboarding, /\/league\/\$\{leagueId\}\/users/);
  assert.match(onboarding, /roster\?\.co_owners/);
  assert.match(onboarding, /writeCommandCenterState\(leagueId, rosterId\)/);
  assert.match(onboarding, /matches\.length === 1/);
  assert.match(onboarding, /matches\.length > 1/);
  assert.match(onboarding, /Choose the roster you manage/);
  assert.doesNotMatch(onboarding, /\/projections\/|\/transactions\//);
});

test("league cards disclose format, IDP, season and sample-demo boundaries", () => {
  assert.match(onboarding, /Dynasty/);
  assert.match(onboarding, /Keeper/);
  assert.match(onboarding, /Redraft/);
  assert.match(onboarding, /Superflex \/ 2QB/);
  assert.match(onboarding, /Offense only/);
  assert.match(onboarding, /sleepercdn\.com\/avatars\/thumbs/);
  assert.match(onboarding, /Try the sample demo/);
  assert.match(onboarding, /static sample interface\. No live league data was imported/);
  assert.match(onboarding, /USER_NOT_FOUND/);
  assert.match(onboarding, /has no NFL leagues listed/);
  assert.match(onboarding, /username lookup is unavailable right now/);
});

test("onboarding assets are versioned, responsive and included in validation previews", () => {
  assert.match(html, /username-onboarding-v1b\.css\?v=0\.1/);
  assert.match(html, /username-onboarding-v1b\.js\?v=0\.1/);
  assert.ok(html.indexOf('src="premium-shell.js?v=0.1.3"') < html.indexOf('src="username-onboarding-v1b.js?v=0.1"'));
  assert.ok(html.indexOf('src="username-onboarding-v1b.js?v=0.1"') < html.indexOf('src="command-center-bridge-v1a.js?v=0.1"'));
  assert.match(packageJson.scripts.check, /node --check username-onboarding-v1b\.js/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /overflow-y:\s*auto/);
  assert.match(workflow, /username-onboarding-v1b\.css/);
  assert.match(workflow, /username-onboarding-v1b\.js/);
  assert.match(workflow, /command-center-mobile-header-v1a\.css/);
  assert.match(workflow, /premium-homepage-truth\.css/);
});
