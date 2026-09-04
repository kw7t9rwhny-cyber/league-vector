(() => {
  "use strict";
  const A = window.LeagueVectorPilotAdapter;
  const surface = document.body.dataset.surface;
  const params = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const format = params.has("format") ? params.get("format") : "dynasty-1qb";
  const requestedRun = params.has("run") ? params.get("run") : null;
  const label = (f = format) => f === "dynasty-superflex" ? "Dynasty Superflex" : "Dynasty 1QB";
  const stamp = v => new Date(v).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC";
  let snapshot, selected = [], query = params.get("q") || "", position = params.get("position") || "ALL", limit = Number(params.get("limit") || 50);
  let sessionId;
  try { sessionId = sessionStorage.getItem("lv-pilot-session") || crypto.randomUUID(); sessionStorage.setItem("lv-pilot-session", sessionId); } catch { sessionId = "ephemeral"; }
  function emit(name, detail = {}) {
    window.dispatchEvent(new CustomEvent(`leaguevector:${name}`, { detail: { timestamp: new Date().toISOString(), run_id: snapshot?.runId || requestedRun, format, surface, session_id: sessionId, ...detail } }));
  }
  function href(page, more = {}, nextFormat = format) {
    const p = new URLSearchParams({ format: nextFormat });
    if (snapshot || requestedRun !== null) p.set("run", snapshot?.runId ?? requestedRun);
    if (query) p.set("q", query);
    if (position !== "ALL") p.set("position", position);
    if (limit > 50) p.set("limit", String(limit));
    Object.entries(more).forEach(([k, v]) => p.set(k, v));
    return `${page}.html?${p}`;
  }
  const playerHref = p => href("player", { id: p.id });
  const compareHref = (a, b) => href("compare", { a, b });
  const storageKey = () => `lv-pilot-selection:${snapshot.runId}:${format}`;
  function saveSelection() { try { sessionStorage.setItem(storageKey(), JSON.stringify(selected)); } catch { /* Browsing remains usable without storage. */ } }
  function notice(message) { $("#pilot-notice").textContent = message; }
  function error(code, message) {
    $("#pilot-content").innerHTML = `<section class="pilot-empty" role="alert" data-error="${esc(code)}"><p class="pilot-eyebrow">${esc(code.replaceAll("_", " ").toUpperCase())}</p><h2>${code.includes("compare") ? "Comparison unavailable" : "Unable to show this surface"}</h2><p>${esc(message)}</p><a class="button" href="rankings.html?format=${A.FORMATS.includes(format) ? format : "dynasty-1qb"}">Open latest demo rankings</a></section>`;
    $("#compare-tray").hidden = true;
    emit("surface_unavailable", { reason_code: code });
  }
  function badge(p) { return `<a class="evidence-badge ${p.evidence === "Limited" ? "limited" : ""}" href="${playerHref(p)}#support">${esc(p.evidence)}</a>`; }
  function addButton(p) { return `<button type="button" data-select="${esc(p.id)}" aria-pressed="${selected.includes(p.id)}" aria-label="${selected.includes(p.id) ? "Remove" : "Select"} ${esc(p.name)} for comparison">${selected.includes(p.id) ? "Selected ✓" : "+ Compare"}</button>`; }
  function renderTray() {
    const tray = $("#compare-tray");
    tray.hidden = selected.length === 0;
    if (!selected.length) return;
    tray.innerHTML = `<div class="tray-players"><span class="tray-count">COMPARE · ${selected.length}/2</span>${selected.map(id => {
      const p = snapshot.players.find(p => p.id === id);
      return `<div class="tray-player"><span>${esc(p.name)}</span><button type="button" data-remove="${esc(id)}" aria-label="Remove ${esc(p.name)}">×</button></div>`;
    }).join("")}</div>${selected.length === 2 ? `<a class="button button-primary" href="${compareHref(...selected)}">Compare players →</a>` : '<button type="button" disabled>Choose one more player</button>'}`;
  }
  function refreshSelectionButtons() {
    document.querySelectorAll("[data-select]").forEach(button => {
      const p = snapshot.players.find(p => p.id === button.dataset.select);
      const active = selected.includes(p.id);
      button.setAttribute("aria-pressed", active);
      button.setAttribute("aria-label", `${active ? "Remove" : "Select"} ${p.name} for comparison`);
      button.textContent = active ? "Selected ✓" : "+ Compare";
    });
    renderTray();
  }
  function selectPlayer(id) {
    if (!snapshot.players.some(p => p.id === id && p.rankingStatus === "RANKED")) return;
    if (selected.includes(id)) selected = selected.filter(v => v !== id);
    else if (selected.length === 2) { notice("Two players are selected. Remove one from the compare tray before adding another."); emit("compare_selection", { outcome: "third_player_rejected", player_id: id }); return; }
    else selected.push(id);
    saveSelection(); refreshSelectionButtons(); notice(`${selected.length} of 2 players selected.`);
    emit("compare_selection", { player_ids: [...selected] });
  }
  function methodology() {
    const outdated = Date.now() >= Math.min(Date.parse(snapshot.reviewAt), Date.parse(snapshot.generatedAt) + 7 * 86400000);
    $("#snapshot-meta").innerHTML = `<p class="snapshot-summary">12-team PPR · Multi-season dynasty preference</p><div class="snapshot-dates"><span>Updated ${stamp(snapshot.generatedAt)}</span><span class="secondary-meta">Data through ${stamp(snapshot.dataThrough)}</span><span class="secondary-meta">Next review due ${stamp(snapshot.reviewAt)}</span></div>${outdated ? '<p class="demo-banner"><strong>OUTDATED DEMO RUN</strong>Historical order only. Current comparison preference is unavailable.</p>' : ""}<details id="methodology"><summary>Format assumptions, coverage &amp; method</summary><div class="disclosure-body"><dl><dt>Run freshness</dt><dd>Updated ${stamp(snapshot.generatedAt)} · Data through ${stamp(snapshot.dataThrough)} · Next review due ${stamp(snapshot.reviewAt)}</dd><dt>Format assumptions</dt><dd>${esc(snapshot.assumptions)}</dd><dt>Horizon</dt><dd>${esc(snapshot.horizon)}</dd><dt>Coverage</dt><dd>${esc(snapshot.coverage)}</dd><dt>Method</dt><dd>${esc(snapshot.method.label)} · ${esc(snapshot.method.version)}</dd><dt>Method limitation</dt><dd>${esc(snapshot.method.limitation)}</dd><dt>Evidence labels</dt><dd>Documented: the required fictional inputs and traceable drivers are present. Limited: required inputs are present, but optional context or a supported change condition is missing. Neither label measures predictive accuracy.</dd><dt>Run and source</dt><dd>${esc(snapshot.runId)} · Original synthetic fixtures. No external football source is used. Team abbreviations are fictional.</dd></dl></div></details>`;
  }
  function renderRankings() {
    document.title = `${label()} rankings · League Vector Pilot`;
    $("#pilot-content").innerHTML = `<div class="pilot-toolbar"><div class="pilot-search"><label for="pilot-search">Find a player</label><div class="search-input"><input id="pilot-search" type="search" autocomplete="off" placeholder="Search names or approved aliases" value="${esc(query)}" aria-describedby="result-count"><button type="button" id="clear-search">Clear</button></div></div><div class="position-filters" role="group" aria-label="Position filter">${["ALL", ...A.POSITIONS].map(p => `<button type="button" data-position="${p}" aria-pressed="${position === p}">${p === "ALL" ? "All" : p}</button>`).join("")}</div></div><p id="result-count" class="result-count" role="status"></p><div id="ranking-results"></div>`;
    $("#pilot-search").addEventListener("input", e => {
      query = e.target.value; limit = 50; updateBoard();
      clearTimeout(searchTimer); searchTimer = setTimeout(() => emit("search_completed", { query_length_bucket: bucket(query.length), result_count_bucket: bucket(A.search(snapshot, query, position).length) }), 300);
    });
    $("#clear-search").addEventListener("click", () => { query = ""; limit = 50; $("#pilot-search").value = ""; updateBoard(); $("#pilot-search").focus(); emit("search_completed", { query_length_bucket: "0", result_count_bucket: bucket(A.search(snapshot, "", position).length) }); });
    updateBoard(); emit("rankings_viewed");
  }
  let searchTimer;
  const bucket = n => n === 0 ? "0" : n === 1 ? "1" : n <= 10 ? "2-10" : "11+";
  function updateBoard() {
    const matches = A.search(snapshot, query, position);
    const ranked = matches.filter(p => p.rankingStatus === "RANKED");
    const unsupported = matches.filter(p => p.rankingStatus === "NOT_RANKED");
    $("#result-count").textContent = `${ranked.length} ranked · ${unsupported.length} not ranked${query ? " matching this search" : " in the covered demo universe"}. Showing ${Math.min(limit, ranked.length)} ranked players. Overall ranks stay unchanged.`;
    $("#ranking-results").innerHTML = !matches.length ? '<div class="pilot-empty"><h2>No players match</h2><p>Try a different name or clear the search and position filter. Search includes the entire loaded demo universe.</p></div>' : `${ranked.length ? `<div class="rank-board"><div class="rank-columns" aria-hidden="true"><span>Rank</span><span>Player</span><span>Why here</span><span>Evidence</span><span>Compare</span></div>${ranked.slice(0, limit).map(p => `<article class="rank-row" data-player-id="${p.id}"><div class="rank-number" aria-label="Overall rank ${p.rank}">${p.rank}</div><div><a class="rank-name" href="${playerHref(p)}">${esc(p.name)}</a><div class="player-meta">${esc(p.position)} · ${esc(p.team || "Team not recorded")} · ${esc(p.status)}</div></div><div class="rank-reason">${esc(p.reason)}</div>${badge(p)}${addButton(p)}</article>`).join("")}</div>` : ""}${limit < ranked.length ? '<button type="button" class="load-more" id="load-more">Load 50 more players</button>' : ""}${unsupported.length ? `<section class="coverage-section"><h2>Not ranked / outside coverage</h2><p class="result-count">These records have no ordinal rank and cannot be compared.</p>${unsupported.map(p => `<article class="rank-row" data-player-id="${p.id}"><span class="unranked">Not ranked</span><div><a class="rank-name" href="${playerHref(p)}">${esc(p.name)}</a><div class="player-meta">${p.position} · ${esc(p.status)}</div></div><div class="rank-reason">${esc(p.exclusion)}</div></article>`).join("")}</section>` : ""}`;
    document.querySelectorAll("[data-position]").forEach(b => b.setAttribute("aria-pressed", b.dataset.position === position));
    history.replaceState(null, "", href("rankings") + location.hash);
    $("#rankings-link").href = href("rankings");
    renderTray();
  }
  function driver(d) {
    return `<div class="driver"><strong>${esc(d.factor)} · ${esc(d.direction)}</strong><p>${esc(d.observation)}</p><details id="${esc(d.id)}"><summary>Evidence &amp; method rule</summary><div class="disclosure-body"><p>${esc(d.source)}</p><p>${esc(d.period)} · As of ${stamp(d.asOf)}</p><p>Rule: ${esc(d.rule)} · ${d.role === "ranking" ? "Ranking input" : "Context only"} · Synthetic display only.</p><p>No numeric contribution to rank is attributed.</p></div></details></div>`;
  }
  function conditions(p) {
    return p.conditions.length ? p.conditions.map(c => `<p><strong>${esc(c.observable)}</strong> · ${c.kind === "editorial-review" ? "Editorial review condition" : "Method-supported condition"}</p><p>${esc(c.condition)} ${esc(c.why)} <a href="${playerHref(p)}#${esc(c.factRef)}">Evidence to recheck</a></p>`).join("") : '<p class="muted">No supported change condition recorded.</p>';
  }
  function historyFor(p) {
    if (p.history.state === "FIRST_RUN") return '<p class="muted">No prior published run</p>';
    if (p.history.state === "NOT_COMPARABLE") return `<p>Not comparable with the previous run.</p><p class="muted">${esc(p.historyReason)}</p>`;
    if (p.history.state === "NEW_PLAYER") return '<p class="muted">Not ranked in the previous run</p>';
    const previous = p.history.previous_rank, delta = previous - p.rank;
    return `<p>Previous rank ${previous} → current rank ${p.rank} (${delta > 0 ? "+" : ""}${delta}; positive means moved up).</p><p class="muted">${stamp(snapshot.prior.generatedAt)} → ${stamp(snapshot.generatedAt)}</p>${p.changedFacts.length ? `<ul>${p.changedFacts.map(f => `<li>${esc(f.text)}<details><summary>Changed input evidence</summary><div class="disclosure-body">${esc(f.source)} · As of ${stamp(f.asOf)}</div></details></li>`).join("")}</ul>` : `<p>${delta ? "Other players’ ordering changed; no material input change is recorded for this player." : "No material input change recorded."}</p>`}`;
  }
  function cautions(p) {
    return p.drivers.filter(d => d.direction === "hurts").map(d => `<p>${esc(d.observation)} <a href="${playerHref(p)}#${d.id}">Evidence and rule</a></p>`).join("") + `<ul>${p.limitations.map(l => `<li>${esc(l)}</li>`).join("")}<li>${esc(snapshot.method.limitation)}</li></ul>`;
  }
  function renderPlayer() {
    const p = snapshot.players.find(p => p.id === params.get("id"));
    if (!p) return error("invalid_player_id", "Player not found in this run. Check the link or return to rankings.");
    $("h1").textContent = p.name;
    document.title = `${p.name} · ${label()} · League Vector Pilot`;
    const actions = `<div class="pilot-actions"><a class="button" href="${href("rankings")}">← Back to rankings</a><button type="button" data-copy>Copy player link</button></div>`;
    if (p.rankingStatus !== "RANKED") {
      $("#pilot-content").innerHTML = `${actions}<section class="pilot-empty" data-state="unsupported_player"><h2>Not ranked / not covered</h2><p>${esc(p.position)} · ${esc(p.team || "Team not recorded")} · ${esc(p.status)}</p><p>${esc(p.exclusion)}</p><p>Evidence unavailable. Comparison and ranking explanations are unavailable for this player.</p></section>`;
      emit("player_viewed", { player_id: p.id, ranking_status: p.rankingStatus }); renderTray(); return;
    }
    $("#pilot-content").innerHTML = `${actions}<section class="player-hero"><div class="rank-number">#${p.rank}</div><div><h2>Overall · ${label()}</h2><div class="player-meta">${p.position} · ${esc(p.team || "Team not recorded")} · ${esc(p.status)}</div><span class="evidence-badge">${p.evidence}</span>${p.age ? `<p class="player-meta">Age ${p.age.years} · As of ${stamp(p.age.as_of)}</p>` : ""}</div>${addButton(p)}</section><div class="evidence-grid"><section class="evidence-card"><h2>WHY IS THIS PLAYER RANKED HERE?</h2><p>${esc(p.reason)}</p>${p.drivers.filter(d => d.role === "ranking").slice(0, 3).map(driver).join("")}</section><section class="evidence-card"><h2>WHAT CHANGED?</h2>${historyFor(p)}</section><section class="evidence-card" id="support"><h2>WHAT SUPPORTS THE RANK?</h2>${p.drivers.filter(d => d.direction === "supports" && d.role === "ranking").map(d => `<p>${esc(d.observation)} <a href="#${d.id}">View source and rule</a></p>`).join("")}<p class="muted">${esc(p.evidence)} evidence. ${esc(p.gaps.join(" "))}</p></section><section class="evidence-card"><h2>WHAT HURTS THE CASE?</h2>${cautions(p)}</section><section class="evidence-card"><h2>WHAT WOULD CHANGE OUR MIND?</h2>${conditions(p)}</section><section class="evidence-card"><h2>WHO ARE THE CLOSEST ALTERNATIVES?</h2><p class="muted">Nearest same-position neighbors in this ranking. Ranks do not imply equivalent trade value.</p>${A.neighbors(snapshot, p).map(n => `<div class="alternative"><div><a href="${playerHref(n)}">${esc(n.name)}</a><div class="player-meta">#${n.rank} · ${n.position} · ${n.evidence}</div></div><a class="button" href="${compareHref(p.id, n.id)}">Compare with ${esc(n.name)}</a></div>`).join("") || '<p>No same-position alternatives are covered.</p>'}</section></div>`;
    emit("player_viewed", { player_id: p.id }); renderTray();
  }
  function renderCompare() {
    const ids = [params.get("a"), params.get("b")];
    const refs = ids.map((id, i) => ({ id, format: params.get(i ? "bFormat" : "aFormat") ?? format, run: params.get(i ? "bRun" : "aRun") ?? snapshot.runId }));
    const result = A.compare(snapshot, refs);
    const [a, b] = result.players;
    selected = ids; saveSelection();
    document.title = `${a.name} vs ${b.name} · League Vector Pilot`;
    const rows = [
      ["Players", p => `<h2><a href="${playerHref(p)}">${esc(p.name)}</a></h2><p class="rank-number">#${p.rank}</p><p>${p.position} · ${esc(p.team || "Team not recorded")} · ${esc(p.status)}</p><p class="muted">${p.age ? `Age ${p.age.years} · As of ${stamp(p.age.as_of)}` : "Age: not recorded in this demo"}</p>`],
      ["Evidence", p => `${badge(p)}<p class="muted">${esc(p.gaps.join(" ")) || "Required fictional inputs are recorded. This does not establish predictive accuracy."}</p>`],
      ["Supporting drivers", p => p.drivers.filter(d => d.direction === "supports" && d.role === "ranking").map(driver).join("")],
      ["Cautions & limitations", cautions],
      ["What changed?", historyFor],
      ["What would change our mind?", conditions]
    ];
    const evidenceLimited = result.players.some(p => p.evidence === "Limited" || p.conditions.length === 0) || result.outcome === "NO_CLEAR_PREFERENCE";
    $("#pilot-content").innerHTML = `<div class="pilot-actions"><a class="button" href="${href("rankings")}">← Replace a player</a><a class="button" href="${compareHref(b.id, a.id)}">Swap sides</a><button type="button" data-copy>Copy comparison link</button></div><section class="compare-conclusion" data-outcome="${result.outcome}"><p class="pilot-eyebrow">${evidenceLimited ? "LIMITED" : "DOCUMENTED"} COMPARISON EVIDENCE · SYNTHETIC</p><p><strong>${esc(a.name)} · #${a.rank}</strong><br><strong>${esc(b.name)} · #${b.rank}</strong></p><h2>No clear supported preference</h2><p>${esc(result.reason)}</p><p>No approved pairwise preference rule is recorded. Compare the evidence below.</p><p>${a.position !== b.position ? "Cross-position comparison uses the reference lineup’s scarcity assumptions." : "These are ordinal positions in the same run."}</p><p class="muted">${esc(snapshot.method.limitation)}</p><p>${a.conditions.length || b.conditions.length ? "A reversal has not been established. Review the recorded conditions below." : "No supported reversal/change condition is recorded."}</p></section><div class="compare-fields">${rows.map(([name, render]) => `<section class="compare-field"><h2 class="compare-label">${name}</h2>${[a, b].map(p => `<div class="compare-cell" role="group" aria-label="${esc(p.name)}: ${esc(name)}"><span class="mobile-player-label">${esc(p.name)}</span>${render(p)}</div>`).join("")}</section>`).join("")}</div>`;
    $("#compare-tray").hidden = true;
    emit("compare_viewed", { player_ids: ids, conclusion_outcome: result.outcome });
  }
  function openHash() {
    if (!location.hash) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
    if (target?.tagName === "DETAILS") target.open = true;
    target?.scrollIntoView({ block: "start" });
  }
  document.addEventListener("click", async event => {
    const control = event.target.closest("button, a");
    if (!control) return;
    if (control.dataset.format) {
      const next = control.dataset.format;
      if (next === format) return;
      emit("format_changed", { next_format: next });
      const more = surface === "compare" ? { a: params.get("a") || "", b: params.get("b") || "" } : surface === "player" ? { id: params.get("id") || "" } : {};
      if (snapshot && selected.length && surface !== "compare") {
        const valid = selected.filter(id => snapshot.formats[next].players.some(p => p.id === id && p.rankingStatus === "RANKED"));
        more.notice = valid.length === selected.length ? "format-selection-preserved" : "format-selection-cleared";
        try { sessionStorage.setItem(`lv-pilot-selection:${snapshot.runId}:${next}`, JSON.stringify(valid)); } catch { /* Optional storage. */ }
      }
      location.href = href(surface, more, next); return;
    }
    if (!snapshot) return;
    if (control.dataset.select) selectPlayer(control.dataset.select);
    if (control.dataset.remove) { selected = selected.filter(id => id !== control.dataset.remove); saveSelection(); refreshSelectionButtons(); notice("Player removed from comparison."); emit("compare_selection", { player_ids: selected }); $("#pilot-content").focus(); }
    if (control.dataset.position) { position = control.dataset.position; limit = 50; updateBoard(); emit("position_filtered", { position }); }
    if (control.id === "load-more") { const start = limit; limit += 50; updateBoard(); document.querySelectorAll(".rank-board .rank-name")[start]?.focus(); }
    if (control.hasAttribute("data-copy")) {
      try { await navigator.clipboard.writeText(location.href); notice("Exact-run link copied."); emit("share_link_copied"); }
      catch { notice("Copy this exact-run link:"); const input = document.createElement("input"); input.className = "share-input"; input.readOnly = true; input.value = location.href; input.setAttribute("aria-label", "Exact-run link"); $("#pilot-notice").append(input); input.select(); }
    }
    if (control.hash && control.pathname === location.pathname) setTimeout(openHash, 0);
  });
  document.addEventListener("toggle", e => { if (e.target.tagName === "DETAILS" && e.target.open) emit("explanation_opened", { evidence_id: e.target.id || "method-evidence" }); }, true);
  new ResizeObserver(() => { document.documentElement.style.setProperty("--tray-height", `${$("#compare-tray").getBoundingClientRect().height}px`); }).observe($("#compare-tray"));
  window.addEventListener("hashchange", openHash);
  window.addEventListener("pageshow", event => {
    if (!event.persisted || !snapshot || surface === "compare") return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey()) || "[]");
      if (Array.isArray(saved) && saved.length <= 2 && new Set(saved).size === saved.length && saved.every(id => snapshot.players.some(p => p.id === id && p.rankingStatus === "RANKED"))) selected = saved;
      refreshSelectionButtons();
    } catch { /* Ignore invalid local selection. */ }
  });
  async function init() {
    try {
      if (!A.FORMATS.includes(format)) throw Object.assign(new Error("Unsupported format. Choose Dynasty 1QB or Dynasty Superflex."), { code: "unsupported_format" });
      if ([...new Set(params.keys())].some(k => params.getAll(k).length !== 1)) throw Object.assign(new Error("Repeated URL fields are ambiguous. Open a fresh rankings link."), { code: "invalid_link" });
      const allowed = ["format", "run", "q", "position", "limit", "notice", ...(surface === "player" ? ["id"] : surface === "compare" ? ["a", "b", "aFormat", "bFormat", "aRun", "bRun"] : [])];
      if ([...params.keys()].some(k => !allowed.includes(k))) throw Object.assign(new Error("This link contains unsupported fields. Open a fresh link with exactly the intended players."), { code: surface === "compare" ? "invalid_compare" : "invalid_link" });
      if (!["ALL", ...A.POSITIONS].includes(position) || !Number.isInteger(limit) || limit < 50 || limit % 50 !== 0 || limit > 10000) throw Object.assign(new Error("Invalid ranking filters or page size."), { code: "invalid_link" });
      const response = await fetch("data/pilot/synthetic-run.json", { cache: "no-store" });
      if (!response.ok) throw Object.assign(new Error(response.status === 404 ? "No snapshot is available." : "The complete demo snapshot could not be loaded. Retry this page."), { code: response.status === 404 ? "no_snapshot" : "snapshot_load_failed" });
      let raw;
      try { raw = await response.text(); } catch { throw Object.assign(new Error("Malformed snapshot. The demo data could not be read."), { code: "malformed_snapshot" }); }
      snapshot = A.read(raw, { format, run: requestedRun });
      try { const saved = JSON.parse(sessionStorage.getItem(storageKey()) || "[]"); if (Array.isArray(saved) && saved.length <= 2 && new Set(saved).size === saved.length && saved.every(id => snapshot.players.some(p => p.id === id && p.rankingStatus === "RANKED"))) selected = saved; } catch { /* A bad local selection is discarded, never used as ranking data. */ }
      const pinned = new URL(location.href); pinned.searchParams.set("format", format); pinned.searchParams.set("run", snapshot.runId); history.replaceState(null, "", pinned);
      $("#rankings-link").href = href("rankings");
      document.querySelectorAll("[data-format]").forEach(b => b.setAttribute("aria-pressed", b.dataset.format === format));
      methodology();
      if (surface === "rankings") renderRankings(); else if (surface === "player") renderPlayer(); else renderCompare();
      if (params.get("notice") === "format-selection-cleared") notice("Format changed. Unsupported comparison selections were removed; search and position are preserved.");
      if (params.get("notice") === "format-selection-preserved") notice("Format changed. Selected players now use this format’s stored rankings in the same run.");
      openHash();
    } catch (e) { error(e.code || "snapshot_load_failed", e.code ? e.message : "The complete demo snapshot could not be loaded. Retry this page."); }
  }
  init();
})();
