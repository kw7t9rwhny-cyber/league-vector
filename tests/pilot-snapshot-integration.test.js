"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../ranking-snapshot-v1");
const A = require("../pilot-fixture-adapter");
const fixture = require("../data/pilot/synthetic-run.json");
const current = require("../fixtures/ranking-snapshot-v1/synthetic-current.json");
const prior = require("../fixtures/ranking-snapshot-v1/synthetic-prior.json");
const clone = value => structuredClone(value);
const format = "dynasty-1qb", now = Date.parse("2026-09-05T00:00:00.000Z");
const catalog = snapshots => JSON.stringify(snapshots.map(value => S.canonicalizeSnapshot(value)));
const read = (value, options = {}) => A.read(value, { format, now, ...options });
const entry = (value, board, id) => value.formats[board].entries.find(player => player.player_id === id);
const malformed = { code: "malformed_snapshot" };

test("Pilot admission rejects sparse, decorated and accessor arrays before serialization", async () => {
  let accessorReads = 0;
  for (const replace of [
    () => Object.assign(new Array(1), { extra: "Synthetic alias" }),
    () => Object.assign(["Synthetic alias"], { extra: "Synthetic hidden payload" }),
    () => Object.defineProperty([], "0", { enumerable: true, get() { accessorReads += 1; return "Synthetic alias"; } })
  ]) {
    const value = clone(fixture);
    for (const board of S.FORMATS) entry(value, board, "lv:synthetic:demo-001").aliases = replace();
    await assert.rejects(() => read(value), malformed);
  }
  assert.equal(accessorReads, 0);
});

test("a conflicting shared observation blocks Pilot admission even through a source alias", async () => {
  for (const alias of [false, true]) {
    const value = clone(fixture);
    const fact = entry(value, "dynasty-superflex", "lv:synthetic:demo-001").facts[0];
    if (alias) {
      value.sources.push({ ...value.sources[0], source_id: "synthetic-input-alias" });
      fact.source_id = "synthetic-input-alias";
    }
    fact.value.value = 99;
    await assert.rejects(() => read(value), malformed);
    await assert.rejects(() => read(value, { format: "dynasty-superflex" }), malformed);
  }
});

test("an explicit valid format derivation retains its separate observation in the Pilot", async () => {
  const value = clone(fixture);
  const fact = entry(value, "dynasty-superflex", "lv:synthetic:demo-001").facts[0];
  fact.value.value = 99;
  fact.format_derivation = {
    component_id: value.method.components[0].id,
    assumptions_id: value.formats["dynasty-superflex"].assumptions_id,
    reference: "synthetic://pilot-integration/format-derivation/v1"
  };
  const view = await read(value, { format: "dynasty-superflex" });
  const player = view.players.find(player => player.id === fact.player_id);
  assert.equal(player.reason, S.renderPrimaryReason(value, { run_id: value.run_id, format: "dynasty-superflex", player_id: fact.player_id }));
  assert.match(player.drivers[0].observation, /^99 /);
  assert.match(view.formats[format].players.find(player => player.id === fact.player_id).drivers[0].observation, /^2 /);
});

test("history admission requires the complete authenticated predecessor", async () => {
  await assert.rejects(() => read(current), malformed);
  const forged = clone(current);
  forged.previous_run.artifact_id = "sha256:" + "0".repeat(64);
  assert.equal(S.validateSnapshot(forged), true);
  await assert.rejects(() => read(forged, { priorCatalog: catalog([prior]) }), malformed);
  const legacy = clone(current);
  for (const board of Object.values(legacy.previous_run.formats)) for (const player of board.entries) {
    player.facts = player.facts.map(fact => ({ field: fact.field, value: fact.value }));
  }
  await assert.rejects(() => read(legacy, { priorCatalog: catalog([prior]) }), malformed);
});

test("predecessor transport preserves strict canonical parsing and rejects ambiguous data", async () => {
  const bytes = S.canonicalizeSnapshot(prior);
  for (const priorCatalog of [
    JSON.stringify([bytes + "\n"]),
    JSON.stringify([bytes.replace("{", '{"run_id":"duplicate",')]),
    JSON.stringify([prior]),
    JSON.stringify({ 0: bytes, length: 1 }),
    "[null]"
  ]) await assert.rejects(() => read(current, { priorCatalog }), malformed);
});

test("authenticated repaired history has canonical parity and retains changed input evidence", async () => {
  const options = { priorCatalog: catalog([prior]) };
  const view = await read(current, options);
  assert.deepEqual(await read(S.canonicalizeSnapshot(current), options), view);
  assert.equal(view.runId, current.run_id);
  assert.ok(Object.isFrozen(view.players));
  for (const id of ["lv:synthetic:alpha", "lv:synthetic:charlie"]) {
    const raw = entry(current, format, id), player = view.players.find(player => player.id === id);
    assert.deepEqual(player.history, raw.history);
    assert.deepEqual(player.changedFacts.map(fact => fact.id), raw.history.changed_fact_refs.slice(0, 3));
    assert.ok(player.changedFacts.every(fact => fact.asOf === raw.facts.find(input => input.id === fact.id).as_of));
  }
  assert.equal(view.players.find(player => player.id === "lv:synthetic:charlie").changedFacts.length, 2);
});

