const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const S = require("../ranking-snapshot-v1");
const A = require("../pilot-fixture-adapter");
const fixture = require("../data/pilot/synthetic-run.json");
const current = require("../fixtures/ranking-snapshot-v1/synthetic-current.json");
const prior = require("../fixtures/ranking-snapshot-v1/synthetic-prior.json");
const clone = () => structuredClone(fixture);
const now = Date.parse("2026-09-05T00:00:00Z");
const read = (raw = clone(), format = "dynasty-1qb", run = undefined) => A.read(raw, { format, run, now, priorCatalog: JSON.stringify(raw === current ? [S.canonicalizeSnapshot(prior)] : []) });
const refs = (v, a = "lv:synthetic:demo-001", b = "lv:synthetic:demo-002") => [a, b].map(id => ({ id, format: v.format, run: v.runId }));

test("UI fixture is reproducible canonical Snapshot v1 and passes catalog admission", async () => {
  const generated = require("../scripts/build-pilot-fixture").createFixture();
  assert.equal(S.canonicalizeSnapshot(generated), fs.readFileSync("data/pilot/synthetic-run.json", "utf8"));
  assert.equal(await S.validateSnapshotCatalog([generated]), true);
  assert.equal(await S.validateSnapshotCatalog([prior, current]), true);
});

test("both formats preserve exact Snapshot identities, missing fields and immutable views", async () => {
  const qb = await read(), sf = await read(clone(), "dynasty-superflex");
  assert.equal(qb.runId, sf.runId); assert.equal(qb.players[0].id, "lv:synthetic:demo-001"); assert.equal(sf.players[0].id, "lv:synthetic:demo-003");
  assert.equal(qb.players.length, 66); assert.equal(qb.players.at(-1).rank, null); assert.ok(Object.isFrozen(qb.players[0].drivers));
  assert.equal(qb.players.find(p => p.id === "lv:synthetic:demo-003").team, null);
  assert.equal(qb.players[0].age.years, 25);
});

test("presentation reasons match the exact Snapshot template", async () => {
  for (const format of A.FORMATS) {
    const v = await read(clone(), format);
    for (const p of v.players.slice(0, 5)) assert.equal(p.reason, S.renderPrimaryReason(fixture, { run_id: fixture.run_id, format, player_id: p.id }));
  }
});

test("search covers the entire universe and approved aliases without identity merging", async () => {
  const v = await read(); assert.equal(A.search(v, "the LANTERN")[0].rank, 64);
  assert.equal(A.search(v, "newleaf")[0].rankingStatus, "NOT_RANKED");
  assert.equal(A.search(v, "Aster Vale Jr").length, 0); assert.equal(A.search(v, "", "QB")[0].rank, 3);
});

test("neighbors are delegated to exact Snapshot same-position semantics", async () => {
  const v = await read(), group = v.players.filter(p => p.position === "WR" && p.rank);
  assert.deepEqual(A.neighbors(v, group[0]).map(p => p.id), [group[1].id, group[2].id]);
  assert.deepEqual(A.neighbors(v, group[1]).map(p => p.id), [group[0].id, group[2].id]);
  assert.deepEqual(A.neighbors(v, group.at(-1)).map(p => p.id), [group.at(-3).id, group.at(-2).id]);
});

test("comparison never manufactures a winner when Snapshot v1 has no pairwise rule", async () => {
  const v = await read();
  assert.equal(A.compare(v, refs(v), now).outcome, "NO_CLEAR_PREFERENCE");
  assert.equal(A.compare(v, refs(v).reverse(), now).outcome, "NO_CLEAR_PREFERENCE");
  const tied = await read(current);
  assert.match(A.compare(tied, refs(tied, "lv:synthetic:alpha", "lv:synthetic:bravo"), now).reason, /exact rank/);
});

for (const [name, mutate, code] of [
  ["one player", r => r.pop(), "invalid_compare"], ["same player", r => { r[1] = r[0]; }, "invalid_compare"],
  ["third player", r => r.push(r[0]), "invalid_compare"], ["cross format", r => { r[1].format = "dynasty-superflex"; }, "cross_format_compare"],
  ["cross run", r => { r[1].run = "demo-old"; }, "cross_run_compare"],
  ["unsupported player", r => { r[1].id = "lv:synthetic:demo-rookie"; }, "unsupported_compare"],
  ["unknown player", r => { r[1].id = "lv:synthetic:absent"; }, "unsupported_compare"]
]) test(`rejects ${name}`, async () => { const v = await read(), r = refs(v); mutate(r); assert.throws(() => A.compare(v, r, now), { code }); });

