(function (root, factory) {
  const Foundation = typeof module === "object" && module.exports
    ? require("./idp-foundation-research-v03.js")
    : root.LeagueVectorIdpFoundationResearchV03;
  const api = factory(Foundation);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LeagueVectorIdpCurrentSeasonRankingsV01 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Foundation) {
  "use strict";

  if (!Foundation) throw new Error("IDP foundation dependency unavailable");

  const VERSION = "lv-idp-current-season-rankings-v0.1";
  const IDP_GROUPS = Object.freeze(["DL", "LB", "DB"]);
  const SUPPORTED_SCORING = Object.freeze({
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
  const KNOWN_IDP_KEY = /(?:^idp_|^tkl|sack|qb_hit|pass_def|(^|_)ff$|fum_rec|def_td|safe|blk_kick|def_2pt|int_ret|fum_ret|def_st|st_td|kick_ret|punt_ret)/;
  const ROSTER_SLOT_MAP = Object.freeze({
    DL: "DL", DE: "DL", DT: "DL", EDGE: "DL",
    LB: "LB", ILB: "LB", OLB: "LB",
    DB: "DB", CB: "DB", S: "DB", FS: "DB", SS: "DB",
  });
  const KNOWN_NON_STARTER_SLOTS = new Set(["BN", "IR", "TAXI"]);
  const KNOWN_OTHER_STARTER_SLOTS = new Set([
    "QB", "RB", "FB", "WR", "TE", "FLEX", "REC_FLEX", "WRRB_FLEX", "SUPER_FLEX", "K", "P",
  ]);

  function finite(value) { return Number.isFinite(Number(value)); }
  function round(value, digits = 3) {
    if (!finite(value)) return null;
    const scale = 10 ** digits;
    return Math.round(Number(value) * scale) / scale;
  }
  function text(value) { return value == null ? "" : String(value).trim(); }
  function countBy(values) {
    const counts = {};
    for (const value of values || []) counts[value] = (counts[value] || 0) + 1;
    return counts;
  }

  function scoringCoverage(scoringSettings = {}, projectedStats = null) {
    const mapped = {};
    const supportedKeys = [];
    const unsupportedKeys = [];
    for (const [key, rawWeight] of Object.entries(scoringSettings || {})) {
      if (!finite(rawWeight) || Number(rawWeight) === 0) continue;
      const stat = SUPPORTED_SCORING[key];
      if (stat) {
        mapped[stat] = (mapped[stat] || 0) + Number(rawWeight);
        supportedKeys.push(key);
      } else if (KNOWN_IDP_KEY.test(key)) unsupportedKeys.push(key);
    }
    const activeSupportedStats = Object.keys(mapped);
    const missingProjectedStats = projectedStats
      ? activeSupportedStats.filter((stat) => !finite(projectedStats?.[stat]))
      : [];
    const hasSupportedScoring = activeSupportedStats.length > 0;
    const complete = hasSupportedScoring && unsupportedKeys.length === 0 && missingProjectedStats.length === 0;
    return {
      status: complete ? "complete" : hasSupportedScoring ? "partial" : "unavailable",
      supported_keys: supportedKeys.sort(),
      unsupported_keys: unsupportedKeys.sort(),
      active_supported_stats: activeSupportedStats.sort(),
      missing_projected_stats: missingProjectedStats.sort(),
      meaningful_incomplete: unsupportedKeys.length > 0 || missingProjectedStats.length > 0,
      scoring: mapped,
    };
  }

  function scoreProjectedStats(projectedStats = {}, scoringSettings = {}) {
    const coverage = scoringCoverage(scoringSettings, projectedStats);
    if (coverage.status !== "complete") {
      return { projected_points: null, scoring_coverage: coverage, ranking_eligible: false };
    }
    let total = 0;
    for (const [stat, weight] of Object.entries(coverage.scoring)) total += Number(projectedStats[stat]) * Number(weight);
    return { projected_points: round(total), scoring_coverage: coverage, ranking_eligible: true };
  }

  function leagueIdpStructure(league = {}) {
    const teams = Number(league?.total_rosters);
    if (!Number.isInteger(teams) || teams <= 0) {
      return { valid: false, reason: "invalid_or_missing_league_size", teams: null, dedicated: null, flex: null, unsupported_roster_slots: [] };
    }
    const slots = Array.isArray(league?.roster_positions) ? league.roster_positions.map((x) => text(x).toUpperCase()).filter(Boolean) : [];
    if (!slots.length) {
      return { valid: false, reason: "missing_roster_positions", teams, dedicated: null, flex: null, unsupported_roster_slots: [] };
    }
    const counts = countBy(slots);
    const dedicated = { DL: 0, LB: 0, DB: 0 };
    const unsupportedRosterSlots = [];
    for (const [slot, count] of Object.entries(counts)) {
      const group = ROSTER_SLOT_MAP[slot];
      if (group) dedicated[group] += count;
      else if (slot === "IDP_FLEX") continue;
      else if (KNOWN_NON_STARTER_SLOTS.has(slot) || KNOWN_OTHER_STARTER_SLOTS.has(slot)) continue;
      else if (/^(?:DL|DE|DT|EDGE|LB|ILB|OLB|DB|CB|S|FS|SS|IDP)/.test(slot)) unsupportedRosterSlots.push(slot);
    }
    const flex = Number(counts.IDP_FLEX || 0);
    const totalIdpStartersPerTeam = dedicated.DL + dedicated.LB + dedicated.DB + flex;
    if (!totalIdpStartersPerTeam) {
      return { valid: false, reason: "league_has_no_supported_idp_starters", teams, dedicated, flex, unsupported_roster_slots: unsupportedRosterSlots };
    }
    if (unsupportedRosterSlots.length) {
      return { valid: false, reason: "unsupported_idp_roster_slots", teams, dedicated, flex, unsupported_roster_slots: unsupportedRosterSlots.sort() };
    }
    return { valid: true, reason: null, teams, dedicated, flex, unsupported_roster_slots: [] };
  }

  function syntheticId(eligibility) { return `__replacement__:${eligibility.join("/")}`; }

  function replacementEntryThreshold(players, config, eligibility, options = {}) {
    const normalizedEligibility = [...new Set((eligibility || []).filter((p) => IDP_GROUPS.includes(p)))].sort();
    if (!normalizedEligibility.length) return null;
    const maxPoints = Math.max(1, ...players.map((p) => finite(p.points) ? Number(p.points) : 0));
    const id = syntheticId(normalizedEligibility);
    const selectedAt = (value) => {
      const candidate = { id, points: value, lineup_eligibility: normalizedEligibility };
      return Foundation.maximumWeightAssignment([...players, candidate], config).selected_player_ids.includes(id);
    };
    if (!selectedAt(maxPoints * 2 + 1)) return null;
    let low = 0;
    let high = maxPoints * 2 + 1;
    const iterations = Number.isInteger(options.iterations) ? options.iterations : 28;
    for (let i = 0; i < iterations; i += 1) {
      const mid = (low + high) / 2;
      if (selectedAt(mid)) high = mid;
      else low = mid;
    }
    return round(high);
  }

  function buildReplacementThresholds(players, structure) {
    const config = { teams: structure.teams, dedicated: structure.dedicated, flex: structure.flex };
    const sets = new Map();
    for (const player of players) {
      const eligibility = [...new Set(player.lineup_eligibility || [])].sort();
      if (!eligibility.length) continue;
      sets.set(eligibility.join("/"), eligibility);
    }
    for (const group of IDP_GROUPS) sets.set(group, [group]);
    const thresholds = {};
    for (const [key, eligibility] of [...sets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      thresholds[key] = replacementEntryThreshold(players, config, eligibility);
    }
    return thresholds;
  }

  function buildCandidate(input = {}) {
    const league = input.league || {};
    const sleeperPlayers = input.sleeper_players || {};
    const projections = Array.isArray(input.projections) ? input.projections : [];
    const crosswalkByGsis = input.crosswalk_by_gsis || {};
    const structure = leagueIdpStructure(league);
    const globalCoverage = scoringCoverage(league.scoring_settings || {});
    const blockedReasons = [];
    if (!structure.valid) blockedReasons.push(structure.reason);
    if (globalCoverage.status === "unavailable") blockedReasons.push("no_supported_active_idp_scoring");
    if (globalCoverage.unsupported_keys.length) blockedReasons.push("meaningful_unsupported_idp_scoring_keys");

    const currentPool = Foundation.filterProjectionPool(projections, sleeperPlayers, crosswalkByGsis);
    const safePlayers = [];
    const excluded = [...currentPool.excluded];
    for (const row of currentPool.included) {
      const scored = scoreProjectedStats(row.projected_stats || {}, league.scoring_settings || {});
      if (!scored.ranking_eligible) {
        excluded.push({ row, sleeper_id: row.sleeper_id, reason: "incomplete_scoring_coverage", scoring_coverage: scored.scoring_coverage });
        continue;
      }
      safePlayers.push({
        ...row,
        id: String(row.sleeper_id || row.gsis_id || row.league_vector_player_id),
        points: scored.projected_points,
        projected_points: scored.projected_points,
        scoring_coverage: scored.scoring_coverage,
      });
    }

    const thresholds = structure.valid && !blockedReasons.length ? buildReplacementThresholds(safePlayers, structure) : {};
    const rows = safePlayers.map((row) => {
      const eligiblePositions = [...new Set(row.lineup_eligibility || [])].sort();
      const replacement = thresholds[eligiblePositions.join("/")] ?? null;
      const surplus = finite(replacement) ? round(row.projected_points - replacement) : null;
      return {
        player_id: row.league_vector_player_id || row.gsis_id || row.sleeper_id,
        sleeper_id: row.sleeper_id || null,
        gsis_id: row.gsis_id || null,
        name: row.name || null,
        team: row.team || null,
        primary_position: row.position,
        eligible_positions: eligiblePositions,
        current_status: row.current_eligibility_class || null,
        projected_points: row.projected_points,
        league_replacement_points: replacement,
        projected_surplus: surplus,
        scoring_coverage: {
          status: row.scoring_coverage.status,
          supported_keys: row.scoring_coverage.supported_keys,
          unsupported_keys: row.scoring_coverage.unsupported_keys,
          missing_projected_stats: row.scoring_coverage.missing_projected_stats,
        },
        role_confidence: "limited",
        historical_role_model_available: false,
        eligibility_verified: true,
        current_season_ranking_available: structure.valid && !blockedReasons.length && finite(row.projected_points),
        current_season_surplus_available: structure.valid && !blockedReasons.length && finite(surplus),
        idp_dynasty_value_available: false,
        dynasty_value: null,
        experimental: true,
        warnings: [
          "current-season projection only; not Dynasty Value",
          "historical starter/reserve role model unavailable",
          "role confidence limited because defensive snap/depth history is incomplete",
        ],
      };
    });

    rows.sort((a, b) => {
      const aValue = finite(a.projected_surplus) ? Number(a.projected_surplus) : Number.NEGATIVE_INFINITY;
      const bValue = finite(b.projected_surplus) ? Number(b.projected_surplus) : Number.NEGATIVE_INFINITY;
      if (bValue !== aValue) return bValue - aValue;
      if (Number(b.projected_points) !== Number(a.projected_points)) return Number(b.projected_points) - Number(a.projected_points);
      return String(a.player_id).localeCompare(String(b.player_id));
    });

    const countsByPosition = Object.fromEntries(IDP_GROUPS.map((position) => [position, rows.filter((row) => row.primary_position === position).length]));
    const readiness = {};
    for (const position of IDP_GROUPS) {
      const positionRows = rows.filter((row) => row.primary_position === position);
      readiness[position] = {
        current_season_ranking: structure.valid && !blockedReasons.length && positionRows.length > 0
          ? "READY_FOR_EXPERIMENTAL_CURRENT_SEASON_RANKING"
          : "NOT_READY",
        current_season_surplus: structure.valid && !blockedReasons.length && positionRows.some((row) => row.current_season_surplus_available)
          ? "READY_EXPERIMENTAL"
          : "NOT_READY",
        dynasty_value: "NOT_READY",
        player_count: positionRows.length,
        role_confidence: "limited",
      };
    }

    return {
      version: VERSION,
      label: "Experimental IDP Current-Season Rankings v0.1",
      status: blockedReasons.length ? "blocked" : "ready_experimental",
      risk: "HIGH",
      blocked_reasons: blockedReasons,
      methodology: {
        projection: "Score each safely current-eligible player's current-season projected IDP counting stats directly under the league's active Sleeper scoring settings.",
        replacement: "For each exact lineup-eligibility set, find the minimum projected points required for an additional player with that same eligibility set to enter the globally optimized league IDP starter pool. Dedicated DL/LB/DB and IDP_FLEX slots are solved together; a player can occupy at most one slot.",
        surplus: "projected_points - league_replacement_points for the player's exact eligibility set. This is one-season lineup surplus, not multi-year Dynasty Value.",
      },
      league_structure: structure,
      scoring_coverage: globalCoverage,
      replacement_points_by_eligibility: thresholds,
      counts: {
        projection_ready_idp_before_current_gate: currentPool.included.length + currentPool.excluded.length,
        safely_ranked: rows.length,
        excluded: excluded.length,
        by_primary_position: countsByPosition,
      },
      readiness,
      players: rows,
      excluded: excluded.map((item) => ({
        sleeper_id: item.sleeper_id || item.row?.sleeper_id || null,
        gsis_id: item.row?.gsis_id || null,
        name: item.row?.name || null,
        primary_position: item.row?.position || null,
        reason: item.reason || null,
      })),
      firewall: {
        idp_dynasty_value_available: false,
        offense_idp_combined_dynasty_rankings_available: false,
        production_activation_authorized: false,
      },
    };
  }

  return Object.freeze({
    VERSION,
    IDP_GROUPS,
    SUPPORTED_SCORING,
    scoringCoverage,
    scoreProjectedStats,
    leagueIdpStructure,
    replacementEntryThreshold,
    buildReplacementThresholds,
    buildCandidate,
  });
});
