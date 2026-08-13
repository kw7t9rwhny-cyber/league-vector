const fs = require("node:fs");
const path = require("node:path");
const Core = require("../core-v08.js");
const Data = require("../football-data-v08.js");
const V1 = require("./benchmark-projections.js");
const H = require("./ingest-historical-data.js");
const B = require("../projection-benchmark-v08.js");
const P = require("../projection-v03.js");
const Identity = require("../projection-identity-v03.js");
const IdpContext = require("../idp-scoring-context-v01.js");

const SEASONS = Array.from({ length: 11 }, (_, i) => 2015 + i);
const FOLDS = [2020, 2021, 2022, 2023, 2024, 2025];
const SLEEPER_URL = "https://api.sleeper.app/v1/players/nfl";

function write(dir, name, value) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + "\n");
}

function activeRelevant(id, player) {
  const pos = Data.normalizePosition(player?.position || player?.fantasy_positions?.[0]).normalized_position;
  return player?.active === true && P.POSITIONS.includes(pos) ? { id, pos } : null;
}

function yearsExp(player) {
  const value = Number(player?.years_exp);
  return Number.isFinite(value) ? value : null;
}

function rankReport(rows) {
  const result = [];
  const limits = { QB: [12, 24], RB: [12, 24, 36], WR: [12, 24, 36, 48], TE: [12, 24], DL: [12, 24], LB: [12, 24], DB: [12, 24] };
  for (const pos of P.POSITIONS) {
    const actual = rows.filter((row) => row.position === pos).sort((a, b) => b.actual_points - a.actual_points);
    const predicted = [...actual].sort((a, b) => b.predicted_points - a.predicted_points);
    for (const n of limits[pos] || []) {
      if (actual.length < n) continue;
      const actualIds = new Set(actual.slice(0, n).map((row) => row.gsis_id));
      const projectedIds = predicted.slice(0, n).map((row) => row.gsis_id);
      const hit = projectedIds.filter((id) => actualIds.has(id)).length;
      result.push({ position: pos, top_n: n, overlap: hit, precision: hit / n, recall: hit / n });
    }
  }
  return result;
}

function projectionForIdentity(candidate, context) {
  const { psIndex, models, uncMap } = context;
  const { sleeper_id: sleeperId, sleeper_player: sleeperPlayer, mapping, position: pos, sleeper_aliases = [] } = candidate;
  const history = P.history(psIndex, mapping.gsis_id, 2026);
  if (!history.length) {
    return { status: yearsExp(sleeperPlayer) === 0 ? "rookie_model_required" : "insufficient_history", projection: null };
  }

  const line = {};
  const used = {};
  for (const target of P.TARGETS[pos] || []) {
    const model = models.get(`${pos}|${target}`);
    const value = model?.buildFor(mapping.gsis_id);
    if (Number.isFinite(value)) {
      line[target] = value;
      used[target] = model.name;
    }
  }

  const clean = P.sanitizeLine(line, pos);
  const missing = (P.REQUIRED[pos] || []).filter((key) => !Number.isFinite(clean.stats[key]));
  const status = missing.length ? "missing_required_inputs" : "projection_ready";
  const intervals = {};
  for (const target of Object.keys(clean.stats)) {
    const uncertainty = uncMap.get(`${pos}|${target}`);
    if (uncertainty) {
      intervals[target] = {
        p80_low: Math.max(0, clean.stats[target] - uncertainty.p80),
        p80_high: clean.stats[target] + uncertainty.p80,
        p90_low: Math.max(0, clean.stats[target] - uncertainty.p90),
        p90_high: clean.stats[target] + uncertainty.p90,
      };
    }
  }

  const projection = Identity.canonicalizeRecord({
    league_vector_player_id: mapping.league_vector_player_id,
    gsis_id: mapping.gsis_id,
    sleeper_id: sleeperId,
    sleeper_aliases,
    name: sleeperPlayer.full_name || [sleeperPlayer.first_name, sleeperPlayer.last_name].filter(Boolean).join(" "),
    position: pos,
    team: sleeperPlayer.team || null,
    projection_status: status,
    projected_stats: clean.stats,
    models: used,
    uncertainty: intervals,
    confidence: P.confidence(history.length, missing, true),
    history_seasons: history.map((row) => row.season),
    missing_inputs: missing,
    warnings: clean.corrections.map((correction) => `sanity_correction:${correction.field}:${correction.rule}`),
    model_version: P.VERSION,
    projection_date: new Date().toISOString(),
    experimental: true,
    production_projection_eligible: false,
    dynasty_value_eligible: false,
  });
  return { status, projection };
}