test("async admission binds the original request and snapshot before catalog validation awaits", async () => {
  const invalidRequest = { format, now, run: "unavailable-requested-run" };
  const rejectedRead = A.read(fixture, invalidRequest);
  invalidRequest.run = fixture.run_id;
  invalidRequest.format = "dynasty-superflex";
  await assert.rejects(() => rejectedRead, { code: "unavailable_run" });

  const value = clone(current);
  const request = { format, now, run: current.run_id, priorCatalog: catalog([prior]) };
  const pendingRead = A.read(value, request);
  request.format = "dynasty-superflex";
  request.run = "changed-requested-run";
  request.now = Date.parse("2026-09-20T00:00:00.000Z");
  request.priorCatalog = "[]";
  value.run_id = "changed-snapshot-run";
  entry(value, format, "lv:synthetic:alpha").history.previous_rank = 999;
  const view = await pendingRead;
  assert.equal(view.runId, current.run_id);
  assert.equal(view.format, format);
  assert.equal(view.runState, S.getRunState(current, new Date(now).toISOString()));
  assert.equal(view.players.find(player => player.id === "lv:synthetic:alpha").history.previous_rank, 3);
  assert.ok(Object.isFrozen(view));
  assert.ok(Object.isFrozen(view.players.find(player => player.id === "lv:synthetic:alpha").history));
});

async function successor() {
  const value = clone(prior);
  value.run_id = "synthetic-pilot-integration-successor";
  value.generated_at = "2026-09-02T11:00:00.000Z";
  value.published_at = "2026-09-02T12:00:00.000Z";
  value.previous_run = await S.createPreviousRun(prior);
  for (const board of S.FORMATS) for (const player of value.formats[board].entries) {
    for (const fact of player.facts) fact.run_id = value.run_id;
    if (player.ranking_status === "RANKED") player.history = { state: "COMPARABLE", previous_rank: player.rank, changed_fact_refs: [] };
  }
  return value;
}

test("equal scalar with changed input units is displayed as authenticated changed evidence", async () => {
  const value = await successor();
  for (const board of S.FORMATS) {
    const player = entry(value, board, "lv:synthetic:bravo"), fact = player.facts[0];
    fact.unit = "different-synthetic-units";
    player.history.changed_fact_refs = [fact.id];
    assert.equal(fact.value.value, entry(prior, board, player.player_id).facts[0].value.value);
  }
  const view = await read(value, { priorCatalog: catalog([prior]) });
  const player = view.players.find(player => player.id === "lv:synthetic:bravo");
  assert.equal(player.history.state, "COMPARABLE");
  assert.equal(player.changedFacts.length, 1);
  assert.match(player.changedFacts[0].text, /21 different-synthetic-units/);
});

test("authenticated unchanged inputs remain unchanged when stored ranks move", async () => {
  const value = await successor();
  for (const board of S.FORMATS) {
    const alpha = entry(value, board, "lv:synthetic:alpha"), bravo = entry(value, board, "lv:synthetic:bravo");
    [alpha.rank, bravo.rank] = [bravo.rank, alpha.rank];
  }
  const view = await read(value, { priorCatalog: catalog([prior]) });
  const player = view.players.find(player => player.id === "lv:synthetic:alpha");
  assert.notEqual(player.history.previous_rank, player.rank);
  assert.equal(player.history.state, "COMPARABLE");
  assert.deepEqual(player.changedFacts, []);
});

test("Pilot mapping keeps known zero, absent context and unsupported records distinct", async () => {
  const view = await read(current, { priorCatalog: catalog([prior]) });
  const zero = view.players.find(player => player.id === "lv:synthetic:echo");
  const missing = view.players.find(player => player.id === "lv:synthetic:charlie");
  const unsupported = view.players.find(player => player.id === "lv:synthetic:rookie");
  assert.match(zero.reason, /: 0 /);
  assert.match(zero.drivers[0].observation, /^0 /);
  assert.equal(missing.age, null);
  assert.equal(missing.team, null);
  assert.ok(missing.changedFacts.some(fact => /optional context: MISSING/.test(fact.text)));
  assert.equal(unsupported.rankingStatus, "NOT_RANKED");
  assert.equal(unsupported.rank, null);
  assert.equal(unsupported.reason, null);
  assert.equal(view.players.find(player => player.id === "lv:synthetic:absent"), undefined);
  const omitted = clone(fixture);
  for (const board of S.FORMATS) delete entry(omitted, board, "lv:synthetic:demo-001").age;
  await assert.rejects(() => read(omitted), malformed);
});

test("repaired history consumers abstain for both ties and distinct stored ranks", async () => {
  const view = await read(current, { priorCatalog: catalog([prior]) });
  for (const ids of [["lv:synthetic:alpha", "lv:synthetic:bravo"], ["lv:synthetic:alpha", "lv:synthetic:echo"]]) {
    const refs = ids.map(id => ({ id, format, run: view.runId }));
    const result = A.compare(view, refs, now);
    assert.equal(result.outcome, "NO_CLEAR_PREFERENCE");
    assert.deepEqual(result.players.map(player => player.id), ids);
    assert.match(result.reason, /order alone does not establish a supported preference/);
    assert.deepEqual(Object.keys(result).sort(), ["outcome", "players", "reason"]);
  }
});
