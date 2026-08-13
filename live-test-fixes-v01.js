(function (root, factory) {
  const Core = typeof module === "object" && module.exports
    ? require("./core-v08.js")
    : root.LeagueVectorCore;
  const api = factory(Core);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LeagueVectorLiveFixes = api;
  if (root.document && Core) api.install(root.document);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Core) {
  "use strict";

  const IDP_POSITIONS = ["DL", "LB", "DB"];

  const number = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const round = (value, digits = 0) => {
    const scale = 10 ** digits;
    return Math.round(number(value) * scale) / scale;
  };

  function idpDedicatedCounts(counts = {}) {
    return {
      DL: number(counts.DL) + number(counts.DE) + number(counts.DT),
      LB: number(counts.LB) + number(counts.ILB) + number(counts.OLB),
      DB: number(counts.DB) + number(counts.CB) + number(counts.S),
    };
  }

  function correctedLeagueContext(league, originalLeagueContext = Core?.leagueContext) {
    if (typeof originalLeagueContext !== "function") throw new Error("League Vector core leagueContext is unavailable.");
    const context = originalLeagueContext(league);
    const teams = number(context.teams) || number(league?.total_rosters) || 12;
    const counts = context.counts || Core.countSlots(league?.roster_positions || []);
    const dedicated = idpDedicatedCounts(counts);
    const idpFlex = number(counts.IDP_FLEX);
    const teamPressure = Math.max(0, teams - 12) * 3;
    const sharedFlexSlotsPerPosition = idpFlex / IDP_POSITIONS.length;
    const idpScoringPresent = (context.idpKeys || []).length > 0;

    for (const position of IDP_POSITIONS) {
      const dedicatedSlots = dedicated[position];
      const hasIdpDemand = dedicatedSlots > 0 || idpFlex > 0;
      const flexDemandShare = teams * sharedFlexSlotsPerPosition;
      const structuralScore = hasIdpDemand
        ? 100 + teamPressure + dedicatedSlots * 5 + sharedFlexSlotsPerPosition * 5
        : 100;

      context.values[position] = {
        ...(context.values[position] || {}),
        structuralScore: round(structuralScore),
        scoringScore: 0,
        score: round(structuralScore),
        demand: round(teams * dedicatedSlots + flexDemandShare),
        dedicatedDemand: teams * dedicatedSlots,
        flexDemandShare,
        sharedFlexSlotsPerPosition,
        scoringContributionStatus: idpScoringPresent ? "not-modeled" : "not-applicable",
        availability: hasIdpDemand ? "context-only" : "not-started",
      };
    }

    context.idpPressureAudit = {
      method: "dedicated-plus-shared-idp-flex",
      idpFlex,
      sharedFlexSlotsPerPosition,
      totalFlexibleDemand: teams * idpFlex,
      scoringContributionStatus: idpScoringPresent ? "not-modeled" : "not-applicable",
    };
    return context;
  }

  function categoryForKey(key) {
    const value = String(key || "");
    if (/^(pass_|bonus_pass)/.test(value)) return "Passing";
    if (/^(rush_|bonus_rush)/.test(value)) return "Rushing";
    if (/^(rec|bonus_rec)/.test(value)) return "Receiving";
    if (/(?:^|_)(?:tkl|tkl_solo|tkl_ast|tkl_loss|ast)(?:_|$)/.test(value)) return "IDP tackles";
    if (/(?:sack|qb_hit)/.test(value)) return "IDP sacks / pressure";
    if (/(?:^idp_|^)(?:int|ff|fum_rec|def_td|safe|pass_def)/.test(value) || /(?:_int|_ff|_fum_rec|_def_td|_safe|_pass_def)/.test(value)) return "IDP turnovers / plays";
    if (/^(fg|xpm|kick)/.test(value)) return "Kicking";
    if (/(?:kr|pr)_yd|return/.test(value)) return "Returns";
    if (/pts_allow|def_st|st_/.test(value)) return "Team defense / special teams";
    if (/fum/.test(value)) return "Fumbles";
    return "Other bonuses / settings";
  }

  function uniqueCategories(keys) {
    return [...new Set((keys || []).filter(Boolean).map(categoryForKey))];
  }

  function parseCoverageText(text) {
    const raw = String(text || "");
    const appliedMatch = raw.match(/Applied keys:\s*([\s\S]*?)(?:Unsupported\/non-matching keys:|$)/i);
    const unsupportedMatch = raw.match(/Unsupported\/non-matching keys:\s*([\s\S]*)$/i);
    const split = (value) => String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && item !== "none" && item !== "none detected");
    return {
      applied: split(appliedMatch?.[1]),
      unsupported: split(unsupportedMatch?.[1]),
    };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function enhanceScoringCoverage(document) {
    const element = document.getElementById("scoringCoverage");
    if (!element || element.dataset.liveFixScoring === "1") return;
    const parsed = parseCoverageText(element.textContent);
    if (!parsed.applied.length && !parsed.unsupported.length) return;
    const denominator = parsed.applied.length + parsed.unsupported.length;
    const coverage = denominator ? Math.round((parsed.applied.length / denominator) * 100) : 100;
    const appliedCategories = uniqueCategories(parsed.applied);
    const unsupportedCategories = uniqueCategories(parsed.unsupported);
    element.innerHTML = [
      `<b>Legacy scoring-key coverage:</b> ${coverage}%`,
      `<br><b>Applied categories:</b> ${escapeHtml(appliedCategories.join(", ") || "none")}`,
      `<br><b>Unsupported categories:</b> ${escapeHtml(unsupportedCategories.join(", ") || "none detected")}`,
      `<details><summary>Show technical scoring keys</summary><p><b>Applied:</b> ${escapeHtml(parsed.applied.join(", ") || "none")}<br><b>Unsupported/non-matching:</b> ${escapeHtml(parsed.unsupported.join(", ") || "none detected")}</p></details>`,
    ].join("");
    element.dataset.liveFixScoring = "1";
  }

  function enhanceProjectionStatus(document) {
    const element = document.getElementById("projectionStatus");
    if (!element || element.dataset.liveFixProjection === "1") return;
    const raw = element.textContent.trim();
    if (!/weekly player rows/i.test(raw)) return;
    const available = /^complete\b/i.test(raw);
    element.innerHTML = `<b>Legacy production source:</b> ${available ? "Available" : "Partial"} <span class="availability-warning">(undocumented, replaceable)</span><br><b>Experimental League Vector v0.3:</b> see experimental projection panel below.<details><summary>Technical details</summary><p>${escapeHtml(raw)}</p></details>`;
    element.dataset.liveFixProjection = "1";
  }

  function enhanceIdpPressureCards(document) {
    for (const card of document.querySelectorAll("#valueGrid .value-card")) {
      const position = card.querySelector("h3")?.textContent?.trim();
      if (!IDP_POSITIONS.includes(position) || card.dataset.liveFixIdp === "1") continue;
      const note = card.querySelector(".value-note");
      if (note) note.innerHTML = note.innerHTML.replace(/scoring contribution\s+0\.?/i, "IDP scoring contribution not yet modeled.");
      card.dataset.liveFixIdp = "1";
    }
  }

  function enhanceIdpDynastyMessages(document) {
    for (const element of document.querySelectorAll(".availability-warning")) {
      if (!/^IDP value unavailable:/i.test(element.textContent.trim()) || element.dataset.liveFixIdpMessage === "1") continue;
      element.textContent += " IDP experimental production projections are available separately where v0.3 coverage exists.";
      element.dataset.liveFixIdpMessage = "1";
    }
  }

  function applyUserFacingEnhancements(document) {
    enhanceScoringCoverage(document);
    enhanceProjectionStatus(document);
    enhanceIdpPressureCards(document);
    enhanceIdpDynastyMessages(document);
  }

  function ensureDynastySearchLoaded(document) {
    if (document.querySelector('script[data-league-vector-dynasty-search="1"]')) return;
    const script = document.createElement("script");
    script.src = "dynasty-search-v01.js?v=0.1";
    script.defer = true;
    script.dataset.leagueVectorDynastySearch = "1";
    document.head.append(script);
  }

  function install(document) {
    if (!Core || Core.__liveTestFixV01Installed) return;
    const originalLeagueContext = Core.leagueContext.bind(Core);
    Core.leagueContext = (league) => correctedLeagueContext(league, originalLeagueContext);
    Core.__liveTestFixV01Installed = true;

    const runEnhancements = () => applyUserFacingEnhancements(document);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", runEnhancements, { once: true });
    else runEnhancements();
    ensureDynastySearchLoaded(document);
    const observer = new MutationObserver(runEnhancements);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  return {
    IDP_POSITIONS,
    idpDedicatedCounts,
    correctedLeagueContext,
    categoryForKey,
    uniqueCategories,
    parseCoverageText,
    applyUserFacingEnhancements,
    ensureDynastySearchLoaded,
    install,
  };
});
