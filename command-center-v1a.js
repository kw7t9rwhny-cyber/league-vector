(() => {
  "use strict";

  const STORAGE_KEY = "leagueVector.commandCenter.v1a";
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const results = document.querySelector("#results");
  const leagueInput = document.querySelector("#leagueId");
  let analysis = null;
  let selectedRosterId = null;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  };

  const readState = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeState = (next) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The command center still works when local storage is blocked.
    }
  };

  const formatNumber = (value) => Number(value || 0).toLocaleString("en-US");
  const smoothBehavior = () => motionQuery.matches ? "auto" : "smooth";
  const scrollToNode = (node, focus = false) => {
    if (!node) return;
    node.scrollIntoView({ behavior: smoothBehavior(), block: "start" });
    if (focus && typeof node.focus === "function") {
      window.setTimeout(() => node.focus({ preventScroll: true }), motionQuery.matches ? 0 : 280);
    }
  };

  const shell = document.createElement("section");
  shell.id = "commandCenter";
  shell.className = "lv-command-center";
  shell.hidden = true;
  shell.setAttribute("aria-labelledby", "commandCenterTitle");
  shell.innerHTML = `
    <div class="cc-complete" tabindex="-1">
      <div class="cc-complete-copy">
        <span class="cc-kicker"><i aria-hidden="true"></i>Analysis complete</span>
        <h2 id="commandCenterTitle">Choose your team</h2>
        <p id="commandCenterStatusCopy">Select your roster to open a personalized view of the supported league analysis.</p>
      </div>
      <button type="button" class="cc-secondary-action" data-command="run-another">Run another league</button>
    </div>

    <section id="commandCenterChooser" class="cc-chooser" aria-labelledby="commandCenterChooserTitle">
      <div class="cc-section-heading">
        <div><span>Personalize this analysis</span><h3 id="commandCenterChooserTitle">Which team is yours?</h3></div>
        <p>League Vector will remember this league and roster on this device. Your selection does not change any values.</p>
      </div>
      <div id="commandCenterTeamGrid" class="cc-team-grid"></div>
    </section>

    <section id="commandCenterDashboard" class="cc-dashboard" hidden aria-labelledby="commandCenterTeamTitle">
      <div class="cc-sticky-header">
        <div class="cc-league-identity">
          <span id="commandCenterLeagueMeta">League analysis</span>
          <h3 id="commandCenterTeamTitle" tabindex="-1">Selected team</h3>
          <p id="commandCenterOwnerName">Sleeper roster</p>
        </div>
        <div class="cc-header-actions">
          <button type="button" class="cc-secondary-action" data-command="change-team">Change team</button>
          <button type="button" class="cc-primary-action" data-command="run-another">Run another league</button>
        </div>
      </div>

      <nav class="cc-navigation" aria-label="League analysis sections">
        <button type="button" data-command-section="overview" aria-current="page">Overview</button>
        <button type="button" data-command-section="my-team">My Team</button>
        <button type="button" data-command-section="league">League</button>
        <button type="button" data-command-section="players">Players</button>
        <button type="button" data-command-section="idp">IDP</button>
        <button type="button" data-command-section="draft-picks">Draft Picks</button>
        <button type="button" data-command-section="methodology">Methodology</button>
      </nav>

      <section id="commandCenterOverview" class="cc-overview" tabindex="-1">
        <div class="cc-section-heading compact">
          <div><span>Supported team snapshot</span><h3>Your league position at a glance</h3></div>
          <p>Numeric team metrics cover matched offensive assets only. Unsupported areas remain clearly separated.</p>
        </div>
        <div id="commandCenterMetrics" class="cc-metric-grid"></div>
        <div class="cc-overview-grid">
          <article id="commandCenterMyTeam" class="cc-panel cc-team-panel" tabindex="-1">
            <span class="cc-panel-label">My Team</span>
            <h4 id="commandCenterTeamSummary">Supported roster profile</h4>
            <div id="commandCenterRosterFacts" class="cc-fact-grid"></div>
            <div id="commandCenterTeamNotes" class="cc-team-notes"></div>
          </article>
          <article id="commandCenterSupport" class="cc-panel cc-support-panel" tabindex="-1">
            <span class="cc-panel-label">Evidence boundaries</span>
            <h4>What this analysis can—and cannot—say</h4>
            <div id="commandCenterSupportRows" class="cc-support-rows"></div>
          </article>
        </div>
      </section>

      <section id="commandCenterDraftPicks" class="cc-panel cc-draft-panel" tabindex="-1">
        <div class="cc-section-heading compact">
          <div><span>Draft capital</span><h3>Tracked future-pick inventory</h3></div>
          <p>Pick ownership is shown without fabricated numeric values.</p>
        </div>
        <div id="commandCenterPickList" class="cc-pick-list"></div>
      </section>

      <section id="commandCenterWarnings" class="cc-panel cc-warning-panel" tabindex="-1">
        <div class="cc-section-heading compact">
          <div><span>Data quality</span><h3>Warnings from this analysis</h3></div>
          <p>These messages come from the same analyzer that produced the detailed results below.</p>
        </div>
        <div id="commandCenterWarningList" class="cc-warning-list"></div>
      </section>
    </section>
  `;

  if (results) results.prepend(shell);

  const byId = (id) => document.getElementById(id);
  const chooser = byId("commandCenterChooser");
  const dashboard = byId("commandCenterDashboard");
  const teamGrid = byId("commandCenterTeamGrid");
  const title = byId("commandCenterTitle");
  const statusCopy = byId("commandCenterStatusCopy");
  const leagueMeta = byId("commandCenterLeagueMeta");
  const teamTitle = byId("commandCenterTeamTitle");
  const ownerName = byId("commandCenterOwnerName");
  const metrics = byId("commandCenterMetrics");
  const rosterFacts = byId("commandCenterRosterFacts");
  const teamNotes = byId("commandCenterTeamNotes");
  const supportRows = byId("commandCenterSupportRows");
  const pickList = byId("commandCenterPickList");
  const warningList = byId("commandCenterWarningList");

  const addMetric = (label, value, note, tone = "") => {
    const card = element("article", `cc-metric-card ${tone}`.trim());
    card.append(element("span", "cc-metric-label", label));
    card.append(element("strong", "cc-metric-value", value));
    card.append(element("small", "cc-metric-note", note));
    metrics.append(card);
  };

  const addFact = (label, value) => {
    const fact = element("div", "cc-fact");
    fact.append(element("span", "", label));
    fact.append(element("strong", "", value));
    rosterFacts.append(fact);
  };

  const addSupport = (label, state, note, tone) => {
    const row = element("div", "cc-support-row");
    const copy = element("div", "cc-support-copy");
    copy.append(element("strong", "", label));
    copy.append(element("span", "", note));
    row.append(copy);
    row.append(element("em", `cc-state ${tone}`, state));
    supportRows.append(row);
  };

  const teamByRosterId = (rosterId) => analysis?.teams.find((team) => Number(team.rosterId) === Number(rosterId));
  const teamNameByRosterId = (rosterId) => teamByRosterId(rosterId)?.teamName || `Roster ${rosterId}`;

  const renderTeamChooser = () => {
    teamGrid.replaceChildren();
    for (const team of analysis.teams) {
      const button = element("button", "cc-team-choice");
      button.type = "button";
      button.dataset.rosterId = String(team.rosterId);
      button.setAttribute("aria-label", `Select ${team.teamName}, owned by ${team.ownerName}`);

      const rank = element("span", "cc-team-rank", `#${team.offensiveRank}`);
      const copy = element("span", "cc-team-choice-copy");
      copy.append(element("strong", "", team.teamName));
      copy.append(element("small", "", `${team.ownerName} · Roster ${team.rosterId}`));
      const meta = element("span", "cc-team-choice-meta");
      meta.append(element("b", "", `${team.completeness}%`));
      meta.append(element("small", "", "offensive match"));
      button.append(rank, copy, meta);
      button.addEventListener("click", () => selectTeam(team.rosterId));
      teamGrid.append(button);
    }
  };

  const renderPicks = (team) => {
    pickList.replaceChildren();
    if (!team.picks.length) {
      pickList.append(element("p", "cc-empty-state", "No future picks were tracked for this roster."));
      return;
    }
    for (const pick of team.picks) {
      const item = element("article", "cc-pick-card");
      item.append(element("strong", "", `${pick.season} Round ${pick.round}`));
      const origin = pick.originalRosterId === team.rosterId
        ? "Original team pick"
        : `Acquired from ${teamNameByRosterId(pick.originalRosterId)}`;
      item.append(element("span", "", origin));
      pickList.append(item);
    }
  };

  const renderWarnings = () => {
    warningList.replaceChildren();
    const warnings = analysis.dataQuality.warnings || [];
    if (!warnings.length) {
      const clear = element("div", "cc-warning-clear");
      clear.append(element("strong", "", "No source-level warnings reported"));
      clear.append(element("span", "", "Product-level limitations still apply and are shown in the evidence boundaries panel."));
      warningList.append(clear);
      return;
    }
    for (const warning of warnings) {
      const item = element("div", "cc-warning-item");
      item.append(element("i", "", "!"));
      item.append(element("span", "", warning));
      warningList.append(item);
    }
  };

  const renderDashboard = (team, remembered = false) => {
    title.textContent = remembered ? "Welcome back to your league" : "Your command center is ready";
    statusCopy.textContent = `${analysis.league.name} has been analyzed. Review supported team metrics first, then open the detailed evidence below.`;
    leagueMeta.textContent = `${analysis.league.name} · ${analysis.league.season || "Current season"} · ${analysis.league.format}`;
    teamTitle.textContent = team.teamName;
    ownerName.textContent = `${team.ownerName} · Roster ${team.rosterId}`;

    metrics.replaceChildren();
    addMetric("Supported offensive rank", `#${team.offensiveRank} of ${team.totalTeams}`, "Based on matched offensive League Vector totals", "gold");
    addMetric("Supported roster value", formatNumber(team.leagueValue), `${team.matchedOffensiveCount} of ${team.offensivePlayerCount} offensive players matched`);
    addMetric("Starting-lineup value", formatNumber(team.starterValue), "Current submitted Sleeper starters");
    addMetric("Bench + depth value", formatNumber(team.benchValue), "Matched offensive non-starters");
    addMetric("Future picks tracked", formatNumber(team.pickCount), "Ownership only · no fabricated pick values");
    addMetric("Offensive completeness", `${team.completeness}%`, "Numeric totals exclude unmatched players", team.completeness < 100 ? "warning" : "good");

    rosterFacts.replaceChildren();
    addFact("Strongest supported position", team.strength || "—");
    addFact("Weakest supported position", team.weakness || "—");
    addFact("Rostered players", formatNumber(team.rosterPlayerCount));
    addFact("Current starters", formatNumber(team.starterCount));
    addFact("IDP players", formatNumber(team.idpPlayerCount));
    addFact("Taxi + reserve", formatNumber(team.taxiCount + team.reserveCount));

    teamNotes.replaceChildren();
    const note = element("p", "");
    note.append("The rank and values above cover supported offensive assets only. ");
    const emphasis = element("strong", "", `${team.idpPlayerCount} defensive players are excluded from numeric dynasty totals.`);
    note.append(emphasis);
    teamNotes.append(note);

    supportRows.replaceChildren();
    addSupport("Offensive dynasty values", "Available", "League-adjusted values for supported offensive market matches.", "available");
    const projectionState = analysis.support.projectionStatus === "complete" ? "Available" : "Partial";
    addSupport("Production projections", projectionState, `${analysis.support.projectionStatus} source coverage; experimental projections remain firewalled from dynasty value.`, projectionState === "Available" ? "available" : "experimental");
    addSupport("Current-season IDP rankings", "Experimental", "Shown only when an approved coverage contract is available.", "experimental");
    addSupport("Numeric IDP dynasty value", "Unavailable", "Defensive players are not assigned unsupported dynasty values.", "unavailable");
    addSupport("Trade recommendations", "In development", "Current league and roster context is informational, not an automated recommendation.", "planned");
    addSupport("Championship probability", "Unavailable", "No win, playoff, or title probability is claimed in V1A.", "unavailable");

    renderPicks(team);
    renderWarnings();
  };

  const selectTeam = (rosterId, options = {}) => {
    const team = teamByRosterId(rosterId);
    if (!team) return;
    selectedRosterId = team.rosterId;
    writeState({ leagueId: analysis.league.id, rosterId: team.rosterId });
    renderDashboard(team, Boolean(options.remembered));
    chooser.hidden = true;
    dashboard.hidden = false;
    if (options.scroll !== false) scrollToNode(teamTitle, true);
  };

  const showChooser = () => {
    selectedRosterId = null;
    dashboard.hidden = true;
    chooser.hidden = false;
    title.textContent = "Choose your team";
    statusCopy.textContent = `Select your roster in ${analysis.league.name} to open a personalized view of the supported analysis.`;
    scrollToNode(chooser, false);
    const firstChoice = teamGrid.querySelector("button");
    if (firstChoice) window.setTimeout(() => firstChoice.focus({ preventScroll: true }), motionQuery.matches ? 0 : 280);
  };

  const runAnotherLeague = () => {
    shell.hidden = true;
    if (results) results.hidden = true;
    if (leagueInput) {
      leagueInput.value = "";
      scrollToNode(leagueInput, true);
    }
  };

  const sectionTarget = (name) => {
    const direct = {
      overview: byId("commandCenterOverview"),
      "my-team": byId("commandCenterMyTeam"),
      league: byId("teamAnalysis"),
      players: byId("dynastyRankingsDisclosure"),
      "draft-picks": byId("commandCenterDraftPicks"),
      methodology: byId("dataQualityDisclosure"),
    };
    if (name === "idp") {
      const idp = byId("experimentalIdpRankings");
      return idp && !idp.hidden ? idp : byId("commandCenterSupport");
    }
    return direct[name] || byId("commandCenterOverview");
  };

  const navigate = (name, button) => {
    for (const item of shell.querySelectorAll("[data-command-section]")) item.removeAttribute("aria-current");
    button.setAttribute("aria-current", "page");
    const target = sectionTarget(name);
    if (target?.tagName === "DETAILS") target.open = true;
    scrollToNode(target, false);
  };

  shell.addEventListener("click", (event) => {
    const action = event.target.closest("[data-command]");
    if (action?.dataset.command === "change-team") showChooser();
    if (action?.dataset.command === "run-another") runAnotherLeague();
    const section = event.target.closest("[data-command-section]");
    if (section) navigate(section.dataset.commandSection, section);
  });

  window.addEventListener("leaguevector:analysis-start", (event) => {
    shell.hidden = true;
    analysis = null;
    selectedRosterId = null;
    if (event.detail?.leagueId) {
      const nextLeagueId = String(event.detail.leagueId);
      const storedState = readState();
      writeState({
        leagueId: nextLeagueId,
        rosterId: storedState.leagueId === nextLeagueId ? storedState.rosterId : null,
      });
    }
  });

  window.addEventListener("leaguevector:analysis-ready", (event) => {
    const detail = event.detail;
    if (!detail?.league || !Array.isArray(detail.teams) || !detail.teams.length) return;
    analysis = detail;
    shell.hidden = false;
    renderTeamChooser();
    const stored = readState();
    const rememberedTeam = stored.leagueId === detail.league.id ? teamByRosterId(stored.rosterId) : null;
    if (rememberedTeam) selectTeam(rememberedTeam.rosterId, { remembered: true });
    else showChooser();
  });

  window.addEventListener("leaguevector:analysis-error", () => {
    shell.hidden = true;
  });

  const stored = readState();
  if (leagueInput && !leagueInput.value && stored.leagueId) leagueInput.value = stored.leagueId;
  if (window.LeagueVectorLastAnalysis) {
    window.dispatchEvent(new CustomEvent("leaguevector:analysis-ready", { detail: window.LeagueVectorLastAnalysis }));
  }

  window.LeagueVectorCommandCenter = Object.freeze({
    version: "v1a",
    get selectedRosterId() { return selectedRosterId; },
    showChooser,
  });
})();
