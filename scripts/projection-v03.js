const fs = require('node:fs');
const path = require('node:path');
const Core = require('../core-v08.js');
const Data = require('../football-data-v08.js');
const V1 = require('./benchmark-projections.js');
const H = require('./ingest-historical-data.js');
const B = require('../projection-benchmark-v08.js');
const P = require('../projection-v03.js');
const Identity = require('../identity-idp-v04.js');

const SEASONS = Array.from({ length: 11 }, (_, i) => 2015 + i);
const FOLDS = [2020, 2021, 2022, 2023, 2024, 2025];
const SLEEPER_URL = 'https://api.sleeper.app/v1/players/nfl';

function write(dir, name, value) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), `${JSON.stringify(value, null, 2)}\n`);
}

function activeRelevant(id, player) {
  const pos = Data.normalizePosition(player?.position || player?.fantasy_positions?.[0]).normalized_position;
  return player?.active === true && P.POSITIONS.includes(pos) ? { id, pos } : null;
}

function yearsExp(player) {
  const n = Number(player?.years_exp);
  return Number.isFinite(n) ? n : null;
}

function rankReport(rows) {
  const result = [];
  const limits = { QB: [12, 24], RB: [12, 24, 36], WR: [12, 24, 36, 48], TE: [12, 24], DL: [12, 24], LB: [12, 24], DB: [12, 24] };
  for (const pos of P.POSITIONS) {
    const actual = rows.filter((x) => x.position === pos).sort((a, b) => b.actual_points - a.actual_points);
    const predicted = [...actual].sort((a, b) => b.predicted_points - a.predicted_points);
    for (const n of limits[pos] || []) {
      if (actual.length < n) continue;
      const actualIds = new Set(actual.slice(0, n).map((x) => x.gsis_id));
      const projectedIds = predicted.slice(0, n).map((x) => x.gsis_id);
      const hit = projectedIds.filter((x) => actualIds.has(x)).length;
      result.push({ position: pos, top_n: n, overlap: hit, precision: hit / n, recall: hit / n });
    }
  }
  return result;
}

function recalcReadiness(readiness, statusRows) {
  const counts = {
    projection_ready: 0,
    rookie_model_required: 0,
    insufficient_history: 0,
    identity_unresolved: 0,
    unsupported_position: 0,
    missing_required_inputs: 0,
    data_unavailable: 0,
    source_error: 0,
  };
  const byPosition = {};
  for (const row of statusRows || []) {
    counts[row.status] = (counts[row.status] || 0) + 1;
    byPosition[row.position] ||= {};
    byPosition[row.position][row.status] = (byPosition[row.position][row.status] || 0) + 1;
  }
  return { ...readiness, counts, by_position: byPosition, total_current_relevant: statusRows.length, players: statusRows };
}

