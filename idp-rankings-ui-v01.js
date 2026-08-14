(() => {
  "use strict";

  const shell = document.getElementById("experimentalIdpRankings");
  if (!shell) return;

  const rows = document.getElementById("idpRankingRows");
  const status = document.getElementById("idpRankingStatus");
  const search = document.getElementById("idpRankingSearch");
  const filters = document.getElementById("idpPositionFilters");
  const summary = document.getElementById("idpRankingSummary");
  let contract = null;
  let activePosition = "ALL";

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const list = (value) => Array.isArray(value) ? value.filter(Boolean).map(String) : [];

  function normalizedPlayers(input) {
    if (!input || input.experimental !== true || input.current_season !== true || input.idp_dynasty_value_available === true) return [];
    return (Array.isArray(input.players) ? input.players : []).filter((player) => {
      return player && player.current_eligible === true && player.player_name && player.team && list(player.eligibility).length > 0 && finite(player.projected_points);
    });
  }

  function matchesPosition(player) {
    const eligibility = list(player.eligibility).map((value) => value.toUpperCase());
    if (activePosition === "ALL") return true;
    if (activePosition === "IDP FLEX") return eligibility.some((value) => ["DL", "LB", "DB"].includes(value));
    return eligibility.includes(activePosition);
  }

  function warningText(player) {
    if (player.warning) return String(player.warning);
    if (String(player.confidence || "").toLowerCase() === "low") return "Lower-confidence experimental projection";
    return "";
  }

  function render() {
    if (!contract) return;
    const safePlayers = normalizedPlayers(contract);
    const query = search.value.trim().toLowerCase();
    const visible = safePlayers.filter((player) => matchesPosition(player) && (!query || String(player.player_name).toLowerCase().includes(query)));

    summary.textContent = `${safePlayers.length} current-eligible defensive players · Dynasty Value unavailable`;
    status.textContent = safePlayers.length
      ? "Current-season experimental defensive rankings. Dynasty Value is unavailable and is not inferred from projected points or surplus."
      : "No approved current-season IDP ranking rows are available from the supplied contract.";

    rows.innerHTML = visible.length ? visible.map((player, index) => {
      const eligibility = list(player.eligibility);
      const primary = String(player.position || eligibility[0] || "IDP");
      const surplus = finite(player.projected_surplus) ? `<div><span>Projected surplus</span><b>${esc(player.projected_surplus.toFixed(1))}</b></div>` : "";
      const warning = warningText(player);
      const confidence = player.confidence ? `<span class="idp-confidence">${esc(player.confidence)} confidence</span>` : "";
      const warningChip = warning ? `<span class="idp-warning" title="${esc(warning)}" aria-label="Warning: ${esc(warning)}">⚠ ${esc(warning)}</span>` : "";
      return `<article class="idp-ranking-card">
        <div class="idp-rank">${index + 1}</div>
        <div class="idp-player"><b>${esc(player.player_name)}</b><div>${esc(player.team)} · ${esc(primary)}</div><div class="idp-eligibility">Eligible: ${esc(eligibility.join(" / "))}</div><div class="idp-flags">${confidence}${warningChip}</div></div>
        <div class="idp-metrics"><div><span>Projected points</span><b>${esc(player.projected_points.toFixed(1))}</b></div>${surplus}<div><span>Status</span><b>${esc(player.status || "Experimental")}</b></div><div class="idp-dynasty-unavailable"><span>Dynasty Value</span><b>Unavailable</b></div></div>
      </article>`;
    }).join("") : '<p class="idp-empty">No defensive players match these filters.</p>';
  }

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-idp-position]");
    if (!button) return;
    activePosition = button.dataset.idpPosition;
    filters.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    render();
  });
  search.addEventListener("input", render);

  window.renderLeagueVectorIdpRankings = (input) => {
    contract = input || null;
    shell.hidden = false;
    render();
    return { rendered: normalizedPlayers(contract).length, idp_dynasty_value_available: contract?.idp_dynasty_value_available === true };
  };

  if (window.__leagueVectorIdpRankingsContract) window.renderLeagueVectorIdpRankings(window.__leagueVectorIdpRankingsContract);
})();
