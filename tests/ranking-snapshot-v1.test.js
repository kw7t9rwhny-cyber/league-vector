'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash, webcrypto } = require('node:crypto');
const Snapshot = require('../ranking-snapshot-v1.js');

const fixtureDirectory = path.join(__dirname, '../fixtures/ranking-snapshot-v1');
const readFixture = name => JSON.parse(fs.readFileSync(path.join(fixtureDirectory, name), 'utf8'));
const prior = readFixture('synthetic-prior.json');
const current = readFixture('synthetic-current.json');
const formats = ['dynasty-1qb', 'dynasty-superflex'];
const clone = value => structuredClone(value);
const board = (snapshot, format = formats[0]) => snapshot.formats[format];
const ranked = (snapshot, format = formats[0]) => board(snapshot, format).entries.filter(entry => entry.ranking_status === 'RANKED');
const unsupported = snapshot => board(snapshot).entries.find(entry => entry.ranking_status === 'NOT_RANKED');
const invalid = fn => assert.throws(fn, error => error && error.code === 'invalid_snapshot');
const mutate = action => { const value = clone(current); action(value); return value; };
const query = (snapshot, player, format = formats[0]) => ({ run_id: snapshot.run_id, format, player_id: player.player_id });
const comparisonQuery = (snapshot, players, now = snapshot.published_at) => ({ run_id: snapshot.run_id, format: formats[0], player_ids: players.map(player => player.player_id), now });

function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).reverse().map(key => [key, reverseObjectKeys(value[key])]));
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

test('both fictional fixtures validate, contain both formats, and preserve explicit unsupported coverage', () => {
  for (const snapshot of [prior, current]) {
    assert.equal(Snapshot.validateSnapshot(snapshot), true);
    assert.equal(snapshot.data_kind, 'SYNTHETIC');
    assert.equal(snapshot.publication.rights_state, 'SYNTHETIC_ONLY');
    assert.deepEqual(Object.keys(snapshot.formats).sort(), formats.slice().sort());
    for (const format of formats) {
      const value = board(snapshot, format);
      assert.ok(ranked(snapshot, format).length >= 4);
      assert.equal(value.universe.coverage_count, ranked(snapshot, format).length);
      assert.deepEqual(new Set(value.universe.eligible_player_ids), new Set(ranked(snapshot, format).map(entry => entry.player_id)));
      for (const entry of value.entries) {
        assert.match(entry.player_id, /^lv:synthetic:/);
        assert.match(entry.name, /^Synthetic /);
        if (entry.ranking_status === 'NOT_RANKED') {
          assert.equal(entry.rank, null);
          assert.equal(entry.primary_reason, null);
          assert.equal(entry.evidence_state, 'UNAVAILABLE');
        }
      }
      const reasons = new Set(value.entries.map(entry => entry.unsupported_reason));
      for (const reason of ['rookie_method_unavailable', 'insufficient_history', 'identity_unresolved']) assert.ok(reasons.has(reason));
    }
  }
});

test('synthetic fixtures exercise exact competition ties and format-specific ranks', () => {
  for (const format of formats) {
    const values = ranked(current, format).map(entry => entry.rank).sort((a, b) => a - b);
    assert.deepEqual(values.slice(0, 3), [1, 1, 3]);
  }
  const second = new Map(ranked(current, formats[1]).map(entry => [entry.player_id, entry.rank]));
  assert.ok(ranked(current).some(entry => entry.rank !== second.get(entry.player_id)));
});

for (const example of readFixture('invalid-cases.json')) {
  test(`documented invalid fixture: ${example.name}`, () => {
    const value = clone(current);
    const parent = example.path.slice(0, -1).reduce((node, key) => node[key], value);
    const key = example.path.at(-1);
    if (example.append) parent[key].push(clone(example.value));
    else parent[key] = clone(example.value);
    invalid(() => Snapshot.validateSnapshot(value));
    if (example.name === 'duplicate-player') assert.throws(() => Snapshot.validateSnapshot(value), error => error.code === 'invalid_snapshot' && error.message === 'player: duplicate identity');
  });
}

