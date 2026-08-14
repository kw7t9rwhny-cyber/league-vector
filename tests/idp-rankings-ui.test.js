const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("experimental IDP rankings shell is isolated from offensive dynasty and Core", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const ui = fs.readFileSync("idp-rankings-ui-v01.js", "utf8");
  assert.match(html, /EXPERIMENTAL IDP RANKINGS/);
  assert.match(html, /idp-rankings-v01\.css\?v=0\.1/);
  assert.match(html, /idp-rankings-ui-v01\.js\?v=0\.1/);
  assert.doesNotMatch(ui, /LeagueVectorCore|calculateDynasty|dynastyValue\s*=/);
  assert.match(ui, /idp_dynasty_value_available === true/);
  assert.match(ui, /current_eligible === true/);
});

test("IDP shell labels current-season experimental output and Dynasty Value unavailability", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /Current-season defense only/);
  assert.match(html, /not League Vector Dynasty Values/);
  assert.match(html, /Dynasty Value remains unavailable/);
  assert.match(html, /data-idp-position="DL"/);
  assert.match(html, /data-idp-position="LB"/);
  assert.match(html, /data-idp-position="DB"/);
  assert.match(html, /data-idp-position="IDP FLEX"/);
});
