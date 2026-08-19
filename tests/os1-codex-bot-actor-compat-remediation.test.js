const fs = require('node:fs');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const protocol = require('../lib/research-qa-protocol-v01.js');

const researchPath = '.github/workflows/research-qa-research-v01.yml';
const controllerPath = '.github/workflows/research-qa-controller-v01.yml';
const helperPath = 'scripts/research-qa-workflow-helper-v01.js';

const research = fs.readFileSync(researchPath, 'utf8');
const controller = fs.readFileSync(controllerPath, 'utf8');

const repository = 'kw7t9rwhny-cyber/league-vector';
const inputIdentity = {
  repository,
  commit_sha: 'a'.repeat(40),
  tree_sha: 'b'.repeat(40),
};

function workItem(maxWorkerRuns = 2) {
  const item = {
    schema_version: protocol.WORK_ITEM_SCHEMA_VERSION,
    work_item_id: 'os1-bot-actor-remediation',
    objective: 'Validate the bounded Research routing authority.',
    role: 'research',
    risk: 'low',
    input_identity: inputIdentity,
    context_refs: ['repo://.github/workflows'],
    allowed_actions: ['read_repository'],
    forbidden_actions: ['merge', 'deploy', 'remediate'],
    expected_terminal_result: protocol.RESULT_SCHEMA_VERSION,
    qa_requirement: 'one',
    founder_gate: true,
    confidentiality: 'public',
    budget: { max_worker_runs: maxWorkerRuns },
    replay_identity: '',
  };
  item.replay_identity = protocol.deriveReplayIdentity(item);
  return item;
}

function researchResult(item) {
  return protocol.buildAuthoritativeResult({
    work_item: item,
    role: 'research',
    role_instance_id: 'research-1',
    worker_run_id: 101,
    run_attempt: 1,
    upstream_result_ids: [],
    writer_identity: 'github-actions[bot]',
    created_at: '2026-08-19T12:00:00Z',
    substance: {
      status: 'COMPLETE',
      claims_or_findings: ['Research complete.'],
      evidence_refs: ['repo://.github/workflows'],
      artifact_refs: [],
      limitations: '',
      recommended_next_action: 'Independent QA.',
    },
  });
}