const invalidCases = {
  'unsupported root format': value => { value.formats['dynasty-idp'] = clone(board(value)); },
  'missing required format': value => { delete value.formats[formats[1]]; },
  'duplicate player record': value => { board(value).entries.push(clone(board(value).entries[0])); },
  'conflicting duplicate identity': value => { const duplicate = clone(board(value).entries[0]); duplicate.name = 'Synthetic Conflicting Identity'; board(value).entries.push(duplicate); },
  'rank on unsupported record': value => { unsupported(value).rank = 1; },
  'zero rank': value => { ranked(value)[0].rank = 0; },
  'fractional rank': value => { ranked(value)[0].rank = 1.5; },
  'broken competition sequence': value => { ranked(value).find(entry => entry.rank === 3).rank = 2; },
  'ranked unresolved identity': value => { ranked(value)[0].identity_state = 'UNRESOLVED'; },
  'ranked missing verified name': value => { ranked(value)[0].name = ''; },
  'conflicting identity across formats': value => { ranked(value, formats[1])[0].name = 'Synthetic Contradictory Name'; },
  'ranked unsupported position': value => { ranked(value)[0].position = 'OTHER'; },
  'missing primary reason': value => { ranked(value)[0].primary_reason = null; },
  'primary reason referencing absent driver': value => { ranked(value)[0].primary_reason.driver_id = 'missing-driver'; },
  'unknown evidence state': value => { ranked(value)[0].evidence_state = 'HIGH_CONFIDENCE'; },
  'probability extension': value => { ranked(value)[0].probability = 0.99; },
  'market value extension': value => { ranked(value)[0].market_value = 5000; },
  'unrecognized root property': value => { value.additional_payload = {}; },
  'malformed source hash': value => { value.sources[0].content_hash = 'sha256:abc'; },
  'missing source manifest': value => { value.sources[0].manifest_ref = ''; },
  'unrecognized rights state': value => { value.publication.rights_state = 'APPROVED_BY_VALIDATOR'; },
  'synthetic fixture claiming source clearance': value => { value.publication.rights_state = 'CLEARED'; },
  'synthetic fixture with real eligible source': value => { value.sources[0].delivery_state = 'ELIGIBLE'; },
  'unbound identity provenance': value => { ranked(value)[0].identity_evidence_refs = ['absent-source']; },
  'unbound factual provenance': value => { ranked(value)[0].facts[0].source_id = 'absent-source'; },
  'cross-run fact': value => { ranked(value)[0].facts[0].run_id = 'other-run'; },
  'cross-format fact': value => { ranked(value)[0].facts[0].format = formats[1]; },
  'cross-player fact': value => { ranked(value)[0].facts[0].player_id = ranked(value)[1].player_id; },
  'broken driver fact reference': value => { ranked(value)[0].drivers[0].fact_refs = ['absent-fact']; },
  'unbound method component': value => { ranked(value)[0].drivers[0].component_id = 'absent-component'; },
  'zero used for missing age': value => { ranked(value)[0].age = { years: 0, as_of: value.data_cutoff }; },
  'numeric zero used for missing team': value => { ranked(value)[0].team = 0; },
  'omitted nullable field': value => { delete ranked(value)[0].age; },
  'documented label with an absent age': value => { const entry = ranked(value).find(item => item.age === null); entry.evidence_state = 'DOCUMENTED'; entry.evidence_gaps = []; },
  'unknown fact with numeric zero': value => { ranked(value)[0].facts[0].value = { state: 'UNKNOWN', value: 0 }; },
  'missing fact with numeric zero': value => { ranked(value)[0].facts[0].value = { state: 'MISSING', value: 0 }; },
  'known fact with null': value => { ranked(value)[0].facts[0].value = { state: 'KNOWN', value: null }; },
  'invalid calendar timestamp': value => { value.generated_at = '2026-02-30T12:00:00.000Z'; },
  'timestamp without required milliseconds': value => { value.generated_at = '2026-09-04T12:00:00Z'; },
  'timestamp with offset instead of canonical UTC': value => { value.generated_at = '2026-09-04T12:00:00.000+00:00'; },
  'cutoff after generation': value => { value.data_cutoff = '2099-01-01T00:00:00.000Z'; },
  'expiration before generation': value => { value.valid_until = value.data_cutoff; },
  'fact after cutoff': value => { ranked(value)[0].facts[0].as_of = '2099-01-01T00:00:00.000Z'; },
  'source expiration cannot be extended by root': value => { value.sources[0].valid_until = value.generated_at; },
  'mismatched coverage count': value => { board(value).universe.coverage_count += 1; },
  'duplicate eligible identity': value => { board(value).universe.eligible_player_ids.push(board(value).universe.eligible_player_ids[0]); },
  'unsupported eligible identity': value => { board(value).universe.eligible_player_ids.push(unsupported(value).player_id); },
};
for (const [name, action] of Object.entries(invalidCases)) {
  test(`validator fails closed for ${name}`, () => invalid(() => Snapshot.validateSnapshot(mutate(action))));
}

