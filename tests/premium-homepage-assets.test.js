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

test("premium homepage preserves the static Sleeper analyzer DOM contract", () => {
  for (const id of ["leagueId", "go", "status", "results"]) {
    assert.equal(countId(id), 1, `Expected exactly one #${id}`);
  }
  assert.match(html, /<label[^>]+for=["']leagueId["'][^>]*>Sleeper league ID or URL<\/label>/);
  assert.match(html, /<button[^>]+id=["']go["'][^>]*>Analyze League<\/button>/);
  const orderedScripts = ["app.js", ...presentationFiles];
  for (let index = 1; index < orderedScripts.length; index += 1) {
    assert.ok(html.indexOf(`src="${orderedScripts[index - 1]}`) < html.indexOf(`src="${orderedScripts[index]}`), `${orderedScripts[index]} must load after ${orderedScripts[index - 1]}`);
  }
});

test("presentation layer is isolated from analyzer behavior and network access", () => {
  for (const file of presentationFiles) new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
  assert.doesNotMatch(presentation, /\bfetch\s*\(/);
  assert.doesNotMatch(presentation, /getElementById\s*\(\s*["'](?:leagueId|go|status|results)["']/);
  assert.doesNotMatch(presentation, /querySelector\s*\(\s*["']#(?:leagueId|go|status|results)["']/);
  assert.doesNotMatch(presentation, /addEventListener\s*\(\s*["'](?:click|keydown|submit)["'][\s\S]{0,160}(?:leagueId|#go|status|results)/);
  assert.doesNotMatch(presentation, /preventDefault\s*\(/);
  assert.match(presentation, /results\?\.id !== "results"/);
  assert.match(presentation, /classList\.add\("premium-homepage"\)/);
  assert.match(presentation, /Built to Win/);
  assert.match(presentation, /Build forever\./);
});

test("premium motion is optional, reduced-motion aware and locally hosted", () => {
  for (const file of [...presentationFiles, ...stylesheetFiles]) assert.equal(fs.existsSync(file), true, `Missing ${file}`);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(styles, /url\s*\(\s*["']?https?:/);
  assert.match(html, /premium-homepage\.css\?v=0\.1/);
  assert.match(html, /premium-homepage\.js\?v=0\.1/);
  assert.doesNotMatch(html, /class=["'][^"']*premium-homepage/);
});
