(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LeagueVectorIdpFoundationResearchV03 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "lv-idp-foundation-research-v0.3";
  const IDP_GROUPS = Object.freeze(["DL", "LB", "DB"]);
  const POSITION_MAP = Object.freeze({
    DL: "DL", DE: "DL", DT: "DL", EDGE: "DL",
    LB: "LB", ILB: "LB", OLB: "LB",
    DB: "DB", CB: "DB", S: "DB", FS: "DB", SS: "DB",
  });
  const STATUS_CLASS = Object.freeze({
    ACTIVE: new Set(["active"]),
    INJURED: new Set(["injured reserve", "reserve/injured", "ir", "physically unable to perform", "pup", "non-football injury", "nfi"]),
    PRACTICE_SQUAD: new Set(["practice squad", "practice-squad"]),
    RETIRED: new Set(["retired"]),
    INACTIVE: new Set(["inactive", "suspended", "commissioner exempt", "exempt"]),
  });

  function text(value) { return value == null ? "" : String(value).trim(); }
  function normalizedStatus(value) { return text(value).toLowerCase().replace(/\s+/g, " "); }
  function canonicalPosition(value) { return POSITION_MAP[text(value).toUpperCase()] || null; }
  function uniq(values) { return [...new Set(values)]; }

  function lineupEligibility(player) {
    const raw = Array.isArray(player?.fantasy_positions) && player.fantasy_positions.length
      ? player.fantasy_positions
      : [player?.position];
    return uniq(raw.map(canonicalPosition).filter((p) => IDP_GROUPS.includes(p))).sort();
  }

  function classifyCurrentEligibility(player, options = {}) {
    const requireKnownStatus = options.requireKnownStatus !== false;
    const status = normalizedStatus(player?.status);
    const positions = lineupEligibility(player);
    const active = player?.active;
    const team = text(player?.team).toUpperCase() || null;

    const result = {
      eligible: false,
      reason: null,
      current_class: "unknown",
      sleeper_active: active === true ? true : active === false ? false : null,
      sleeper_status: text(player?.status) || null,
      team,
      teamless: !team,
      lineup_eligibility: positions,
    };

    if (!positions.length) { result.reason = "no_current_idp_lineup_eligibility"; return result; }
    if (active !== true) {
      result.current_class = active === false ? "inactive" : "unknown";
      result.reason = active === false ? "sleeper_active_false" : "missing_sleeper_active";
      return result;
    }
    if (!status && requireKnownStatus) { result.reason = "missing_status_fail_closed"; return result; }
    if (STATUS_CLASS.RETIRED.has(status)) { result.current_class = "retired"; result.reason = "retired"; return result; }
    if (STATUS_CLASS.INACTIVE.has(status)) { result.current_class = "inactive"; result.reason = `inactive_status:${status}`; return result; }
    if (STATUS_CLASS.ACTIVE.has(status)) {
      result.current_class = team ? "active_roster" : "free_agent";
      result.eligible = true;
      return result;
    }
    if (STATUS_CLASS.INJURED.has(status)) {
      if (!team) { result.reason = "injury_status_without_team_fail_closed"; return result; }
      result.current_class = "injured_roster";
      result.eligible = true;
      return result;
    }
    if (STATUS_CLASS.PRACTICE_SQUAD.has(status)) {
      if (!team) { result.reason = "practice_squad_without_team_fail_closed"; return result; }
      result.current_class = "practice_squad";
      result.eligible = true;
      return result;
    }
    result.reason = status ? `unknown_status_fail_closed:${status}` : "missing_status_fail_closed";
    return result;
  }

  function buildCurrentEligibilitySnapshot(sleeperPlayers, options = {}) {
    const included = [], excluded = [], counts = {};
    for (const [sleeperId, player] of Object.entries(sleeperPlayers || {})) {
      const decision = classifyCurrentEligibility(player, options);
      const row = { sleeper_id: String(sleeperId), ...decision };
      counts[decision.current_class] = (counts[decision.current_class] || 0) + 1;
      if (decision.eligible) included.push(row); else excluded.push(row);
    }
    return {
      version: VERSION,
      policy: "Sleeper current player snapshot is authoritative for current fantasy eligibility; active must be true; missing/unknown status fails closed; retired/inactive records are excluded; teamless Active records are classified as free agents; IR/PUP/NFI and practice-squad records require a team.",
      included,
      excluded,
      counts,
    };
  }

  function filterProjectionPool(projections, sleeperPlayers, crosswalkByGsis = {}) {
    const bySleeper = sleeperPlayers || {};
    const included = [], excluded = [];
    for (const row of projections || []) {
      if (row?.projection_status !== "projection_ready" || !IDP_GROUPS.includes(row?.position)) continue;
      const sleeperId = row?.sleeper_id || crosswalkByGsis?.[row?.gsis_id]?.sleeper_id || null;
      if (!sleeperId || !bySleeper[String(sleeperId)]) {
        excluded.push({ row, reason: "no_current_sleeper_identity_fail_closed" });
        continue;
      }
      const decision = classifyCurrentEligibility(bySleeper[String(sleeperId)]);
      if (!decision.eligible) { excluded.push({ row, sleeper_id: String(sleeperId), reason: decision.reason }); continue; }
      included.push({ ...row, sleeper_id: String(sleeperId), lineup_eligibility: decision.lineup_eligibility, current_eligibility_class: decision.current_class });
    }
    return { version: VERSION, included, excluded };
  }

  function expandedSlots(config) {
    const slots = [];
    const teams = Number(config?.teams || 0);
    for (const group of IDP_GROUPS) {
      const count = Math.max(0, Math.round(Number(config?.dedicated?.[group] || 0) * teams));
      for (let i = 0; i < count; i += 1) slots.push({ id: `${group}:${i + 1}`, eligibility: [group], slot_group: group });
    }
    const flexCount = Math.max(0, Math.round(Number(config?.flex || 0) * teams));
    for (let i = 0; i < flexCount; i += 1) slots.push({ id: `IDP_FLEX:${i + 1}`, eligibility: IDP_GROUPS.slice(), slot_group: "IDP_FLEX" });
    return slots;
  }

  function playerId(player, index) { return String(player?.id || player?.sleeper_id || player?.gsis_id || `row:${index}`); }
  function points(player) { const n = Number(player?.points); return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY; }
  function eligibleForSlot(player, slot) {
    const elig = Array.isArray(player?.lineup_eligibility) ? player.lineup_eligibility : [];
    return slot.eligibility.some((p) => elig.includes(p));
  }

  function maximumWeightAssignment(players, config) {
    const slots = expandedSlots(config);
    const normalized = (players || []).map((p, i) => ({ ...p, _id: playerId(p, i), _points: points(p) }))
      .filter((p) => Number.isFinite(p._points) && p._points >= 0 && Array.isArray(p.lineup_eligibility) && p.lineup_eligibility.length)
      .sort((a, b) => b._points - a._points || a._id.localeCompare(b._id));
    const playerById = new Map(normalized.map((p) => [p._id, p]));
    const slotById = new Map(slots.map((s) => [s.id, s]));
    const slotToPlayer = new Map();
    const playerToSlot = new Map();

    function augment(playerIdValue, seenSlots, seenPlayers) {
      if (seenPlayers.has(playerIdValue)) return false;
      seenPlayers.add(playerIdValue);
      const player = playerById.get(playerIdValue);
      const candidateSlots = slots.filter((slot) => eligibleForSlot(player, slot)).sort((a, b) => a.id.localeCompare(b.id));
      for (const slot of candidateSlots) {
        if (seenSlots.has(slot.id)) continue;
        seenSlots.add(slot.id);
        const occupant = slotToPlayer.get(slot.id);
        if (!occupant || augment(occupant, seenSlots, seenPlayers)) {
          slotToPlayer.set(slot.id, playerIdValue);
          playerToSlot.set(playerIdValue, slot.id);
          return true;
        }
      }
      return false;
    }

    for (const player of normalized) augment(player._id, new Set(), new Set());
    const assignments = [...playerToSlot.entries()].map(([pid, sid]) => {
      const p = playerById.get(pid), s = slotById.get(sid);
      return { player_id: pid, slot_id: sid, slot_group: s.slot_group, points: p._points, lineup_eligibility: p.lineup_eligibility.slice() };
    }).sort((a, b) => b.points - a.points || a.player_id.localeCompare(b.player_id));
    return { assignments, selected_player_ids: assignments.map((x) => x.player_id), total_points: assignments.reduce((sum, x) => sum + x.points, 0), slots };
  }

  function playerMarginalStarterValue(players, config, targetId) {
    const all = maximumWeightAssignment(players, config);
    const without = maximumWeightAssignment((players || []).filter((p, i) => playerId(p, i) !== String(targetId)), config);
    return Math.max(0, all.total_points - without.total_points);
  }

  function replacementShadowPrices(players, config) {
    const base = maximumWeightAssignment(players, config);
    const prices = {};
    for (const group of [...IDP_GROUPS, "IDP_FLEX"]) {
      const next = {
        teams: config.teams,
        dedicated: { ...(config.dedicated || {}) },
        flex: Number(config.flex || 0),
      };
      if (group === "IDP_FLEX") next.flex += 1 / Number(config.teams || 1);
      else next.dedicated[group] = Number(next.dedicated[group] || 0) + 1 / Number(config.teams || 1);
      prices[group] = maximumWeightAssignment(players, next).total_points - base.total_points;
    }
    return { base_total_points: base.total_points, replacement_shadow_price: prices };
  }

  function ageOnDate(birthDate, isoDate) {
    if (!birthDate || !isoDate) return null;
    const birth = new Date(`${birthDate}T00:00:00Z`), at = new Date(`${isoDate}T00:00:00Z`);
    if (!Number.isFinite(birth.getTime()) || !Number.isFinite(at.getTime()) || at < birth) return null;
    let age = at.getUTCFullYear() - birth.getUTCFullYear();
    const beforeBirthday = at.getUTCMonth() < birth.getUTCMonth() || (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() < birth.getUTCDate());
    if (beforeBirthday) age -= 1;
    return age;
  }

  function playerSeasonAge(birthDate, season, cutoffMonthDay = "09-01") {
    if (!Number.isInteger(Number(season))) return null;
    return ageOnDate(birthDate, `${Number(season)}-${cutoffMonthDay}`);
  }

  function experienceSeason(rookieYear, season) {
    const rookie = Number(rookieYear), year = Number(season);
    if (!Number.isInteger(rookie) || !Number.isInteger(year) || year < rookie) return null;
    return year - rookie + 1;
  }

  return Object.freeze({
    VERSION, IDP_GROUPS, POSITION_MAP,
    canonicalPosition, lineupEligibility, classifyCurrentEligibility, buildCurrentEligibilitySnapshot, filterProjectionPool,
    expandedSlots, maximumWeightAssignment, playerMarginalStarterValue, replacementShadowPrices,
    ageOnDate, playerSeasonAge, experienceSeason,
  });
});