test('required unknown input withholds a ranked record instead of coercing to zero', () => {
  const value = clone(current);
  const fields = new Set(value.method.components.flatMap(component => component.required_fields));
  const fact = ranked(value)[0].facts.find(item => fields.has(item.field));
  assert.ok(fact, 'fixture has an actual method-required fact');
  fact.value = { state: 'MISSING', value: null };
  invalid(() => Snapshot.validateSnapshot(value));
  assert.equal(fact.value.value, null);
});

test('malformed nested object shapes fail with contract errors and comparison abstention', () => {
  for (const change of [value => { value.method.components = [null]; }, value => { value.sources = [null]; }, value => { board(value).entries = [null]; }]) {
    const value = mutate(change);
    invalid(() => Snapshot.validateSnapshot(value));
    assert.equal(Snapshot.comparePlayers(value, comparisonQuery(current, ranked(current).slice(0, 2))).state, 'UNAVAILABLE');
  }
});

test('fact and driver identifiers cannot be reused elsewhere in the same run', () => {
  const reusedFact = clone(current);
  const entry = ranked(reusedFact, formats[1])[0];
  const oldFactId = entry.facts[0].id;
  const collisionId = ranked(reusedFact)[0].facts[0].id;
  entry.facts[0].id = collisionId;
  for (const driver of entry.drivers) driver.fact_refs = driver.fact_refs.map(id => id === oldFactId ? collisionId : id);
  for (const condition of entry.change_conditions) if (condition.fact_id === oldFactId) condition.fact_id = collisionId;
  entry.history.changed_fact_refs = entry.history.changed_fact_refs.map(id => id === oldFactId ? collisionId : id);
  invalid(() => Snapshot.validateSnapshot(reusedFact));
  const reusedDriver = clone(current);
  const other = ranked(reusedDriver, formats[1])[0];
  const oldDriverId = other.drivers[0].id;
  const collisionDriver = ranked(reusedDriver)[0].drivers[0].id;
  other.drivers[0].id = collisionDriver;
  if (other.primary_reason.driver_id === oldDriverId) other.primary_reason.driver_id = collisionDriver;
  for (const condition of other.change_conditions) if (condition.basis_driver_id === oldDriverId) condition.basis_driver_id = collisionDriver;
  invalid(() => Snapshot.validateSnapshot(reusedDriver));
});

test('null optional facts remain null with honest limitations; observed numeric zero remains a value', () => {
  const entries = ranked(current);
  assert.ok(entries.some(entry => entry.age === null && entry.evidence_state === 'LIMITED' && entry.evidence_gaps.includes('missing_age')));
  assert.ok(entries.some(entry => entry.team === null && entry.team_state === 'UNKNOWN' && entry.evidence_gaps.includes('missing_team')));
  assert.ok(entries.some(entry => entry.change_conditions.length === 0 && entry.evidence_gaps.includes('missing_change_condition')));
  const value = clone(prior);
  const fact = ranked(value)[0].facts.find(item => item.value.state === 'KNOWN' && typeof item.value.value === 'number');
  assert.ok(fact);
  fact.value.value = 0;
  invalid(() => Snapshot.validateSnapshot(value));
  for (const format of formats) board(value, format).entries.find(entry => entry.player_id === fact.player_id).facts.find(item => item.field === fact.field).value.value = 0;
  assert.equal(Snapshot.validateSnapshot(value), true);
  const restored = Snapshot.parseCanonicalSnapshot(Snapshot.canonicalizeSnapshot(value));
  assert.equal(ranked(restored)[0].facts.find(item => item.id === fact.id).value.value, 0);
  for (const format of formats) assert.equal(board(restored, format).entries.find(entry => entry.player_id === fact.player_id).facts.find(item => item.field === fact.field).value.value, 0);
});

