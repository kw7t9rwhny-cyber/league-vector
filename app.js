(function () {
  "use strict";

  const Core = window.LeagueVectorCore;
  const Data = window.LeagueVectorData;
  const $ = (id) => document.getElementById(id);
  let activeController = null;
  let analysisSequence = 0;

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);

  function leagueIdFrom(value) {
    const matches = String(value).match(/\d{8,}/g);
    return matches ? matches.at(-1) : "";
  }

  function cleanSlot(slot) {
    return ({ SUPER_FLEX: "SF", REC_FLEX: "FLEX", WRRB_FLEX: "FLEX", IDP_FLEX: "IDP", DEF: "DST" }[slot] || slot || "?").replace("_FLEX", "");
  }

  function playerName(player, id) {
    return player?.full_name || [player?.first_name, player?.last_name].filter(Boolean).join(" ") || `Unknown Player (${id})`;
  }

  function percent(value) {
    const rounded = Math.round(Core.number(value) * 100);
    return `${rounded > 0 ? "+" : ""}${rounded}%`;
  }

  function setStatus(message, type = "") {
    $("status").className = `status ${type}`.trim();
    $("status").textContent = message;
  }

  function warning(message) {
    const item = document.createElement("li");
    item.textContent = message;
    $("warningList").append(item);
    $("analysisWarnings").hidden = false;
  }

  async function loadOverrides(signal) {
    try {
      return (await Data.request("data/player-overrides.json", { signal, ttlMs: 5 * 60 * 1000 })).value || {};
    } catch { return {}; }
  }

  async function loadCrosswalk(signal) {
    try {
      return (await Data.request("data/player-crosswalk.json", { signal, ttlMs: 5 * 60 * 1000 })).value || {};
    } catch { return {}; }
  }

  function scoringProfile(scoring = {}) {
    const reception = Core.number(scoring.rec);
    const chips = [reception > 0 ? `${reception} PPR` : "Standard receptions"];
    if (scoring.pass_td != null) chips.push(`${scoring.pass_td} pt Pass TD`);
    const tightEndPremium = Core.number(scoring.bonus_rec_te) + Math.max(0, Core.number(scoring.rec_te) - reception);
    if (tightEndPremium > 0) chips.push(`TE Premium +${tightEndPremium}`);
    if (Object.keys(scoring).some((key) => /tkl|sack|int|ff|fum|def|qb_hit|pass_def|ast/.test(key))) chips.push("IDP scoring");
    return chips;
  }

  function valueCard(position, data) {
    const width = Math.min(100, Math.max(12, ((data.score - 70) / 80) * 100));
    const label = data.score >= 135 ? "Extreme pressure" : data.score >= 120 ? "High pressure" : data.score >= 108 ? "Elevated" : data.score >= 95 ? "Neutral" : "Reduced";
    return `<article class="value-card"><h3>${escapeHtml(position)}</h3><div class="value-number">${data.score}</div><div class="value-label">${label}</div><div class="value-bar" aria-hidden="true"><div class="value-fill" style="width:${width}%"></div></div><div class="value-note"><span class="demand">${data.demand}</span> estimated league-wide starter opportunities.<br>Structural pressure ${data.structuralScore}; scoring contribution ${data.scoringScore}.</div></article>`;
  }

  function isPaidValueEligible(value) {
    const eligibility = value?.components?.paidValueEligibility;
    return eligibility?.state === "PAID_VALUE_ELIGIBLE"
      && eligibility?.numeric_offensive_paid_value_available === true
      && eligibility?.projection_policy === "CONTEXT_ONLY_NOT_IN_VALUATION";
  }

  function valuationCard(value, rank) {
    if (!isPaidValueEligible(value)) {
      return `<article class="player-card" data-paid-value-state="PAID_VALUE_INELIGIBLE"><div class="rank">—</div><div><div class="pv-name">${escapeHtml(value.name)}</div><div class="availability-warning">Paid value unavailable because its eligibility contract is unsatisfied. No numeric value was emitted.</div></div></article>`;
    }
    const components = value.components;
    return `<article class="player-card" data-paid-value-state="${components.paidValueEligibility.state}"><div class="rank">#${rank}</div><div><div class="pv-name">${escapeHtml(value.name)}</div><div class="pv-meta">${escapeHtml(value.pos)} • ${escapeHtml(value.team)}${value.age ? ` • Age ${value.age}` : ""} • ${components.marketFormat.toUpperCase()} baseline</div><div class="signal-row"><span class="signal">Market ${components.marketBaseline.toLocaleString()}</span><span class="${components.ageAdjustment < 0 ? "signal bad" : "signal good"}">Age ${percent(components.ageAdjustment)}</span><span class="${components.leagueAdjustment < 0 ? "signal bad" : "signal good"}">League structure ${percent(components.leagueAdjustment)}</span><span class="signal warning">Weekly projections excluded from paid value</span>${components.rookieApplied ? `<span class="signal good">Rookie floor ${components.rookieFloor.toLocaleString()}</span>` : ""}${components.tradeActivity.count ? `<span class="signal">${components.tradeActivity.count} local trade${components.tradeActivity.count === 1 ? "" : "s"} • informational</span>` : ""}</div></div><div class="pv-values"><div class="lv-value">${components.finalValue.toLocaleString()}</div><div class="market-value">Net ${percent(components.totalAdjustment)}</div><div class="confidence">${escapeHtml(components.confidence.label)}</div></div></article>`;
  }

  function playerRow(id, players, slot, valuation) {
    const player = players[id];
    return `<div class="player">${slot ? `<span class="slot">${escapeHtml(cleanSlot(slot))}</span>` : ""}<span class="pos">${escapeHtml(Core.positionOf(player))}</span><span class="player-name">${escapeHtml(playerName(player, id))}</span>${isPaidValueEligible(valuation) ? `<span class="roster-value">LV ${valuation.components.finalValue.toLocaleString()}</span>` : `<span class="nfl-team">${escapeHtml(player?.team || "FA")}</span>`}</div>`;
  }

  function tradeCounts(transactions) {
    const counts = {};
    for (const transaction of transactions || []) {
      if (transaction?.type !== "trade" || transaction?.status !== "complete") continue;
      const ids = new Set([...Object.keys(transaction.adds || {}), ...Object.keys(transaction.drops || {})]);
      for (const id of ids) counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }

  function teamAnalyses(rosters, players, valuationsById, pickInventory) {
    const positionTotals = {};
    const teams = rosters.map((roster) => {
      const starterIds = new Set((roster.starters || []).filter((id) => id && id !== "0"));
      const offensiveIds = (roster.players || []).filter((id) => Core.isOffense(Core.positionOf(players[id])));
      const idpIds = (roster.players || []).filter((id) => Core.isIdp(Core.positionOf(players[id])));
      const matched = offensiveIds.filter((id) => isPaidValueEligible(valuationsById[id]));
      const sum = (ids, selector) => ids.reduce((total, id) => total + Core.number(selector(valuationsById[id])), 0);
      const positional = {};
      for (const pos of Core.OFFENSE) {
        positional[pos] = sum(matched.filter((id) => Core.positionOf(players[id]) === pos), (value) => value.components.finalValue);
        positionTotals[pos] ||= [];
        positionTotals[pos].push(positional[pos]);
      }
      return {
        roster, offensiveIds, idpIds, matched,
        marketValue: sum(matched, (value) => value.components.marketBaseline),
        leagueValue: sum(matched, (value) => value.components.finalValue),
        starterValue: sum(matched.filter((id) => starterIds.has(id)), (value) => value.components.finalValue),
        benchValue: sum(matched.filter((id) => !starterIds.has(id)), (value) => value.components.finalValue),
        completeness: offensiveIds.length ? Math.round((matched.length / offensiveIds.length) * 100) : 100,
        picks: pickInventory.filter((pick) => pick.ownerRosterId === roster.roster_id), positional,
      };
    });
    const averages = Object.fromEntries(Object.entries(positionTotals).map(([pos, values]) => [pos, values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)]));
    for (const team of teams) {
      const comparisons = Core.OFFENSE.map((pos) => ({ pos, ratio: averages[pos] ? team.positional[pos] / averages[pos] : 0 })).sort((a, b) => b.ratio - a.ratio);
      team.strength = comparisons[0]?.pos || "—";
      team.weakness = comparisons.at(-1)?.pos || "—";
    }
    return teams;
  }

  function renderTeamAnalysis(analyses, userMap) {
    $("teamAnalysis").innerHTML = analyses.sort((a, b) => b.leagueValue - a.leagueValue).map((team) => {
      const owner = userMap[team.roster.owner_id];
      const name = owner?.metadata?.team_name || owner?.display_name || `Roster ${team.roster.roster_id}`;
      const picks = team.picks
        .sort((a, b) => Number(a.season) - Number(b.season) || a.round - b.round)
        .map((pick) => `${pick.season} R${pick.round}${pick.originalRosterId !== team.roster.roster_id ? ` (from ${pick.originalRosterId})` : ""}`)
        .join(" • ");
      return `<article class="team-analysis-card"><h3>${escapeHtml(name)}</h3><div class="metric-grid"><div><span>Offensive market</span><b>${team.marketValue.toLocaleString()}</b></div><div><span>Offensive LV</span><b>${team.leagueValue.toLocaleString()}</b></div><div><span>Starters</span><b>${team.starterValue.toLocaleString()}</b></div><div><span>Bench/depth</span><b>${team.benchValue.toLocaleString()}</b></div></div><p class="team-insight">Relative strength: ${team.strength} • Relative weakness: ${team.weakness}</p><p class="team-insight">${team.picks.length} future picks tracked • ${team.completeness}% offensive match completeness</p><details class="pick-details"><summary>Future-pick inventory</summary><p>${escapeHtml(picks || "No tracked picks")}</p></details><p class="availability-warning">IDP value unavailable: ${team.idpIds.length} defensive players excluded from numeric totals.</p></article>`;
    }).join("");
  }

  function renderRosters(rosters, players, valuationsById, userMap, starterSlots) {
    $("teams").innerHTML = [...rosters].sort((a, b) => a.roster_id - b.roster_id).map((roster) => {
      const owner = userMap[roster.owner_id];
      const name = owner?.metadata?.team_name || owner?.display_name || `Roster ${roster.roster_id}`;
      const starters = (roster.starters || []).filter((id) => id && id !== "0");
      const starterSet = new Set(starters);
      const bench = (roster.players || []).filter((id) => !starterSet.has(id));
      return `<article class="team"><h3>${escapeHtml(name)}</h3><div class="owner">${escapeHtml(owner?.display_name || "Unknown owner")} • Roster ${roster.roster_id}</div><div class="team-stats"><span class="pill">${(roster.players || []).length} players</span><span class="pill">${starters.length} starters</span><span class="pill">${bench.length} bench</span><span class="pill">${(roster.taxi || []).length} taxi</span><span class="pill">${(roster.reserve || []).length} IR</span></div><div class="label">Starting lineup</div>${starters.map((id, index) => playerRow(id, players, starterSlots[index], valuationsById[id])).join("") || `<div class="more">No starters currently set.</div>`}<div class="label">Bench preview</div>${bench.slice(0, 8).map((id) => playerRow(id, players, null, valuationsById[id])).join("") || `<div class="more">No bench players.</div>`}${bench.length > 8 ? `<div class="more">+ ${bench.length - 8} more bench players</div>` : ""}</article>`;
    }).join("");
  }

  async function analyze() {
    const leagueId = leagueIdFrom($("leagueId").value);
    if (!leagueId) return setStatus("Enter a valid Sleeper league ID.", "error");
    if (activeController) activeController.abort();
    activeController = new AbortController();
    const sequence = ++analysisSequence;
    const { signal } = activeController;
    $("go").disabled = true;
    $("results").hidden = true;
    $("analysisWarnings").hidden = true;
    $("warningList").replaceChildren();

    try {
      setStatus("Loading league, rosters, cached players and market data…");
      const [bundle, marketResult, overrides, crosswalk] = await Promise.all([
        Data.leagueBundle(leagueId, signal),
        Data.marketData(signal),
        loadOverrides(signal),
        loadCrosswalk(signal),
      ]);
      if (sequence !== analysisSequence) return;
      const { league, users, rosters, players, tradedPicks, state } = bundle;
      const format = Core.marketFormat(league);
      const context = Core.leagueContext(league);
      const season = Number(league.season) || Number(state?.league_season) || new Date().getFullYear();
      const maxRound = Math.max(18, Core.number(state?.leg), Core.number(league?.settings?.playoff_week_start) + 3);

      setStatus("Calculating paid values and scanning explicit transaction rounds…");
      const transactionResult = await Data.transactionHistory(leagueId, maxRound, signal);
      if (sequence !== analysisSequence) return;
      if (transactionResult.failures.length) warning(`${transactionResult.failures.length} transaction rounds failed and local trade counts may be incomplete.`);

      const marketRows = Core.parseMarketRows(Core.parseCsv(marketResult.value), format);
      const identityIndex = Core.buildIdentityIndex(marketRows);
      const localTradeCounts = tradeCounts(transactionResult.transactions);
      const rosteredIds = [...new Set(rosters.flatMap((roster) => roster.players || []))];
      const identityReport = { crosswalk: 0, exact: 0, verified: 0, manual: 0, unmatched: 0, ambiguous: 0 };
      const valuations = [];
      for (const id of rosteredIds) {
        const player = players[id];
        if (!Core.isOffense(Core.positionOf(player))) continue;
        const match = Core.matchPlayerIdentity(id, player, identityIndex, overrides, crosswalk);
        identityReport[match.status] = (identityReport[match.status] || 0) + 1;
        if (!match.market) continue;
        const components = Core.calculateValuation({ player, market: match.market, context, tradeCount: localTradeCounts[id] });
        const valuation = { id, name: playerName(player, id), pos: Core.positionOf(player), team: player?.team || match.market.team || "FA", age: match.market.age, matchStatus: match.status, components };
        if (isPaidValueEligible(valuation)) valuations.push(valuation);
      }
      valuations.sort((a, b) => b.components.finalValue - a.components.finalValue);
      const valuationsById = Object.fromEntries(valuations.map((value) => [value.id, value]));
      const userMap = Object.fromEntries(users.map((user) => [user.user_id, user]));
      const starterSlots = (league.roster_positions || []).filter((slot) => slot !== "BN");
      const rounds = Core.number(league?.settings?.draft_rounds) || 6;
      const pickInventory = Core.buildPickInventory(rosters, tradedPicks, [season, season + 1, season + 2].map(String), rounds);
      const analyses = teamAnalyses(rosters, players, valuationsById, pickInventory);

      $("name").textContent = league.name || "Sleeper League";
      $("count").textContent = rosters.length;
      $("season").textContent = league.season || "—";
      $("leagueStarters").textContent = starterSlots.length * rosters.length;
      $("marketFormat").textContent = format === "2qb" ? "Superflex / 2QB" : "1QB";
      $("lineupChips").innerHTML = Object.entries(Core.countSlots(league.roster_positions || [])).map(([slot, count]) => `<span class="chip ${slot.includes("FLEX") ? "hot" : ""}">${count}× ${escapeHtml(cleanSlot(slot))}</span>`).join("");
      $("lineupNote").textContent = `${starterSlots.length} starters per team across ${rosters.length} teams. Market format selected automatically: ${format.toUpperCase()}.`;
      $("scoringChips").innerHTML = scoringProfile(league.scoring_settings).map((chip) => `<span class="chip hot">${escapeHtml(chip)}</span>`).join("");
      $("scoringNote").textContent = `${Object.keys(league.scoring_settings || {}).length} total settings imported for league context and separately labeled experimental projections.`;
      $("valueGrid").innerHTML = ["QB", "RB", "WR", "TE", "DL", "LB", "DB"].map((pos) => valueCard(pos, context.values[pos])).join("");
      $("valueExplanation").textContent = "Paid offensive value uses the market baseline, applicable rookie floor, age and structural league pressure. The legacy weekly projection adjustment is intentionally excluded from paid-beta valuation.";
      $("identityStatus").textContent = `${valuations.length} offensive players valued • ${identityReport.crosswalk} stable-ID crosswalk • ${identityReport.exact} exact • ${identityReport.verified} team-verified • ${identityReport.manual} manual • ${identityReport.unmatched} unmatched • ${identityReport.ambiguous} ambiguous.`;
      $("scoringCoverage").textContent = "Not applied to paid value. League scoring may be inspected here and with separately labeled experimental projections, but no weekly projection score changes an ordinary paid dynasty value.";
      $("projectionStatus").textContent = "CONTEXT_ONLY_NOT_IN_VALUATION • The undocumented legacy Sleeper weekly projection source is excluded and is not requested during paid-value analysis.";
      $("transactionStatus").textContent = `Rounds ${transactionResult.roundsScanned[0]}–${transactionResult.roundsScanned.at(-1)} scanned • ${transactionResult.transactions.filter((transaction) => transaction?.type === "trade" && transaction?.status === "complete").length} completed trades • picks shown without fabricated numeric values.`;
      $("playerValues").innerHTML = valuations.length ? valuations.slice(0, 60).map((value, index) => valuationCard(value, index + 1)).join("") : `<p class="availability-warning">No offensive market-value matches were found.</p>`;
      renderTeamAnalysis(analyses, userMap);
      renderRosters(rosters, players, valuationsById, userMap, starterSlots);
      const eligibility = Core.paidValueEligibility();
      const eligibilityElement = $("paidValueEligibility");
      eligibilityElement.dataset.state = eligibility.state;
      eligibilityElement.dataset.contractVersion = eligibility.contract_version;
      eligibilityElement.dataset.projectionPolicy = eligibility.projection_policy;
      eligibilityElement.textContent = `${eligibility.state} — Offensive paid values remain available because the legacy weekly projection adjustment is intentionally excluded. You may safely inspect league/scoring inputs and the separately labeled experimental projection board. No missing projection was replaced with zero and no projection coverage was fabricated.`;
      $("results").dataset.paidValueState = eligibility.state;
      $("results").dataset.projectionPolicy = eligibility.projection_policy;
      window.__leagueVectorPaidValueEligibility = eligibility;
      $("dataQuality").textContent = `Weekly projections are context only and cannot alter paid value. IDP numeric valuation remains unavailable by design. Player cache: ${bundle.cacheSources.players}. Market cache: ${marketResult.source}.`;
      $("results").hidden = false;
      setStatus("✓ League Vector v0.8 foundation calculated — paid value eligible.", "success");
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error(error);
      setStatus(`Could not analyze league: ${error.message}`, "error");
    } finally {
      if (sequence === analysisSequence) $("go").disabled = false;
    }
  }

  $("go").addEventListener("click", analyze);
  $("leagueId").addEventListener("keydown", (event) => { if (event.key === "Enter") analyze(); });
})();
