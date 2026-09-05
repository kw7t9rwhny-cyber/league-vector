'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Snapshot = require(process.env.RANKING_SNAPSHOT_TEST_MODULE || '../ranking-snapshot-v1.js');
const prior = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/ranking-snapshot-v1/synthetic-prior.json'), 'utf8'));
const formats = ['dynasty-1qb', 'dynasty-superflex'];
const clone = value => structuredClone(value);
const player = (snapshot, format, name = 'bravo') => snapshot.formats[format].entries.find(entry => entry.player_id === `lv:synthetic:${name}`);
const invalid = fn => assert.throws(fn, error => error && error.code === 'invalid_snapshot');

async function successor(base = prior) {
  const value = clone(base);
  value.run_id += '-history-successor';
  value.generated_at = '2026-09-02T11:00:00.000Z';
  value.published_at = '2026-09-02T12:00:00.000Z';
  value.previous_run = await Snapshot.createPreviousRun(base);
  for (const format of formats) for (const entry of value.formats[format].entries) {
    for (const fact of entry.facts) fact.run_id = value.run_id;
    if (entry.ranking_status === 'RANKED') entry.history = { state: 'COMPARABLE', previous_rank: entry.rank, changed_fact_refs: [] };
  }
  return value;
}

function markChanged(value, predicate) {
  for (const format of formats) for (const entry of value.formats[format].entries) {
    if (entry.ranking_status === 'RANKED') entry.history.changed_fact_refs = entry.facts.filter(fact => predicate(fact, entry)).map(fact => fact.id).sort();
  }
}

async function acceptedCatalog(value, base = prior) {
  assert.equal(Snapshot.validateSnapshot(value), true);
  const bytes = Snapshot.canonicalizeSnapshot(value);
  assert.equal(Snapshot.canonicalizeSnapshot(Snapshot.parseCanonicalSnapshot(bytes)), bytes);
  assert.equal(await Snapshot.validateSnapshotCatalog([base, value]), true);
}

for (const [semantic, replacement] of [
  ['unit', 'different-synthetic-units'],
  ['unit', null],
  ['period', 'Different synthetic observation period'],
  ['as_of', '2026-08-31T00:00:00.000Z']
]) {
  test(`history records changed ${semantic} (${replacement}) with identical numeric input and authenticated prior`, async () => {
    const value = await successor();
    const bravo = player(value, formats[0]);
    const alpha = player(value, formats[0], 'alpha');
    [bravo.rank, alpha.rank] = [alpha.rank, bravo.rank];
    for (const format of formats) player(value, format).facts[0][semantic] = replacement;
    assert.equal(bravo.facts[0].value.value, player(prior, formats[0]).facts[0].value.value);
    invalid(() => Snapshot.validateSnapshot(value));
    markChanged(value, (_fact, entry) => entry.player_id === bravo.player_id);
    await acceptedCatalog(value);
    assert.equal(bravo.history.previous_rank, 1);
    assert.equal(bravo.rank, 3);
    assert.deepEqual(bravo.history.changed_fact_refs, [bravo.facts[0].id]);
    assert.deepEqual(alpha.history.changed_fact_refs, []);
  });
}

for (const [semantic, replacement] of [
  ['manifest_ref', 'synthetic://ranking-snapshot-v1/revised-input-meaning'],
  ['content_hash', `sha256:${'a'.repeat(64)}`]
]) {
  test(`history records changed input source ${semantic} with identical fact scalars`, async () => {
    const value = await successor();
    value.sources[0][semantic] = replacement;
    invalid(() => Snapshot.validateSnapshot(value));
    markChanged(value, () => true);
    await acceptedCatalog(value);
  });
}

test('unchanged input meaning stays unchanged across run/fact/source alias identity and administrative source refresh', async () => {
  const value = await successor();
  value.sources[0].source_id = 'synthetic-source-alias';
  value.sources[0].observed_at = '2026-09-02T10:00:00.000Z';
  value.sources[0].valid_until = '2026-09-08T00:00:00.000Z';
  for (const format of formats) for (const entry of value.formats[format].entries) {
    entry.identity_evidence_refs = ['synthetic-source-alias'];
    const ids = new Map(entry.facts.map(fact => [fact.id, `${fact.id}-successor`]));
    for (const fact of entry.facts) { fact.id = ids.get(fact.id); fact.source_id = 'synthetic-source-alias'; }
    for (const driver of entry.drivers) driver.fact_refs = driver.fact_refs.map(id => ids.get(id));
    for (const condition of entry.change_conditions) condition.fact_id = ids.get(condition.fact_id);
  }
  await acceptedCatalog(value);
  for (const format of formats) for (const entry of value.formats[format].entries) assert.deepEqual(entry.history.changed_fact_refs, []);
});