test('canonical round-trip preserves every explicit state and is independent of object key insertion order', async () => {
  const bytes = Snapshot.canonicalizeSnapshot(current);
  assert.equal(typeof bytes, 'string');
  assert.equal(bytes, Snapshot.canonicalizeSnapshot(reverseObjectKeys(current)));
  const restored = Snapshot.parseCanonicalSnapshot(bytes);
  assert.equal(Snapshot.canonicalizeSnapshot(restored), bytes);
  assert.equal(await Snapshot.snapshotArtifactId(restored), await Snapshot.snapshotArtifactId(current));
  assert.equal(await Snapshot.snapshotArtifactId(current), `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`);
  assertDeepFrozen(restored);
});

test('canonicalization does not mutate the caller snapshot', () => {
  const value = clone(current);
  const before = JSON.stringify(value);
  Snapshot.canonicalizeSnapshot(value);
  assert.equal(JSON.stringify(value), before);
  assert.equal(Object.isFrozen(value), false);
});

test('canonical entry ordering is competition rank then stable internal identity, independent of input order', () => {
  const value = clone(current);
  for (const format of formats) board(value, format).entries.reverse();
  assert.equal(Snapshot.validateSnapshot(value), true);
  assert.equal(Snapshot.canonicalizeSnapshot(value), Snapshot.canonicalizeSnapshot(current));
  const restored = Snapshot.parseCanonicalSnapshot(Snapshot.canonicalizeSnapshot(value));
  for (const format of formats) {
    const entries = ranked(restored, format);
    const expected = entries.slice().sort((a, b) => a.rank - b.rank || (a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0));
    assert.deepEqual(entries.map(entry => entry.player_id), expected.map(entry => entry.player_id));
  }
});

test('artifact identity binds safety-bearing provenance, method, limitation and fact data', async () => {
  const initial = await Snapshot.snapshotArtifactId(prior);
  const changes = [
    value => { value.sources[0].content_hash = `sha256:${'f'.repeat(64)}`; },
    value => { value.method.summary += ' Additional declared synthetic assumption.'; },
    value => { value.method.limitations[0].text += ' Additional synthetic limitation.'; },
    value => { value.publication.reference += '-revision'; },
    value => {
      const fact = ranked(value)[0].facts.find(item => typeof item.value.value === 'number');
      fact.value.value += 1;
      invalid(() => Snapshot.validateSnapshot(value));
      for (const format of formats) board(value, format).entries.find(entry => entry.player_id === fact.player_id).facts.find(item => item.field === fact.field).value.value = fact.value.value;
    },
  ];
  for (const change of changes) {
    const value = clone(prior);
    change(value);
    assert.equal(Snapshot.validateSnapshot(value), true);
    assert.notEqual(await Snapshot.snapshotArtifactId(value), initial);
  }
});

test('canonical parser rejects duplicate keys, malformed JSON and noncanonical byte representations', () => {
  const canonical = Snapshot.canonicalizeSnapshot(current);
  for (const bytes of ['', '{', `${canonical} `, `\n${canonical}`, canonical.replace('{', '{"schema_version":"shadow",')]) {
    invalid(() => Snapshot.parseCanonicalSnapshot(bytes));
  }
});

