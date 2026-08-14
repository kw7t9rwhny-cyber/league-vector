const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("experimental IDP rankings shell is isolated from offensive dynasty and Core", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const ui = fs.readFileSync("idp-rankings-ui-v01.js", "utf8");
  assert.match(html, /EXPERIMENTAL IDP RANKINGS/);
  assert.match(html, /idp-rankings-v01\.css\?v=0\.1/);
  assert.match(html, /idp-rankings-ui-v01\.js\?v=0\.2/);
  assert.doesNotMatch(html, /idp-rankings-ui-v01\.js\?v=0\.1/);
  assert.match(html, /DYNASTY VALUE — v0\.8 Formula/);
  assert.doesNotMatch(ui, /LeagueVectorCore|calculateDynasty|dynastyValue\s*=/);
});

test("IDP renderer consumes the canonical PR22 contract and nested firewall", () => {
  const ui = fs.readFileSync("idp-rankings-ui-v01.js", "utf8");
  for (const field of [
    "lv-idp-current-season-rankings-v0.1",
    "Experimental IDP Current-Season Rankings v0.1",
    "firewall.idp_dynasty_value_available",
    "eligible_positions",
    "primary_position",
    "eligibility_verified",
    "role_confidence",
    "current_status",
    "current_season_ranking_available",
    "idp_dynasty_value_available === false",
    "player.dynasty_value === null",
  ]) assert.match(ui, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const obsolete of [
    "current_season === true",
    "current_eligible === true",
    "player.player_name",
    "player?.player_name",
    "player.eligibility)",
    "player.position",
    "player.confidence",
    "player.status",
    "input.idp_dynasty_value_available",
  ]) assert.doesNotMatch(ui, new RegExp(obsolete.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("IDP shell labels current-season experimental output and canonical Dynasty firewall", () => {
  const html = fs.readFileSync("index.html", "utf8");
  assert.match(html, /Current-season defense only/);
  assert.match(html, /not League Vector Dynasty Values/);
  assert.match(html, /firewall\.idp_dynasty_value_available=false/);
  assert.match(html, /fails closed/);
  assert.match(html, /data-idp-position="DL"/);
  assert.match(html, /data-idp-position="LB"/);
  assert.match(html, /data-idp-position="DB"/);
  assert.match(html, /data-idp-position="IDP FLEX"/);
});
