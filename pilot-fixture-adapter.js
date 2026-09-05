/* Presentation-only mapping of the exact Ranking Snapshot v1 contract.
 * All admission, ordinal/tie rules, lineage and comparison semantics belong to that module.
 * This UI deliberately admits SYNTHETIC data only. */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./ranking-snapshot-v1") : root.LeagueVectorRankingSnapshotV1);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LeagueVectorPilotAdapter = api;
})(typeof globalThis === "object" ? globalThis : this, function (S) {
  "use strict";
  const FORMATS = S.FORMATS, POSITIONS = ["QB", "RB", "WR", "TE"], admitted = new WeakMap();
  const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
  const words = s => s.replaceAll("_", " ");
  const exclusions = { rookie_method_unavailable: "Rookie: a supported rookie method is unavailable.", identity_unresolved: "Identity unresolved: no verified player join.", insufficient_history: "Insufficient history for the declared method." };
  function freeze(o) { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; }
  function mapEntry(raw, format, e) {
    const drivers = e.drivers.map(d => {
      const component = raw.method.components.find(c => c.id === d.component_id);
      const facts = d.fact_refs.map(id => e.facts.find(f => f.id === id));
      const observation = facts.map(f => `${f.value.state === "KNOWN" ? f.value.value : words(f.value.state)}${f.unit ? ` ${f.unit}` : ""}`).join("; ");
      return { id: d.id, factor: component.label, observation, direction: d.direction, role: d.use, rule: `${component.id}/${component.version}`, asOf: facts[0].as_of, period: facts.map(f => f.period).join("; "), source: [...new Set(facts.map(f => raw.sources.find(s => s.source_id === f.source_id).attribution))].join("; "), factIds: d.fact_refs };
    });
    const primary = drivers.find(d => d.id === e.primary_reason?.driver_id);
    const primaryFact = e.facts.find(f => f.id === [...(primary?.factIds || [])].sort()[0]);
    const reason = primary ? `${primary.factor}: ${String(primaryFact.value.value)}${primaryFact.unit ? ` ${primaryFact.unit}` : ""} (${primaryFact.period}) supports the rank.` : null;
    return {
      id: e.player_id, name: e.name, aliases: e.aliases, position: e.position, team: e.team,
      status: words(e.status.toLowerCase()), age: e.age, rankingStatus: e.ranking_status, rank: e.rank,
      evidence: { DOCUMENTED: "Documented", LIMITED: "Limited", UNAVAILABLE: "Unavailable" }[e.evidence_state],
      exclusion: exclusions[e.unsupported_reason] || (e.unsupported_reason ? words(e.unsupported_reason) + "." : null),
      reason, drivers: primary ? [primary, ...drivers.filter(d => d !== primary)] : drivers,
      limitations: e.limitations.map(id => raw.method.limitations.find(l => l.id === id).text), gaps: e.evidence_gaps.map(g => ({ missing_age: "Age not recorded.", missing_team: "Team not recorded.", missing_change_condition: "No supported change condition recorded.", optional_input_missing: "Optional context is missing.", nonblocking_disagreement: "Nonblocking disagreement is recorded." }[g])),
      conditions: e.change_conditions.map(c => {
        const f = e.facts.find(f => f.id === c.fact_id), d = drivers.find(d => d.id === c.basis_driver_id);
        return { observable: words(f.field), condition: `Review if this observation ${c.direction === "becomes_known" ? "becomes known" : c.direction + "s"}.`, why: `Recorded review basis: ${d.factor}. No reversal is established.`, factRef: d.id, kind: c.kind === "METHOD" ? "method-supported" : "editorial-review" };
      }),
      history: e.history,
      historyReason: raw.previous_run ? [
        JSON.stringify(raw.method) !== JSON.stringify(raw.previous_run.method) ? "Method changed." : "",
        raw.formats[format].assumptions_id !== raw.previous_run.formats[format].assumptions_id ? "Format assumptions changed." : "",
        JSON.stringify(raw.formats[format].universe) !== JSON.stringify(raw.previous_run.formats[format].universe) ? "Ranking universe changed." : ""
      ].filter(Boolean).join(" ") : "",
      changedFacts: e.history.changed_fact_refs.slice(0, 3).map(id => {
        const f = e.facts.find(f => f.id === id);
        return { id, text: `${words(f.field)}: ${f.value.state === "KNOWN" ? f.value.value : words(f.value.state)}${f.unit ? ` ${f.unit}` : ""} (${f.period})`, asOf: f.as_of, source: raw.sources.find(s => s.source_id === f.source_id).attribution };
      })
    };
  }
  async function read(input, expected = {}) {
    const format = expected.format, run = expected.run, now = expected.now ?? Date.now(), priorCatalog = expected.priorCatalog;
    if (!FORMATS.includes(format)) fail("unsupported_format", "Unsupported format. Choose Dynasty 1QB or Dynasty Superflex.");
    if (input == null) fail("no_snapshot", "No snapshot is available.");
    let raw;
    try {
      raw = S.parseCanonicalSnapshot(typeof input === "string" ? input : S.canonicalizeSnapshot(input));
      // Each predecessor remains canonical bytes until strict parsing; an embedded
      // summary alone cannot authenticate history. The catalog is local fixture data.
      const catalogBytes = priorCatalog === undefined ? "[]" : priorCatalog;
      if (typeof catalogBytes !== "string") throw new Error("Invalid prior catalog");
      const priorBytes = JSON.parse(catalogBytes);
      if (!Array.isArray(priorBytes) || priorBytes.some(bytes => typeof bytes !== "string")) throw new Error("Invalid prior catalog");
      const predecessors = priorBytes.map(bytes => S.parseCanonicalSnapshot(bytes));
      await S.validateSnapshotCatalog([...predecessors, raw]);
    }
    catch { fail("malformed_snapshot", "Malformed snapshot. Exact Ranking Snapshot v1 validation failed."); }
    if (raw.data_kind !== "SYNTHETIC") fail("malformed_snapshot", "This Pilot admits synthetic snapshots only.");
    if (run != null && run !== raw.run_id) fail("unavailable_run", "This requested run is unavailable. Its ranks have not been replaced with another run.");
    if (raw.publication.state === "WITHDRAWN") fail("revoked_snapshot", "This snapshot has been withdrawn. Its rankings and evidence are unavailable.");
    const state = S.getRunState(raw, new Date(now).toISOString());
    if (state === "UNAVAILABLE") fail("unavailable_run", "This run is not available at the current decision time.");
    const formats = Object.fromEntries(FORMATS.map(f => [f, { players: raw.formats[f].entries.map(e => mapEntry(raw, f, e)) }]));
    const view = freeze({ runId: raw.run_id, format, formats, players: formats[format].players,
      generatedAt: raw.published_at || raw.generated_at, dataThrough: raw.data_cutoff, reviewAt: raw.valid_until, runState: state,
      method: { label: raw.method.summary, version: `${raw.method.id}/${raw.method.version}`, limitation: raw.method.limitations.map(l => l.text).join(" ") },
      horizon: S.ASSUMPTIONS[format].horizon, coverage: raw.formats[format].universe.definition,
      assumptions: "12 teams · Full PPR · 1 QB / 2 RB / 3 WR / 1 TE / 2 RB-WR-TE flex. Superflex adds one QB-RB-WR-TE slot. 0.1 rush/receiving yards, 6 rush/receiving TD, 0.04 passing yards, 4 passing TD, −2 interceptions and lost fumbles, +2 successful two-point conversions. " + S.ASSUMPTIONS[format].limitations,
      prior: raw.previous_run ? { generatedAt: raw.previous_run.published_at } : null });
    admitted.set(view, raw); return view;
  }
  function search(view, query = "", position = "ALL") {
    const q = query.trim().toLowerCase();
    return view.players.filter(p => (position === "ALL" || p.position === position) && (!q || [p.name, ...p.aliases].some(n => n.toLowerCase().includes(q))));
  }
  function neighbors(view, player) {
    return S.nearbyAlternatives(admitted.get(view), { run_id: view.runId, format: view.format, player_id: player.id }).map(e => view.players.find(p => p.id === e.player_id));
  }
  function compare(view, refs, now = Date.now()) {
    const raw = admitted.get(view);
    if (!raw) fail("malformed_snapshot", "Comparison requires a complete validated snapshot.");
    if (!Array.isArray(refs) || refs.length !== 2 || refs.some(r => typeof r?.id !== "string" || !r.id) || refs[0].id === refs[1].id) fail("invalid_compare", "Choose exactly two distinct ranked players to compare.");
    if (refs.some(r => r.format !== view.format)) fail("cross_format_compare", "Cross-format comparison is unavailable. Both players must use the same format.");
    if (refs.some(r => r.run !== view.runId)) fail("cross_run_compare", "Cross-run comparison is unavailable. Both players must use the same run.");
    const result = S.comparePlayers(raw, { run_id: view.runId, format: view.format, player_ids: refs.map(r => r.id), now: new Date(now).toISOString() });
    if (result.state === "UNAVAILABLE") fail(result.reason === "outdated_run" ? "outdated_compare" : "unsupported_compare", result.reason === "outdated_run" ? "This run is outdated. Current preference is unavailable; the stored historical order remains on the rankings page." : "Comparison is unavailable for a missing or not-ranked player.");
    return { players: result.players.map(e => view.players.find(p => p.id === e.player_id)), outcome: result.state, reason: result.reason === "exact_tie" ? "These players share an exact rank. " + result.disclosure : result.disclosure };
  }
  return { FORMATS, POSITIONS, read, search, neighbors, compare };
});
