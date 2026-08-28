const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const behavior = fs.readFileSync("command-center-mobile-header-v1a.js", "utf8");
const styles = fs.readFileSync("command-center-mobile-header-v1a.css", "utf8");

test("mobile command center collapses and restores the public site header", () => {
  assert.match(behavior, /classList\.toggle\(ACTIVE_CLASS, Boolean\(active\)\)/);
  assert.match(behavior, /leaguevector:analysis-ready/);
  assert.match(behavior, /leaguevector:analysis-start/);
  assert.match(behavior, /leaguevector:analysis-error/);
  assert.match(behavior, /data-command="run-another"/);
  assert.doesNotMatch(behavior, /\bfetch\s*\(|XMLHttpRequest/);
  new vm.Script(behavior, { filename: "command-center-mobile-header-v1a.js" });

  assert.match(styles, /body\.premium-homepage\.command-center-active \.site-header[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /command-center-active \.site-header \.header-actions[\s\S]*?display:\s*none/);
  assert.match(styles, /command-center-active \.brand-mark[\s\S]*?width:\s*25px[\s\S]*?height:\s*25px/);
  assert.match(styles, /command-center-active \.cc-navigation[\s\S]*?top:\s*44px/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);

  assert.match(html, /command-center-mobile-header-v1a\.css\?v=0\.1/);
  assert.match(html, /command-center-mobile-header-v1a\.js\?v=0\.1/);
  assert.ok(html.indexOf('src="command-center-v1a.js?v=0.1"') < html.indexOf('src="command-center-mobile-header-v1a.js?v=0.1"'));
});
