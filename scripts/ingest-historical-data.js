const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Core = require("../core-v08.js");
const Data = require("../football-data-v08.js");

const DEFAULT_SEASONS = [2022, 2023, 2024];
const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const ATTRIBUTION = "nflverse / nflverse-data (CC BY 4.0 repository license); dataset provenance remains documented in League Vector licensing records.";

function parseArgs(values) {
  const out = { seasons: DEFAULT_SEASONS.join(",") };
  for (let i = 0; i < values.length; i += 1) {
    if (!values[i].startsWith("--")) continue;
    out[values[i].slice(2)] = values[i + 1];
    i += 1;
  }
  return out;
}

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function sha256(text) { return crypto.createHash("sha256").update(text).digest("hex"); }
function percent(n, d) { return d ? Math.round((n / d) * 1000) / 10 : 100; }
function text(value) { return value == null ? "" : String(value).trim(); }

async function fetchText(url, cacheFile, options = {}) {
  if (cacheFile && fs.existsSync(cacheFile) && !options.refresh) {
    return { text: fs.readFileSync(cacheFile, "utf8"), source: "cache" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 45000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "League-Vector-development-ingestion/0.8" } });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    const body = await response.text();
    if (cacheFile) {
      ensureDir(path.dirname(cacheFile));
      fs.writeFileSync(cacheFile, body);
    }
    return { text: body, source: "network" };
  } finally {
    clearTimeout(timer);
  }
}

function relevantPosition(player) {
  return Data.normalizePosition(player?.position || player?.fantasy_positions?.[0]).normalized_position || "OTHER";
}

function identityReport(crosswalk, sleeperPlayers, nflversePlayers) {
  const byPosition = {};
  const review = { unmatched: [], ambiguous: [], conflicting: [] };
  const normalizedNfl = nflversePlayers.map(Data.normalizeNflversePlayer).filter((p) => p.league_vector_player_id);
  const index = Data.indexPlayers(normalizedNfl);

  for (const row of crosswalk.results || []) {
    const sleeper = sleeperPlayers[row.sleeper_id] || {};
    const group = relevantPosition(sleeper);
    byPosition[group] ||= { total: 0, resolved: 0, unmatched: 0, ambiguous: 0, conflicting: 0 };
    byPosition[group].total += 1;
    if (["exact_stable_id", "manual", "verified_fallback"].includes(row.status)) byPosition[group].resolved += 1;
    else if (row.status === "ambiguous") byPosition[group].ambiguous += 1;
    else if (row.status === "conflicting_ids") byPosition[group].conflicting += 1;
    else byPosition[group].unmatched += 1;

    if (!["exact_stable_id", "manual", "verified_fallback"].includes(row.status)) {
      const name = text(sleeper.full_name || [sleeper.first_name, sleeper.last_name].filter(Boolean).join(" "));
      const normalizedName = Data.normalizeName(name);
      const pos = Data.normalizePosition(sleeper.position || sleeper.fantasy_positions?.[0]).normalized_position;
      const candidates = (index.byNamePosition.get(`${normalizedName}|${pos || ""}`) || []).map((candidate) => ({
        gsis_id: candidate.identity.gsis_id,
        name: candidate.name.full,
        team: candidate.football.team,
        source_position: candidate.football.position,
        position_group: candidate.football.position_group,
      }));
      const item = {
        sleeper_id: row.sleeper_id,
        sleeper_name: name,
        sleeper_team: sleeper.team || null,
        sleeper_position: sleeper.position || sleeper.fantasy_positions?.[0] || null,
        status: row.status,
        reason: row.reason || null,
        candidates,
      };
      if (row.status === "ambiguous") review.ambiguous.push(item);
      else if (row.status === "conflicting_ids") review.conflicting.push(item);
      else review.unmatched.push(item);
    }
  }

  for (const group of Object.values(byPosition)) group.coverage_pct = percent(group.resolved, group.total);
  const s = crosswalk.summary || {};
  const resolved = (s.exact_stable_id || 0) + (s.manual || 0) + (s.verified_fallback || 0);
  return {
    generated_at: crosswalk.generated_at,
    total: s.total || 0,
    exact_stable_id: s.exact_stable_id || 0,
    manual: s.manual || 0,
    verified_fallback: s.verified_fallback || 0,
    unmatched: s.unmatched || 0,
    ambiguous: s.ambiguous || 0,
    conflicting_ids: s.conflicting_ids || 0,
    resolved,
    coverage_pct: percent(resolved, s.total || 0),
    by_position: byPosition,
    review,
  };
}

