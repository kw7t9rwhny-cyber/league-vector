const test = require("node:test");
const assert = require("node:assert/strict");
const oneQb = require("./fixtures/one-qb-league.json");
const superflex = require("./fixtures/superflex-league.json");
const idp = require("./fixtures/idp-league.json");
const Core = require("../core-v08.js");

const marketCsvRows = [{
  player: "Test Quarterback Jr.", pos: "QB", team: "NE", age: "24",
  ecr_1qb: "40", ecr_2qb: "8", value_1qb: "4000", value_2qb: "8500",
  scrape_date: "2026-08-12", fp_id: "99",
}];

test("selects the correct market format from lineup structure", () => {
  assert.equal(Core.marketFormat(oneQb), "1qb");
  assert.equal(Core.marketFormat(superflex), "2qb");
});

test("uses one-QB and two-QB market columns independently", () => {
  const one = Core.parseMarketRows(marketCsvRows, "1qb")[0];
  const two = Core.parseMarketRows(marketCsvRows, "2qb")[0];
  assert.equal(one.base, 4000);
  assert.equal(one.ecr, 40);
  assert.equal(two.base, 8500);
  assert.equal(two.ecr, 8);
});

test("paid valuation excludes legacy projection inputs", () => {
  const context = Core.leagueContext(superflex);
  const market = Core.parseMarketRows(marketCsvRows, "2qb")[0];
  const input = {
    player: { full_name: "Test Quarterback Jr.", position: "QB", years_exp: 2 },
    market,
    context,
    projection: { points: 400, pos: "QB" },
    neutralReplacement: { levels: { QB: 250 } },
    leagueReplacement: { levels: { QB: 330 } },
  };
  const result = Core.calculateValuation(input);
  const withoutProjection = Core.calculateValuation({ player: input.player, market, context });
  assert.deepEqual(result, withoutProjection);
  assert.equal(result.paidValueEligibility.projection_policy, "CONTEXT_ONLY_NOT_IN_VALUATION");
  assert.equal("projectionAdjustment" in result, false);
  assert.equal("projectedPoints" in result, false);
  assert.equal("leagueVorp" in result, false);
  assert.ok(Number.isFinite(result.finalValue));
  assert.ok(result.finalValue >= 0);
});

test("normalizes suffixes but never silently resolves ambiguity", () => {
  const rows = Core.parseMarketRows([...marketCsvRows, { ...marketCsvRows[0], team: "NYJ", fp_id: "100" }], "2qb");
  const index = Core.buildIdentityIndex(rows);
  const ambiguous = Core.matchPlayerIdentity("1", { full_name: "Test Quarterback", position: "QB", team: "FA" }, index);
  const verified = Core.matchPlayerIdentity("1", { full_name: "Test Quarterback III", position: "QB", team: "NE" }, index);
  assert.equal(ambiguous.status, "ambiguous");
  assert.equal(verified.status, "verified");
});

test("supports explicit manual identity overrides", () => {
  const rows = Core.parseMarketRows(marketCsvRows, "2qb");
  const index = Core.buildIdentityIndex(rows);
  const result = Core.matchPlayerIdentity("sleeper-1", { full_name: "Different Name", position: "QB" }, index, {
    "sleeper-1": { marketName: "Test Quarterback Jr.", position: "QB", fpId: "99" },
  });
  assert.equal(result.status, "manual");
});

test("prefers a stable-ID crosswalk across team and name changes", () => {
  const rows = Core.parseMarketRows(marketCsvRows, "2qb");
  const index = Core.buildIdentityIndex(rows);
  const result = Core.matchPlayerIdentity(
    "sleeper-1",
    { full_name: "Renamed Quarterback", position: "QB", team: "NYJ" },
    index,
    {},
    { mappings: { "sleeper-1": { fpId: "99", position: "QB" } } },
  );
  assert.equal(result.status, "crosswalk");
  assert.equal(result.market.fpId, "99");
});

test("reports a stale stable-ID mapping instead of falling back silently", () => {
  const rows = Core.parseMarketRows(marketCsvRows, "2qb");
  const index = Core.buildIdentityIndex(rows);
  const result = Core.matchPlayerIdentity(
    "sleeper-1",
    { full_name: "Test Quarterback Jr.", position: "QB", team: "NE" },
    index,
    {},
    { mappings: { "sleeper-1": { fpId: "missing", position: "QB" } } },
  );
  assert.equal(result.status, "unmatched");
  assert.equal(result.crosswalkIssue, true);
});

test("marks IDP as context-only instead of inventing values", () => {
  const context = Core.leagueContext(idp);
  assert.equal(context.values.DL.availability, "context-only");
  assert.equal(context.values.LB.availability, "context-only");
  assert.equal(context.values.DB.availability, "context-only");
});

test("tracks traded pick ownership without assigning numeric value", () => {
  const picks = Core.buildPickInventory(
    [{ roster_id: 1 }, { roster_id: 2 }],
    [{ season: "2027", round: 1, roster_id: 1, owner_id: 2 }],
    ["2027"],
    2,
  );
  const moved = picks.find((pick) => pick.season === "2027" && pick.round === 1 && pick.originalRosterId === 1);
  assert.equal(moved.ownerRosterId, 2);
  assert.equal("value" in moved, false);
});