test('only strict JSON object graphs are accepted, without evaluating accessors', () => {
  const changes = [
    value => { value.run_id = undefined; },
    value => { value.run_id = 1n; },
    value => { value.run_id = () => 'run'; },
    value => { value.generated_at = new Date(); },
    value => { ranked(value)[0].age.years = Infinity; },
    value => { ranked(value)[0].facts[0].value.value = NaN; },
    value => { value.sources.push(undefined); },
    value => { value.sources.length += 1; },
    value => { value.self = value; },
    value => { Object.setPrototypeOf(value, { hidden: true }); },
    value => { value[Symbol('hidden')] = 'hidden'; },
  ];
  for (const change of changes) invalid(() => Snapshot.validateSnapshot(mutate(change)));
  let accessorRead = false;
  const value = clone(current);
  Object.defineProperty(value, 'run_id', { enumerable: true, get() { accessorRead = true; return 'run'; } });
  invalid(() => Snapshot.validateSnapshot(value));
  assert.equal(accessorRead, false);
});

test('previous-run summary reproduces the exact prior artifact and catalog accepts the authentic chain', async () => {
  const summary = await Snapshot.createPreviousRun(prior);
  assert.equal(summary.artifact_id, await Snapshot.snapshotArtifactId(prior));
  assert.equal(summary.run_id, prior.run_id);
  assert.deepEqual(summary, current.previous_run);
  assert.equal(await Snapshot.validateSnapshotCatalog([prior, current]), true);
  assertDeepFrozen(summary);
  assert.equal(prior.previous_run, null);
  for (const format of formats) for (const entry of ranked(prior, format)) {
    assert.deepEqual(entry.history, { state: 'FIRST_RUN', previous_rank: null, changed_fact_refs: [] });
  }
});

test('standalone history rejects false prior rank and fabricated changed-fact references', () => {
  const comparable = ranked(current).find(entry => entry.history.state === 'COMPARABLE');
  assert.ok(comparable);
  const wrongRank = mutate(value => { board(value).entries.find(entry => entry.player_id === comparable.player_id).history.previous_rank += 1; });
  invalid(() => Snapshot.validateSnapshot(wrongRank));
  const wrongFact = mutate(value => { board(value).entries.find(entry => entry.player_id === comparable.player_id).history.changed_fact_refs = ['absent-fact']; });
  invalid(() => Snapshot.validateSnapshot(wrongFact));
  const wrongState = mutate(value => { board(value).entries.find(entry => entry.player_id === comparable.player_id).history.state = 'FIRST_RUN'; });
  invalid(() => Snapshot.validateSnapshot(wrongState));
  invalid(() => Snapshot.validateSnapshot(mutate(value => { value.previous_run = null; })));
  invalid(() => Snapshot.validateSnapshot(mutate(value => { value.previous_run.method.summary += ' Incompatible method revision.'; })));
  invalid(() => Snapshot.validateSnapshot(mutate(value => { value.previous_run.formats[formats[0]].entries.find(entry => entry.ranking_status === 'RANKED').facts = []; })));
});

test('catalog rejects missing predecessors, duplicate run identity and forged prior artifact hashes', async () => {
  await assert.rejects(() => Snapshot.validateSnapshotCatalog([current]), error => error.code === 'invalid_snapshot');
  await assert.rejects(() => Snapshot.validateSnapshotCatalog([prior, prior, current]), error => error.code === 'invalid_snapshot');
  const forged = clone(current);
  forged.previous_run.artifact_id = `sha256:${'0'.repeat(64)}`;
  await assert.rejects(() => Snapshot.validateSnapshotCatalog([prior, forged]), error => error.code === 'invalid_snapshot');
  const altered = clone(prior);
  altered.publication.reference += '-changed';
  await assert.rejects(() => Snapshot.validateSnapshotCatalog([altered, current]), error => error.code === 'invalid_snapshot');
});

