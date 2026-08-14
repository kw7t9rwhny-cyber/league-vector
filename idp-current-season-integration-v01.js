(() => {
  "use strict";

  const Data = window.LeagueVectorData;
  const ProjectionFrontend = window.LeagueVectorProjectionFrontend;
  const Rankings = window.LeagueVectorIdpCurrentSeasonRankingsV01;
  const statusNode = document.getElementById("status");
  const leagueInput = document.getElementById("leagueId");
  if (!Data || !ProjectionFrontend || !Rankings || !statusNode || !leagueInput) return;

  let sequence = 0;
  let lastSuccessfulLeagueId = null;

  const leagueIdFrom = (value) => {
    const matches = String(value || "").match(/\d{8,}/g);
    return matches ? matches.at(-1) : "";
  };

  function failClosed(message) {
    window.__leagueVectorIdpRankingsContract = {
      version: Rankings.VERSION,
      label: "Experimental IDP Current-Season Rankings v0.1",
      status: "blocked",
      blocked_reasons: [message],
      unavailable_reasons: [],
      players: [],
      firewall: {
        idp_dynasty_value_available: false,
        offense_idp_combined_dynasty_rankings_available: false,
        production_activation_authorized: false,
      },
    };
    window.renderLeagueVectorIdpRankings?.(window.__leagueVectorIdpRankingsContract);
  }

  async function buildAndRender(leagueId) {
    const current = ++sequence;
    try {
      const [bundle, projectionAsset] = await Promise.all([
        Data.leagueBundle(leagueId),
        Data.request("data/experimental/2026-projections.json", { ttlMs: 60 * 60 * 1000 }),
      ]);
      if (current !== sequence) return;
      const index = ProjectionFrontend.buildIndex(projectionAsset.value);
      const contract = Rankings.buildCandidate({
        league: bundle.league,
        sleeper_players: bundle.players,
        projections: index.records,
      });
      window.__leagueVectorIdpRankingsContract = contract;
      window.renderLeagueVectorIdpRankings?.(contract);
    } catch (error) {
      if (current !== sequence) return;
      console.error(error);
      failClosed(`current_season_idp_integration_unavailable:${error?.message || "unknown_error"}`);
    }
  }

  function maybeRun() {
    if (!statusNode.classList.contains("success")) return;
    const leagueId = leagueIdFrom(leagueInput.value);
    if (!leagueId) return;
    if (leagueId === lastSuccessfulLeagueId && window.__leagueVectorIdpRankingsContract) return;
    lastSuccessfulLeagueId = leagueId;
    buildAndRender(leagueId);
  }

  new MutationObserver(maybeRun).observe(statusNode, { attributes: true, childList: true, subtree: true });
  document.getElementById("go")?.addEventListener("click", () => {
    lastSuccessfulLeagueId = null;
    sequence += 1;
  });
  leagueInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      lastSuccessfulLeagueId = null;
      sequence += 1;
    }
  });
  maybeRun();
})();
