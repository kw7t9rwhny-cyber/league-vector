const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Core = require("../core-v08.js");
const Data = require("../football-data-v08.js");

function args(values) {
  const out = { seasons: "2022,2023,2024" };
  for (let i = 0; i < values.length; i += 1) {
    if (!values[i].startsWith("--")) continue;
    out[values[i].slice(2)] = values[i + 1];
    i += 1;
  }
  return out;
}
function sha256(text) { return crypto.createHash("sha256").update(text).digest("hex"); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
async function getText(url, cacheFile) {
  if (fs.existsSync(cacheFile)) return { text: fs.readFileSync(cacheFile, "utf8"), cache: true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    const text = await response.text();
    fs.writeFileSync(cacheFile, text);
    return { text, cache: false };
  } finally { clearTimeout(timer); }
}
function duplicateKeys(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = `${row.league_vector_player_id}|${row.season}|${row.week}|${row.team || ""}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count }));
}

async function main() {
  const options = args(process.argv.slice(2));
  const seasons = options.seasons.split(",").map(Number).filter(Number.isInteger);
  if (!seasons.length) throw new Error("No valid seasons supplied");
  const cacheDir = path.resolve(options.cache || ".cache/league-vector/nflverse");
  ensureDir(cacheDir);
  const retrievedAt = new Date().toISOString();

  const playersUrl = Data.nflverseUrls(seasons[0]).players;
  const playersFile = path.join(cacheDir, "players.csv");
  const playersDownload = await getText(playersUrl, playersFile);
  const nflversePlayers = Core.parseCsv(playersDownload.text);

  let sleeperPlayers = {};
  if (options.sleeper) sleeperPlayers = JSON.parse(fs.readFileSync(options.sleeper, "utf8"));
  const overrides = options.overrides && fs.existsSync(options.overrides) ? JSON.parse(fs.readFileSync(options.overrides, "utf8")) : {};
  const crosswalk = Data.buildCrosswalk(sleeperPlayers, nflversePlayers, overrides, retrievedAt);

  const observations = [];
  const manifests = [];
  const failures = [];
  for (const season of seasons) {
    const url = Data.nflverseUrls(season).weeklyStats;
    const cacheFile = path.join(cacheDir, `stats_player_week_${season}.csv`);
    try {
      const download = await getText(url, cacheFile);
      const sourceRows = Core.parseCsv(download.text);
      const normalized = sourceRows.map((row) => Data.normalizeObservation(row, {
        provider: "nflverse",
        dataset: "stats_player weekly",
        retrieved_at: retrievedAt,
        source_url_or_identifier: url,
        license_classification: Data.LICENSE.APPROVED_WITH_ATTRIBUTION,
      }));
      observations.push(...normalized);
      manifests.push(Data.createManifest({
        provider: "nflverse", dataset: `stats_player_week_${season}`, seasons: [season], retrieved_at: retrievedAt,
        row_count: sourceRows.length, checksum_sha256: sha256(download.text), license_classification: Data.LICENSE.APPROVED_WITH_ATTRIBUTION,
        attribution: "nflverse / nflverse-data; CC BY 4.0 repository license. Dataset-level third-party caveats remain subject to the licensing matrix.",
        training_eligible: true, production_projection_eligible: true,
      }));
    } catch (error) {
      failures.push({ season, dataset: "weeklyStats", message: error.message });
    }
  }

  const validation = observations.map(Data.validateObservation);
  const report = {
    generated_at: retrievedAt,
    seasons,
    identity: crosswalk.summary,
    ingestion: {
      observations: observations.length,
      valid: validation.filter((x) => x.valid).length,
      invalid: validation.filter((x) => !x.valid).length,
      warnings: validation.reduce((sum, x) => sum + x.warnings.length, 0),
      duplicate_keys: duplicateKeys(observations).slice(0, 100),
      failures,
    },
    manifests,
    cache_directory: cacheDir,
    note: "Raw downloads are cached locally and are not intended for Git commits. This report contains metadata/counts, not a bulk redistribution of source records.",
  };

  const output = options.output || "data/reports/nflverse-ingestion-report.json";
  ensureDir(path.dirname(output));
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  if (options.crosswalkOutput) fs.writeFileSync(options.crosswalkOutput, `${JSON.stringify(crosswalk, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) process.exitCode = 2;
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });
