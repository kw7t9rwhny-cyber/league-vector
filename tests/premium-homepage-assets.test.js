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
const hero = fs.readFileSync("premium-shell-hero.js", "utf8");
const sections = fs.readFileSync("premium-shell-sections.js", "utf8");
const shell = fs.readFileSync("premium-shell.js", "utf8");
const motion = fs.readFileSync("premium-homepage.js", "utf8");
const stylesheetFiles = [
  "premium-homepage.css",
  "premium-homepage-base.css",
  "premium-homepage-dashboard.css",
  "premium-homepage-sections.css",
  "premium-homepage-motion.css",
  "premium-homepage-safety.css",
  "premium-homepage-truth.css",
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
  assert.match(html, /premium-shell-hero\.js\?v=0\.1\.3/);
  assert.match(html, /premium-shell-sections\.js\?v=0\.1\.3/);
  assert.match(html, /premium-shell\.js\?v=0\.1\.3/);
  assert.match(html, /premium-homepage\.js\?v=0\.1\.3/);
  assert.match(html, /premium-homepage-truth\.css\?v=0\.1/);
});

test("hero particle network is brighter and cursor energized", () => {
  assert.match(motion, /radius:\s*randomBetween\(0\.82,\s*2\.08\)/);
  assert.match(motion, /baseOpacity[\s\S]*?\*\s*0\.31/);
  assert.match(motion, /lineWidth\s*=\s*0\.78\s*\+\s*lineEnergy\s*\*\s*0\.42/);
  assert.match(motion, /createRadialGradient/);
  assert.match(motion, /pointer\.lastMove\s*=\s*performance\.now\(\)/);
  assert.match(motion, /pointer\.energy\s*\+=/);
  assert.match(motion, /glowRadius/);
});

test("homepage preview and feature claims disclose current product truth", () => {
  assert.match(hero, /Sample league interface/);
  assert.match(hero, /Static sample data/);
  assert.doesNotMatch(hero, />\s*LIVE\s*</);
  assert.doesNotMatch(hero, /Justin Jefferson|CeeDee Lamb|Bijan Robinson|Trevor Lawrence|Kyle Pitts/);
  assert.doesNotMatch(hero, /View full rankings|View top players|View rookie rankings|View market movement/);
  assert.match(sections, /id="data-status"/);
  assert.match(sections, /Foundation beta v0\.8/i);
  assert.match(sections, /Numeric IDP dynasty values/);
  assert.match(sections, /Complete trade recommendation engine/);
  assert.match(sections, /Sample offensive valuation/);
  assert.doesNotMatch(sections, /Micah Parsons/);
  assert.doesNotMatch(sections, /<h3>Trade Analysis<\/h3>/);
  assert.match(sections, /not affiliated with or endorsed by Sleeper or the NFL/i);
});

test("homepage metadata identifies the canonical beta product", () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/leaguevector\.com\/">/);
  assert.match(html, /<meta property="og:title" content="League Vector — Every League Has an Edge\. Find Yours\.">/);
  assert.match(html, /<meta name="theme-color" content="#030403">/);
  assert.match(html, /foundation-beta Sleeper dynasty and IDP league analyzer/i);
});