test('history distinguishes a changed known value from unchanged inputs', async () => {
  const value = await successor();
  for (const format of formats) player(value, format).facts[0].value.value = 0;
  invalid(() => Snapshot.validateSnapshot(value));
  markChanged(value, (_fact, entry) => entry.player_id === 'lv:synthetic:bravo');
  await acceptedCatalog(value);
});

test('history distinguishes changed absent-value states without inventing zero', async () => {
  const value = await successor();
  for (const format of formats) player(value, format, 'charlie').facts.find(fact => fact.field === 'optional_context').value.state = 'UNKNOWN';
  invalid(() => Snapshot.validateSnapshot(value));
  markChanged(value, fact => fact.field === 'optional_context');
  await acceptedCatalog(value);
});

test('removal of a prior optional input cannot claim unchanged inputs and is explicitly noncomparable', async () => {
  const value = await successor();
  for (const format of formats) {
    const entry = player(value, format, 'charlie');
    entry.facts = entry.facts.filter(fact => fact.field !== 'optional_context');
    entry.evidence_gaps = entry.evidence_gaps.filter(gap => gap !== 'optional_input_missing');
  }
  invalid(() => Snapshot.validateSnapshot(value));
  for (const format of formats) player(value, format, 'charlie').history = { state: 'NOT_COMPARABLE', previous_rank: null, changed_fact_refs: [] };
  await acceptedCatalog(value);
});

test('new optional input is represented by its current fact reference', async () => {
  const value = await successor();
  for (const format of formats) {
    const entry = player(value, format);
    entry.facts.push({ ...clone(entry.facts[0]), id: `${entry.facts[0].id}-optional`, field: 'optional_new_context', value: { state: 'KNOWN', value: false } });
  }
  invalid(() => Snapshot.validateSnapshot(value));
  markChanged(value, fact => fact.field === 'optional_new_context');
  await acceptedCatalog(value);
});

test('legacy field/value-only prior summaries fail closed instead of asserting comparability', async () => {
  const value = await successor();
  value.previous_run = clone(value.previous_run);
  for (const format of formats) for (const entry of value.previous_run.formats[format].entries) entry.facts = entry.facts.map(fact => ({ field: fact.field, value: fact.value }));
  invalid(() => Snapshot.validateSnapshot(value));
  await assert.rejects(() => Snapshot.validateSnapshotCatalog([prior, value]), error => error.code === 'invalid_snapshot');
});

for (const change of ['add', 'reference', 'remove']) {
  test(`history detects ${change} of explicit format derivation meaning`, async () => {
    const base = clone(prior);
    const derivation = format => ({ component_id: base.method.components[0].id, assumptions_id: base.formats[format].assumptions_id, reference: 'synthetic://format-derivation/v1' });
    if (change !== 'add') for (const format of formats) player(base, format).facts[0].format_derivation = derivation(format);
    const value = await successor(base);
    for (const format of formats) {
      const fact = player(value, format).facts[0];
      if (change === 'add') fact.format_derivation = derivation(format);
      else if (change === 'remove') delete fact.format_derivation;
      else fact.format_derivation.reference = 'synthetic://format-derivation/v2';
    }
    invalid(() => Snapshot.validateSnapshot(value));
    markChanged(value, (_fact, entry) => entry.player_id === 'lv:synthetic:bravo');
    await acceptedCatalog(value, base);
  });
}

test('unchanged format derivations remain unchanged across runs', async () => {
  const base = clone(prior);
  for (const format of formats) player(base, format).facts[0].format_derivation = { component_id: base.method.components[0].id, assumptions_id: base.formats[format].assumptions_id, reference: 'synthetic://format-derivation/v1' };
  const value = await successor(base);
  await acceptedCatalog(value, base);
});
