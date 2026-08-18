'use strict';

const SCHEMA_VERSION = 'lv-registry-observer/v1';
const ALLOWED_HOST = 'api.github.com';
const ALLOWED_REPOSITORY = 'kw7t9rwhny-cyber/league-vector';
const PER_PAGE = 100;
const DEFAULT_TIMEOUT_MS = 10_000;
const DISABLED_STATES = new Set([
  'disabled_manually',
  'disabled_inactivity',
  'disabled_fork',
  'deleted',
]);

function nowRfc3339(clock = () => new Date()) {
  return clock().toISOString();
}

function redactDetail(detail) {
  if (detail == null) return null;
  let value = String(detail);
  value = value.replace(/authorization\s*:\s*[^\s,;]+/gi, 'authorization:[REDACTED]');
  value = value.replace(/bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]');
  value = value.replace(/token\s+[A-Za-z0-9._~+\/-]+/gi, 'token [REDACTED]');
  return value.slice(0, 500);
}

function errorRecord(code, detail = null) {
  return { code, detail: redactDetail(detail) };
}

function baseRecord(path, observedAt) {
  return {
    repository: ALLOWED_REPOSITORY,
    workflow_id: null,
    name: null,
    path,
    raw_state: null,
    normalized_state: 'UNVERIFIED',
    observed_at: observedAt,
    errors: [],
  };
}

function normalizeState(rawState, identityOk) {
  if (!identityOk) return 'UNVERIFIED';
  if (rawState === 'active') return 'VERIFIED_ENABLED';
  if (DISABLED_STATES.has(rawState)) return 'VERIFIED_DISABLED';
  return 'UNVERIFIED';
}

function assertRepositoryAllowed(repository) {
  if (repository !== ALLOWED_REPOSITORY) {
    const error = new Error(`Repository is not allowlisted: ${repository}`);
    error.code = 'REPOSITORY_NOT_ALLOWED';
    throw error;
  }
}

function buildListUrl(page) {
  const url = new URL(`https://${ALLOWED_HOST}/repos/${ALLOWED_REPOSITORY}/actions/workflows`);
  url.searchParams.set('per_page', String(PER_PAGE));
  url.searchParams.set('page', String(page));
  return url;
}

function buildGetUrl(workflowId) {
  if (!Number.isInteger(workflowId) || workflowId <= 0) {
    const error = new Error('Workflow ID must be a positive integer');
    error.code = 'INVALID_WORKFLOW_ID';
    throw error;
  }
  return new URL(`https://${ALLOWED_HOST}/repos/${ALLOWED_REPOSITORY}/actions/workflows/${workflowId}`);
}

function assertAllowedUrl(url, kind) {
  if (!(url instanceof URL) || url.protocol !== 'https:' || url.hostname !== ALLOWED_HOST) {
    throw new Error('GitHub host is not allowlisted');
  }
  const escapedRepo = ALLOWED_REPOSITORY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const listPattern = new RegExp(`^/repos/${escapedRepo}/actions/workflows$`);
  const getPattern = new RegExp(`^/repos/${escapedRepo}/actions/workflows/[1-9][0-9]*$`);
  const ok = kind === 'list' ? listPattern.test(url.pathname) : getPattern.test(url.pathname);
  if (!ok) throw new Error('GitHub route is not allowlisted');
}

function classifyHttpStatus(response) {
  if (response.status === 401) return 'AUTH_FAILURE';
  if (response.status === 403) {
    const remaining = response.headers?.get?.('x-ratelimit-remaining');
    return remaining === '0' ? 'RATE_LIMIT' : 'PERMISSION_FAILURE';
  }
  if (response.status === 404) return 'WORKFLOW_GET_NOT_FOUND';
  if (response.status === 429) return 'RATE_LIMIT';
  if (response.status >= 500) return 'GITHUB_TRANSPORT_FAILURE';
  return 'HTTP_ERROR';
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    const malformed = new Error('Malformed JSON response');
    malformed.code = 'MALFORMED_RESPONSE';
    malformed.cause = error;
    throw malformed;
  }
}

