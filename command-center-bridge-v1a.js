(() => {
  "use strict";

  const Core = window.LeagueVectorCore;
  const Data = window.LeagueVectorData;
  const leagueInput = document.querySelector("#leagueId");
  const submitButton = document.querySelector("#go");
  const status = document.querySelector("#status");
  const results = document.querySelector("#results");
  if (!Core || !Data || !leagueInput || !submitButton || !status || !results) return;

  const state = {
    leagueId: "",
    bundle: null,
    projectionResult: null,
    pickInventory: [],
    valuationsById: new Map(),
    playerIds: new WeakMap(),
    readySignature: "",
    errorSignature: "",
    readyScheduled: false,
  };

  const leagueIdFrom = (value) => {
    const matches = String(value).match(/\d{8,}/g);
    return matches ? matches.at(-1) : "";
  };

  const emit = (name, detail = {}) => {
    window.dispatchEvent(new CustomEvent(`leaguevector:${name}`, { detail }));
  };

  const reset = () => {
    state.leagueId = leagueIdFrom(leagueInput.value);
    state.bundle = null;
    state.projectionResult = null;
    state.pickInventory = [];
    state.valuationsById = new Map();
    state.playerIds = new WeakMap();
    state.readySignature = "";
    state.errorSignature = "";
    state.readyScheduled = false;
    emit("analysis-start", { leagueId: state.leagueId });
  };

  const originalLeagueBundle = Data.leagueBundle.bind(Data);
  Data.leagueBundle = async (...args) => {
    const bundle = await originalLeagueBundle(...args);
    state.leagueId = String(args[0] || state.leagueId);
    state.bundle = bundle;
    for (const [id, player] of Object.entries(bundle?.players || {})) {
      if (player && typeof player === "object") state.playerIds.set(player, id);
    }
    return bundle;
  };

  const originalSeasonProjections = Data.seasonProjections.bind(Data);
  Data.seasonProjections = async (...args) => {
    const result = await originalSeasonProjections(...args);
    state.projectionResult = result;
    return result;
  };

  const originalCalculateValuation = Core.calculateValuation.bind(Core);
  Core.calculateValuation = (input) => {
    const components = originalCalculateValuation(input);
    const id = state.playerIds.get(input?.player);
    if (id) {
      state.valuationsById.set(id, {
        components,
        projectionAvailable: Boolean(input?.projection),
      });
    }
    return components;
  };

  const originalBuildPickInventory = Core.buildPickInventory.bind(Core);
  Core.buildPickInventory = (...args) => {
    const inventory = originalBuildPickInventory(...args);
    state.pickInventory = inventory;
    return inventory;
  };

  const teamName = (roster, userMap) => {
    const owner = userMap[roster.owner_id];
    return owner?.metadata?.team_name || owner?.display_name || `Roster ${roster.roster_id}`;
  };

  const numberFromText = (text, pattern) => Number(String(text || "").match(pattern)?.[1] || 0);

  const buildDetail = () => {
    const { league, users = [], rosters = [], players = {} } = state.bundle || {};
    if (!league || !rosters.length) return null;
    const userMap = Object.fromEntries(users.map((user) => [user.user_id, user]));
    const positionTotals = {};
    const teams = rosters.map((roster) => {
      const starterIds = new Set((roster.starters || []).filter((id) => id && id !== "0"));
      const offensiveIds = (roster.players || []).filter((id) => Core.isOffense(Core.positionOf(players[id])));
      const idpIds = (roster.players || []).filter((id) => Core.isIdp(Core.positionOf(players[id])));
      const matched = offensiveIds.filter((id) => state.valuationsById.has(id));
      const sum = (ids, field) => ids.reduce((total, id) => total + Core.number(state.valuationsById.get(id)?.components?.[field]), 0);
      const positional = {};
      for (const position of Core.OFFENSE) {
        positional[position] = sum(matched.filter((id) => Core.positionOf(players[id]) === position), "finalValue");
        positionTotals[position] ||= [];
        positionTotals[position].push(positional[position]);
      }
      const picks = state.pickInventory
        .filter((pick) => Number(pick.ownerRosterId) === Number(roster.roster_id))
        .sort((a, b) => Number(a.season) - Number(b.season) || a.round - b.round)
        .map((pick) => ({
          season: String(pick.season),
          round: Core.number(pick.round),
          originalRosterId: Core.number(pick.originalRosterId),
          ownerRosterId: Core.number(pick.ownerRosterId),
        }));
      return {
        rosterId: Core.number(roster.roster_id),
        ownerId: String(roster.owner_id || ""),
        ownerName: userMap[roster.owner_id]?.display_name || "Unknown owner",
        teamName: teamName(roster, userMap),
        marketValue: sum(matched, "marketBaseline"),
        leagueValue: sum(matched, "finalValue"),
        starterValue: sum(matched.filter((id) => starterIds.has(id)), "finalValue"),
        benchValue: sum(matched.filter((id) => !starterIds.has(id)), "finalValue"),
        completeness: offensiveIds.length ? Math.round((matched.length / offensiveIds.length) * 100) : 100,
        pickCount: picks.length,
        picks,
        positional,
        offensivePlayerCount: offensiveIds.length,
        matchedOffensiveCount: matched.length,
        idpPlayerCount: idpIds.length,
        rosterPlayerCount: (roster.players || []).length,
        starterCount: starterIds.size,
        taxiCount: (roster.taxi || []).length,
        reserveCount: (roster.reserve || []).length,
      };
    });

    const averages = Object.fromEntries(Object.entries(positionTotals).map(([position, values]) => [
      position,
      values.reduce((total, value) => total + value, 0) / Math.max(1, values.length),
    ]));
    for (const team of teams) {
      const comparisons = Core.OFFENSE
        .map((position) => ({ position, ratio: averages[position] ? team.positional[position] / averages[position] : 0 }))
        .sort((a, b) => b.ratio - a.ratio);
      team.strength = comparisons[0]?.position || "—";
      team.weakness = comparisons.at(-1)?.position || "—";
      delete team.positional;
    }
    teams.sort((a, b) => b.leagueValue - a.leagueValue);
    teams.forEach((team, index) => {
      team.offensiveRank = index + 1;
      team.totalTeams = teams.length;
    });

    const warnings = [...document.querySelectorAll("#warningList li")]
      .map((item) => item.textContent || "")
      .filter(Boolean);
    const identityText = document.querySelector("#identityStatus")?.textContent || "";
    const starterSlots = (league.roster_positions || []).filter((slot) => slot !== "BN");
    const projectionStatus = state.projectionResult?.status || "unavailable";

    return {
      version: "league-vector-command-center-v1a",
      league: {
        id: String(state.leagueId || league.league_id || ""),
        name: league.name || "Sleeper League",
        season: String(league.season || ""),
        format: Core.marketFormat(league) === "2qb" ? "Superflex / 2QB" : "1QB",
        teamCount: teams.length,
        starterSlotsPerTeam: starterSlots.length,
      },
      teams,
      support: {
        offensiveValues: "available",
        projectionStatus,
        projectionFailureCount: (state.projectionResult?.failures || []).length,
        idpCurrentSeason: "experimental-when-available",
        idpDynastyValue: "unavailable",
        tradeRecommendations: "in-development",
        championshipProbability: "unavailable",
      },
      dataQuality: {
        valuedOffensivePlayers: numberFromText(identityText, /(\d+) offensive players valued/),
        unmatchedPlayers: numberFromText(identityText, /(\d+) unmatched/),
        ambiguousPlayers: numberFromText(identityText, /(\d+) ambiguous/),
        warningCount: warnings.length,
        warnings,
      },
    };
  };

  const inspectStatus = () => {
    if (status.classList.contains("error")) {
      const signature = `${state.leagueId}:${status.textContent}`;
      if (signature !== state.errorSignature) {
        state.errorSignature = signature;
        emit("analysis-error", { leagueId: state.leagueId, message: status.textContent || "Analysis failed" });
      }
      return;
    }
    if (!status.classList.contains("success") || results.hidden || state.readyScheduled) return;
    const signature = `${state.leagueId}:${status.textContent}`;
    if (signature === state.readySignature) return;
    state.readyScheduled = true;
    window.requestAnimationFrame(() => {
      state.readyScheduled = false;
      const detail = buildDetail();
      if (!detail) return;
      state.readySignature = signature;
      window.LeagueVectorLastAnalysis = detail;
      emit("analysis-ready", detail);
    });
  };

  submitButton.addEventListener("click", reset, { capture: true });
  leagueInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") reset();
  }, { capture: true });

  const observer = new MutationObserver(inspectStatus);
  observer.observe(status, { attributes: true, childList: true, subtree: true });
  observer.observe(results, { attributes: true, attributeFilter: ["hidden"] });
})();
