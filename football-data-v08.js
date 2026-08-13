(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LeagueVectorFootballData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TRANSFORMATION_VERSION = "lv-football-normalization-v1";
  const DATA_STATE = Object.freeze({
    VALUE: "value",
    NULL: "null",
    UNAVAILABLE: "unavailable",
    NOT_APPLICABLE: "not_applicable",
    SOURCE_ERROR: "source_error",
  });
  const LICENSE = Object.freeze({
    APPROVED_COMMERCIAL: "APPROVED_COMMERCIAL",
    APPROVED_WITH_ATTRIBUTION: "APPROVED_WITH_ATTRIBUTION",
    LEGAL_REVIEW_REQUIRED: "LEGAL_REVIEW_REQUIRED",
    DEVELOPMENT_ONLY: "DEVELOPMENT_ONLY",
    PROHIBITED: "PROHIBITED",
  });

  const TEAM_ALIASES = Object.freeze({ JAC: "JAX", WAS: "WSH", OAK: "LV", SD: "LAC", STL: "LA" });
  const POSITION_RULES = Object.freeze({
    QB: { group: "QB" }, RB: { group: "RB" }, FB: { group: "RB", role: "FB" },
    WR: { group: "WR" }, TE: { group: "TE" },
    EDGE: { group: "DL", role: "EDGE" }, DE: { group: "DL", role: "EDGE" }, DT: { group: "DL", role: "INTERIOR" }, DL: { group: "DL" },
    LB: { group: "LB" }, ILB: { group: "LB", role: "OFF_BALL" }, OLB: { group: "LB", role: "UNKNOWN_LB_ROLE" },
    CB: { group: "DB", role: "CB" }, S: { group: "DB", role: "S" }, DB: { group: "DB" },
  });

  const OFFENSE_MAP = Object.freeze({
    attempts: ["attempts", "passing_attempts"], completions: ["completions"], passing_yards: ["passing_yards"], passing_td: ["passing_tds", "passing_td"],
    interceptions: ["interceptions", "passing_interceptions"], sacks: ["sacks_suffered", "sacks"], sack_yards: ["sack_yards"], passing_epa: ["passing_epa"], cpoe: ["passing_cpoe", "cpoe"],
    carries: ["carries", "rushing_attempts"], rushing_yards: ["rushing_yards"], rushing_td: ["rushing_tds", "rushing_td"], rushing_fumbles: ["rushing_fumbles"],
    targets: ["targets"], receptions: ["receptions"], receiving_yards: ["receiving_yards"], receiving_td: ["receiving_tds", "receiving_td"], air_yards: ["receiving_air_yards", "air_yards"], yards_after_catch: ["receiving_yards_after_catch", "yards_after_catch"],
    target_share: ["target_share"], rush_share: ["carry_share", "rush_share"], team_pass_attempts: ["team_pass_attempts"], team_rush_attempts: ["team_rush_attempts"],
    red_zone_targets: ["red_zone_targets"], red_zone_carries: ["red_zone_carries"], goal_line_carries: ["goal_line_carries"],
  });

  const IDP_MAP = Object.freeze({
    solo_tackles: ["def_tackles_solo", "solo_tackles"], assisted_tackles: ["def_tackles_with_assist", "assisted_tackles"], total_tackles: ["def_tackles", "total_tackles"],
    tackles_for_loss: ["def_tackles_for_loss", "tackles_for_loss"], sacks: ["def_sacks", "sacks"], sack_yards: ["def_sack_yards", "sack_yards"], qb_hits: ["def_qb_hits", "qb_hits"],
    pressures: ["pressures"], interceptions: ["def_interceptions", "interceptions"], interception_yards: ["def_interception_yards", "interception_yards"], passes_defended: ["def_pass_defended", "passes_defended"],
    forced_fumbles: ["def_fumbles_forced", "forced_fumbles"], fumble_recoveries: ["def_fumbles", "fumble_recoveries"], defensive_td: ["def_tds", "defensive_td"], safeties: ["def_safeties", "safeties"],
    defensive_snaps: ["defensive_snaps"], snap_share: ["defensive_snap_share", "snap_share"],
  });

  function text(value) { return value == null ? "" : String(value).trim(); }
  function normalizeName(name) {
    return text(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }
  function normalizeTeam(team) { const value = text(team).toUpperCase(); return TEAM_ALIASES[value] || value || null; }
  function normalizePosition(position) {
    const sourcePosition = text(position).toUpperCase() || null;
    const rule = POSITION_RULES[sourcePosition] || null;
    return { source_position: sourcePosition, normalized_position: rule?.group || null, role_hint: rule?.role || null };
  }
  function firstPresent(row, keys) {
    for (const key of keys) if (Object.prototype.hasOwnProperty.call(row || {}, key) && row[key] !== "" && row[key] != null) return row[key];
    return undefined;
  }
  function numberOrNull(value) { if (value === undefined || value === null || value === "") return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
  function stateful(value, state = null) {
    if (state) return { state, value: state === DATA_STATE.VALUE ? value : null };
    if (value === undefined) return { state: DATA_STATE.UNAVAILABLE, value: null };
    if (value === null || value === "") return { state: DATA_STATE.NULL, value: null };
    const numeric = Number(value);
    return Number.isFinite(numeric) ? { state: DATA_STATE.VALUE, value: numeric } : { state: DATA_STATE.NULL, value: null };
  }
  function mapStats(row, mapping) {
    return Object.fromEntries(Object.entries(mapping).map(([canonical, keys]) => [canonical, stateful(firstPresent(row, keys))]));
  }
  function canonicalPlayerId(ids) {
    if (ids?.gsis_id) return `lv:gsis:${ids.gsis_id}`;
    if (ids?.sleeper_id) return `lv:sleeper:${ids.sleeper_id}`;
    if (ids?.nflverse_id) return `lv:nflverse:${ids.nflverse_id}`;
    return null;
  }

  function normalizeNflversePlayer(row) {
    const ids = {
      gsis_id: text(row?.gsis_id) || null, nflverse_id: text(row?.smart_id || row?.gsis_id) || null,
      sleeper_id: text(row?.sleeper_id) || null, sportsdataio_id: null, espn_id: text(row?.espn_id) || null,
      sportradar_id: null, pfr_id: text(row?.pfr_id) || null,
      other_source_ids: Object.fromEntries([["pff_id", text(row?.pff_id)], ["otc_id", text(row?.otc_id)], ["esb_id", text(row?.esb_id)]].filter(([,v]) => v)),
    };
    const full = text(row?.display_name || row?.full_name || row?.football_name || [row?.first_name, row?.last_name].filter(Boolean).join(" "));
    const position = normalizePosition(row?.position);
    return {
      league_vector_player_id: canonicalPlayerId(ids), identity: ids,
      name: { full, first: text(row?.first_name) || null, last: text(row?.last_name) || null, suffix: text(row?.suffix) || null, normalized: normalizeName(full) },
      football: { position: position.source_position, position_group: position.normalized_position, fantasy_position: position.normalized_position, role_hint: position.role_hint, team: normalizeTeam(row?.team), status: text(row?.status) || null },
      bio: { birth_date: text(row?.birth_date) || null, age: numberOrNull(row?.age), height: text(row?.height) || null, weight: numberOrNull(row?.weight), rookie_year: numberOrNull(row?.rookie_year || row?.entry_year) },
      metadata: { identity_status: ids.gsis_id ? "resolved" : "partial", identity_method: ids.gsis_id ? "exact_gsis" : "source_record", identity_confidence: ids.gsis_id ? "high" : "low", source: "nflverse players", source_updated_at: null },
    };
  }

  function indexPlayers(players) {
    const byGsis = new Map(), bySleeper = new Map(), byNamePosition = new Map();
    for (const player of players || []) {
      if (player.identity.gsis_id) byGsis.set(String(player.identity.gsis_id), player);
      if (player.identity.sleeper_id) bySleeper.set(String(player.identity.sleeper_id), player);
      const key = `${player.name.normalized}|${player.football.position_group || ""}`;
      const rows = byNamePosition.get(key) || []; rows.push(player); byNamePosition.set(key, rows);
    }
    return { byGsis, bySleeper, byNamePosition };
  }

  function matchSleeperPlayer(sleeperId, sleeper, index, overrides = {}) {
    const override = overrides?.[sleeperId];
    if (override?.gsis_id) {
      const player = index.byGsis.get(String(override.gsis_id));
      return player ? { status: "manual", player, method: "manual_gsis" } : { status: "unmatched", reason: "Manual GSIS override not found" };
    }
    const suppliedGsis = text(sleeper?.gsis_id);
    if (suppliedGsis) {
      const player = index.byGsis.get(suppliedGsis);
      if (player) return { status: "exact_stable_id", player, method: "exact_gsis" };
    }
    const direct = index.bySleeper.get(String(sleeperId));
    if (direct) return { status: "exact_stable_id", player: direct, method: "exact_sleeper" };
    const full = text(sleeper?.full_name || [sleeper?.first_name, sleeper?.last_name].filter(Boolean).join(" "));
    const pos = normalizePosition(sleeper?.position || sleeper?.fantasy_positions?.[0]).normalized_position;
    const candidates = index.byNamePosition.get(`${normalizeName(full)}|${pos || ""}`) || [];
    if (!candidates.length) return { status: "unmatched", reason: "No corroborated candidate" };
    if (candidates.length > 1) return { status: "ambiguous", reason: `${candidates.length} name/position candidates` };
    const candidate = candidates[0];
    const sleeperTeam = normalizeTeam(sleeper?.team);
    if (sleeperTeam && candidate.football.team && sleeperTeam !== candidate.football.team) return { status: "unmatched", reason: "Name/position candidate failed team corroboration" };
    return { status: "verified_fallback", player: candidate, method: "name_position_team" };
  }

  function buildCrosswalk(sleeperPlayers, nflverseRows, overrides = {}, now = new Date().toISOString()) {
    const normalized = (nflverseRows || []).map(normalizeNflversePlayer).filter((p) => p.league_vector_player_id);
    const index = indexPlayers(normalized);
    const summary = { total: 0, exact_stable_id: 0, manual: 0, verified_fallback: 0, unmatched: 0, ambiguous: 0, conflicting_ids: 0 };
    const mappings = {}, results = [];
    for (const [sleeperId, sleeper] of Object.entries(sleeperPlayers || {})) {
      summary.total += 1;
      const match = matchSleeperPlayer(sleeperId, sleeper, index, overrides);
      summary[match.status] = (summary[match.status] || 0) + 1;
      if (match.player) mappings[sleeperId] = { league_vector_player_id: match.player.league_vector_player_id, gsis_id: match.player.identity.gsis_id, sleeper_id: sleeperId, method: match.method, verified: true, updated_at: now, notes: null };
      results.push({ sleeper_id: sleeperId, name: text(sleeper?.full_name), status: match.status, method: match.method || null, gsis_id: match.player?.identity?.gsis_id || null, reason: match.reason || null });
    }
    return { version: 1, generated_at: now, mappings, summary, results };
  }

  function normalizeObservation(row, options = {}) {
    const position = normalizePosition(row?.position || options.position);
    const isDefense = ["DL", "LB", "DB"].includes(position.normalized_position);
    const gsisId = text(row?.player_id || row?.gsis_id || options.gsis_id) || null;
    const season = numberOrNull(row?.season ?? options.season), week = numberOrNull(row?.week ?? options.week);
    return {
      league_vector_player_id: options.league_vector_player_id || canonicalPlayerId({ gsis_id: gsisId }), gsis_id: gsisId,
      season, week, season_type: text(row?.season_type || options.season_type || "REG").toUpperCase(),
      team: normalizeTeam(row?.team || row?.recent_team), opponent: normalizeTeam(row?.opponent_team || row?.opponent),
      position: position.source_position, position_group: position.normalized_position, role_hint: position.role_hint,
      stats: mapStats(row, isDefense ? IDP_MAP : OFFENSE_MAP),
      source: { provider: options.provider || "nflverse", dataset: options.dataset || "stats_player", source_version: options.source_version || null, retrieved_at: options.retrieved_at || null, source_url_or_identifier: options.source_url_or_identifier || null, license_classification: options.license_classification || LICENSE.APPROVED_WITH_ATTRIBUTION },
      timing: { event_date: options.event_date || row?.game_date || null, source_updated_at: options.source_updated_at || null, retrieved_at: options.retrieved_at || null, feature_available_at: options.feature_available_at || options.retrieved_at || null },
      transformation: { version: TRANSFORMATION_VERSION, generated_at: options.generated_at || new Date().toISOString() },
    };
  }

  function validateObservation(row) {
    const errors = [], warnings = [];
    if (!row?.league_vector_player_id) errors.push("missing_player_identity");
    if (!Number.isInteger(row?.season) || row.season < 1999 || row.season > 2100) errors.push("invalid_season");
    if (row?.week != null && (!Number.isInteger(row.week) || row.week < 1 || row.week > 25)) errors.push("invalid_week");
    if (!row?.position_group) warnings.push("unknown_position");
    for (const [key, cell] of Object.entries(row?.stats || {})) {
      if (cell?.state === DATA_STATE.VALUE && !Number.isFinite(cell.value)) errors.push(`non_numeric_${key}`);
      if (cell?.state === DATA_STATE.VALUE && cell.value < 0 && !["sack_yards", "passing_epa"].includes(key)) warnings.push(`negative_${key}`);
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  function createManifest(input) {
    const license = input.license_classification || LICENSE.LEGAL_REVIEW_REQUIRED;
    return {
      manifest_version: 1, provider: input.provider, dataset: input.dataset, seasons: input.seasons || [], retrieved_at: input.retrieved_at || null,
      source_version: input.source_version || null, transformation_version: input.transformation_version || TRANSFORMATION_VERSION,
      row_count: Number.isInteger(input.row_count) ? input.row_count : null, checksum_sha256: input.checksum_sha256 || null,
      license_classification: license, attribution: input.attribution || null,
      training_eligible: input.training_eligible === true && ![LICENSE.DEVELOPMENT_ONLY, LICENSE.PROHIBITED, LICENSE.LEGAL_REVIEW_REQUIRED].includes(license),
      production_projection_eligible: input.production_projection_eligible === true && ![LICENSE.DEVELOPMENT_ONLY, LICENSE.PROHIBITED, LICENSE.LEGAL_REVIEW_REQUIRED].includes(license),
      schema_testing_only: input.schema_testing_only === true,
    };
  }
  function sportsDataIoTrialManifest(retrievedAt = null) { return createManifest({ provider: "SportsDataIO", dataset: "free-trial-scrambled", retrieved_at: retrievedAt, license_classification: LICENSE.DEVELOPMENT_ONLY, training_eligible: false, production_projection_eligible: false, schema_testing_only: true, attribution: "SCRAMBLED TEST DATA — NOT FOR MODEL TRAINING OR PRODUCTION PROJECTIONS" }); }
  function temporalSplit(observations, cutoff) {
    const cutoffTime = new Date(cutoff).getTime();
    if (!Number.isFinite(cutoffTime)) throw new Error("Invalid cutoff");
    const eligible = [], withheld = [], unknown = [];
    for (const row of observations || []) {
      const available = row?.timing?.feature_available_at || row?.timing?.retrieved_at || row?.timing?.event_date;
      const time = available ? new Date(available).getTime() : NaN;
      if (!Number.isFinite(time)) unknown.push(row); else if (time <= cutoffTime) eligible.push(row); else withheld.push(row);
    }
    return { eligible, withheld, unknown };
  }

  function nflverseUrls(season) {
    const y = Number(season);
    if (!Number.isInteger(y) || y < 1999) throw new Error("Invalid nflverse season");
    return {
      players: "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv",
      weeklyStats: `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${y}.csv`,
      seasonalStats: `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_${y}.csv`,
      weeklyRosters: y >= 2002 ? `https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_${y}.csv` : null,
    };
  }

  return { TRANSFORMATION_VERSION, DATA_STATE, LICENSE, TEAM_ALIASES, POSITION_RULES, OFFENSE_MAP, IDP_MAP, normalizeName, normalizeTeam, normalizePosition, stateful, canonicalPlayerId, normalizeNflversePlayer, indexPlayers, matchSleeperPlayer, buildCrosswalk, normalizeObservation, validateObservation, createManifest, sportsDataIoTrialManifest, temporalSplit, nflverseUrls };
});