async function run(options = {}) {
  const seasons = options.seasons || SEASONS;
  const folds = (options.folds || FOLDS).filter((x) => seasons.includes(x));
  const dir = path.resolve(options.outputDir || 'data/reports/projection-v03');
  const cache = path.resolve(options.cacheDir || '.cache/league-vector/projection-v03');
  const base = await V1.load(seasons, { cacheDir: cache, refresh: options.refresh });

  const playersUrl = Data.nflverseUrls(seasons[0]).players;
  const playersCsv = (await H.fetchText(playersUrl, path.join(cache, 'players.csv'), { refresh: options.refresh, timeoutMs: 45000 })).text;
  const rawPlayers = Core.parseCsv(playersCsv);
  const normalizedPlayers = rawPlayers.map(Data.normalizeNflversePlayer);
  const players = normalizedPlayers;
  const birth = Object.fromEntries(players.filter((p) => p.identity.gsis_id && p.bio.birth_date).map((p) => [p.identity.gsis_id, p.bio.birth_date]));
  const sourcePlayersByGsis = new Map(players.filter((p) => p.identity.gsis_id).map((p) => [String(p.identity.gsis_id), p]));

  const ps = B.aggregatePlayerSeasons(base.observations);
  const pred = [];
  for (const fold of folds) pred.push(...P.predictFold(ps.filter((r) => r.season <= fold), fold, birth));
  if (pred.some((x) => x.history_seasons.some((y) => y >= x.target_season))) throw new Error('Temporal leakage detected');

  const selection = P.compare(pred, folds);
  const fantasy = P.fantasyBacktest(pred, selection);
  const uncertainty = P.uncertainty(pred, selection);
  const selectedMap = new Map(selection.map((x) => [`${x.position}|${x.target}`, x.selected.model]));

  const groups = new Map();
  for (const row of pred) {
    if (selectedMap.get(`${row.position}|${row.target}`) !== row.model) continue;
    const key = `${row.gsis_id}|${row.position}|${row.target_season}`;
    const value = groups.get(key) || { gsis_id: row.gsis_id, position: row.position, target_season: row.target_season, pred: {}, actual: {} };
    value.pred[row.target] = row.prediction;
    value.actual[row.target] = row.actual;
    groups.set(key, value);
  }
  const rankRows = [];
  for (const value of groups.values()) {
    const missing = (P.REQUIRED[value.position] || []).filter((k) => !Number.isFinite(value.pred[k]) || !Number.isFinite(value.actual[k]));
    if (!missing.length) rankRows.push({ ...value, predicted_points: P.scoreReference(value.pred, value.position), actual_points: P.scoreReference(value.actual, value.position) });
  }
  const rankings = rankReport(rankRows);

  const sleeperText = (await H.fetchText(SLEEPER_URL, path.join(cache, 'sleeper-players.json'), { refresh: options.refresh, timeoutMs: 45000 })).text;
  const sleeper = JSON.parse(sleeperText);
  const crosswalk = Data.buildCrosswalk(sleeper, rawPlayers, {}, new Date().toISOString());
  const hist = P.index(ps);
  const historicalPositionByGsis = new Map();
  for (const row of ps) {
    const key = String(row.gsis_id);
    const previous = historicalPositionByGsis.get(key);
    if (!previous || Number(row.season) > previous.season) historicalPositionByGsis.set(key, { season: Number(row.season), position: row.position });
  }
  for (const [key, value] of historicalPositionByGsis) historicalPositionByGsis.set(key, value.position);

  const uncMap = new Map(uncertainty.map((x) => [`${x.position}|${x.target}`, x]));
  const models = new Map();
  for (const s of selection) models.set(`${s.position}|${s.target}`, P.finalModel(ps, s.position, s.target, birth, s, 2026));

  const initialCounts = { projection_ready: 0, rookie_model_required: 0, insufficient_history: 0, identity_unresolved: 0, unsupported_position: 0, missing_required_inputs: 0, data_unavailable: 0 };
  const initialByPosition = {};
  const projections = [];
  const review = [];
  const statusRows = [];

  for (const [sleeperId, sp] of Object.entries(sleeper)) {
    const rel = activeRelevant(sleeperId, sp);
    if (!rel) continue;
    const pos = rel.pos;
    initialByPosition[pos] ||= { projection_ready: 0, rookie_model_required: 0, insufficient_history: 0, identity_unresolved: 0, missing_required_inputs: 0 };
    const mapping = crosswalk.mappings[sleeperId];
    let status;
    if (!mapping) {
      status = yearsExp(sp) === 0 ? 'rookie_model_required' : 'identity_unresolved';
      review.push({ sleeper_id: sleeperId, name: sp.full_name || null, position: pos, status });
    } else {
      const history = P.history(hist, mapping.gsis_id, 2026);
      if (!history.length) status = yearsExp(sp) === 0 ? 'rookie_model_required' : 'insufficient_history';
      else {
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
        const missing = (P.REQUIRED[pos] || []).filter((k) => !Number.isFinite(clean.stats[k]));
        status = missing.length ? 'missing_required_inputs' : 'projection_ready';
        const intervals = {};
        for (const target of Object.keys(clean.stats)) {
          const u = uncMap.get(`${pos}|${target}`);
          if (u) intervals[target] = { p80_low: Math.max(0, clean.stats[target] - u.p80), p80_high: clean.stats[target] + u.p80, p90_low: Math.max(0, clean.stats[target] - u.p90), p90_high: clean.stats[target] + u.p90 };
        }
        projections.push({
          league_vector_player_id: mapping.league_vector_player_id,
          gsis_id: mapping.gsis_id,
          sleeper_id: sleeperId,
          name: sp.full_name || [sp.first_name, sp.last_name].filter(Boolean).join(' '),
          position: pos,
          team: sp.team || null,
          identity_method: mapping.method || null,
          projection_status: status,
          projected_stats: clean.stats,
          models: used,
          uncertainty: intervals,
          confidence: P.confidence(history.length, missing, true),
          history_seasons: history.map((x) => x.season),
          missing_inputs: missing,
          warnings: clean.corrections.map((c) => `sanity_correction:${c.field}:${c.rule}`),
          model_version: P.VERSION,
          projection_date: new Date().toISOString(),
          experimental: true,
          production_projection_eligible: false,
          dynasty_value_eligible: false,
        });
      }
    }
    initialCounts[status] = (initialCounts[status] || 0) + 1;
    initialByPosition[pos][status] = (initialByPosition[pos][status] || 0) + 1;
    statusRows.push({ sleeper_id: sleeperId, position: pos, status });
  }

  const resolved = Identity.resolveProjectionIdentityConflicts(projections, statusRows, { sourcePlayersByGsis, historicalPositionByGsis, sleeperPlayers: sleeper });
  const readinessBase = { generated_at: new Date().toISOString(), counts: initialCounts, by_position: initialByPosition, total_current_relevant: Object.values(initialCounts).reduce((a, b) => a + b, 0), crosswalk_summary: crosswalk.summary, players: statusRows };
  const readiness = recalcReadiness(readinessBase, resolved.statusRows);
  const idpProfiles = Identity.buildIdpScoringProfiles(ps, { seasons, minGames: 8, trim: 0.1 });

  const selectedCounts = {};
  for (const s of selection) selectedCounts[s.selected.model] = (selectedCounts[s.selected.model] || 0) + 1;
  const ageAblation = {
    with_age_better: selection.filter((x) => x.age_ablation.preferred === 'with_age').length,
    without_age_better: selection.filter((x) => x.age_ablation.preferred === 'without_age').length,
    insufficient: selection.filter((x) => x.age_ablation.preferred === 'insufficient_evidence').length,
  };

  const summary = {
    version: P.VERSION,
    seasons,
    folds,
    observations: base.observations.length,
    player_seasons: ps.length,
    historical_predictions: pred.length,
    selected_models: selectedCounts,
    age_ablation: ageAblation,
    complete_fantasy_players: fantasy.complete_players,
    current_2026_projection_records: resolved.projections.length,
    current_projection_ready: readiness.counts.projection_ready,
    rookie_model_required: readiness.counts.rookie_model_required,
    identity_unresolved: readiness.counts.identity_unresolved,
    identity_duplicate_groups: resolved.report.duplicate_groups,
    identity_duplicate_records_removed: resolved.report.removed_records,
    idp_scoring_profile: {
      version: idpProfiles.version,
      method: idpProfiles.method,
      seasons: idpProfiles.seasons,
      min_games: idpProfiles.min_games,
      sample_sizes: Object.fromEntries(Object.entries(idpProfiles.positions).map(([k, v]) => [k, v.sample_size])),
    },
    tree_model: { implemented: false, reason: 'Deferred: v0.3 first completes tuned ridge/age ablation/shrinkage and live-readiness; no dependency added without evidence it is needed.' },
    production_eligible: false,
    dynasty_value_eligible: false,
  };

  write(dir, 'summary.json', summary);
  write(dir, 'model-selection.json', selection);
  write(dir, 'fantasy-backtest.json', fantasy);
  write(dir, 'top-n-rankings.json', rankings);
  write(dir, 'uncertainty.json', uncertainty);
  write(dir, '2026-readiness.json', readiness);
  write(dir, '2026-projections.json', resolved.projections);
  write(dir, 'identity-review.json', review);
  write(dir, 'identity-duplicate-audit.json', resolved.report);
  write(dir, 'idp-scoring-profiles.json', idpProfiles);
  return { summary, selection, fantasy, rankings, uncertainty, readiness, projections: resolved.projections, identityDuplicateAudit: resolved.report, idpScoringProfiles: idpProfiles };
}

if (require.main === module) {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  run({
    seasons: (args.seasons || SEASONS.join(',')).split(',').map(Number),
    folds: (args.folds || FOLDS.join(',')).split(',').map(Number),
    cacheDir: args.cache,
    outputDir: args.outputDir,
    refresh: args.refresh === 'true',
  }).then((x) => console.log(JSON.stringify(x.summary, null, 2))).catch((error) => { console.error(error.stack || error.message); process.exit(1); });
}

module.exports = { run, rankReport, recalcReadiness };