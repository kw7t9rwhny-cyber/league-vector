const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const presentationFiles = [
  "premium-shell-hero.js",
  "premium-shell-sections.js",
  "premium-shell.js",
  "premium-homepage.js",
];
const presentation = presentationFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const shell = fs.readFileSync("premium-shell.js", "utf8");
const stylesheetFiles = [
  "premium-homepage.css",
  "premium-homepage-base.css",
  "premium-homepage-dashboard.css",
  "premium-homepage-sections.css",
  "premium-homepage-motion.css",
  "premium-homepage-safety.css",
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
  assert.match(shell, /form\?\.querySelector\(["']button["']\)/);
  assert.match(shell, /secondary\.append\(status\)/);
  assert.match(shell, /Every League/);
  assert.match(shell, /Has an Edge\./);
  assert.match(shell, /Find Yours\./);
  assert.doesNotMatch(presentation, /Win today\.|Build forever\./i);
  assert.doesNotMatch(presentation, /id=["'](?:leagueId|go|status|results)["']/);
  assert.ok(html.indexOf('src="app.js') < html.indexOf('src="premium-shell-hero.js'), "Presentation scripts must load after app.js");
});

test("presentation layer is isolated from analyzer networking and submission", () => {
  assert.doesNotMatch(presentation, /\bfetch\s*\(/);
  assert.doesNotMatch(presentation, /XMLHttpRequest/);
  assert.doesNotMatch(presentation, /getElementById\s*\(\s*["'](?:leagueId|go|status|results)["']/);
  assert.doesNotMatch(presentation, /querySelector\s*\(\s*["']#(?:leagueId|go|status|results)["']/);
  assert.doesNotMatch(presentation, /preventDefault\s*\(/);
  for (const file of presentationFiles) new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
});

test("premium art and motion are local, optional and versioned", () => {
  for (const file of stylesheetFiles) assert.equal(fs.existsSync(file), true, `Missing ${file}`);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /data:image\/webp;base64,/);
  assert.doesNotMatch(styles, /assets\/league-vector-runner\.webp/);
  assert.doesNotMatch(styles, /url\s*\(\s*["']?https?:/);
  assert.match(html, /premium-homepage\.css\?v=0\.1\.2/);
  assert.match(html, /premium-shell-hero\.js\?v=0\.1\.2/);
  assert.match(html, /premium-shell-sections\.js\?v=0\.1\.2/);
  assert.match(html, /premium-shell\.js\?v=0\.1\.2/);
  assert.match(html, /premium-homepage\.js\?v=0\.1\.2/);
});
