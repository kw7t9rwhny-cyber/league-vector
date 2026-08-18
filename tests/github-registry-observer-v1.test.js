'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ALLOWED_REPOSITORY,
  observeRepositoryWorkflows,
} = require('../scripts/github-registry-observer-v1.js');

const PATH = '.github/workflows/research-qa-controller-v01.yml';
const NAME = 'Reusable Research QA Controller v0.1';
const ID = 12345;
const CLOCK = () => new Date('2026-08-18T19:30:00.000Z');
const credentialProvider = async () => 'fixture-secret-that-must-never-appear';

function headers(values = {}) {
  const normalized = Object.fromEntries(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name) => normalized[name.toLowerCase()] ?? null };
}

function response(status, body, headerValues = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: headers(headerValues),
    async json() {
      if (body instanceof Error) throw body;
      return body;
    },
  };
}

function workflow(overrides = {}) {
  return { id: ID, name: NAME, path: PATH, state: 'active', ...overrides };
}

function fetchSequence(sequence, calls) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    const next = sequence.shift();
    if (next instanceof Error) throw next;
    if (typeof next === 'function') return next(url, init);
    return next;
  };
}

async function observe(sequence, { path = PATH, timeoutMs = 1000 } = {}) {
  const calls = [];
  const output = await observeRepositoryWorkflows({
    repository: ALLOWED_REPOSITORY,
    expected_workflow_paths: [path],
    fetchImpl: fetchSequence([...sequence], calls),
    credentialProvider,
    clock: CLOCK,
    timeoutMs,
  });
  return { output, calls };
}

test('active workflow -> VERIFIED_ENABLED', async () => {
  const { output } = await observe([
    response(200, { workflows: [workflow()] }),
    response(200, workflow()),
  ]);
  assert.equal(output.workflows[0].normalized_state, 'VERIFIED_ENABLED');
  assert.equal(output.workflows[0].workflow_id, ID);
});

test('recognized disabled workflow -> VERIFIED_DISABLED', async () => {
  const { output } = await observe([
    response(200, { workflows: [workflow({ state: 'disabled_manually' })] }),
    response(200, workflow({ state: 'disabled_manually' })),
  ]);
  assert.equal(output.workflows[0].normalized_state, 'VERIFIED_DISABLED');
});

test('missing workflow -> UNVERIFIED', async () => {
  const { output } = await observe([response(200, { workflows: [] })]);
  assert.equal(output.workflows[0].normalized_state, 'UNVERIFIED');
  assert.equal(output.workflows[0].errors[0].code, 'WORKFLOW_NOT_RESOLVED');
});

test('duplicate exact path -> UNVERIFIED', async () => {
  const { output } = await observe([response(200, { workflows: [workflow(), workflow({ id: 777 })] })]);
  assert.equal(output.workflows[0].normalized_state, 'UNVERIFIED');
  assert.equal(output.workflows[0].errors[0].code, 'AMBIGUOUS_IDENTITY');
});

test('same name / wrong path is rejected', async () => {
  const { output } = await observe([response(200, { workflows: [workflow({ path: '.github/workflows/wrong.yml' })] })]);
  assert.equal(output.workflows[0].normalized_state, 'UNVERIFIED');
  assert.equal(output.workflows[0].errors[0].code, 'WORKFLOW_NOT_RESOLVED');
});

test('list identity differs from get identity -> UNVERIFIED', async () => {
  const { output } = await observe([
    response(200, { workflows: [workflow()] }),
    response(200, workflow({ name: 'Different name' })),
  ]);
  assert.equal(output.workflows[0].errors[0].code, 'IDENTITY_MISMATCH');
});

test('wrong numeric ID -> UNVERIFIED', async () => {
  const { output } = await observe([
    response(200, { workflows: [workflow()] }),
    response(200, workflow({ id: 999 })),
  ]);
  assert.equal(output.workflows[0].normalized_state, 'UNVERIFIED');
  assert.equal(output.workflows[0].errors[0].code, 'IDENTITY_MISMATCH');
});