async function requestJson({ fetchImpl, url, kind, credentialProvider, timeoutMs }) {
  assertAllowedUrl(url, kind);
  let credential;
  try {
    credential = await credentialProvider();
  } catch (error) {
    const auth = new Error('Managed credential unavailable');
    auth.code = 'AUTH_FAILURE';
    throw auth;
  }
  if (typeof credential !== 'string' || credential.length === 0) {
    const auth = new Error('Managed credential unavailable');
    auth.code = 'AUTH_FAILURE';
    throw auth;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'error',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${credential}`,
        'X-GitHub-Api-Version': '2026-03-10',
        'User-Agent': 'league-vector-registry-observer-v1',
      },
      signal: controller.signal,
    });

    if (!response || typeof response.status !== 'number' || !response.headers) {
      const malformed = new Error('Malformed HTTP response');
      malformed.code = 'MALFORMED_RESPONSE';
      throw malformed;
    }

    if (!response.ok) {
      const httpError = new Error(`GitHub returned HTTP ${response.status}`);
      httpError.code = classifyHttpStatus(response);
      throw httpError;
    }

    const body = await parseJsonResponse(response);
    return { body, headers: response.headers };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('GitHub request timed out');
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }
    if (error?.code) throw error;
    const transport = new Error('GitHub transport failure');
    transport.code = 'GITHUB_TRANSPORT_FAILURE';
    throw transport;
  } finally {
    clearTimeout(timeout);
    credential = undefined;
  }
}

function hasNextLink(linkHeader) {
  if (!linkHeader) return false;
  return linkHeader.split(',').some((part) => /;\s*rel="next"\s*$/.test(part.trim()));
}

async function listAllWorkflows(options) {
  const workflows = [];
  for (let page = 1; ; page += 1) {
    const { body, headers } = await requestJson({
      ...options,
      url: buildListUrl(page),
      kind: 'list',
    });
    if (!body || !Array.isArray(body.workflows)) {
      const malformed = new Error('List response missing workflows array');
      malformed.code = 'MALFORMED_RESPONSE';
      throw malformed;
    }
    workflows.push(...body.workflows);
    if (!hasNextLink(headers.get('link'))) break;
    if (page >= 1000) {
      const malformed = new Error('Pagination limit exceeded');
      malformed.code = 'MALFORMED_RESPONSE';
      throw malformed;
    }
  }
  return workflows;
}

function validateDiscoveryWorkflow(workflow) {
  return workflow && Number.isInteger(workflow.id) && workflow.id > 0 &&
    typeof workflow.name === 'string' && typeof workflow.path === 'string';
}

function validateGetWorkflow(workflow) {
  return validateDiscoveryWorkflow(workflow) && typeof workflow.state === 'string';
}

function targetFailure(path, observedAt, code, detail = null, discovered = null) {
  const record = baseRecord(path, observedAt);
  if (discovered && Number.isInteger(discovered.id)) record.workflow_id = discovered.id;
  if (discovered && typeof discovered.name === 'string') record.name = discovered.name;
  if (discovered && typeof discovered.state === 'string') record.raw_state = discovered.state;
  record.errors.push(errorRecord(code, detail));
  return record;
}

function classifyThrown(error) {
  return error?.code || 'GITHUB_TRANSPORT_FAILURE';
}

async function observeRepositoryWorkflows({
  repository,
  expected_workflow_paths,
  fetchImpl = globalThis.fetch,
  credentialProvider,
  clock = () => new Date(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  assertRepositoryAllowed(repository);
  if (!Array.isArray(expected_workflow_paths) || expected_workflow_paths.length === 0 ||
      expected_workflow_paths.some((path) => typeof path !== 'string' || path.length === 0)) {
    const error = new Error('expected_workflow_paths must be a non-empty string array');
    error.code = 'INVALID_INPUT';
    throw error;
  }
  if (typeof fetchImpl !== 'function' || typeof credentialProvider !== 'function') {
    const error = new Error('Managed fetch and credential provider are required');
    error.code = 'INVALID_RUNTIME';
    throw error;
  }

  const observedAt = nowRfc3339(clock);
  let discoveredWorkflows;
  try {
    discoveredWorkflows = await listAllWorkflows({
      fetchImpl,
      credentialProvider,
      timeoutMs,
    });
  } catch (error) {
    const code = classifyThrown(error);
    return {
      schema_version: SCHEMA_VERSION,
      repository: ALLOWED_REPOSITORY,
      observed_at: observedAt,
      workflows: expected_workflow_paths.map((path) => targetFailure(path, observedAt, code, error.message)),
    };
  }

  const records = [];
  for (const path of expected_workflow_paths) {
    const matches = discoveredWorkflows.filter((workflow) => workflow?.path === path);
    if (matches.length === 0) {
      records.push(targetFailure(path, observedAt, 'WORKFLOW_NOT_RESOLVED'));
      continue;
    }
    if (matches.length !== 1) {
      records.push(targetFailure(path, observedAt, 'AMBIGUOUS_IDENTITY', `exact_path_matches=${matches.length}`));
      continue;
    }

    const discovered = matches[0];
    if (!validateDiscoveryWorkflow(discovered)) {
      records.push(targetFailure(path, observedAt, 'MALFORMED_RESPONSE', 'Discovery workflow missing required identity fields'));
      continue;
    }

    let exact;
    try {
      const response = await requestJson({
        fetchImpl,
        credentialProvider,
        timeoutMs,
        url: buildGetUrl(discovered.id),
        kind: 'get',
      });
      exact = response.body;
    } catch (error) {
      records.push(targetFailure(path, observedAt, classifyThrown(error), error.message, discovered));
      continue;
    }

    if (!validateGetWorkflow(exact)) {
      records.push(targetFailure(path, observedAt, 'MALFORMED_RESPONSE', 'Get workflow response missing required fields', discovered));
      continue;
    }

    const identityOk = exact.id === discovered.id && exact.path === path &&
      exact.path === discovered.path && exact.name === discovered.name;
    if (!identityOk) {
      records.push(targetFailure(path, observedAt, 'IDENTITY_MISMATCH', 'List/get workflow identity mismatch', discovered));
      continue;
    }

    const normalized = normalizeState(exact.state, true);
    const record = {
      repository: ALLOWED_REPOSITORY,
      workflow_id: exact.id,
      name: exact.name,
      path: exact.path,
      raw_state: exact.state,
      normalized_state: normalized,
      observed_at: observedAt,
      errors: [],
    };
    if (normalized === 'UNVERIFIED') {
      record.errors.push(errorRecord('UNKNOWN_STATE', `raw_state=${exact.state}`));
    }
    records.push(record);
  }

  return {
    schema_version: SCHEMA_VERSION,
    repository: ALLOWED_REPOSITORY,
    observed_at: observedAt,
    workflows: records,
  };
}

async function main() {
  const input = JSON.parse(process.argv[2] || '{}');
  const token = process.env.LV_GITHUB_REGISTRY_TOKEN;
  const output = await observeRepositoryWorkflows({
    repository: input.repository,
    expected_workflow_paths: input.expected_workflow_paths,
    credentialProvider: async () => token,
  });
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      schema_version: SCHEMA_VERSION,
      normalized_state: 'UNVERIFIED',
      errors: [errorRecord(error.code || 'OBSERVER_FAILURE', error.message)],
    })}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  SCHEMA_VERSION,
  ALLOWED_REPOSITORY,
  DISABLED_STATES,
  normalizeState,
  observeRepositoryWorkflows,
  redactDetail,
};
