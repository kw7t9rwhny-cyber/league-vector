(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LeagueVectorIdpScoringContext = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "lv-idp-scoring-context-v0.1";
  const POSITIONS = Object.freeze(["DL", "LB", "DB"]);
  const STATS = Object.freeze([
    "solo_tackles", "assisted_tackles", "total_tackles", "tackles_for_loss",
    "sacks", "qb_hits", "interceptions", "passes_defended", "forced_fumbles",
    "fumble_recoveries", "defensive_td", "safeties",
  ]);

  // Reuses the benchmark's existing LV-IDP balanced reference. It is an internal,
  // versioned comparison baseline, not a claim about a universal IDP scoring system.
  const REFERENCE_SCORING = Object.freeze({
    solo_tackles: 1.5,
    assisted_tackles: 0.75,
    tackles_for_loss: 2,
    sacks: 4,
    qb_hits: 1,
    interceptions: 6,
    passes_defended: 1.5,
    forced_fumbles: 3,
    fumble_recoveries: 3,
    defensive_td: 6,
    safeties: 4,
  });

  const SCORING_KEY_TO_STAT = Object.freeze({
    tkl: "total_tackles", idp_tkl: "total_tackles",
    tkl_solo: "solo_tackles", idp_tkl_solo: "solo_tackles",
    tkl_ast: "assisted_tackles", idp_tkl_ast: "assisted_tackles",
    tkl_loss: "tackles_for_loss", idp_tkl_loss: "tackles_for_loss",
    sack: "sacks", idp_sack: "sacks",
    qb_hit: "qb_hits", idp_qb_hit: "qb_hits",
    int: "interceptions", idp_int: "interceptions",
    pass_def: "passes_defended", idp_pass_def: "passes_defended",
    ff: "forced_fumbles", idp_ff: "forced_fumbles",
    fum_rec: "fumble_recoveries", idp_fum_rec: "fumble_recoveries",
    def_td: "defensive_td", idp_def_td: "defensive_td",
    safe: "safeties", idp_safe: "safeties",
  });

  const number = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  const round = (value, digits = 1) => {
    if (!finite(value)) return null;
    const scale = 10 ** digits;
    return Math.round(Number(value) * scale) / scale;
  };

  function scoreStatLine(stats = {}, scoring = {}) {
    let total = 0;
    for (const [stat, weight] of Object.entries(scoring || {})) {
      if (!finite(weight) || (weight !== 0 && !finite(stats[stat]))) return null;
      if (weight !== 0) total += stats[stat] * weight;
    }
    return total;
  }

  function leagueScoringToStats(scoring = {}) {
    const out = {};
    const supportedKeys = [];
    const unsupportedKeys = [];
    for (const [key, rawWeight] of Object.entries(scoring || {})) {
      if (!finite(rawWeight) || Number(rawWeight) === 0) continue;
      if (!/(?:^idp_|^tkl|^sack$|^qb_hit$|^int$|^pass_def$|^ff$|^fum_rec$|^def_td$|^safe$)/.test(key)) continue;
      const stat = SCORING_KEY_TO_STAT[key];
      if (!stat) {
        unsupportedKeys.push(key);
        continue;
      }
      out[stat] = number(out[stat]) + Number(rawWeight);
      supportedKeys.push(key);
    }
    return { scoring: out, supported_keys: supportedKeys, unsupported_keys: unsupportedKeys };
  }

  function buildHistoricalProfiles(playerSeasons = [], options = {}) {
    const minGames = Number.isFinite(Number(options.minGames)) ? Number(options.minGames) : 8;
    const seasons = options.seasons ? new Set(options.seasons.map(Number)) : null;
    const byPositionSeason = new Map();

    for (const row of playerSeasons || []) {
      if (!POSITIONS.includes(row?.position) || !Number.isInteger(row?.season)) continue;
      if (seasons && !seasons.has(row.season)) continue;
      if (number(row.games) < minGames) continue;
      // A supplied eligible participant with no known events must still count
      // toward each field's expected support; absence is not positive production.
      const key = `${row.position}|${row.season}`;
      const records = byPositionSeason.get(key) || [];
      records.push(row);
      byPositionSeason.set(key, records);
    }

    const profiles = [];
    for (const [key, rows] of byPositionSeason) {
      const [position, seasonText] = key.split("|");
      const stats = {}, support = {};
      for (const stat of STATS) {
        const values = rows.map((row) => row.per_game?.[stat]).filter(finite);
        support[stat] = {known: values.length, expected: rows.length};
        stats[stat] = values.length === rows.length ? round(mean(values), 4) : null;
      }
      profiles.push({
        position,
        season: Number(seasonText),
        sample_size: rows.length,
        min_games: minGames,
        aggregation: "mean_player_per_game_then_median_across_seasons",
        stats, support,
      });
    }
    profiles.sort((a, b) => a.position.localeCompare(b.position) || a.season - b.season);
    return profiles;
  }

  function scoringContext(profiles = [], sleeperScoring = {}) {
    const mapped = leagueScoringToStats(sleeperScoring);
    if (!Object.keys(mapped.scoring).length) {
      return {
        version: VERSION,
        reference_version: "LV-IDP-BALANCED-v0.1",
        status: "unavailable",
        reason: "No supported active IDP scoring keys",
        supported_keys: mapped.supported_keys,
        unsupported_keys: mapped.unsupported_keys,
        positions: {},
      };
    }

    const rawByPosition = {};
    for (const position of POSITIONS) {
      const ratios = [];
      const leaguePoints = [];
      const referencePoints = [];
      const rows = profiles.filter((row) => row.position === position);
      for (const row of rows) {
        const league = scoreStatLine(row.stats, mapped.scoring);
        const reference = scoreStatLine(row.stats, REFERENCE_SCORING);
        if (reference > 0 && Number.isFinite(league)) {
          ratios.push(league / reference);
          leaguePoints.push(league);
          referencePoints.push(reference);
        }
      }
      if (ratios.length) {
        rawByPosition[position] = {
          raw_ratio: median(ratios),
          seasons: rows.map((row) => row.season),
          season_count: ratios.length,
          sample_size: rows.reduce((sum, row) => sum + number(row.sample_size), 0),
          median_league_points_per_game: median(leaguePoints),
          median_reference_points_per_game: median(referencePoints),
        };
      }
    }

    const availableRatios = Object.values(rawByPosition).map((row) => row.raw_ratio).filter((value) => finite(value) && value > 0);
    const center = median(availableRatios);
    const positions = {};
    for (const position of POSITIONS) {
      const row = rawByPosition[position];
      if (!row || !center) {
        positions[position] = { status: "unavailable" };
        continue;
      }
      const index = 100 * row.raw_ratio / center;
      positions[position] = {
        status: "available",
        scoring_pressure: round(index, 1),
        scoring_adjustment: round(index - 100, 1),
        raw_ratio_to_reference: round(row.raw_ratio, 4),
        season_count: row.season_count,
        sample_size: row.sample_size,
        median_league_points_per_game: round(row.median_league_points_per_game, 3),
        median_reference_points_per_game: round(row.median_reference_points_per_game, 3),
        seasons: row.seasons,
      };
    }

    return {
      version: VERSION,
      reference_version: "LV-IDP-BALANCED-v0.1",
      status: Object.values(positions).some((row) => row.status === "available") ? "available" : "unavailable",
      methodology: "For each position-season, score the historical mean per-game stat profile under the league and LV-IDP reference rules; take the median league/reference ratio across seasons, then normalize DL/LB/DB around the median position = 100. This measures relative IDP scoring favorability, not scarcity or VORP.",
      center_ratio: round(center, 4),
      supported_keys: mapped.supported_keys,
      unsupported_keys: mapped.unsupported_keys,
      positions,
    };
  }

  function applyStructuralContext(structural = {}, scoringContextResult = {}) {
    const out = {};
    for (const position of POSITIONS) {
      const structuralPressure = finite(structural?.[position]?.structuralScore)
        ? Number(structural[position].structuralScore)
        : finite(structural?.[position]) ? Number(structural[position]) : null;
      const scoring = scoringContextResult?.positions?.[position];
      const adjustment = scoring?.status === "available" && finite(scoring.scoring_adjustment)
        ? Number(scoring.scoring_adjustment)
        : null;
      out[position] = {
        structural_pressure: structuralPressure,
        scoring_pressure: scoring?.status === "available" ? scoring.scoring_pressure : null,
        scoring_adjustment: adjustment,
        overall_context: structuralPressure != null && adjustment != null ? round(structuralPressure + adjustment, 1) : structuralPressure,
        scoring_status: scoring?.status || "unavailable",
      };
    }
    return out;
  }

  return {
    VERSION,
    POSITIONS,
    STATS,
    REFERENCE_SCORING,
    SCORING_KEY_TO_STAT,
    scoreStatLine,
    leagueScoringToStats,
    buildHistoricalProfiles,
    scoringContext,
    applyStructuralContext,
  };
});
