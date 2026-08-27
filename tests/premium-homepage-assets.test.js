const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const presentation = fs.readFileSync("premium-homepage.js", "utf8");
const stylesheetFiles = [
  "premium-homepage.css",
  "premium-homepage-base.css",
  "premium-homepage-dashboard.css",
  "premium-homepage-sections.css",
  "premium-homepage-motion.css",
];
const styles = stylesheetFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

function countId(id) {
  return [...html.matchAll(new RegExp(`\\bid=["']${id}["']`, "g"))].length;
}

test("premium homepage preserves the Sleeper analyzer DOM contract", () => {
  for (const id of ["leagueId", "go", "status", "results"]) {
    assert.equal(countId(id), 1, `Expected exactly one #${id}`);
  }
  assert.match(html, /<label[^>]+for=["']leagueId["'][^>]*>Sleeper league ID or URL<\/label>/);
  assert.match(html, /<button[^>]+id=["']go["'][^>]+aria-label=["']Analyze League["']/);
  assert.ok(html.indexOf('src="app.js') < html.indexOf('src="premium-homepage.js'), "Presentation script must load after app.js");
});

test("presentation layer is isolated from the analyzer and network", () => {
  assert.doesNotMatch(presentation, /\bfetch\s*\(/);
  assert.doesNotMatch(presentation, /getElementById\s*\(\s*["'](?:leagueId|go|status|results)["']/);
  assert.doesNotMatch(presentation, /querySelector\s*\(\s*["']#(?:leagueId|go|status|results)["']/);
  assert.doesNotMatch(presentation, /addEventListener\s*\(\s*["'](?:click|keydown|submit)["'][\s\S]{0,120}(?:leagueId|#go|status|results)/);
  assert.doesNotMatch(presentation, /preventDefault\s*\(/);
  new vm.Script(presentation, { filename: "premium-homepage.js" });
});

test("premium motion is optional and uses local assets only", () => {
  for (const file of stylesheetFiles) assert.equal(fs.existsSync(file), true, `Missing ${file}`);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(styles, /url\s*\(\s*["']?https?:/);
  assert.match(html, /premium-homepage\.css\?v=0\.1/);
  assert.match(html, /premium-homepage\.js\?v=0\.1/);
});