test('catalog rejects skipping an intervening published predecessor', async () => {
  const intermediate = clone(prior);
  intermediate.run_id += '-intermediate';
  intermediate.generated_at = new Date(Date.parse(prior.published_at) + 1).toISOString();
  intermediate.published_at = intermediate.generated_at;
  intermediate.previous_run = await Snapshot.createPreviousRun(prior);
  for (const format of formats) {
    for (const entry of board(intermediate, format).entries) {
      for (const fact of entry.facts) fact.run_id = intermediate.run_id;
      if (entry.ranking_status === 'RANKED') entry.history = { state: 'COMPARABLE', previous_rank: entry.rank, changed_fact_refs: [] };
    }
  }
  assert.equal(Snapshot.validateSnapshot(intermediate), true);
  assert.equal(await Snapshot.validateSnapshotCatalog([prior, intermediate]), true);
  await assert.rejects(() => Snapshot.validateSnapshotCatalog([prior, intermediate, current]), error => error.code === 'invalid_snapshot');
  intermediate.generated_at = new Date(Date.parse(current.generated_at) - 1).toISOString();
  intermediate.published_at = new Date((Date.parse(current.generated_at) + Date.parse(current.published_at)) / 2).toISOString();
  assert.equal(Snapshot.validateSnapshot(intermediate), true);
  await assert.rejects(() => Snapshot.validateSnapshotCatalog([prior, intermediate, current]), error => error.code === 'invalid_snapshot');
});

test('catalog verifies the complete previous summary instead of trusting its copied artifact ID', async () => {
  const forged = clone(current);
  forged.previous_run.method.summary += ' Forged prior method declaration.';
  for (const format of formats) {
    for (const entry of ranked(forged, format)) entry.history = { state: 'NOT_COMPARABLE', previous_rank: null, changed_fact_refs: [] };
  }
  assert.equal(forged.previous_run.artifact_id, current.previous_run.artifact_id);
  assert.equal(Snapshot.validateSnapshot(forged), true);
  await assert.rejects(() => Snapshot.validateSnapshotCatalog([prior, forged]), error => error.code === 'invalid_snapshot');
});

test('a previously unsupported player can become newly ranked without inventing prior rank or comparable movement', () => {
  const value = clone(current);
  for (const format of formats) {
    const valueBoard = board(value, format);
    const index = valueBoard.entries.findIndex(entry => entry.unsupported_reason === 'rookie_method_unavailable');
    const old = valueBoard.entries[index];
    const added = JSON.parse(JSON.stringify(ranked(value, format)[0]).replaceAll('alpha', 'rookie'));
    added.player_id = old.player_id;
    added.name = old.name;
    added.rank = valueBoard.universe.coverage_count + 1;
    added.history = { state: 'NEW_PLAYER', previous_rank: null, changed_fact_refs: [] };
    for (const entry of ranked(value, format)) entry.history = { state: 'NOT_COMPARABLE', previous_rank: null, changed_fact_refs: [] };
    valueBoard.entries[index] = added;
    valueBoard.universe.coverage_count += 1;
    valueBoard.universe.eligible_player_ids.push(added.player_id);
  }
  assert.equal(Snapshot.validateSnapshot(value), true);
  const restored = Snapshot.parseCanonicalSnapshot(Snapshot.canonicalizeSnapshot(value));
  for (const format of formats) {
    const added = ranked(restored, format).find(entry => entry.history.state === 'NEW_PLAYER');
    assert.ok(added);
    assert.equal(added.history.previous_rank, null);
    assert.deepEqual(added.history.changed_fact_refs, []);
  }
});

test('player selectors bind run and format and return immutable detached records', () => {
  const value = clone(current);
  const target = ranked(value)[0];
  const selected = Snapshot.selectPlayer(value, query(value, target));
  assert.equal(selected.player_id, target.player_id);
  assert.notEqual(selected, target);
  assertDeepFrozen(selected);
  target.name = 'Synthetic Changed Caller Object';
  assert.notEqual(selected.name, target.name);
  invalid(() => Snapshot.selectPlayer(current, { ...query(current, ranked(current)[0]), run_id: 'other-run' }));
  invalid(() => Snapshot.selectPlayer(current, { ...query(current, ranked(current)[0]), format: 'dynasty-idp' }));
  assert.equal(Snapshot.selectPlayer(current, { ...query(current, ranked(current)[0]), player_id: 'lv:synthetic:absent' }), null);
});