function runControllerWithMockApi(t) {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-os1-controller-'));
  t.after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));

  const item = workItem();
  const outputPath = path.join(tempDirectory, 'github-output.txt');
  const capturePath = path.join(tempDirectory, 'requests.json');
  const preloadPath = path.join(tempDirectory, 'mock-api.js');
  const issue = {
    number: 71,
    user: { login: 'founder', id: 1 },
    body: protocol.taggedRecord(protocol.MARKERS.workItem, item),
  };
  const preload = `
const fs = require('node:fs');
const issue = ${JSON.stringify(issue)};
const requests = [];
let comments = [];
function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return data === undefined ? '' : JSON.stringify(data); },
  };
}
global.fetch = async (url, options = {}) => {
  const parsed = new URL(url);
  const method = options.method || 'GET';
  const body = options.body === undefined ? undefined : JSON.parse(options.body);
  requests.push({ method, pathname: parsed.pathname, body });
  if (method === 'GET' && parsed.pathname === '/repos/${repository}/issues/71') {
    return response(200, issue);
  }
  if (method === 'GET' && parsed.pathname === '/repos/${repository}/issues/71/comments') {
    return response(200, comments);
  }
  if (method === 'GET' && parsed.pathname === '/repos/${repository}/collaborators/founder/permission') {
    return response(200, { user: { login: 'founder', id: 1 }, permission: 'write' });
  }
  if (method === 'GET' && parsed.pathname === '/repos/${repository}/git/commits/${inputIdentity.commit_sha}') {
    return response(200, { tree: { sha: '${inputIdentity.tree_sha}' } });
  }
  if (method === 'POST' && parsed.pathname === '/repos/${repository}/issues/71/comments') {
    comments = [{ user: { login: 'github-actions[bot]', id: 41898282, type: 'Bot' }, body: body.body }];
    return response(201, comments[0]);
  }
  if (method === 'POST' && parsed.pathname.startsWith('/repos/${repository}/actions/workflows/')) {
    return response(204);
  }
  throw new Error('unexpected_mock_request:' + method + ':' + parsed.pathname);
};
process.on('exit', () => fs.writeFileSync(process.env.RQA_CAPTURE_PATH, JSON.stringify(requests)));
`;
  fs.writeFileSync(preloadPath, preload, 'utf8');

  const result = spawnSync(
    process.execPath,
    ['--require', preloadPath, helperPath, 'controller', '71'],
    {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        GH_TOKEN: 'test-token',
        GITHUB_REPOSITORY: repository,
        GITHUB_OUTPUT: outputPath,
        RQA_CAPTURE_PATH: capturePath,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(fs.readFileSync(capturePath, 'utf8'));
}

function extractJob(workflow, jobName) {
  const lines = workflow.split('\n');
  const start = lines.findIndex((line) => line === `  ${jobName}:`);
  assert.notEqual(start, -1, `job ${jobName} must exist`);

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function assertResearchModelAuthority(workflow) {
  const researchJob = extractJob(workflow, 'research');
  assert.match(
    researchJob,
    /\n    permissions:\n      contents: read(?:\n|$)/,
    'Research model-execution job must retain contents: read',
  );
  assert.doesNotMatch(
    researchJob,
    /\n      (?:contents|actions|issues|pull-requests|deployments|packages|administration): write(?:\n|$)/,
    'Research model-execution job must not gain repository write authority',
  );
}

test('allow-bots true is scoped to Research Codex invocation', () => {
  const researchJob = extractJob(research, 'research');
  const codex = researchJob.match(/uses: openai\/codex-action@v1[\s\S]*?(?=\n      - |$)/)?.[0] || '';
  assert.match(codex, /allow-bots:\s*true/);
});

test('Codex action remains @v1', () => {
  assert.match(extractJob(research, 'research'), /uses: openai\/codex-action@v1/);
});

test('permission profile remains read-only', () => {
  assert.match(extractJob(research, 'research'), /permission-profile:\s*["']?:read-only["']?/);
});

test('Research model-execution job authority remains read-only', () => {
  assertResearchModelAuthority(research);
});

test('negative mutation: Research model contents write is detected', () => {
  const researchJob = extractJob(research, 'research');
  const mutatedResearchJob = researchJob.replace('      contents: read', '      contents: write');
  assert.notEqual(mutatedResearchJob, researchJob, 'mutation must alter Research model permission');
  const mutatedWorkflow = research.replace(researchJob, mutatedResearchJob);
  assert.throws(() => assertResearchModelAuthority(mutatedWorkflow), assert.AssertionError);
});

for (const permission of ['actions', 'issues', 'pull-requests', 'deployments', 'packages', 'administration']) {
  test(`negative mutation: Research model ${permission} write is detected`, () => {
    const researchJob = extractJob(research, 'research');
    const mutatedResearchJob = researchJob.replace(
      '      contents: read',
      `      contents: read\n      ${permission}: write`,
    );
    assert.notEqual(mutatedResearchJob, researchJob, 'mutation must alter Research model permissions');
    const mutatedWorkflow = research.replace(researchJob, mutatedResearchJob);
    assert.throws(() => assertResearchModelAuthority(mutatedWorkflow), assert.AssertionError);
  });
}

test('authorized persistence job scoped writes remain permitted', () => {
  const persistJob = extractJob(research, 'persist');
  assert.match(persistJob, /\n    permissions:\n      contents: read\n      issues: write\n      actions: write(?:\n|$)/);
  assert.doesNotThrow(() => assertResearchModelAuthority(research));
});

test('checkout credentials remain non-persistent in Research model job', () => {
  assert.match(extractJob(research, 'research'), /persist-credentials:\s*false/);
});

test('Research checkout remains bound to validated immutable commit_sha', () => {
  assert.match(
    extractJob(research, 'research'),
    /ref:\s*\$\{\{ needs\.preflight\.outputs\.commit_sha \}\}/,
  );
});

test('no allow-users wildcard is introduced', () => {
  assert.doesNotMatch(extractJob(research, 'research'), /allow-users:\s*["']?\*/);
});

test('no broad arbitrary allow-bot-users override is introduced', () => {
  assert.doesNotMatch(extractJob(research, 'research'), /allow-bot-users:/);
});

test('no PAT or alternate write-token input is introduced', () => {
  assert.doesNotMatch(
    research,
    /\bPAT\b|personal[_ -]?access[_ -]?token|write[_ -]?token/i,
  );
});

test('Research remains workflow_dispatch worker', () => {
  assert.match(research, /workflow_dispatch:/);
});

test('Research preflight remains required', () => {
  assert.match(extractJob(research, 'research'), /^  research:\n    needs: preflight/m);
});

test('terminal fail-closed guard remains', () => {
  assert.match(extractJob(research, 'terminal'), /Reject false-green or partial Research completion/);
});

test('no retry command is introduced', () => {
  assert.doesNotMatch(research, /\bretry\b/i);
});

test('no replacement-worker authority is introduced', () => {
  assert.doesNotMatch(research, /replacement worker|replacement-worker/i);
});

test('Research workflow does not dispatch QA directly', () => {
  assert.doesNotMatch(research, /research-qa-qa-v01|createWorkflowDispatch/);
});

test('Research workflow contains no public mutation CLI', () => {
  assert.doesNotMatch(research, /\b(?:git push|gh pr create|gh issue create|gh release create)\b/);
});

test('Controller executable path dispatches the intended Research workflow', (t) => {
  assert.match(
    extractJob(controller, 'route'),
    /run:\s*node scripts\/research-qa-workflow-helper-v01\.js controller "\$\{\{ inputs\.issue_number \}\}"/,
  );
  const dispatches = runControllerWithMockApi(t).filter(
    (request) => request.method === 'POST' && request.pathname.includes('/actions/workflows/'),
  );
  assert.equal(dispatches.length, 1);
  assert.equal(
    dispatches[0].pathname,
    `/repos/${repository}/actions/workflows/research-qa-research-v01.yml/dispatches`,
  );
  assert.equal(dispatches[0].body.ref, 'main');
  assert.equal(dispatches[0].body.inputs.issue_number, '71');
  assert.match(dispatches[0].body.inputs.dispatch_identity, /^[a-f0-9]{64}$/);
});

test('Protocol permits only one bounded Research worker dispatch', () => {
  const item = workItem();
  const first = protocol.route({
    work_item: item,
    research_results: [],
    qa_results: [],
    dispatches: [],
    usage: { worker_runs_used: 0 },
  });
  assert.equal(first.action, 'DISPATCH_RESEARCH');
  assert.equal(first.role_instance_id, 'research-1');

  const replay = protocol.route({
    work_item: item,
    research_results: [],
    qa_results: [],
    dispatches: [first.dispatch_identity],
    usage: { worker_runs_used: 1 },
  });
  assert.deepEqual(
    { action: replay.action, disposition: replay.disposition, reason: replay.reason },
    { action: 'STOP', disposition: 'BLOCKED', reason: 'replayed_dispatch' },
  );

  const next = protocol.route({
    work_item: item,
    research_results: [researchResult(item)],
    qa_results: [],
    dispatches: [],
    usage: { worker_runs_used: 1 },
  });
  assert.equal(next.action, 'DISPATCH_QA');
  assert.equal(next.role_instance_id, 'qa-1');
});

test('prospective third worker is rejected fail-closed by max_worker_runs', () => {
  const item = workItem(2);
  const budget = protocol.checkBudget({
    budget: item.budget,
    worker_runs_used: 2,
  });
  assert.deepEqual(budget, { ok: false, reason: 'run_limit_exhausted' });

  const decision = protocol.route({
    work_item: item,
    research_results: [researchResult(item)],
    qa_results: [],
    dispatches: [],
    usage: { worker_runs_used: 2 },
  });
  assert.deepEqual(
    {
      action: decision.action,
      disposition: decision.disposition,
      reason: decision.reason,
      founder_gate: decision.founder_gate,
    },
    {
      action: 'STOP',
      disposition: 'BLOCKED',
      reason: 'run_limit_exhausted',
      founder_gate: true,
    },
  );
});
