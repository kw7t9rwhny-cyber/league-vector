const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Core = require("../core-v08.js");
const { audit } = require("../scripts/audit-crosswalk.js");

test("crosswalk audit reports stable, exact, ambiguous and excluded IDP records", () => {
  const players = require("./fixtures/crosswalk-players.json");
  const crosswalk = require("./fixtures/crosswalk.json");
  const marketRows = Core.parseCsv(fs.readFileSync("tests/fixtures/crosswalk-market.csv", "utf8"));
  const report = audit({ players, crosswalk, marketRows, format: "1qb" });

  assert.deepEqual(report.summary, {
    total: 4,
    crosswalk: 1,
    manual: 0,
    exact: 1,
    verified: 0,
    unmatched: 0,
    ambiguous: 2,
    coveragePct: 50,
  });
  assert.equal(report.results.some((result) => result.sleeperId === "idp-1"), false);
  assert.equal(report.results.find((result) => result.sleeperId === "changed-team").status, "crosswalk");
});