function duplicateAudit(observations) {
  const seen = new Map();
  for (const row of observations) {
    const key = [row.source.provider, row.source.dataset, row.gsis_id, row.season, row.week, row.team || ""].join("|");
    const existing = seen.get(key) || [];
    existing.push(row);
    seen.set(key, existing);
  }
  const duplicates = [];
  for (const [key, rows] of seen.entries()) {
    if (rows.length > 1) duplicates.push({ key, count: rows.length });
  }
  return duplicates;
}

function fieldCoverage(observations, fields) {
  const result = {};
  for (const field of fields) {
    let value = 0, zero = 0, nullCount = 0, unavailable = 0, sourceError = 0, notApplicable = 0;
    for (const row of observations) {
      const cell = row.stats?.[field];
      if (!cell || cell.state === Data.DATA_STATE.UNAVAILABLE) unavailable += 1;
      else if (cell.state === Data.DATA_STATE.NULL) nullCount += 1;
      else if (cell.state === Data.DATA_STATE.SOURCE_ERROR) sourceError += 1;
      else if (cell.state === Data.DATA_STATE.NOT_APPLICABLE) notApplicable += 1;
      else if (cell.state === Data.DATA_STATE.VALUE) { value += 1; if (cell.value === 0) zero += 1; }
    }
    const total = observations.length;
    const availability = value === total ? "available" : value > 0 ? "partially_available" : "unavailable";
    result[field] = { availability, total, value, zero, null: nullCount, unavailable, source_error: sourceError, not_applicable: notApplicable, coverage_pct: percent(value, total), known_zero_capable: zero > 0 };
  }
  return result;
}