test('unsupported comparisons and expired current advice abstain; supported comparisons do not invent preference', () => {
  const players = ranked(current).slice(0, 2);
  const result = Snapshot.comparePlayers(current, comparisonQuery(current, players));
  assert.equal(result.state, 'NO_CLEAR_PREFERENCE');
  assertDeepFrozen(result);
  const unavailable = Snapshot.comparePlayers(current, comparisonQuery(current, [players[0], unsupported(current)]));
  assert.equal(unavailable.state, 'UNAVAILABLE');
  const expired = Snapshot.comparePlayers(current, comparisonQuery(current, players, '2099-01-01T00:00:00.000Z'));
  assert.equal(expired.state, 'UNAVAILABLE');
  const futurePublication = Snapshot.comparePlayers(current, comparisonQuery(current, players, current.generated_at));
  assert.equal(futurePublication.state, 'UNAVAILABLE');
  assert.equal(Snapshot.comparePlayers(current, { ...comparisonQuery(current, players), run_id: 'other-run' }).state, 'UNAVAILABLE');
  assert.equal(Snapshot.comparePlayers(current, comparisonQuery(current, [players[0], players[0]])).state, 'UNAVAILABLE');
});

test('serving state distinguishes synthetic, prepublication, expired, withdrawn and the seven-day cap', () => {
  assert.equal(Snapshot.getRunState(current, current.published_at), 'SYNTHETIC');
  assert.equal(Snapshot.getRunState(current, current.generated_at), 'UNAVAILABLE');
  assert.equal(Snapshot.getRunState(current, current.valid_until), 'OUTDATED');
  const withdrawn = clone(current);
  withdrawn.publication.state = 'WITHDRAWN';
  assert.equal(Snapshot.validateSnapshot(withdrawn), true);
  assert.equal(Snapshot.getRunState(withdrawn, withdrawn.published_at), 'UNAVAILABLE');
  assert.equal(Snapshot.comparePlayers(withdrawn, comparisonQuery(withdrawn, ranked(withdrawn).slice(0, 2))).state, 'UNAVAILABLE');
  invalid(() => Snapshot.selectPlayer(withdrawn, query(withdrawn, ranked(withdrawn)[0])));
  invalid(() => Snapshot.nearbyAlternatives(withdrawn, query(withdrawn, ranked(withdrawn)[0])));
  // Fictional bytes exercise the real-data serving gate; no real input or clearance is supplied.
  const staged = clone(prior);
  staged.data_kind = 'REAL'; staged.publication.state = 'STAGED'; staged.publication.rights_state = 'UNRESOLVED'; staged.published_at = null;
  for (const source of staged.sources) source.delivery_state = 'ELIGIBLE';
  assert.equal(Snapshot.validateSnapshot(staged), true);
  assert.equal(Snapshot.getRunState(staged, staged.generated_at), 'UNAVAILABLE');
  invalid(() => Snapshot.selectPlayer(staged, query(staged, ranked(staged)[0])));
  invalid(() => Snapshot.nearbyAlternatives(staged, query(staged, ranked(staged)[0])));
  const extended = clone(prior);
  extended.valid_until = '2026-09-20T00:00:00.000Z';
  for (const source of extended.sources) source.valid_until = extended.valid_until;
  assert.equal(Snapshot.validateSnapshot(extended), true);
  const weekAfter = new Date(Date.parse(extended.published_at) + 7 * 86400000).toISOString();
  assert.equal(Snapshot.getRunState(extended, new Date(Date.parse(weekAfter) - 1).toISOString()), 'SYNTHETIC');
  assert.equal(Snapshot.getRunState(extended, weekAfter), 'OUTDATED');
});

test('primary reasons render deterministic supported facts within the consumer length limit', () => {
  const reordered = reverseObjectKeys(current);
  for (const format of formats) {
    for (const entry of ranked(current, format)) {
      const selection = query(current, entry, format);
      const reason = Snapshot.renderPrimaryReason(current, selection);
      assert.equal(typeof reason, 'string');
      assert.ok(reason.length > 0 && reason.length <= 180);
      assert.equal(reason, Snapshot.renderPrimaryReason(reordered, selection));
      assert.match(reason, /supports the rank\.$/);
    }
  }
  assert.equal(Snapshot.renderPrimaryReason(current, query(current, unsupported(current))), null);
});

