(() => {
  "use strict";

  const Data = window.LeagueVectorData;
  const SLEEPER_API = Data?.SLEEPER_API || "https://api.sleeper.app/v1";
  const STORAGE_KEY = "leagueVector.usernameOnboarding.v1b";
  const COMMAND_CENTER_KEY = "leagueVector.commandCenter.v1a";
  const CACHE_TTL = 5 * 60 * 1000;
  const hero = document.querySelector(".premium-hero") || document.querySelector(".hero");
  const originalImport = hero?.querySelector(".hero-form") || hero?.querySelector(".form");
  const leagueInput = document.getElementById("leagueId");
  const analyzeButton = document.getElementById("go");
  const analyzerStatus = document.getElementById("status");

  if (!Data?.request || !hero || !originalImport || !leagueInput || !analyzeButton || !analyzerStatus) return;

  let activeController = null;
  let activeUser = null;
  let activeSeason = null;
  let activeLeagues = [];

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  };

  const readState = () => {
    try {
      const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  };

  const writeState = (next) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Username onboarding remains usable when storage is unavailable.
    }
  };

  const writeCommandCenterState = (leagueId, rosterId = null) => {
    try {
      window.localStorage.setItem(COMMAND_CENTER_KEY, JSON.stringify({
        leagueId: String(leagueId),
        rosterId: rosterId == null ? null : Number(rosterId),
      }));
    } catch {
      // Team selection will fall back to the Command Center chooser.
    }
  };

  const cleanUsername = (value) => String(value || "").trim().replace(/^@+/, "");
  const asArray = (value) => Array.isArray(value) ? value : [];
  const text = (value, fallback = "") => String(value ?? fallback);
  const isIdpSlot = (slot) => /^(?:DL|DE|DT|LB|DB|CB|S|IDP|IDP_FLEX)$/i.test(text(slot));
  const isSuperflex = (league) => asArray(league?.roster_positions).some((slot) => slot === "SUPER_FLEX")
    || asArray(league?.roster_positions).filter((slot) => slot === "QB").length > 1;
  const hasIdp = (league) => asArray(league?.roster_positions).some(isIdpSlot);

  const leagueType = (league) => {
    const type = Number(league?.settings?.type);
    if (type === 2) return "Dynasty";
    if (type === 1) return "Keeper";
    if (type === 0) return "Redraft";
    if (Number(league?.settings?.taxi_slots) > 0) return "Dynasty";
    return "Format unlabeled";
  };

  const statusLabel = (status) => ({
    pre_draft: "Pre-draft",
    drafting: "Drafting",
    in_season: "In season",
    complete: "Complete",
  })[status] || "Active league";

  const initials = (name) => text(name, "LV")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "LV";

  const shell = element("section", "lv-username-onboarding");
  shell.id = "usernameOnboarding";
  shell.setAttribute("aria-labelledby", "usernameOnboardingTitle");
  shell.innerHTML = `
    <div class="username-onboarding-card">
      <div class="username-onboarding-heading">
        <div>
          <span class="username-kicker">Fast Sleeper connection</span>
          <h2 id="usernameOnboardingTitle">Find your leagues by username</h2>
          <p>No password is needed. League Vector uses Sleeper's read-only league data, then opens the existing analyzer.</p>
        </div>
        <span class="username-readonly-badge">Read only</span>
      </div>
      <div class="username-search-row">
        <label for="sleeperUsername">Sleeper username</label>
        <div class="username-search-controls">
          <input id="sleeperUsername" type="text" inputmode="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Enter Sleeper username" aria-describedby="usernameOnboardingStatus">
          <button id="findSleeperLeagues" type="button"><span aria-hidden="true">S</span>Find my leagues</button>
        </div>
      </div>
      <div class="username-helper-row">
        <button id="usernameDemo" type="button" class="username-demo-button">Try the sample demo</button>
        <span>Your username, last league and matched roster can be remembered on this device.</span>
      </div>
      <p id="usernameOnboardingStatus" class="username-onboarding-status" role="status" aria-live="polite">Enter your Sleeper username to see current NFL leagues.</p>
    </div>

    <section id="usernameLeagueChooser" class="username-league-chooser" hidden aria-labelledby="usernameLeagueChooserTitle">
      <div class="username-section-heading">
        <div><span>Current Sleeper leagues</span><h3 id="usernameLeagueChooserTitle">Choose a league to analyze</h3></div>
        <button id="changeSleeperUsername" type="button">Change username</button>
      </div>
      <div id="usernameLeagueGrid" class="username-league-grid"></div>
    </section>

    <section id="usernameRosterChooser" class="username-roster-chooser" hidden aria-labelledby="usernameRosterChooserTitle">
      <div class="username-section-heading">
        <div><span>Multiple roster matches</span><h3 id="usernameRosterChooserTitle">Choose the roster you manage</h3></div>
        <button id="backToSleeperLeagues" type="button">Back to leagues</button>
      </div>
      <p>League Vector found more than one roster connected to this Sleeper user. Select one before analysis.</p>
      <div id="usernameRosterGrid" class="username-roster-grid"></div>
    </section>

    <details id="advancedLeagueImport" class="username-advanced-import">
      <summary>Advanced: import by league ID or URL</summary>
      <div class="username-advanced-body">
        <p>Use this fallback for a league you do not own, an inactive league, or whenever username lookup is unavailable.</p>
        <div id="advancedLeagueImportSlot"></div>
      </div>
    </details>
  `;

  originalImport.before(shell);
  const advancedSlot = shell.querySelector("#advancedLeagueImportSlot");
  advancedSlot.append(originalImport, analyzerStatus);
  originalImport.classList.add("username-advanced-form");
  analyzerStatus.classList.add("username-analyzer-status");

  const usernameInput = shell.querySelector("#sleeperUsername");
  const findButton = shell.querySelector("#findSleeperLeagues");
  const demoButton = shell.querySelector("#usernameDemo");
  const usernameStatus = shell.querySelector("#usernameOnboardingStatus");
  const leagueChooser = shell.querySelector("#usernameLeagueChooser");
  const leagueGrid = shell.querySelector("#usernameLeagueGrid");
  const rosterChooser = shell.querySelector("#usernameRosterChooser");
  const rosterGrid = shell.querySelector("#usernameRosterGrid");
  const advancedImport = shell.querySelector("#advancedLeagueImport");
  const changeUsernameButton = shell.querySelector("#changeSleeperUsername");
  const backToLeaguesButton = shell.querySelector("#backToSleeperLeagues");

  const buttonCopy = analyzeButton.querySelector("span:last-child");
  if (buttonCopy) buttonCopy.textContent = "Analyze league ID";
  analyzeButton.setAttribute("aria-label", "Analyze League ID");
  const skipLink = document.querySelector(".skip-link");
  const headerCta = document.querySelector(".header-cta");
  if (skipLink) skipLink.href = "#sleeperUsername";
  if (headerCta) headerCta.href = "#sleeperUsername";

  const setStatus = (message, tone = "") => {
    usernameStatus.textContent = message;
    usernameStatus.className = `username-onboarding-status ${tone}`.trim();
  };

  const setSearching = (searching) => {
    findButton.disabled = searching;
    usernameInput.disabled = searching;
    findButton.classList.toggle("is-loading", searching);
    const label = findButton.querySelector("span")?.nextSibling;
    if (label) label.textContent = searching ? "Searching…" : "Find my leagues";
  };

  const showLeagues = () => {
    rosterChooser.hidden = true;
    leagueChooser.hidden = false;
  };

  const showRosterChoices = () => {
    leagueChooser.hidden = true;
    rosterChooser.hidden = false;
  };

  const leagueTags = (league) => [
    `${Number(league?.total_rosters) || "—"} teams`,
    leagueType(league),
    isSuperflex(league) ? "Superflex / 2QB" : "1QB",
    hasIdp(league) ? "IDP" : "Offense only",
    statusLabel(league?.status),
  ];

  const renderAvatar = (league) => {
    const holder = element("span", "username-league-avatar");
    holder.append(element("span", "username-avatar-fallback", initials(league?.name)));
    if (!league?.avatar) return holder;
    const image = document.createElement("img");
    image.src = `https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(league.avatar)}`;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("load", () => holder.classList.add("has-image"), { once: true });
    image.addEventListener("error", () => image.remove(), { once: true });
    holder.append(image);
    return holder;
  };

  const openExistingAnalyzer = (league, rosterId = null) => {
    const leagueId = text(league?.league_id);
    if (!leagueId) return;
    writeCommandCenterState(leagueId, rosterId);
    const saved = readState();
    writeState({
      ...saved,
      username: activeUser?.username || cleanUsername(usernameInput.value),
      userId: activeUser?.user_id || null,
      lastLeagueId: leagueId,
      season: activeSeason,
    });
    leagueInput.value = leagueId;
    advancedImport.open = false;
    setStatus(rosterId == null
      ? `Importing ${league.name || "this league"}. Choose your team after analysis if needed.`
      : `Roster matched. Importing ${league.name || "this league"}…`, "loading");
    if (analyzeButton.disabled) {
      setStatus("Another analysis is already running. Finish it before opening a different league.", "error");
      return;
    }
    analyzeButton.click();
  };

  const renderRosterChoices = (league, matches, users) => {
    rosterGrid.replaceChildren();
    const userMap = new Map(asArray(users).map((user) => [text(user?.user_id), user]));
    for (const roster of matches) {
      const owner = userMap.get(text(roster?.owner_id));
      const teamName = owner?.metadata?.team_name || owner?.display_name || `${league.name || "League"} roster ${roster.roster_id}`;
      const choice = element("button", "username-roster-choice");
      choice.type = "button";
      choice.append(element("strong", "", teamName));
      choice.append(element("span", "", `${owner?.display_name || activeUser?.display_name || "Sleeper manager"} · Roster ${roster.roster_id}`));
      choice.append(element("small", "", `${asArray(roster?.players).length} players · ${asArray(roster?.starters).filter((id) => id && id !== "0").length} starters`));
      choice.addEventListener("click", () => openExistingAnalyzer(league, roster.roster_id));
      rosterGrid.append(choice);
    }
    showRosterChoices();
    setStatus(`More than one roster is connected to ${activeUser?.display_name || activeUser?.username || "this user"}. Choose one to continue.`, "notice");
  };

  const selectLeague = async (league, button) => {
    if (!activeUser?.user_id || !league?.league_id) return;
    activeController?.abort();
    activeController = new AbortController();
    const { signal } = activeController;
    for (const candidate of leagueGrid.querySelectorAll("button")) candidate.disabled = true;
    button?.classList.add("is-loading");
    setStatus(`Matching your Sleeper roster in ${league.name || "this league"}…`, "loading");

    try {
      const leagueId = text(league.league_id);
      const [rosterResult, userResult] = await Promise.all([
        Data.request(`${SLEEPER_API}/league/${leagueId}/rosters`, { signal, ttlMs: 10 * 60 * 1000 }),
        Data.request(`${SLEEPER_API}/league/${leagueId}/users`, { signal, ttlMs: 10 * 60 * 1000 }),
      ]);
      const userId = text(activeUser.user_id);
      const matches = asArray(rosterResult.value).filter((roster) => {
        const owners = [text(roster?.owner_id), ...asArray(roster?.co_owners).map(text)];
        return owners.includes(userId);
      });

      if (matches.length === 1) {
        openExistingAnalyzer(league, matches[0].roster_id);
      } else if (matches.length > 1) {
        renderRosterChoices(league, matches, userResult.value);
      } else {
        openExistingAnalyzer(league, null);
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("League roster matching failed.", error);
      setStatus("League Vector found the league but could not match a roster. Open advanced import or try again.", "error");
    } finally {
      button?.classList.remove("is-loading");
      for (const candidate of leagueGrid.querySelectorAll("button")) candidate.disabled = false;
    }
  };

  const renderLeagues = (leagues) => {
    leagueGrid.replaceChildren();
    const saved = readState();
    const statusOrder = { in_season: 0, drafting: 1, pre_draft: 2, complete: 3 };
    const sorted = [...leagues].sort((a, b) => {
      const statusDifference = (statusOrder[a?.status] ?? 9) - (statusOrder[b?.status] ?? 9);
      if (statusDifference) return statusDifference;
      return text(a?.name).localeCompare(text(b?.name));
    });

    for (const league of sorted) {
      const card = element("article", "username-league-card");
      if (text(saved.lastLeagueId) === text(league?.league_id)) card.classList.add("last-opened");
      const identity = element("div", "username-league-identity");
      identity.append(renderAvatar(league));
      const copy = element("div", "username-league-copy");
      copy.append(element("strong", "", league?.name || "Unnamed Sleeper league"));
      copy.append(element("span", "", `${league?.season || activeSeason || "Current"} season · ${statusLabel(league?.status)}`));
      identity.append(copy);

      const tags = element("div", "username-league-tags");
      for (const tag of leagueTags(league)) tags.append(element("span", "", tag));

      const action = element("button", "username-league-action");
      action.type = "button";
      action.setAttribute("aria-label", `Analyze ${league?.name || "Sleeper league"}`);
      action.innerHTML = `<span>Analyze league</span><i aria-hidden="true">→</i>`;
      action.addEventListener("click", () => selectLeague(league, action));
      card.append(identity, tags, action);
      leagueGrid.append(card);
    }
    showLeagues();
  };

  const lookupUsername = async () => {
    const username = cleanUsername(usernameInput.value);
    if (!username) {
      setStatus("Enter a Sleeper username first.", "error");
      usernameInput.focus();
      return;
    }

    activeController?.abort();
    activeController = new AbortController();
    const { signal } = activeController;
    setSearching(true);
    leagueChooser.hidden = true;
    rosterChooser.hidden = true;
    setStatus("Finding your Sleeper account and current NFL leagues…", "loading");

    try {
      const stateResult = await Data.request(`${SLEEPER_API}/state/nfl`, { signal, ttlMs: CACHE_TTL });
      activeSeason = text(stateResult.value?.league_season || stateResult.value?.season || new Date().getFullYear());
      let userResult;
      try {
        userResult = await Data.request(`${SLEEPER_API}/user/${encodeURIComponent(username)}`, { signal, ttlMs: CACHE_TTL });
      } catch (error) {
        if (/404/.test(error?.message || "")) {
          const notFound = new Error("Sleeper username not found");
          notFound.code = "USER_NOT_FOUND";
          throw notFound;
        }
        throw error;
      }
      const user = userResult.value;
      if (!user?.user_id) {
        const notFound = new Error("Sleeper username not found");
        notFound.code = "USER_NOT_FOUND";
        throw notFound;
      }
      activeUser = user;
      const leaguesResult = await Data.request(
        `${SLEEPER_API}/user/${encodeURIComponent(user.user_id)}/leagues/nfl/${encodeURIComponent(activeSeason)}`,
        { signal, ttlMs: CACHE_TTL },
      );
      activeLeagues = asArray(leaguesResult.value).filter((league) => league?.league_id && league?.sport !== "nba");
      writeState({
        ...readState(),
        username: user.username || username,
        userId: text(user.user_id),
        season: activeSeason,
      });
      if (!activeLeagues.length) {
        setStatus(`${user.display_name || user.username || username} has no NFL leagues listed for ${activeSeason}. Try advanced import for an older or inactive league.`, "notice");
        return;
      }
      renderLeagues(activeLeagues);
      setStatus(`Found ${activeLeagues.length} league${activeLeagues.length === 1 ? "" : "s"} for ${user.display_name || user.username || username}.`, "success");
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("Sleeper username lookup failed.", error);
      if (error?.code === "USER_NOT_FOUND") {
        setStatus(`No Sleeper account was found for “${username}”. Check the spelling and try again.`, "error");
      } else {
        setStatus("Sleeper username lookup is unavailable right now. Try again or use advanced league-ID import.", "error");
      }
    } finally {
      setSearching(false);
    }
  };

  findButton.addEventListener("click", lookupUsername);
  usernameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") lookupUsername();
  });
  changeUsernameButton.addEventListener("click", () => {
    activeController?.abort();
    activeUser = null;
    activeLeagues = [];
    leagueChooser.hidden = true;
    rosterChooser.hidden = true;
    setStatus("Enter another Sleeper username to continue.");
    usernameInput.focus();
    usernameInput.select();
  });
  backToLeaguesButton.addEventListener("click", () => {
    showLeagues();
    setStatus(`Choose one of ${activeLeagues.length} current Sleeper leagues.`, "success");
  });
  demoButton.addEventListener("click", () => {
    const preview = document.getElementById("preview");
    if (!preview) return;
    preview.classList.add("onboarding-demo-focus");
    preview.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    setStatus("Showing League Vector's static sample interface. No live league data was imported.", "notice");
    window.setTimeout(() => preview.classList.remove("onboarding-demo-focus"), 2400);
  });

  window.addEventListener("leaguevector:analysis-start", () => {
    setStatus("League data found. Running the existing League Vector analysis…", "loading");
  });
  window.addEventListener("leaguevector:analysis-ready", () => {
    setStatus("Analysis complete. Opening your personalized Command Center.", "success");
  });
  window.addEventListener("leaguevector:analysis-error", () => {
    setStatus("League analysis could not be completed. Open advanced import to review the analyzer message.", "error");
  });

  const saved = readState();
  if (saved.username) {
    usernameInput.value = saved.username;
    setStatus(`Saved username “${saved.username}” is ready. Find leagues to refresh the current season.`, "success");
  }

  window.LeagueVectorUsernameOnboarding = Object.freeze({
    version: "v1b",
    lookupUsername,
    get activeUserId() { return activeUser?.user_id || null; },
    get activeSeason() { return activeSeason; },
  });
})();
