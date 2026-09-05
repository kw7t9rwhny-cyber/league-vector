'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');
const modulePath = process.env.SNAPSHOT_MODULE || path.join(__dirname, '../ranking-snapshot-v1.js');
const Snapshot = require(modulePath);
const fixture = () => structuredClone(require('../fixtures/ranking-snapshot-v1/synthetic-prior.json'));
const formats = ['dynasty-1qb', 'dynasty-superflex'];
const alpha = (snapshot, format) => snapshot.formats[format].entries.find(entry => entry.player_id === 'lv:synthetic:alpha');
const signal = (snapshot, format) => alpha(snapshot, format).facts.find(fact => fact.field === 'synthetic_signal');
const invalid = error => error && error.code === 'invalid_snapshot';
function scope(snapshot, format) {
  signal(snapshot, format).format_derivation = {
    component_id: snapshot.method.components[0].id,
    assumptions_id: snapshot.formats[format].assumptions_id,
    reference: `synthetic://format-derivation/${format}/v1`,
  };
}
async function rejected(snapshot) {
  assert.throws(() => Snapshot.validateSnapshot(snapshot), invalid);
  assert.throws(() => Snapshot.canonicalizeSnapshot(snapshot), invalid);
  await assert.rejects(() => Snapshot.snapshotArtifactId(snapshot), invalid);
  assert.equal(Snapshot.comparePlayers(snapshot, { run_id: snapshot.run_id, format: formats[0], player_ids: ['lv:synthetic:alpha', 'lv:synthetic:bravo'], now: snapshot.published_at }).state, 'UNAVAILABLE');
}

for (const format of formats) {
  test(`P1-2: shared source observations cannot contradict in ${format}`, async () => {
    const snapshot = fixture();
    signal(snapshot, format).value.value = 999;
    assert.equal(alpha(snapshot, format).evidence_state, 'DOCUMENTED');
    await rejected(snapshot);
  });
}

test('P1-2: canonical parser rejects a contradictory serialized shared observation', () => {
  const snapshot = JSON.parse(Snapshot.canonicalizeSnapshot(fixture()));
  signal(snapshot, formats[1]).value.value = 999;
  assert.throws(() => Snapshot.parseCanonicalSnapshot(JSON.stringify(snapshot)), invalid);
});

test('P1-2: renaming a source alias cannot hide shared evidence conflicts', async () => {
  const snapshot = fixture();
  const alias = { ...snapshot.sources[0], source_id: 'synthetic-source-alias' };
  snapshot.sources.push(alias);
  signal(snapshot, formats[1]).source_id = alias.source_id;
  signal(snapshot, formats[1]).value.value = 999;
  await rejected(snapshot);
});

test('P1-2: optional missing-state disagreement also fails closed', async () => {
  const snapshot = fixture();
  for (const format of formats) {
    const entry = alpha(snapshot, format);
    entry.facts.push({ ...signal(snapshot, format), id: `${format}-optional`, field: 'synthetic_optional', value: { state: format === formats[0] ? 'MISSING' : 'UNKNOWN', value: null } });
    entry.evidence_state = 'LIMITED';
    entry.evidence_gaps.push('optional_input_missing');
  }
  await rejected(snapshot);
});

for (const scopedFormats of [[formats[1]], formats]) {
  test(`P1-2: explicit method/assumption derivations permit legitimate format inputs (${scopedFormats.length} scoped)`, async () => {
    const snapshot = fixture();
    for (const format of scopedFormats) scope(snapshot, format);
    signal(snapshot, formats[1]).value.value = 999;
    assert.equal(Snapshot.validateSnapshot(snapshot), true);
    const before = JSON.stringify(snapshot);
    const bytes = Snapshot.canonicalizeSnapshot(snapshot);
    const restored = Snapshot.parseCanonicalSnapshot(bytes);
    assert.equal(Snapshot.canonicalizeSnapshot(restored), bytes);
    assert.deepEqual(signal(restored, formats[1]).format_derivation, signal(snapshot, formats[1]).format_derivation);
    assert.equal(alpha(restored, formats[1]).evidence_state, 'DOCUMENTED');
    assert.match(Snapshot.renderPrimaryReason(restored, { run_id: restored.run_id, format: formats[1], player_id: 'lv:synthetic:alpha' }), /999/);
    assert.equal(await Snapshot.snapshotArtifactId(restored), `sha256:${createHash('sha256').update(bytes).digest('hex')}`);
    assert.equal(JSON.stringify(snapshot), before);
  });
}

for (const [name, mutate] of [
  ['other format assumptions', d => { d.assumptions_id = 'lv-pilot-dynasty-1qb/v1'; }],
  ['unknown component', d => { d.component_id = 'absent-component'; }],
  ['empty derivation reference', d => { d.reference = ''; }],
  ['missing derivation reference', d => { delete d.reference; }],
  ['unknown scope property', d => { d.unreviewed = true; }],
]) {
  test(`P1-2: scoped observation rejects ${name}`, async () => {
    const snapshot = fixture();
    scope(snapshot, formats[1]);
    signal(snapshot, formats[1]).value.value = 999;
    mutate(signal(snapshot, formats[1]).format_derivation);
    await rejected(snapshot);
  });
}

test('P1-2: a derivation component must actually declare the fact field', async () => {
  const snapshot = fixture();
  scope(snapshot, formats[1]);
  const fact = { ...signal(snapshot, formats[1]), id: 'sf-other-field', field: 'synthetic_other_field' };
  alpha(snapshot, formats[1]).facts.push(fact);
  await rejected(snapshot);
});

test('P1-2: null is not an explicit format derivation', async () => {
  const snapshot = fixture();
  signal(snapshot, formats[1]).format_derivation = null;
  await rejected(snapshot);
});

test('P1-2: equal shared facts preserve canonical SHA-256 through source aliases and set order', async () => {
  const snapshot = fixture();
  snapshot.sources.push({ ...snapshot.sources[0], source_id: 'synthetic-alias' });
  signal(snapshot, formats[1]).source_id = 'synthetic-alias';
  assert.equal(Snapshot.validateSnapshot(snapshot), true);
  const bytes = Snapshot.canonicalizeSnapshot(snapshot);
  snapshot.sources.reverse();
  assert.equal(Snapshot.canonicalizeSnapshot(snapshot), bytes);
  assert.equal(await Snapshot.snapshotArtifactId(snapshot), `sha256:${createHash('sha256').update(bytes).digest('hex')}`);
});

test('P1-2: browser/CommonJS agree on conflict rejection and scoped canonical readback', async () => {
  const context = vm.createContext({ crypto: webcrypto, TextEncoder });
  vm.runInContext(fs.readFileSync(modulePath, 'utf8'), context);
  const browser = context.LeagueVectorRankingSnapshotV1;
  const snapshot = fixture();
  signal(snapshot, formats[1]).value.value = 999;
  const intoBrowser = value => vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(value))})`, context);
  assert.throws(() => browser.validateSnapshot(intoBrowser(snapshot)), invalid);
  scope(snapshot, formats[1]);
  const value = intoBrowser(snapshot);
  assert.equal(browser.canonicalizeSnapshot(value), Snapshot.canonicalizeSnapshot(snapshot));
  assert.equal(await browser.snapshotArtifactId(value), await Snapshot.snapshotArtifactId(snapshot));
  assert.equal(browser.canonicalizeSnapshot(browser.parseCanonicalSnapshot(browser.canonicalizeSnapshot(value))), Snapshot.canonicalizeSnapshot(snapshot));
});
