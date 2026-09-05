/* Original synthetic UI fixture in the exact Ranking Snapshot v1 contract.
 * No football model, provider data, ranking score or publication authority. */
const fs = require("node:fs");
const path = require("node:path");
const S = require("../ranking-snapshot-v1");
function createFixture() {
  const run = {
    schema_version: S.VERSION, run_id: "demo-2026-09-04", data_kind: "SYNTHETIC",
    generated_at: "2026-09-04T18:00:00.000Z", published_at: null,
    data_cutoff: "2026-09-03T18:00:00.000Z", valid_until: "2026-09-10T18:00:00.000Z",
    publication: { state: "STAGED", rights_state: "SYNTHETIC_ONLY", reference: "synthetic-ui-fixture-only" },
    method: { id: "synthetic-ui-demonstration", version: "1", summary: "Fictional observations and hand-authored ordinal examples demonstrate the interface. No football ranking method or predictive accuracy is established.",
      components: [{ id: "demo-role", version: "1", label: "Recorded involvement", required_fields: ["synthetic_involvement"] }],
      limitations: [{ id: "synthetic-only", text: "Fictional history does not establish future role or performance. No football ranking method or predictive accuracy is established.", reviewed: true }] },
    sources: [{ source_id: "synthetic-ui-source", manifest_ref: "synthetic://pilot-ui/original-fixture-v1", content_hash: "sha256:" + "0".repeat(64), observed_at: "2026-09-03T18:00:00.000Z", data_cutoff: "2026-09-03T18:00:00.000Z", valid_until: "2026-09-10T18:00:00.000Z", delivery_state: "SYNTHETIC_ONLY", eligibility_ref: "synthetic-ui-fixture-only", attribution: "Original League Vector synthetic UI fixtures. No real athlete or external source data." }],
    formats: {}, previous_run: null
  };
  const first = ["Aster", "Bramble", "Cobalt", "Dune", "Ember", "Fable", "Grove", "Harbor", "Indigo", "Juniper", "Kestrel", "Lumen", "Morrow", "Nimbus", "Orion", "Peregrine"];
  const last = ["Vale", "Quill", "Moss", "Reed"];
  const positions = ["WR", "RB", "QB", "TE"];
  const observations = ["sustained receiving involvement", "repeated rushing and receiving involvement", "repeated passing involvement", "sustained tight-end receiving involvement"];
  for (const format of S.FORMATS) {
    const short = format === "dynasty-1qb" ? "1qb" : "sf";
    let entries = Array.from({ length: 64 }, (_, i) => {
      const id = `lv:synthetic:demo-${String(i + 1).padStart(3, "0")}`;
      const fact = `ui-${short}-demo-${String(i + 1).padStart(3, "0")}-fact`;
      const driver = `ui-${short}-demo-${String(i + 1).padStart(3, "0")}-role`;
      return {
        player_id: id, name: `Synthetic ${first[i % 16]} ${last[Math.floor(i / 16)]}`,
        aliases: i === 63 ? ["The Lantern"] : [], identity_state: "VERIFIED", position: positions[i % 4],
        team: i === 2 ? null : ["NTH", "EST", "WST", "STH"][i % 4], team_state: i === 2 ? "UNKNOWN" : "KNOWN", status: "ACTIVE",
        age: null, identity_evidence_refs: ["synthetic-ui-source"], ranking_status: "RANKED", rank: i + 1,
        evidence_state: "LIMITED", unsupported_reason: null, evidence_gaps: ["missing_age", "missing_change_condition", ...(i === 2 ? ["missing_team"] : [])],
        facts: [{ id: fact, run_id: run.run_id, format, player_id: id, field: "synthetic_involvement", value: { state: "KNOWN", value: observations[i % 4] }, unit: null, period: "Fictional 2024–2025", as_of: run.data_cutoff, source_id: "synthetic-ui-source" }],
        drivers: [{ id: driver, component_id: "demo-role", direction: "supports", use: "ranking", fact_refs: [fact] }],
        primary_reason: { template_id: "observed-support/v1", driver_id: driver },
        limitations: ["synthetic-only"], change_conditions: [], history: { state: "FIRST_RUN", previous_rank: null, changed_fact_refs: [] }
      };
    });
    // One documented sample and a material negative driver exercise all UI fields.
    for (const i of [0, 1]) {
      const p = entries[i], f = p.facts[0];
      f.value.value = i === 0 ? 2 : 1; f.unit = "fictional recorded seasons";
      p.age = { years: 25 + i, as_of: run.data_cutoff };
      p.evidence_state = "DOCUMENTED"; p.evidence_gaps = [];
      p.change_conditions = [{ fact_id: f.id, direction: "decrease", basis_driver_id: p.drivers[0].id, kind: "EDITORIAL", reviewed: true }];
    }
    entries[1].drivers.push({ id: `ui-${short}-demo-002-caution`, component_id: "demo-role", direction: "hurts", use: "ranking", fact_refs: [entries[1].facts[0].id] });
    if (short === "sf") entries = [entries[2], entries[0], entries[1], ...entries.slice(3)];
    entries.forEach((p, i) => { p.rank = i + 1; });
    const eligible = entries.map(p => p.player_id);
    for (const [suffix, name, position, reason] of [["rookie", "Solstice Newleaf", "WR", "rookie_method_unavailable"], ["unresolved", "Echo Unknown", "QB", "identity_unresolved"]]) entries.push({
      player_id: `lv:synthetic:demo-${suffix}`, name: `Synthetic ${name}`, aliases: [], identity_state: suffix === "unresolved" ? "UNRESOLVED" : "VERIFIED", position,
      team: null, team_state: "UNKNOWN", status: "UNKNOWN", age: null, identity_evidence_refs: ["synthetic-ui-source"], ranking_status: "NOT_RANKED", rank: null,
      evidence_state: "UNAVAILABLE", unsupported_reason: reason, evidence_gaps: [], facts: [], drivers: [], primary_reason: null, limitations: [], change_conditions: [], history: { state: "NOT_RANKED", previous_rank: null, changed_fact_refs: [] }
    });
    run.formats[format] = { assumptions_id: S.ASSUMPTIONS[format].id, universe: { id: "synthetic-ui-universe-v1", definition: "64 fictional veteran players; two known fictional exclusions. Partial demonstration universe only.", supported_positions: ["QB", "RB", "WR", "TE"], eligible_player_ids: eligible, coverage_count: 64, exclusions: ["Fictional rookies without a supported method", "Fictional identities awaiting resolution"] }, entries };
  }
  // This source manifest represents only the original fictional observations above.
  const inputBytes = JSON.stringify(Object.values(run.formats).flatMap(b => b.entries.map(e => ({ id: e.player_id, facts: e.facts, identity: [e.name, e.position, e.team, e.age] }))));
  run.sources[0].content_hash = "sha256:" + require("node:crypto").createHash("sha256").update(inputBytes).digest("hex");
  return run;
}
if (require.main === module) {
  const fixture = createFixture();
  S.validateSnapshotCatalog([fixture]).then(() => {
    fs.writeFileSync(path.join(__dirname, "../data/pilot/synthetic-run.json"), S.canonicalizeSnapshot(fixture));
    console.log("Wrote canonical synthetic Ranking Snapshot v1 UI fixture.");
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { createFixture };