async function run(options = {}) {
  const seasons = options.seasons || SEASONS;
  const folds = (options.folds || FOLDS).filter((season) => seasons.includes(season));
  const dir = path.resolve(options.outputDir || "data/reports/projection-v03");
  const cache = path.resolve(options.cacheDir || ".cache/league-vector/projection-v03");
  const base = await V1.load(seasons, { cacheDir: cache, refresh: options.refresh });

  const playersUrl = Data.nflverseUrls(seasons[0]).players;
  const playersCsv = (await H.fetchText(playersUrl, path.join(cache, "players.csv"), { refresh: options.refresh, timeoutMs: 45000 })).text;
  const rawPlayers = Core.parseCsv(playersCsv);
  const players = rawPlayers.map(Data.normalizeNflversePlayer);
  const birth = Object.fromEntries(players.filter((player) => player.identity.gsis_id && player.bio.birth_date).map((player) => [player.identity.gsis_id, player.bio.birth_date]));
  const playerSeasons = B.aggregatePlayerSeasons(base.observations);
  const predictions = [];
  for (const fold of folds) predictions.push(...P.predictFold(playerSeasons.filter((row) => row.season <= fold), fold, birth));
  if (predictions.some((row) => row.history_seasons.some((season) => season >= row.target_season))) throw new Error("Temporal leakage detected");

  const selection = P.compare(predictions, folds);
  const fantasy = P.fantasyBacktest(predictions, selection);
  const uncertainty = P.uncertainty(predictions, selection);
  const selectedMap = new Map(selection.map((row) => [`${row.position}|${row.target}`, row.selected.model]));

  const groups = new Map();
  for (const row of predictions) {
    if (selectedMap.get(`${row.position}|${row.target}`) !== row.model) continue;
    const key = `${row.gsis_id}|${row.position}|${row.target_season}`;
    const group = groups.get(key) || { gsis_id: row.gsis_id, position: row.position, target_season: row.target_season, pred: {}, actual: {} };
    group.pred[row.target] = row.prediction;
    group.actual[row.target] = row.actual;
    groups.set(key, group);
  }
  const rankRows = [];
  for (const group of groups.values()) {
    const missing = (P.REQUIRED[group.position] || []).filter((key) => !Number.isFinite(group.pred[key]) || !Number.isFinite(group.actual[key]));
    if (!missing.length) rankRows.push({ ...group, predicted_points: P.scoreReference(group.pred, group.position), actual_points: P.scoreReference(group.actual, group.position) });
  }
  const rankings = rankReport(rankRows);

  const sleeperText = (await H.fetchText(SLEEPER_URL, path.join(cache, "sleeper-players.json"), { refresh: options.refresh, timeoutMs: 45000 })).text;
  const sleeper = JSON.parse(sleeperText);
  const crosswalk = Data.buildCrosswalk(sleeper, rawPlayers, {}, new Date().toISOString());
  const psIndex = P.index(playerSeasons);
  const uncMap = new Map(uncertainty.map((row) => [`${row.position}|${row.target}`, row]));
  const models = new Map();
  for (const selected of selection) models.set(`${selected.position}|${selected.target}`, P.finalModel(playerSeasons, selected.position, selected.target, birth, selected, 2026));

  const relevantEntries = [];
  const unmappedEntries = [];
  for (const [sleeperId, sleeperPlayer] of Object.entries(sleeper)) {
    const relevant = activeRelevant(sleeperId, sleeperPlayer);
    if (!relevant) continue;
    const mapping = crosswalk.mappings[sleeperId];
    const baseCandidate = { sleeper_id: sleeperId, sleeper_player: sleeperPlayer, position: relevant.pos, mapping };
    if (!mapping) unmappedEntries.push(baseCandidate);
    else relevantEntries.push({
      ...baseCandidate,
      gsis_id: mapping.gsis_id,
      league_vector_player_id: Identity.canonicalLeagueVectorId(mapping.league_vector_player_id, mapping.gsis_id),
    });
  }

  const resolved = Identity.resolveAliases(relevantEntries);
  const counts = { projection_ready: 0, rookie_model_required: 0, insufficient_history: 0, identity_unresolved: 0, unsupported_position: 0, missing_required_inputs: 0, data_unavailable: 0 };
  const byPosition = {};
  const projections = [];
  const review = [];
  const statusRows = [];
  const statusBySleeper = new Map();

  function countStatus(position, status) {
    counts[status] = (counts[status] || 0) + 1;
    byPosition[position] ||= { projection_ready: 0, rookie_model_required: 0, insufficient_history: 0, identity_unresolved: 0, missing_required_inputs: 0 };
    byPosition[position][status] = (byPosition[position][status] || 0) + 1;
  }

  for (const candidate of resolved.canonical) {
    const result = projectionForIdentity(candidate, { psIndex, models, uncMap });
    countStatus(candidate.position, result.status);
    if (result.projection) projections.push(result.projection);
    const ids = [candidate.sleeper_id, ...(candidate.sleeper_aliases || [])];
    for (const sleeperId of ids) {
      statusBySleeper.set(String(sleeperId), {
        sleeper_id: String(sleeperId),
        canonical_sleeper_id: candidate.sleeper_id,
        alias_of: String(sleeperId) === String(candidate.sleeper_id) ? null : candidate.sleeper_id,
        gsis_id: candidate.gsis_id,
        league_vector_player_id: candidate.league_vector_player_id,
        position: candidate.position,
        status: result.status,
      });
    }
  }

  for (const candidate of resolved.unresolved) {
    const position = candidate.position || Data.normalizePosition(candidate.sleeper_player?.position).normalized_position || "?";
    countStatus(position, "identity_unresolved");
    statusBySleeper.set(String(candidate.sleeper_id), { sleeper_id: String(candidate.sleeper_id), position, status: "identity_unresolved", reason: candidate.reason || "stable_identity_conflict" });
    review.push({ sleeper_id: String(candidate.sleeper_id), name: candidate.sleeper_player?.full_name || null, position, status: "identity_unresolved", reason: candidate.reason || "stable_identity_conflict" });
  }

  for (const candidate of unmappedEntries) {
    const status = yearsExp(candidate.sleeper_player) === 0 ? "rookie_model_required" : "identity_unresolved";
    countStatus(candidate.position, status);
    statusBySleeper.set(String(candidate.sleeper_id), { sleeper_id: String(candidate.sleeper_id), position: candidate.position, status });
    review.push({ sleeper_id: String(candidate.sleeper_id), name: candidate.sleeper_player.full_name || null, position: candidate.position, status });
  }

  statusRows.push(...statusBySleeper.values());
  Identity.assertUnique(projections);

  const idpHistoricalProfiles = IdpContext.buildHistoricalProfiles(playerSeasons, { seasons, minGames: 8 });
  const duplicateAudit = {
    version: Identity.VERSION,
    generated_at: new Date().toISOString(),
    mapped_candidates: relevantEntries.length,
    canonical_identities: resolved.canonical.length,
    alias_groups: resolved.duplicateReport.filter((row) => row.status === "resolved_aliases").length,
    resolved_alias_records: resolved.duplicateReport.filter((row) => row.status === "resolved_aliases").reduce((sum, row) => sum + (row.sleeper_aliases || []).length, 0),
    unresolved_records: resolved.unresolved.length,
    groups: resolved.duplicateReport,
    artifact_uniqueness: Identity.uniquenessAudit(projections),
  };

  const readiness = {
    generated_at: new Date().toISOString(),
    counts,
    by_position: byPosition,
    total_current_relevant_identities: Object.values(counts).reduce((sum, value) => sum + value, 0),
    total_current_relevant_sleeper_records: statusRows.length,
    crosswalk_summary: crosswalk.summary,
    duplicate_identity_summary: {
      alias_groups: duplicateAudit.alias_groups,
      resolved_alias_records: duplicateAudit.resolved_alias_records,
      unresolved_records: duplicateAudit.unresolved_records,
    },
    players: statusRows,
  };

  const selectedCounts = {};
  for (const selected of selection) selectedCounts[selected.selected.model] = (selectedCounts[selected.selected.model] || 0) + 1;
  const ageAblation = {
    with_age_better: selection.filter((row) => row.age_ablation.preferred === "with_age").length,
    without_age_better: selection.filter((row) => row.age_ablation.preferred === "without_age").length,
    insufficient: selection.filter((row) => row.age_ablation.preferred === "insufficient_evidence").length,
  };
  const summary = {
    version: P.VERSION,
    seasons,
    folds,
    observations: base.observations.length,
    player_seasons: playerSeasons.length,
    historical_predictions: predictions.length,
    selected_models: selectedCounts,
    age_ablation: ageAblation,
    complete_fantasy_players: fantasy.complete_players,
    current_2026_projection_records: projections.length,
    current_projection_ready: counts.projection_ready,
    rookie_model_required: counts.rookie_model_required,
    identity_unresolved: counts.identity_unresolved,
    resolved_sleeper_aliases: duplicateAudit.resolved_alias_records,
    unresolved_duplicate_identity_records: duplicateAudit.unresolved_records,
    idp_historical_profile_rows: idpHistoricalProfiles.length,
    idp_historical_profile_seasons: seasons,
    tree_model: { implemented: false, reason: "Deferred: v0.3 first completes tuned ridge/age ablation/shrinkage and live-readiness; no dependency added without evidence it is needed." },
    production_eligible: false,
    dynasty_value_eligible: false,
  };

  write(dir, "summary.json", summary);
  write(dir, "model-selection.json", selection);
  write(dir, "fantasy-backtest.json", fantasy);
  write(dir, "top-n-rankings.json", rankings);
  write(dir, "uncertainty.json", uncertainty);
  write(dir, "2026-readiness.json", readiness);
  write(dir, "2026-projections.json", projections);
  write(dir, "identity-review.json", review);
  write(dir, "duplicate-identity-audit.json", duplicateAudit);
  write(dir, "idp-historical-profiles.json", { version: IdpContext.VERSION, reference_scoring: IdpContext.REFERENCE_SCORING, seasons, profiles: idpHistoricalProfiles });
  return { summary, selection, fantasy, rankings, uncertainty, readiness, projections, duplicateAudit, idpHistoricalProfiles };
}

if (require.main === module) {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
  run({
    seasons: (args.seasons || SEASONS.join(",")).split(",").map(Number),
    folds: (args.folds || FOLDS.join(",")).split(",").map(Number),
    cacheDir: args.cache,
    outputDir: args.outputDir,
    refresh: args.refresh === "true",
  }).then((result) => console.log(JSON.stringify(result.summary, null, 2))).catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { run, rankReport, projectionForIdentity };
