const fs = require("node:fs");
const Core = require("../core-v08.js");

function argumentsFrom(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith("--")) continue;
    result[key.slice(2)] = values[index + 1];
    index += 1;
  }
  return result;
}

function readJson(file, fallback = {}) {
  return file ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}

function audit({ players, marketRows, format, overrides = {}, crosswalk = {} }) {
  const market = Core.parseMarketRows(marketRows, format);
  const index = Core.buildIdentityIndex(market);
  const summary = { total: 0, crosswalk: 0, manual: 0, exact: 0, verified: 0, unmatched: 0, ambiguous: 0 };
  const results = [];
  for (const [sleeperId, player] of Object.entries(players || {})) {
    const position = Core.positionOf(player);
    if (!Core.isOffense(position)) continue;
    const match = Core.matchPlayerIdentity(sleeperId, player, index, overrides, crosswalk);
    summary.total += 1;
    summary[match.status] = (summary[match.status] || 0) + 1;
    results.push({
      sleeperId,
      name: player.full_name || [player.first_name, player.last_name].filter(Boolean).join(" "),
      position,
      team: player.team || "",
      status: match.status,
      fpId: match.market?.fpId || null,
      marketName: match.market?.name || null,
      reason: match.reason || null,
    });
  }
  const resolved = summary.crosswalk + summary.manual + summary.exact + summary.verified;
  summary.coveragePct = summary.total ? Math.round((resolved / summary.total) * 1000) / 10 : 100;
  return { summary, results };
}

if (require.main === module) {
  const args = argumentsFrom(process.argv.slice(2));
  if (!args.players || !args.market) {
    console.error("Usage: node scripts/audit-crosswalk.js --players players.json --market market.csv [--crosswalk crosswalk.json] [--overrides overrides.json] [--format 1qb|2qb]");
    process.exit(1);
  }
  const report = audit({
    players: readJson(args.players),
    marketRows: Core.parseCsv(fs.readFileSync(args.market, "utf8")),
    format: args.format === "2qb" ? "2qb" : "1qb",
    overrides: readJson(args.overrides),
    crosswalk: readJson(args.crosswalk),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

module.exports = { audit };
