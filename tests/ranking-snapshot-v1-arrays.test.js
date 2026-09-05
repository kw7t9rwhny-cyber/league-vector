'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash, webcrypto } = require('node:crypto');
const modulePath = process.env.SNAPSHOT_MODULE || path.join(__dirname, '../ranking-snapshot-v1.js');
const Snapshot = require(modulePath);
const fixtureText = fs.readFileSync(path.join(__dirname, '../fixtures/ranking-snapshot-v1/synthetic-prior.json'), 'utf8');
const fixture = () => JSON.parse(fixtureText);
const alphaEntries = snapshot => Object.values(snapshot.formats).map(board => board.entries.find(entry => entry.player_id === 'lv:synthetic:alpha'));
const invalid = error => error && error.code === 'invalid_snapshot';

function replaceArrays(snapshot, field, makeArray) {
  for (const entry of alphaEntries(snapshot)) entry[field] = makeArray(entry[field]);
  return snapshot;
}

async function rejectsBeforeSerialization(snapshot) {
  assert.throws(() => Snapshot.validateSnapshot(snapshot), invalid);
  assert.throws(() => Snapshot.canonicalizeSnapshot(snapshot), invalid);
  await assert.rejects(() => Snapshot.snapshotArtifactId(snapshot), invalid);
}

for (const field of ['aliases', 'identity_evidence_refs', 'limitations', 'change_conditions']) {
  test(`P1-1: a hole plus a named property cannot supply ${field}`, async () => {
    const snapshot = replaceArrays(fixture(), field, original => {
      const array = new Array(1);
      array.extra = original[0];
      return array;
    });
    for (const entry of alphaEntries(snapshot)) {
      assert.equal(entry.evidence_state, 'DOCUMENTED');
      assert.equal(entry[field].length, 1);
      assert.equal(Object.hasOwn(entry[field], 0), false);
      assert.equal(Reflect.ownKeys(entry[field]).length, 2);
    }
    await rejectsBeforeSerialization(snapshot);
  });
}

test('P1-1: canonicalization must reject accepted-data loss before emitting null holes', () => {
  const snapshot = replaceArrays(fixture(), 'aliases', () => Object.assign(new Array(1), { extra: 'Synthetic alias A' }));
  assert.throws(() => Snapshot.canonicalizeSnapshot(snapshot), invalid);
});

test('P1-1: hashing rejects both differing named payloads instead of discarding them', async () => {
  for (const alias of ['Synthetic alias A', 'Synthetic alias B']) {
    const snapshot = replaceArrays(fixture(), 'aliases', () => Object.assign(new Array(1), { extra: alias }));
    await assert.rejects(() => Snapshot.snapshotArtifactId(snapshot), invalid);
  }
});

for (const property of ['01', '-0', '-1', '1.0', '1e0', '4294967295', '9007199254740991']) {
  test(`P1-1: non-index property ${property} cannot replace a missing numeric index`, async () => {
    const snapshot = replaceArrays(fixture(), 'aliases', () => {
      const array = new Array(1);
      array[property] = 'Synthetic alias';
      return array;
    });
    await rejectsBeforeSerialization(snapshot);
  });
}

const rejectedShapes = {
  'an empty sparse array': () => new Array(1),
  'an interior hole': () => { const array = ['Synthetic A', 'Synthetic B', 'Synthetic C']; delete array[1]; return array; },
  'a trailing hole': () => { const array = ['Synthetic A']; array.length = 2; return array; },
  'multiple holes disguised by named properties': () => Object.assign(new Array(2), { first: 'Synthetic A', second: 'Synthetic B' }),
  'a dense array with an extra property': () => Object.assign(['Synthetic A'], { extra: 'Synthetic B' }),
  'an empty array with a named property': () => Object.assign([], { extra: 'Synthetic A' }),
  'a dense array with a hidden property': () => Object.defineProperty(['Synthetic A'], 'extra', { value: 'Synthetic B' }),
  'a hidden numeric index': () => Object.defineProperty([], '0', { value: 'Synthetic A' }),
  'a symbol property': () => Object.assign(['Synthetic A'], { [Symbol('extra')]: 'Synthetic B' }),
  'a hole disguised by a symbol property': () => Object.assign(new Array(1), { [Symbol('extra')]: 'Synthetic A' }),
  'an undefined numeric member': () => [undefined],
  'an inherited numeric member': () => Object.setPrototypeOf(new Array(1), Object.assign(Object.create(Array.prototype), { 0: 'Synthetic A' }))
};
for (const [description, makeArray] of Object.entries(rejectedShapes)) {
  test(`P1-1: reject ${description}`, async () => {
    await rejectsBeforeSerialization(replaceArrays(fixture(), 'aliases', makeArray));
  });
}

