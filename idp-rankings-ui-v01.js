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

  const CONTRACT_VERSION = "lv-idp-current-season-rankings-v0.1";
  const CONTRACT_LABEL = "Experimental IDP Current-Season Rankings v0.1";
  const IDP_POSITIONS = ["DL", "LB", "DB"];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const list = (value) => Array.isArray(value) ? value.filter(Boolean).map(String) : [];

  function canonicalContractReady(input) {
    return Boolean(
      input &&
      input.version === CONTRACT_VERSION &&
      input.label === CONTRACT_LABEL &&
      input.status === "ready_experimental" &&
      input.firewall &&
      input.firewall.idp_dynasty_value_available === false &&
      input.firewall.offense_idp_combined_dynasty_rankings_available === false &&
      input.firewall.production_activation_authorized === false &&
      Array.isArray(input.players)
    );
  }

  function normalizedPlayers(input) {
    if (!canonicalContractReady(input)) return [];
    return input.players.filter((player) => {
      const eligibility = list(player?.eligible_positions).map((value) => value.toUpperCase());
      return Boolean(
        player &&
        player.player_id &&
        player.name &&
        player.team &&
        IDP_POSITIONS.includes(String(player.primary_position || "").toUpperCase()) &&
        eligibility.length > 0 &&
        eligibility.every((value) => IDP_POSITIONS.includes(value)) &&
        player.eligibility_verified === true &&
        player.current_season_ranking_available === true &&
        player.idp_dynasty_value_available === false &&
        player.dynasty_value === null &&
        player.historical_role_model_available === false &&
        finite(player.projected_points) &&
        player.scoring_coverage?.status === "complete"
      );
    });
  }

  function matchesPosition(player) {
    const eligibility = list(player.eligible_positions).map((value) => value.toUpperCase());
    if (activePosition === "ALL") return true;
    if (activePosition === "IDP FLEX") return eligibility.some((value) => IDP_POSITIONS.includes(value));
    return eligibility.includes(activePosition);
  }

  function warningText(player) {
    const warnings = list(player.warnings);
    if (warnings.length) return warnings.join(" · ");
    if (String(player.role_confidence || "").toLowerCase() === "limited") return "Role confidence limited";
    return "";
  }

  function unavailableReason(input) {
    if (!input) return "Waiting for the approved Experimental IDP Current-Season Rankings contract.";
    if (input.version !== CONTRACT_VERSION || input.label !== CONTRACT_LABEL) return "IDP rankings unavailable: supplied contract version is not approved for this UI.";
    if (input.firewall?.idp_dynasty_value_available !== false || input.firewall?.offense_idp_combined_dynasty_rankings_available !== false || input.firewall?.production_activation_authorized !== false) {
      return "IDP rankings unavailable: Dynasty/production firewall contract is not in the approved fail-closed state.";
    }
    const reasons = input.status === "blocked" ? list(input.blocked_reasons) : list(input.unavailable_reasons);
    if (reasons.length) return `IDP rankings unavailable: ${reasons.join(", ")}.`;
    if (input.status !== "ready_experimental") return `IDP rankings unavailable: contract status is ${String(input.status || "unknown")}.`;
    return "No approved current-season IDP ranking rows are available from the supplied contract.";
  }

  function render() {
    if (!contract) return;
    const safePlayers = normalizedPlayers(contract);
    const query = search.value.trim().toLowerCase();
    const visible = safePlayers.filter((player) => matchesPosition(player) && (!query || String(player.name).toLowerCase().includes(query)));

    summary.textContent = `${safePlayers.length} current-season defensive players · Dynasty Value unavailable`;
    status.textContent = safePlayers.length
      ? "Current-season experimental defensive rankings. Dynasty Value is unavailable and is not inferred from projected points or surplus."
      : unavailableReason(contract);

    rows.innerHTML = visible.length ? visible.map((player, index) => {
      const eligibility = list(player.eligible_positions);
      const primary = String(player.primary_position || eligibility[0] || "IDP");
      const surplus = player.current_season_surplus_available === true && finite(player.projected_surplus)
        ? `<div><span>Projected surplus</span><b>${esc(player.projected_surplus.toFixed(1))}</b></div>`
        : "";
      const warning = warningText(player);
      const confidence = player.role_confidence ? `<span class="idp-confidence">${esc(player.role_confidence)} confidence</span>` : "";
      const warningChip = warning ? `<span class="idp-warning" title="${esc(warning)}" aria-label="Warning: ${esc(warning)}">⚠ ${esc(warning)}</span>` : "";
      return `<article class="idp-ranking-card" data-player-id="${esc(player.player_id)}">
        <div class="idp-rank">${index + 1}</div>
        <div class="idp-player"><b>${esc(player.name)}</b><div>${esc(player.team)} · ${esc(primary)}</div><div class="idp-eligibility">Eligible: ${esc(eligibility.join(" / "))}</div><div class="idp-flags">${confidence}${warningChip}</div></div>
        <div class="idp-metrics"><div><span>Projected points</span><b>${esc(player.projected_points.toFixed(1))}</b></div>${surplus}<div><span>Status</span><b>${esc(player.current_status || "Experimental")}</b></div><div class="idp-dynasty-unavailable"><span>Dynasty Value</span><b>Unavailable</b></div></div>
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
    return {
      rendered: normalizedPlayers(contract).length,
      idp_dynasty_value_available: contract?.firewall?.idp_dynasty_value_available === true,
      contract_version: contract?.version || null,
    };
  };

  if (window.__leagueVectorIdpRankingsContract) window.renderLeagueVectorIdpRankings(window.__leagueVectorIdpRankingsContract);
})();