function qualityAudit(observations, validation, sourceHeaders, seasons) {
  const issues = {};
  for (const item of validation) {
    for (const error of item.errors) issues[error] = (issues[error] || 0) + 1;
    for (const warning of item.warnings) issues[`warning:${warning}`] = (issues[`warning:${warning}`] || 0) + 1;
  }
  const weeksBySeason = {};
  for (const season of seasons) {
    const weeks = [...new Set(observations.filter((r) => r.season === season && r.season_type === "REG").map((r) => r.week).filter(Number.isInteger))].sort((a,b) => a-b);
    weeksBySeason[season] = weeks;
  }
  return {
    total_observations: observations.length,
    valid_observations: validation.filter((x) => x.valid).length,
    invalid_observations: validation.filter((x) => !x.valid).length,
    duplicate_keys: duplicateAudit(observations),
    issue_counts: issues,
    weeks_by_season: weeksBySeason,
    source_headers_by_season: sourceHeaders,
  };
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function run(options = {}) {
  const seasons = (options.seasons || DEFAULT_SEASONS).map(Number).filter(Number.isInteger);
  if (!seasons.length) throw new Error("No valid seasons supplied");
  const root = options.root || process.cwd();
  const cacheDir = path.resolve(root, options.cacheDir || ".cache/league-vector/historical");
  const reportDir = path.resolve(root, options.reportDir || "data/reports");
  const retrievedAt = new Date().toISOString();
  ensureDir(cacheDir); ensureDir(reportDir);

  const playersUrl = Data.nflverseUrls(seasons[0]).players;
  const nflPlayersDownload = await fetchText(playersUrl, path.join(cacheDir, "nflverse-players.csv"), options);
  const nflversePlayers = Core.parseCsv(nflPlayersDownload.text);
  if (!nflversePlayers.length) throw new Error("nflverse players dataset parsed to zero rows");

  const sleeperDownload = await fetchText(SLEEPER_PLAYERS_URL, path.join(cacheDir, "sleeper-players.json"), options);
  const sleeperPlayers = JSON.parse(sleeperDownload.text);
  if (!sleeperPlayers || typeof sleeperPlayers !== "object" || !Object.keys(sleeperPlayers).length) throw new Error("Sleeper player universe is empty");

  const overridesFile = path.resolve(root, options.overrides || "data/player-identity-overrides.json");
  const legacyOverridesFile = path.resolve(root, "data/player-overrides.json");
  let overrides = {};
  if (fs.existsSync(overridesFile)) overrides = JSON.parse(fs.readFileSync(overridesFile, "utf8"));
  else if (fs.existsSync(legacyOverridesFile)) overrides = JSON.parse(fs.readFileSync(legacyOverridesFile, "utf8"));

  const crosswalk = Data.buildCrosswalk(sleeperPlayers, nflversePlayers, overrides, retrievedAt);
  const identity = identityReport(crosswalk, sleeperPlayers, nflversePlayers);

  const observations = [];
  const manifests = [];
  const failures = [];
  const sourceHeaders = {};

  for (const season of seasons) {
    const url = Data.nflverseUrls(season).weeklyStats;
    try {
      const download = await fetchText(url, path.join(cacheDir, `stats_player_week_${season}.csv`), options);
      const rows = Core.parseCsv(download.text);
      if (!rows.length) throw new Error(`stats_player_week_${season} parsed to zero rows`);
      sourceHeaders[season] = Object.keys(rows[0]);
      const normalized = rows.map((row) => Data.normalizeObservation(row, {
        provider: "nflverse",
        dataset: "stats_player_week",
        source_version: "stats_player",
        retrieved_at: retrievedAt,
        source_url_or_identifier: url,
        license_classification: Data.LICENSE.APPROVED_WITH_ATTRIBUTION,
        feature_available_at: null,
      })).filter((row) => row.season_type === "REG");
      observations.push(...normalized);
      manifests.push(Data.createManifest({
        provider: "nflverse",
        dataset: `stats_player_week_${season}`,
        seasons: [season],
        retrieved_at: retrievedAt,
        source_version: "stats_player",
        row_count: rows.length,
        checksum_sha256: sha256(download.text),
        license_classification: Data.LICENSE.APPROVED_WITH_ATTRIBUTION,
        attribution: ATTRIBUTION,
        training_eligible: true,
        production_projection_eligible: true,
      }));
    } catch (error) {
      failures.push({ season, dataset: "stats_player_week", message: error.message });
    }
  }

  if (failures.length) throw new Error(`Historical ingestion incomplete: ${failures.map((x) => `${x.season}: ${x.message}`).join("; ")}`);

  const validation = observations.map(Data.validateObservation);
  const offense = observations.filter((row) => ["QB", "RB", "WR", "TE"].includes(row.position_group));
  const idp = observations.filter((row) => ["DL", "LB", "DB"].includes(row.position_group));
  const offenseFields = Object.keys(Data.OFFENSE_MAP);
  const idpFields = Object.keys(Data.IDP_MAP);
  const quality = qualityAudit(observations, validation, sourceHeaders, seasons);
  const coverage = { offense: fieldCoverage(offense, offenseFields), idp: fieldCoverage(idp, idpFields), offense_rows: offense.length, idp_rows: idp.length };

  const timing = {
    policy: "Historical weekly observations are ordered by season/week. Exact feature_available_at remains unknown unless a source record contains a defensible event/publication timestamp. Future preseason backtests must use only prior completed seasons until exact within-season availability is established.",
    rows_with_event_date: observations.filter((r) => Boolean(r.timing?.event_date)).length,
    rows_with_feature_available_at: observations.filter((r) => Boolean(r.timing?.feature_available_at)).length,
    season_level_leakage_guard: true,
  };

  const summary = {
    generated_at: retrievedAt,
    seasons,
    sources: {
      nflverse_players: { url: playersUrl, rows: nflversePlayers.length, cache: nflPlayersDownload.source },
      sleeper_players: { url: SLEEPER_PLAYERS_URL, rows: Object.keys(sleeperPlayers).length, cache: sleeperDownload.source },
    },
    identity: { ...identity, review: undefined },
    ingestion: { normalized_regular_season_records: observations.length, offense_records: offense.length, idp_records: idp.length },
    quality: { ...quality, source_headers_by_season: undefined, duplicate_keys: quality.duplicate_keys.slice(0, 200) },
    coverage,
    manifests,
    timing,
    licensing: {
      nflverse_stats_player: Data.LICENSE.APPROVED_WITH_ATTRIBUTION,
      nflverse_players: Data.LICENSE.APPROVED_WITH_ATTRIBUTION,
      sportsdataio_trial: Data.LICENSE.DEVELOPMENT_ONLY,
      note: "No SportsDataIO trial records participate in this ingestion or training eligibility calculation.",
    },
  };

  writeJson(path.join(reportDir, "historical-ingestion-summary.json"), summary);
  writeJson(path.join(reportDir, "player-identity-report.json"), { ...identity, review: undefined });
  writeJson(path.join(reportDir, "player-identity-review.json"), identity.review);
  writeJson(path.join(reportDir, "historical-data-quality.json"), quality);
  writeJson(path.join(reportDir, "historical-field-coverage.json"), coverage);
  writeJson(path.join(reportDir, "historical-manifests.json"), manifests);
  writeJson(path.join(reportDir, "generated-player-crosswalk.json"), { version: crosswalk.version, generated_at: crosswalk.generated_at, mappings: crosswalk.mappings, summary: crosswalk.summary });

  return summary;
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const seasons = cli.seasons.split(",").map(Number).filter(Number.isInteger);
  const summary = await run({ seasons, cacheDir: cli.cache, reportDir: cli.outputDir, overrides: cli.overrides, refresh: cli.refresh === "true" });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });

module.exports = { DEFAULT_SEASONS, SLEEPER_PLAYERS_URL, parseArgs, fetchText, identityReport, duplicateAudit, fieldCoverage, qualityAudit, run };