for (const property of ['0', 'extra', 'toJSON']) {
  test(`P1-1: an array accessor at ${property} is rejected without execution`, async () => {
    let reads = 0;
    const snapshot = replaceArrays(fixture(), 'aliases', () => {
      const array = property === '0' ? [] : new Array(1);
      Object.defineProperty(array, property, { enumerable: true, get() { reads += 1; return 'Synthetic alias'; } });
      return array;
    });
    await rejectsBeforeSerialization(snapshot);
    assert.equal(reads, 0);
  });
}

for (const aliases of [[], ['Synthetic A'], ['Synthetic A', 'Synthetic B', 'Synthetic \u03a9']]) {
  test(`P1-1: accepted dense arrays of length ${aliases.length} preserve all data on readback`, async () => {
    const snapshot = replaceArrays(fixture(), 'aliases', () => aliases.slice());
    assert.equal(Snapshot.validateSnapshot(snapshot), true);
    const canonicalInput = JSON.parse(Snapshot.canonicalizeSnapshot(snapshot));
    const before = structuredClone(canonicalInput);
    for (const entry of alphaEntries(canonicalInput)) Object.freeze(entry.aliases);
    assert.equal(Snapshot.validateSnapshot(canonicalInput), true);
    const bytes = Snapshot.canonicalizeSnapshot(canonicalInput);
    const restored = Snapshot.parseCanonicalSnapshot(bytes);
    assert.deepEqual(restored, before);
    for (const entry of alphaEntries(restored)) assert.deepEqual(entry.aliases, aliases);
    assert.equal(Snapshot.canonicalizeSnapshot(restored), bytes);
    assert.equal(await Snapshot.snapshotArtifactId(restored), `sha256:${createHash('sha256').update(bytes).digest('hex')}`);
    assert.deepEqual(canonicalInput, before);
  });
}

test('P1-1: browser and CommonJS agree on array rejection and canonical readback', async () => {
  const context = vm.createContext({ TextEncoder, crypto: webcrypto, fixtureText });
  vm.runInContext(fs.readFileSync(modulePath, 'utf8'), context);
  const result = await vm.runInContext(`(async () => {
    const api = LeagueVectorRankingSnapshotV1;
    const snapshot = JSON.parse(fixtureText);
    const bytes = api.canonicalizeSnapshot(snapshot);
    const restored = api.parseCanonicalSnapshot(bytes);
    const hash = await api.snapshotArtifactId(restored);
    const malformed = JSON.parse(fixtureText);
    for (const board of Object.values(malformed.formats)) {
      const entry = board.entries.find(item => item.player_id === 'lv:synthetic:alpha');
      entry.aliases = Object.assign(new Array(1), { extra: 'Synthetic alias' });
    }
    const errors = [];
    for (const action of [() => api.validateSnapshot(malformed), () => api.canonicalizeSnapshot(malformed), () => api.snapshotArtifactId(malformed)]) {
      try { await action(); errors.push(null); } catch (error) { errors.push(error.code); }
    }
    return JSON.stringify({ bytes, hash, readback: api.canonicalizeSnapshot(restored), errors });
  })()`, context);
  const browser = JSON.parse(result);
  assert.deepEqual(browser.errors, ['invalid_snapshot', 'invalid_snapshot', 'invalid_snapshot']);
  assert.equal(browser.bytes, Snapshot.canonicalizeSnapshot(fixture()));
  assert.equal(browser.readback, browser.bytes);
  assert.equal(browser.hash, await Snapshot.snapshotArtifactId(fixture()));
});
