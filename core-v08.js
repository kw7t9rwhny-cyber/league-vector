(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LeagueVectorCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const OFFENSE = ["QB", "RB", "WR", "TE"];
  const IDP = ["DL", "DE", "DT", "LB", "ILB", "OLB", "DB", "CB", "S"];
  const STRUCTURAL_RULES = {
    QB: { rate: 0.0024, up: 0.12, down: 0.06 },
    RB: { rate: 0.0018, up: 0.08, down: 0.06 },
    WR: { rate: 0.002, up: 0.1, down: 0.06 },
    TE: { rate: 0.0022, up: 0.1, down: 0.06 },
  };
  const PAID_VALUE_ELIGIBILITY_CONTRACT = Object.freeze({
    contract_version: "lv-paid-value-eligibility-v1",
    state: "PAID_VALUE_ELIGIBLE",
    numeric_offensive_paid_value_available: true,
    projection_policy: "CONTEXT_ONLY_NOT_IN_VALUATION",
    legacy_weekly_projection_requested_during_paid_value_analysis: false,
    legacy_weekly_projection_adjustment_applied: false,
    projection_data_can_affect_paid_value: false,
    projection_data_can_affect_player_values: false,
    projection_data_can_affect_team_totals: false,
    projection_data_can_affect_sorting_or_ranking: false,
    projection_data_can_appear_inside_paid_value_components: false,
    missing_projection_substituted_with_zero: false,
    projection_coverage_fabricated: false,
    safe_context_surfaces: [
      "league_and_scoring_inputs",
      "separately_labeled_experimental_projection_board",
    ],
    idp_dynasty_value_available: false,
    offense_idp_combined_dynasty_rankings_available: false,
  });

  const number = (value) => {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const round = (value, digits = 0) => {
    const scale = 10 ** digits;
    return Math.round(number(value) * scale) / scale;
  };

  function positionOf(player) {
    return player?.fantasy_positions?.[0] || player?.position || "?";
  }

  function isOffense(position) {
    return OFFENSE.includes(position);
  }

  function isIdp(position) {
    return IDP.includes(position);
  }

  function marketFormat(league) {
    const slots = league?.roster_positions || [];
    const qbSlots = slots.filter((slot) => slot === "QB").length;
    const superflex = slots.some((slot) => slot === "SUPER_FLEX");
    return superflex || qbSlots >= 2 ? "2qb" : "1qb";
  }

  function normalizeName(name) {
    return String(name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function normalizeTeam(team) {
    return String(team || "").trim().toUpperCase();
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let index = 0; index < String(text || "").length; index += 1) {
      const character = text[index], next = text[index + 1];
      if (character === '"' && quoted && next === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = !quoted;
      else if (character === "," && !quoted) { row.push(field); field = ""; }
      else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && next === "\n") index += 1;
        row.push(field);
        if (row.some(Boolean)) rows.push(row);
        row = []; field = "";
      } else field += character;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    if (rows.length < 2) return [];
    const headers = rows.shift().map((header) => header.trim());
    return rows.map((values) => Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    ));
  }

  function parseMarketRows(rows, format) {
    const suffix = format === "1qb" ? "1qb" : "2qb";
    return (rows || [])
      .map((row) => ({
        name: row.player,
        normalizedName: normalizeName(row.player),
        pos: String(row.pos || "").trim().toUpperCase(),
        team: normalizeTeam(row.team),
        age: Number.isFinite(Number(row.age)) ? Number(row.age) : null,
        ecr: Number.isFinite(Number(row[`ecr_${suffix}`]))
          ? Number(row[`ecr_${suffix}`])
          : null,
        base: number(row[`value_${suffix}`]),
        date: row.scrape_date || "",
        fpId: row.fp_id || null,
        format,
      }))
      .filter((row) => isOffense(row.pos) && row.normalizedName && row.base > 0);
  }

  function buildIdentityIndex(marketRows) {
    const byNamePosition = new Map();
    const byFpId = new Map();
    for (const row of marketRows || []) {
      const key = `${row.normalizedName}|${row.pos}`;
      const existing = byNamePosition.get(key) || [];
      existing.push(row);
      byNamePosition.set(key, existing);
      if (row.fpId != null && row.fpId !== "") {
        const id = String(row.fpId);
        const idRows = byFpId.get(id) || [];
        idRows.push(row);
        byFpId.set(id, idRows);
      }
    }
    return { byNamePosition, byFpId };
  }

  function matchPlayerIdentity(sleeperId, player, index, overrides = {}, crosswalk = {}) {
    const override = overrides[sleeperId];
    if (override) {
      const candidates = index.byNamePosition.get(
        `${normalizeName(override.marketName)}|${override.position}`,
      ) || [];
      const exact = override.fpId
        ? candidates.find((row) => String(row.fpId) === String(override.fpId))
        : candidates.find(
            (row) => !override.team || row.team === normalizeTeam(override.team),
          );
      return exact
        ? { status: "manual", market: exact }
        : { status: "unmatched", reason: "Manual override did not resolve" };
    }

    const mappings = crosswalk?.mappings || crosswalk || {};
    const mapping = mappings[sleeperId];
    if (mapping?.fpId != null) {
      const candidates = index.byFpId.get(String(mapping.fpId)) || [];
      const position = mapping.position || positionOf(player);
      const matches = candidates.filter((row) => !position || row.pos === position);
      return matches.length === 1
        ? { status: "crosswalk", market: matches[0] }
        : {
            status: matches.length ? "ambiguous" : "unmatched",
            reason: `Stable crosswalk fpId ${mapping.fpId} resolved to ${matches.length} rows`,
            crosswalkIssue: true,
          };
    }

    const pos = positionOf(player);
    const name = player?.full_name ||
      [player?.first_name, player?.last_name].filter(Boolean).join(" ");
    const candidates = index.byNamePosition.get(`${normalizeName(name)}|${pos}`) || [];
    if (!candidates.length) return { status: "unmatched", reason: "No exact name/position match" };
    if (candidates.length === 1) return { status: "exact", market: candidates[0] };

    const team = normalizeTeam(player?.team);
    const teamMatches = candidates.filter((row) => team && row.team === team);
    if (teamMatches.length === 1) return { status: "verified", market: teamMatches[0] };
    return { status: "ambiguous", reason: `${candidates.length} exact-name candidates` };
  }

  function countSlots(slots) {
    const counts = {};
    for (const slot of slots || []) {
      if (slot !== "BN") counts[slot] = (counts[slot] || 0) + 1;
    }
    return counts;
  }

  function leagueContext(league) {
    const teams = number(league?.total_rosters) || 12;
    const scoring = league?.scoring_settings || {};
    const counts = countSlots(league?.roster_positions || []);
    const flex = number(counts.FLEX) + number(counts.REC_FLEX) + number(counts.WRRB_FLEX);
    const idpFlex = number(counts.IDP_FLEX);
    const teamPressure = Math.max(0, teams - 12) * 3;
    const dedicated = {
      QB: number(counts.QB),
      RB: number(counts.RB),
      WR: number(counts.WR),
      TE: number(counts.TE),
      DL: number(counts.DL) + number(counts.DE) + number(counts.DT),
      LB: number(counts.LB),
      DB: number(counts.DB) + number(counts.CB) + number(counts.S),
    };
    const structural = {
      QB: 100 + teamPressure + number(counts.SUPER_FLEX) * 28 + Math.max(0, dedicated.QB - 1) * 15,
      RB: 100 + teamPressure + Math.max(0, dedicated.RB - 2) * 7 + flex * 4,
      WR: 100 + teamPressure + Math.max(0, dedicated.WR - 2) * 7 + flex * 5,
      TE: 100 + teamPressure + Math.max(0, dedicated.TE - 1) * 10 + flex * 2,
    };
    const ppr = number(scoring.rec);
    const teBonus = number(scoring.bonus_rec_te) + Math.max(0, number(scoring.rec_te) - ppr);
    const scoringPressure = {
      QB: Math.max(0, number(scoring.pass_td || 4) - 4) * 4,
      RB: ppr * 2,
      WR: ppr * 5,
      TE: teBonus * 15,
    };
    const idpKeys = Object.keys(scoring).filter((key) =>
      /tkl|sack|int|ff|fum|def|qb_hit|pass_def|ast/.test(key),
    );
    const idpBase = 100 + teamPressure + Math.min(15, idpKeys.length * 0.4);
    const values = {};
    for (const pos of OFFENSE) {
      values[pos] = {
        structuralScore: round(structural[pos]),
        scoringScore: round(scoringPressure[pos]),
        score: round(structural[pos] + scoringPressure[pos]),
        demand: round(
          teams *
            (dedicated[pos] +
              (pos === "QB" ? number(counts.SUPER_FLEX) : flex * ({ RB: 0.34, WR: 0.5, TE: 0.16 }[pos] || 0))),
        ),
      };
    }
    for (const pos of ["DL", "LB", "DB"]) {
      values[pos] = {
        structuralScore: round(idpBase + dedicated[pos] * 5 + idpFlex * 3),
        scoringScore: 0,
        score: round(idpBase + dedicated[pos] * 5 + idpFlex * 3),
        demand: teams * dedicated[pos],
        availability: "context-only",
      };
    }
    return { teams, counts, flex, idpFlex, idpKeys, values };
  }

  function structuralLeagueDelta(pos, context) {
    const rule = STRUCTURAL_RULES[pos] || { rate: 0, up: 0, down: 0 };
    const pressure = number(context?.values?.[pos]?.structuralScore || 100) - 100;
    return clamp(pressure * rule.rate, -rule.down, rule.up);
  }

  function paidValueEligibility() {
    return {
      ...PAID_VALUE_ELIGIBILITY_CONTRACT,
      safe_context_surfaces: [...PAID_VALUE_ELIGIBILITY_CONTRACT.safe_context_surfaces],
    };
  }

  function compactAgeDelta(pos, age) {
    if (!Number.isFinite(age)) return 0;
    if (pos === "QB") {
      if (age < 25) return 0.06;
      if (age < 29) return 0.03;
      if (age < 32) return 0;
      if (age < 35) return -0.05;
      return -0.1;
    }
    if (pos === "RB") {
      if (age < 24) return 0.05;
      if (age < 27) return 0.01;
      if (age < 29) return -0.06;
      return -0.13;
    }
    if (pos === "WR") {
      if (age < 24) return 0.05;
      if (age < 28) return 0.02;
      if (age < 31) return -0.03;
      return -0.09;
    }
    if (pos === "TE") {
      if (age < 25) return 0.04;
      if (age < 29) return 0.02;
      if (age < 32) return -0.03;
      return -0.08;
    }
    return 0;
  }

  function rookieFloorFromEcr(ecr, pos) {
    if (!Number.isFinite(ecr) || ecr <= 0) return 0;
    const bump = { QB: 1.08, RB: 1, WR: 1.02, TE: 0.92 }[pos] || 1;
    return Math.round(9000 * Math.exp(-0.034 * (ecr - 1)) * bump);
  }

  function rookieDraftCapitalFloor(player, pos) {
    if (number(player?.years_exp) > 0) return 0;
    const draftRound = number(player?.draft_round);
    const draftPick = number(player?.draft_pick);
    let floor = { 1: 5200, 2: 3600, 3: 2400, 4: 1500, 5: 900, 6: 600, 7: 400 }[draftRound] || 0;
    if (draftRound === 1 && draftPick) floor += Math.max(0, 1800 - (draftPick - 1) * 55);
    if (pos === "QB") floor *= 1.1;
    if (pos === "TE") floor *= 0.95;
    return Math.round(floor);
  }

  function applyRookieFloor(base, player, market) {
    if (number(player?.years_exp) > 0) return { value: base, floor: 0, applied: false };
    const pos = positionOf(player);
    const floor = Math.max(
      rookieFloorFromEcr(number(market?.ecr), pos),
      rookieDraftCapitalFloor(player, pos),
    );
    return { value: Math.max(base, floor), floor, applied: floor > base };
  }

  function heuristicConfidence(base, ecr) {
    if (!base || !Number.isFinite(ecr) || ecr <= 0) return { label: "Limited heuristic", gap: null };
    const expected = Math.round(10500 * Math.exp(-0.018 * (ecr - 1)));
    const gap = Math.abs(base - expected) / Math.max(base, expected);
    return {
      label: gap < 0.12 ? "High heuristic agreement" : gap < 0.25 ? "Moderate heuristic agreement" : "Market/ECR disagreement",
      gap: round(gap, 3),
    };
  }

  function calculateValuation(input) {
    const { player, market, context, tradeCount = 0 } = input;
    const pos = positionOf(player);
    const rookie = applyRookieFloor(number(market?.base), player, market);
    const age = compactAgeDelta(pos, market?.age);
    const league = structuralLeagueDelta(pos, context);
    const totalAdjustment = clamp(age + league, -0.25, 0.35);
    const finalValue = Math.max(0, Math.round(rookie.value * (1 + totalAdjustment)));
    return {
      marketBaseline: number(market?.base),
      marketFormat: market?.format || "unknown",
      rookieFloor: rookie.floor,
      rookieApplied: rookie.applied,
      adjustedBaseline: rookie.value,
      ageAdjustment: round(age, 4),
      leagueAdjustment: round(league, 4),
      totalAdjustment: round(totalAdjustment, 4),
      finalValue,
      paidValueEligibility: paidValueEligibility(),
      confidence: heuristicConfidence(number(market?.base), market?.ecr),
      tradeActivity: { count: number(tradeCount), appliedToValue: false },
    };
  }

  function buildPickInventory(rosters, tradedPicks, seasons, rounds) {
    const picks = [];
    for (const season of seasons) {
      for (let roundNumber = 1; roundNumber <= rounds; roundNumber += 1) {
        for (const roster of rosters || []) {
          picks.push({
            season: String(season),
            round: roundNumber,
            originalRosterId: roster.roster_id,
            ownerRosterId: roster.roster_id,
          });
        }
      }
    }
    for (const traded of tradedPicks || []) {
      const pick = picks.find(
        (candidate) =>
          candidate.season === String(traded.season) &&
          candidate.round === number(traded.round) &&
          candidate.originalRosterId === number(traded.roster_id),
      );
      if (pick) pick.ownerRosterId = number(traded.owner_id);
    }
    return picks;
  }

  return {
    OFFENSE,
    IDP,
    number,
    clamp,
    round,
    positionOf,
    isOffense,
    isIdp,
    marketFormat,
    normalizeName,
    normalizeTeam,
    parseCsv,
    parseMarketRows,
    buildIdentityIndex,
    matchPlayerIdentity,
    countSlots,
    leagueContext,
    structuralLeagueDelta,
    paidValueEligibility,
    compactAgeDelta,
    rookieFloorFromEcr,
    rookieDraftCapitalFloor,
    applyRookieFloor,
    heuristicConfidence,
    calculateValuation,
    buildPickInventory,
  };
});