test('unknown raw state -> UNVERIFIED', async () => {
  const { output } = await observe([
    response(200, { workflows: [workflow({ state: 'future_state' })] }),
    response(200, workflow({ state: 'future_state' })),
  ]);
  assert.equal(output.workflows[0].normalized_state, 'UNVERIFIED');
  assert.equal(output.workflows[0].errors[0].code, 'UNKNOWN_STATE');
});

test('401/auth failure -> UNVERIFIED', async () => {
  const { output } = await observe([response(401, { message: 'bad credentials' })]);
  assert.equal(output.workflows[0].errors[0].code, 'AUTH_FAILURE');
});

test('403/permission failure -> UNVERIFIED', async () => {
  const { output } = await observe([response(403, { message: 'forbidden' }, { 'x-ratelimit-remaining': '12' })]);
  assert.equal(output.workflows[0].errors[0].code, 'PERMISSION_FAILURE');
});

test('404 workflow get -> UNVERIFIED', async () => {
  const { output } = await observe([
    response(200, { workflows: [workflow()] }),
    response(404, { message: 'not found' }),
  ]);
  assert.equal(output.workflows[0].errors[0].code, 'WORKFLOW_GET_NOT_FOUND');
});

test('rate limit -> UNVERIFIED', async () => {
  const { output } = await observe([response(403, { message: 'rate limited' }, { 'x-ratelimit-remaining': '0' })]);
  assert.equal(output.workflows[0].errors[0].code, 'RATE_LIMIT');
});

test('timeout -> UNVERIFIED', async () => {
  const timeoutFetch = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  });
  const output = await observeRepositoryWorkflows({
    repository: ALLOWED_REPOSITORY,
    expected_workflow_paths: [PATH],
    fetchImpl: timeoutFetch,
    credentialProvider,
    clock: CLOCK,
    timeoutMs: 5,
  });
  assert.equal(output.workflows[0].errors[0].code, 'TIMEOUT');
});

test('malformed JSON -> UNVERIFIED', async () => {
  const { output } = await observe([response(200, new SyntaxError('bad json'))]);
  assert.equal(output.workflows[0].errors[0].code, 'MALFORMED_RESPONSE');
});

test('pagination works', async () => {
  const filler = Array.from({ length: 100 }, (_, index) => workflow({
    id: index + 1,
    name: `filler-${index}`,
    path: `.github/workflows/filler-${index}.yml`,
  }));
  const { output, calls } = await observe([
    response(200, { workflows: filler }, { link: '<https://api.github.com/repos/kw7t9rwhny-cyber/league-vector/actions/workflows?per_page=100&page=2>; rel="next"' }),
    response(200, { workflows: [workflow()] }),
    response(200, workflow()),
  ]);
  assert.equal(output.workflows[0].normalized_state, 'VERIFIED_ENABLED');
  assert.match(calls[1].url, /page=2/);
});

test('no mutation method exists: every HTTP request is GET to allowlisted workflow registry routes', async () => {
  const { calls } = await observe([
    response(200, { workflows: [workflow()] }),
    response(200, workflow()),
  ]);
  assert.ok(calls.length >= 2);
  for (const call of calls) {
    assert.equal(call.init.method, 'GET');
    const url = new URL(call.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'api.github.com');
    assert.match(url.pathname, /^\/repos\/kw7t9rwhny-cyber\/league-vector\/actions\/workflows(?:\/[1-9][0-9]*)?$/);
  }
});

test('repository allowlist enforced before transport', async () => {
  let called = false;
  await assert.rejects(() => observeRepositoryWorkflows({
    repository: 'other/repo',
    expected_workflow_paths: [PATH],
    fetchImpl: async () => { called = true; },
    credentialProvider,
  }), { code: 'REPOSITORY_NOT_ALLOWED' });
  assert.equal(called, false);
});

test('no credential included in output or log-shaped error detail', async () => {
  const secret = 'super-secret-fixture-token';
  const output = await observeRepositoryWorkflows({
    repository: ALLOWED_REPOSITORY,
    expected_workflow_paths: [PATH],
    fetchImpl: async () => { throw new Error(`Authorization: Bearer ${secret}`); },
    credentialProvider: async () => secret,
    clock: CLOCK,
  });
  const serialized = JSON.stringify(output);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('Bearer [REDACTED]'), false, 'transport failure detail is generic, not credential-bearing');
});