test('canonical-equivalent evidence orders produce identical primary reasons and selected evidence', () => {
  const value = clone(prior);
  value.method.components[0].required_fields.push('synthetic_second_signal');
  for (const format of formats) for (const entry of ranked(value, format)) {
    const extra = clone(entry.facts[0]);
    extra.id += '-extra'; extra.field = 'synthetic_second_signal'; extra.value = { state: 'KNOWN', value: 99 };
    entry.facts.push(extra);
    entry.drivers.find(driver => driver.id === entry.primary_reason.driver_id).fact_refs.push(extra.id);
  }
  const reordered = clone(value);
  for (const format of formats) {
    board(reordered, format).entries.reverse();
    for (const entry of ranked(reordered, format)) {
      entry.facts.reverse(); entry.drivers.reverse(); entry.evidence_gaps.reverse();
      for (const driver of entry.drivers) driver.fact_refs.reverse();
    }
  }
  assert.equal(Snapshot.validateSnapshot(value), true);
  assert.equal(Snapshot.validateSnapshot(reordered), true);
  assert.equal(Snapshot.canonicalizeSnapshot(value), Snapshot.canonicalizeSnapshot(reordered));
  const selection = query(value, ranked(value)[0]);
  assert.equal(Snapshot.renderPrimaryReason(value, selection), Snapshot.renderPrimaryReason(reordered, selection));
  assert.deepEqual(Snapshot.selectPlayer(value, selection), Snapshot.selectPlayer(reordered, selection));
  assert.deepEqual(Snapshot.nearbyAlternatives(value, selection), Snapshot.nearbyAlternatives(reordered, selection));
});

test('nearby alternatives are immutable, deterministic, and never borrow unsupported players', () => {
  const player = ranked(current)[0];
  const result = Snapshot.nearbyAlternatives(current, query(current, player));
  assert.ok(Array.isArray(result));
  assert.ok(result.length > 0 && result.length <= 2);
  assert.equal(new Set(result.map(entry => entry.player_id)).size, result.length);
  for (const entry of result) {
    assert.notEqual(entry.player_id, player.player_id);
    assert.equal(entry.ranking_status, 'RANKED');
    assert.equal(entry.position, player.position);
  }
  assertDeepFrozen(result);
  assert.deepEqual(result, Snapshot.nearbyAlternatives(current, query(current, player)));
  invalid(() => Snapshot.nearbyAlternatives(current, { ...query(current, player), run_id: 'other-run' }));
  assert.deepEqual(Snapshot.nearbyAlternatives(current, query(current, unsupported(current))), []);
  const wr = ranked(current).filter(entry => entry.position === 'WR').sort((a, b) => a.rank - b.rank || a.player_id.localeCompare(b.player_id));
  assert.equal(wr.length, 3);
  for (let index = 0; index < wr.length; index++) {
    assert.deepEqual(Snapshot.nearbyAlternatives(current, query(current, wr[index])).map(entry => entry.player_id), wr.filter((_, other) => index !== other).map(entry => entry.player_id));
  }
});

test('browser UMD build canonicalizes and hashes the same fixture with Web Crypto', async () => {
  const context = vm.createContext({ crypto: webcrypto, TextEncoder });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../ranking-snapshot-v1.js'), 'utf8'), context);
  const exported = context.LeagueVectorRankingSnapshotV1;
  assert.ok(exported, 'UMD attaches the snapshot API in a browser without CommonJS');
  const browserFixture = vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(current))})`, context);
  assert.equal(exported.validateSnapshot(browserFixture), true);
  assert.equal(exported.canonicalizeSnapshot(browserFixture), Snapshot.canonicalizeSnapshot(current));
  assert.equal(await exported.snapshotArtifactId(browserFixture), await Snapshot.snapshotArtifactId(current));
});