test("outdated, withdrawn and future runs use exact Snapshot lifecycle semantics", async () => {
  const v = await read(); assert.throws(() => A.compare(v, refs(v), Date.parse(v.reviewAt)), { code: "outdated_compare" });
  const raw = clone(); raw.publication.state = "WITHDRAWN"; raw.published_at = raw.generated_at;
  await assert.rejects(() => read(raw), { code: "revoked_snapshot" });
  await assert.rejects(() => A.read(fixture, { format: "dynasty-1qb", now: Date.parse("2026-09-01") }), { code: "unavailable_run" });
});

test("missing, unknown run and invalid format remain distinct", async () => {
  await assert.rejects(() => read(null), { code: "no_snapshot" }); await assert.rejects(() => read(clone(), "invalid"), { code: "unsupported_format" });
  await assert.rejects(() => read(clone(), "dynasty-1qb", "missing"), { code: "unavailable_run" });
});

test("browser canonical parsing fails closed on duplicate JSON keys and noncanonical bytes", async () => {
  const bytes = S.canonicalizeSnapshot(fixture);
  await assert.rejects(() => read(bytes.replace('{', '{"run_id":"duplicate",')), { code: "malformed_snapshot" });
  await assert.rejects(() => read(bytes + "\n"), { code: "malformed_snapshot" });
  assert.equal((await read(bytes)).runId, fixture.run_id);
});

for (const [name, mutate] of [
  ["invalid other format", r => { r.formats["dynasty-superflex"].entries[0].rank = 0; }],
  ["conflicting identity", r => { r.formats["dynasty-superflex"].entries[0].name = "Synthetic Another Person"; }],
  ["unknown schema field", r => { r.extra = true; }],
  ["missing source", r => { r.sources = []; }],
  ["missing required driver", r => { r.formats["dynasty-1qb"].entries[0].drivers = []; }]
]) test(`delegates malformed admission: ${name}`, async () => { const raw = clone(); mutate(raw); await assert.rejects(() => read(raw), { code: "malformed_snapshot" }); });

test("a structurally valid REAL snapshot is still refused by this synthetic-only UI", async () => {
  const raw = clone(); raw.data_kind = "REAL"; raw.publication.rights_state = "CLEARED";
  raw.sources.forEach(s => { s.delivery_state = "ELIGIBLE"; });
  assert.equal(S.validateSnapshot(raw), true);
  await assert.rejects(() => read(raw), { code: "malformed_snapshot" });
});

test("history and change facts are mapped from the validated Snapshot entry", async () => {
  const v = await read(current), alpha = v.players.find(p => p.id === "lv:synthetic:alpha");
  assert.equal(alpha.history.state, "COMPARABLE"); assert.equal(alpha.history.previous_rank, 3); assert.equal(alpha.changedFacts.length, 1);
  assert.equal((await read(prior)).players.find(p => p.id === "lv:synthetic:alpha").history.state, "FIRST_RUN");
});

test("three static surfaces are synthetic and load only Snapshot/Pilot scripts", () => {
  for (const name of ["rankings", "player", "compare"]) {
    const html = fs.readFileSync(`${name}.html`, "utf8"); assert.match(html, /noindex,follow/); assert.match(html, /DEMO · SYNTHETIC DATA/);
    assert.deepEqual([...html.matchAll(/<script src="([^"]+)/g)].map(m => m[1]), ["ranking-snapshot-v1.js", "pilot-fixture-adapter.js", "pilot-ui.js"]);
    assert.doesNotMatch(html, /sleeper|https:\/\/|login|leagueId/i);
  }
});

test("iPhone project is scoped to Pilot spec filenames", () => {
  const p = require("../playwright.config").projects.find(p => p.name === "iphone-webkit");
  assert.ok(p.testMatch.test("/tmp/league-vector-pilot-ui/tests/e2e/pilot.spec.js"));
  assert.ok(!p.testMatch.test("/tmp/league-vector-pilot-ui/tests/e2e/command-center-mobile-header.spec.js"));
});
