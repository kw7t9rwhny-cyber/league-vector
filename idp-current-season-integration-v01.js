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
  let activeWorker = null;

  const leagueIdFrom = (value) => {
    const matches = String(value || "").match(/\d{8,}/g);
    return matches ? matches.at(-1) : "";
  };

  const sleeperDisplayName = (player) => {
    if (!player) return null;
    const full = String(player.full_name || "").trim();
    if (full) return full;
    const joined = [player.first_name, player.last_name].filter(Boolean).join(" ").trim();
    return joined || null;
  };

  const firewall = () => ({
    idp_dynasty_value_available: false,
    offense_idp_combined_dynasty_rankings_available: false,
    production_activation_authorized: false,
  });

  function transientContract(status, reason) {
    return {
      version: Rankings.VERSION,
      label: "Experimental IDP Current-Season Rankings v0.1",
      status,
      blocked_reasons: status === "blocked" && reason ? [reason] : [],
      unavailable_reasons: [],
      players: [],
      firewall: firewall(),
    };
  }

  function revealBuildingShell() {
    const loading = transientContract("building_current_season_rankings");
    window.__leagueVectorIdpRankingsContract = loading;
    window.renderLeagueVectorIdpRankings?.(loading);
  }

  function failClosed(message) {
    const blocked = transientContract("blocked", message);
    window.__leagueVectorIdpRankingsContract = blocked;
    window.renderLeagueVectorIdpRankings?.(blocked);
  }

  function terminateWorker() {
    if (activeWorker) activeWorker.terminate();
    activeWorker = null;
  }

  function candidateInput(league, sleeperPlayers, projections) {
    const relevantSleepers = {};
    for (const row of projections) {
      const sleeperId = String(row?.sleeper_id || "");
      if (sleeperId && sleeperPlayers?.[sleeperId]) relevantSleepers[sleeperId] = sleeperPlayers[sleeperId];
    }
    return { league, sleeper_players: relevantSleepers, projections };
  }

  function buildCandidateOffMainThread(input, requestId) {
    if (typeof Worker !== "function") {
      return new Promise((resolve, reject) => {
        requestAnimationFrame(() => {
          try { resolve(Rankings.buildCandidate(input)); }
          catch (error) { reject(error); }
        });
      });
    }

    terminateWorker();
    return new Promise((resolve, reject) => {
      const worker = new Worker("idp-current-season-worker-v01.js?v=0.1");
      activeWorker = worker;
      worker.onmessage = (event) => {
        if (event.data?.request_id !== requestId) return;
        terminateWorker();
        if (event.data?.error) reject(new Error(event.data.error));
        else resolve(event.data?.contract);
      };
      worker.onerror = (event) => {
        terminateWorker();
        reject(new Error(event.message || "idp_worker_error"));
      };
      worker.postMessage({ request_id: requestId, input });
    });
  }

  async function buildAndRender(leagueId) {
    const current = ++sequence;
    revealBuildingShell();
    try {
      const [bundle, projectionAsset] = await Promise.all([
        Data.leagueBundle(leagueId),
        Data.request("data/experimental/2026-projections.json", { ttlMs: 60 * 60 * 1000 }),
      ]);
      if (current !== sequence) return;
      const index = ProjectionFrontend.buildIndex(projectionAsset.value);
      const projections = index.records.map((row) => {
        const currentSleeper = bundle.players?.[String(row.sleeper_id)] || null;
        return {
          ...row,
          name: sleeperDisplayName(currentSleeper) || row.name || null,
        };
      });
      const contract = await buildCandidateOffMainThread(
        candidateInput(bundle.league, bundle.players, projections),
        current,
      );
      if (current !== sequence) return;
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
    terminateWorker();
  });
  leagueInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      lastSuccessfulLeagueId = null;
      sequence += 1;
      terminateWorker();
    }
  });
  maybeRun();
})();
