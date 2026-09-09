const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const protocol = require('../lib/research-qa-protocol-v01.js');

const qaPath = process.env.OS1_QA_WORKFLOW_PATH
  || '.github/workflows/research-qa-qa-v01.yml';
const researchPath = '.github/workflows/research-qa-research-v01.yml';
const controllerPath = '.github/workflows/research-qa-controller-v01.yml';
const helperPath = 'scripts/research-qa-workflow-helper-v01.js';

const qa = fs.readFileSync(qaPath, 'utf8');
const research = fs.readFileSync(researchPath, 'utf8');
const controller = fs.readFileSync(controllerPath, 'utf8');
const helper = fs.readFileSync(helperPath, 'utf8');

const repository = 'kw7t9rwhny-cyber/league-vector';
const currentMainQaBlob = '4509aec39a5d0381899336db75c20358bf895ed5';
const currentMainResearchBlob = 'e1c2d758bb21107df1da2791a75ad9f2feb6ab1a';
const inputIdentity = {
  repository,
  commit_sha: 'a'.repeat(40),
  tree_sha: 'b'.repeat(40),
};

function workItem(maxWorkerRuns = 2) {
  const item = {
    schema_version: protocol.WORK_ITEM_SCHEMA_VERSION,
    work_item_id: 'os1-qa-bot-actor-remediation',
    objective: 'Validate the bounded independent QA routing authority.',
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

function qaResult(item, upstreamResultId) {
  return protocol.buildAuthoritativeResult({
    work_item: item,
    role: 'qa',
    role_instance_id: 'qa-1',
    worker_run_id: 102,
    run_attempt: 1,
    upstream_result_ids: [upstreamResultId],
    writer_identity: 'github-actions[bot]',
    created_at: '2026-08-19T12:05:00Z',
    substance: {
      status: 'PASS',
      claims_or_findings: ['QA independently reproduced the finding.'],
      evidence_refs: ['repo://.github/workflows'],
      artifact_refs: [],
      limitations: '',
      recommended_next_action: 'Founder STOP.',
    },
  });
}

function canonicalBotComment(marker, value) {
  return {
    user: { login: 'github-actions[bot]', id: 41898282, type: 'Bot' },
    body: protocol.taggedRecord(marker, value),
  };
}

function runControllerAtQaBoundary(t) {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lv-os1-qa-controller-'));
  t.after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));

  const item = workItem();
  const result = researchResult(item);
  const researchDispatch = protocol.buildDispatchRecord({
    work_item: item,
    role: 'research',
    role_instance_id: 'research-1',
    created_at: '2026-08-19T11:59:00Z',
  });
  const outputPath = path.join(tempDirectory, 'github-output.txt');
  const capturePath = path.join(tempDirectory, 'requests.json');
  const preloadPath = path.join(tempDirectory, 'mock-api.js');
  const issue = {
    number: 71,
    user: { login: 'founder', id: 1 },
    body: protocol.taggedRecord(protocol.MARKERS.workItem, item),
  };
  const initialComments = [
    canonicalBotComment(protocol.MARKERS.dispatch, researchDispatch),
    canonicalBotComment(protocol.MARKERS.result, result),
  ];
  const proofName = protocol.proofArtifactName(result);
  const preload = `
const fs = require('node:fs');
const issue = ${JSON.stringify(issue)};
const requests = [];
let comments = ${JSON.stringify(initialComments)};
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
  if (method === 'GET' && parsed.pathname === '/repos/${repository}/actions/runs/101/attempts/1') {
    return response(200, {
      id: 101,
      run_attempt: 1,
      event: 'workflow_dispatch',
      path: '.github/workflows/research-qa-research-v01.yml',
      repository: { full_name: '${repository}' },
      head_branch: 'main',
      run_started_at: '2026-08-19T11:59:30Z',
      status: 'completed',
      conclusion: 'success',
    });
  }
  if (method === 'GET' && parsed.pathname === '/repos/${repository}/actions/runs/101/artifacts') {
    return response(200, {
      artifacts: [{
        name: '${proofName}',
        expired: false,
        workflow_run: { id: 101 },
      }],
    });
  }
  if (method === 'POST' && parsed.pathname === '/repos/${repository}/issues/71/comments') {
    comments = [...comments, {
      user: { login: 'github-actions[bot]', id: 41898282, type: 'Bot' },
      body: body.body,
    }];
    return response(201, comments[comments.length - 1]);
  }
  if (method === 'POST' && parsed.pathname.startsWith('/repos/${repository}/actions/workflows/')) {
    return response(204);
  }
  throw new Error('unexpected_mock_request:' + method + ':' + parsed.pathname + parsed.search);
};
process.on('exit', () => fs.writeFileSync(process.env.RQA_CAPTURE_PATH, JSON.stringify(requests)));
`;
  fs.writeFileSync(preloadPath, preload, 'utf8');

  const execution = spawnSync(
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
  assert.equal(execution.status, 0, execution.stderr);
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

function extractStepBlocks(job) {
  const lines = job.split('\n');
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^      - /.test(lines[index])) starts.push(index);
  }
  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : lines.length;
    return lines.slice(start, end).join('\n');
  });
}

function extractCodexStep(workflow) {
  const steps = extractStepBlocks(extractJob(workflow, 'qa')).filter(
    (step) => /^        uses:\s*openai\/codex-action@v1\s*$/m.test(step),
  );
  assert.equal(steps.length, 1, 'QA must contain exactly one Codex action step');
  return steps[0];
}

function extractStepInputs(step) {
  const lines = step.split('\n');
  const withIndex = lines.findIndex((line) => /^        with:\s*$/.test(line));
  assert.notEqual(withIndex, -1, 'action step must contain a with mapping');
  return lines.slice(withIndex + 1).flatMap((line) => {
    const match = line.match(/^          ([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    return match ? [{ key: match[1], value: match[2] }] : [];
  });
}

function extractJobPermissions(job) {
  const lines = job.split('\n');
  const index = lines.findIndex((line) => line === '    permissions:');
  assert.notEqual(index, -1, 'job must define an explicit permissions mapping');
  const entries = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const match = lines[cursor].match(/^      ([A-Za-z0-9_-]+):\s*(\S+)\s*$/);
    if (!match) break;
    entries.push({ key: match[1], value: match[2] });
  }
  return entries;
}

function replaceQaJob(workflow, transform) {
  const qaJob = extractJob(workflow, 'qa');
  const mutatedQaJob = transform(qaJob);
  assert.notEqual(mutatedQaJob, qaJob, 'mutation must alter QA job');
  return workflow.replace(qaJob, mutatedQaJob);
}

function addCodexInput(workflow, key, value) {
  return replaceQaJob(workflow, (qaJob) => {
    const codexStep = extractCodexStep(workflow);
    const marker = '          allow-bots: true';
    assert.match(codexStep, /^          allow-bots:\s*true\s*$/m);
    const mutatedCodexStep = codexStep.replace(marker, `${marker}\n          ${key}: ${value}`);
    return qaJob.replace(codexStep, mutatedCodexStep);
  });
}

function addQaRunStep(workflow, { name, env = {}, run }) {
  return replaceQaJob(workflow, (qaJob) => {
    const envEntries = Object.entries(env);
    const envBlock = envEntries.length === 0
      ? ''
      : `\n        env:\n${envEntries.map(([key, value]) => `          ${key}: ${value}`).join('\n')}`;
    const trimmedJob = qaJob.replace(/\s+$/, '');
    return `${trimmedJob}\n      - name: ${name}${envBlock}\n        run: ${run}\n\n`;
  });
}

function extractRunScripts(workflow) {
  return extractStepBlocks(extractJob(workflow, 'qa')).flatMap((step) => {
    const lines = step.split('\n');
    const runIndex = lines.findIndex((line) => /^        run:/.test(line));
    if (runIndex === -1) return [];

    const scalar = lines[runIndex].replace(/^        run:\s*/, '').trim();
    if (!/^[|>][+-]?$/.test(scalar)) return [scalar];
    return [lines.slice(runIndex + 1).map((line) => line.replace(/^          /, '')).join('\n')];
  });
}

function classifyGhApiMethods(script) {
  const normalized = script.replace(/\\\r?\n\s*/g, ' ');
  const methods = [];
  const apiCommands = normalized.matchAll(/\bgh\s+api\b([^;\n&|]*)/gi);
  for (const command of apiCommands) {
    const args = command[1];
    const hasMethodFlag = /(?:^|\s)(?:--method(?:\s|=)|-X)/i.test(args);
    if (!hasMethodFlag) {
      const hasRequestBody = /(?:^|\s)(?:-f|-F|--raw-field|--field|--input)(?:\s|=)/.test(args);
      methods.push(hasRequestBody ? 'POST' : 'GET');
      continue;
    }
    const literal = args.match(
      /(?:^|\s)(?:--method(?:\s+|=)|-X(?:\s*=?\s*))(["']?)([A-Za-z]+)\1/i,
    );
    methods.push(literal ? literal[2].toUpperCase() : 'UNKNOWN');
  }
  return methods;
}

function assertApprovedActorAdmission(workflow) {
  const allowInputs = extractStepInputs(extractCodexStep(workflow)).filter(
    ({ key }) => key.startsWith('allow-'),
  );
  assert.deepEqual(
    allowInputs,
    [{ key: 'allow-bots', value: 'true' }],
    'allow-bots: true must be the sole QA actor-admission expansion',
  );
}

function assertQaCodexBoundary(workflow) {
  assert.deepEqual(
    extractStepInputs(extractCodexStep(workflow)),
    [
      { key: 'openai-api-key', value: '${{ secrets.OPENAI_API_KEY }}' },
      { key: 'permission-profile', value: '":read-only"' },
      { key: 'allow-bots', value: 'true' },
      { key: 'prompt', value: '${{ needs.preflight.outputs.prompt }}' },
      { key: 'output-schema-file', value: 'protocol/research-qa/worker-substance.schema.json' },
    ],
    'QA Codex invocation must retain its exact read-only input boundary',
  );
}

function assertQaModelAuthority(workflow) {
  const qaJob = extractJob(workflow, 'qa');
  assert.deepEqual(
    extractJobPermissions(qaJob),
    [{ key: 'contents', value: 'read' }],
    'QA model job must retain exactly contents: read',
  );
}

function assertQaCheckoutBoundary(workflow) {
  const checkoutSteps = extractStepBlocks(extractJob(workflow, 'qa')).filter(
    (step) => /^      - uses:\s*actions\/checkout@v5\s*$/m.test(step),
  );
  assert.equal(checkoutSteps.length, 1, 'QA must contain exactly one checkout');
  assert.deepEqual(
    extractStepInputs(checkoutSteps[0]),
    [
      { key: 'ref', value: '${{ needs.preflight.outputs.commit_sha }}' },
      { key: 'persist-credentials', value: 'false' },
    ],
    'QA checkout must remain immutable and credential-free',
  );
}

function assertQaCredentialAuthority(workflow) {
  const qaJob = extractJob(workflow, 'qa');
  const codexStep = extractCodexStep(workflow);
  const approvedOpenAiKey = /^          openai-api-key:\s*\$\{\{\s*secrets\.OPENAI_API_KEY\s*\}\}\s*$/m;
  assert.match(codexStep, approvedOpenAiKey, 'QA Codex must receive its approved OpenAI credential');

  const withoutApprovedOpenAiKey = qaJob.replace(
    approvedOpenAiKey,
    '          openai-api-key: [approved-openai-credential]',
  );
  assert.doesNotMatch(
    withoutApprovedOpenAiKey,
    /\bsecrets\s*(?:\.|\[)|\$\{\{\s*github\.token\s*\}\}|\b(?:GH_TOKEN|GITHUB_TOKEN|PAT|REPOSITORY_ADMIN_TOKEN)\s*:/,
    'QA model job must not receive an alternate repository credential',
  );
}

function assertQaPublicMutationBoundary(workflow) {
  for (const script of extractRunScripts(workflow)) {
    const normalized = script.replace(/\\\r?\n\s*/g, ' ');
    assert.doesNotMatch(
      normalized,
      /\bgit\s+push\b|\bgh\s+(?:pr|issue|release)\s+(?:create|edit|close|reopen|merge|delete)\b|\bgh\s+workflow\s+run\b/i,
      'QA must not execute a public mutation, remediation, or worker-dispatch command',
    );
    for (const method of classifyGhApiMethods(script)) {
      assert.ok(
        method === 'GET' || method === 'HEAD',
        `QA gh api method must be read-only, received ${method}`,
      );
    }
  }
}

function assertQaStepTopology(workflow) {
  const steps = extractStepBlocks(extractJob(workflow, 'qa'));
  assert.equal(steps.length, 2, 'QA model job must contain only checkout and Codex steps');
  assert.match(steps[0], /^      - uses:\s*actions\/checkout@v5\s*$/m);
  assert.match(steps[1], /^        uses:\s*openai\/codex-action@v1\s*$/m);
  assert.equal(extractRunScripts(workflow).length, 0, 'QA model job must not contain shell steps');
}

function assertQaIndependence(workflow) {
  const qaJob = extractJob(workflow, 'qa');
  const preflight = extractJob(workflow, 'preflight');
  assert.match(qaJob, /^  qa:\n    needs: preflight$/m);
  assert.match(preflight, /preflight .* qa$/m);
  assert.match(qaJob, /prompt:\s*\$\{\{ needs\.preflight\.outputs\.prompt \}\}/);
  assert.match(helper, /You are a fresh independent QA role\./);
  assert.match(helper, /Do not resume or assume Research reasoning\./);
  assert.match(helper, /Do not remediate, merge, deploy, release, or dispatch onward\./);
}

function assertQaCannotDispatchOrRemediate(workflow) {
  assert.doesNotMatch(workflow, /actions:\s*write/);
  assert.doesNotMatch(
    extractJob(workflow, 'qa'),
    /research-qa-(?:controller|research|qa)-v01\.yml|wake-controller|\/dispatches|remediation-worker/i,
  );
  assertQaPublicMutationBoundary(workflow);
  assertQaStepTopology(workflow);
}

function assertOnlyAuthorizedProductionDelta(workflow) {
  const matches = workflow.match(/^          allow-bots:\s*true\s*$/gm) || [];
  assert.equal(matches.length, 1, 'QA workflow must contain exactly one allow-bots: true input');
  const reconstructedBase = workflow.replace(/^          allow-bots:\s*true\s*\n/m, '');
  assert.equal(
    gitBlobSha(reconstructedBase),
    currentMainQaBlob,
    'removing allow-bots must reconstruct the exact current-main QA workflow blob',
  );
}

function assertQaAuthorityBoundary(workflow) {
  assertOnlyAuthorizedProductionDelta(workflow);
  assertQaModelAuthority(workflow);
  assertQaCodexBoundary(workflow);
  assertApprovedActorAdmission(workflow);
  assertQaCheckoutBoundary(workflow);
  assertQaCredentialAuthority(workflow);
  assertQaIndependence(workflow);
  assertQaCannotDispatchOrRemediate(workflow);
}

function gitBlobSha(content) {
  const header = Buffer.from(`blob ${Buffer.byteLength(content)}\0`);
  return crypto.createHash('sha1').update(header).update(content).digest('hex');
}

test('allow-bots true is scoped to the QA Codex invocation', () => {
  assertApprovedActorAdmission(qa);
});

test('allow-bots true is the only QA production byte delta from current main', () => {
  assertOnlyAuthorizedProductionDelta(qa);
});

test('removing QA allow-bots true is detected', () => {
  const mutated = qa.replace(/^          allow-bots:\s*true\s*\n/m, '');
  assert.notEqual(mutated, qa);
  assert.throws(() => assertApprovedActorAdmission(mutated), assert.AssertionError);
});

test('QA Codex action remains @v1 with read-only permission profile', () => {
  const codexStep = extractCodexStep(qa);
  assert.match(codexStep, /^        uses:\s*openai\/codex-action@v1\s*$/m);
  assert.match(codexStep, /^          permission-profile:\s*["']?:read-only["']?\s*$/m);
});

test('QA composite authority boundary remains capability-bounded', () => {
  assertQaAuthorityBoundary(qa);
});

test('negative mutation: QA model contents write is detected', () => {
  const mutated = replaceQaJob(qa, (job) => job.replace('      contents: read', '      contents: write'));
  assert.throws(() => assertQaModelAuthority(mutated), assert.AssertionError);
});

for (const permission of ['actions', 'issues', 'pull-requests', 'deployments', 'packages', 'administration']) {
  test(`negative mutation: QA model ${permission} write is detected`, () => {
    const mutated = replaceQaJob(qa, (job) => job.replace(
      '      contents: read',
      `      contents: read\n      ${permission}: write`,
    ));
    assert.throws(() => assertQaModelAuthority(mutated), assert.AssertionError);
  });
}

test('QA checkout remains preflight-bound with non-persistent credentials', () => {
  assertQaCheckoutBoundary(qa);
});

test('negative mutation: writable QA Codex permission profile is detected', () => {
  const mutated = qa.replace('permission-profile: ":read-only"', 'permission-profile: ":workspace"');
  assert.notEqual(mutated, qa);
  assert.throws(() => assertQaAuthorityBoundary(mutated), assert.AssertionError);
});

test('negative mutation: QA persist-credentials true is detected', () => {
  const mutated = replaceQaJob(qa, (job) => job.replace(
    '          persist-credentials: false',
    '          persist-credentials: true',
  ));
  assert.throws(() => assertQaCheckoutBoundary(mutated), assert.AssertionError);
});

test('negative mutation: floating QA checkout is detected', () => {
  const mutated = replaceQaJob(qa, (job) => job.replace(
    '          ref: ${{ needs.preflight.outputs.commit_sha }}',
    '          ref: main',
  ));
  assert.throws(() => assertQaCheckoutBoundary(mutated), assert.AssertionError);
});

test('allow-bots true remains the sole QA actor-admission expansion', () => {
  assertApprovedActorAdmission(qa);
});

test('negative mutation: arbitrary allow-users actor admission is detected', () => {
  const mutated = addCodexInput(qa, 'allow-users', 'untrusted-outsider');
  assert.throws(() => assertApprovedActorAdmission(mutated), assert.AssertionError);
});

test('negative mutation: arbitrary allow-bot-users actor admission is detected', () => {
  const mutated = addCodexInput(qa, 'allow-bot-users', 'untrusted-outsider[bot]');
  assert.throws(() => assertApprovedActorAdmission(mutated), assert.AssertionError);
});

test('QA receives no alternate repository credential', () => {
  assertQaCredentialAuthority(qa);
});

test('negative mutation: alternate privileged GH_TOKEN exposure is detected', () => {
  const mutated = addQaRunStep(qa, {
    name: 'Read with alternate credential',
    env: { GH_TOKEN: '${{ secrets.REPOSITORY_ADMIN_TOKEN }}' },
    run: 'gh api --method GET repos/${{ github.repository }}',
  });
  assert.throws(() => assertQaCredentialAuthority(mutated), assert.AssertionError);
});

test('negative mutation: alternate privileged credential on QA Codex step is detected', () => {
  const mutated = addCodexInput(
    qa,
    'repository-credential',
    '${{ secrets.REPOSITORY_ADMIN_TOKEN }}',
  );
  assert.throws(() => assertQaCredentialAuthority(mutated), assert.AssertionError);
});

test('read-only GitHub API GET remains classified as read-only', () => {
  assert.deepEqual(classifyGhApiMethods('gh api --method GET repos/x/y'), ['GET']);
  assert.deepEqual(classifyGhApiMethods('gh api -X HEAD repos/x/y'), ['HEAD']);
});

for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
  test(`negative mutation: QA gh api --method ${method} is detected`, () => {
    const mutated = addQaRunStep(qa, {
      name: `Attempt generic ${method} mutation`,
      run: `gh api --method ${method} repos/\${{ github.repository }}/issues`,
    });
    assert.throws(() => assertQaPublicMutationBoundary(mutated), assert.AssertionError);
  });
}

for (const field of ['-f', '--raw-field', '-F', '--field', '--input']) {
  test(`negative mutation: implicit QA gh api POST via ${field} is detected`, () => {
    const mutated = addQaRunStep(qa, {
      name: `Attempt implicit POST through ${field}`,
      run: `gh api repos/\${{ github.repository }}/issues ${field} title=unauthorized`,
    });
    assert.throws(() => assertQaPublicMutationBoundary(mutated), assert.AssertionError);
  });
}

test('negative composite mutation: actor, credential, and API escape is detected', () => {
  let mutated = addCodexInput(qa, 'allow-users', 'untrusted-outsider');
  mutated = addQaRunStep(mutated, {
    name: 'Attempt composite QA authority escape',
    env: { GH_TOKEN: '${{ secrets.REPOSITORY_ADMIN_TOKEN }}' },
    run: 'gh api --method POST repos/${{ github.repository }}/issues',
  });
  assert.throws(() => assertQaAuthorityBoundary(mutated), assert.AssertionError);
});

test('QA remains independently preflighted and distinct from Research', () => {
  assertQaIndependence(qa);
  assert.notEqual(protocol.WORKFLOW_PATHS.qa, protocol.WORKFLOW_PATHS.research);
  assert.match(qa, /^name: Reusable QA Worker v0\.1$/m);
  assert.match(research, /^name: Reusable Research Worker v0\.1$/m);
  assert.notEqual(extractCodexStep(qa), extractJob(research, 'research'));
});

test('negative mutation: removing the QA preflight dependency is detected', () => {
  const mutated = replaceQaJob(qa, (job) => job.replace('    needs: preflight\n', ''));
  assert.throws(() => assertQaIndependence(mutated), assert.AssertionError);
});

test('QA cannot remediate or dispatch another worker', () => {
  assertQaCannotDispatchOrRemediate(qa);
  assert.equal(protocol.route.toString().includes('REMEDIATE'), false);
});

test('negative mutation: QA self-remediation command is detected', () => {
  const mutated = addQaRunStep(qa, {
    name: 'Attempt self-remediation',
    run: 'gh pr create --title unauthorized --body unauthorized',
  });
  assert.throws(() => assertQaCannotDispatchOrRemediate(mutated), assert.AssertionError);
});

test('negative mutation: QA third-worker dispatch is detected', () => {
  const mutated = addQaRunStep(qa, {
    name: 'Attempt third-worker dispatch',
    run: 'gh workflow run research-qa-qa-v01.yml',
  });
  assert.throws(() => assertQaCannotDispatchOrRemediate(mutated), assert.AssertionError);
});

test('Controller executable path dispatches QA only after durable Research', (t) => {
  assert.match(
    extractJob(controller, 'route'),
    /run:\s*node scripts\/research-qa-workflow-helper-v01\.js controller "\$\{\{ inputs\.issue_number \}\}"/,
  );
  const dispatches = runControllerAtQaBoundary(t).filter(
    (request) => request.method === 'POST' && request.pathname.includes('/actions/workflows/'),
  );
  assert.equal(dispatches.length, 1);
  assert.equal(
    dispatches[0].pathname,
    `/repos/${repository}/actions/workflows/research-qa-qa-v01.yml/dispatches`,
  );
  assert.equal(dispatches[0].body.ref, 'main');
  assert.equal(dispatches[0].body.inputs.issue_number, '71');
  assert.match(dispatches[0].body.inputs.dispatch_identity, /^[a-f0-9]{64}$/);
});

test('routing remains Research=1, QA=1, third worker=0 under max_worker_runs=2', () => {
  const item = workItem(2);
  const first = protocol.route({
    work_item: item,
    research_results: [],
    qa_results: [],
    dispatches: [],
    usage: { worker_runs_used: 0 },
  });
  assert.equal(first.action, 'DISPATCH_RESEARCH');
  assert.equal(first.role_instance_id, 'research-1');

  const researchTerminal = researchResult(item);
  const second = protocol.route({
    work_item: item,
    research_results: [researchTerminal],
    qa_results: [],
    dispatches: [first.dispatch_identity],
    usage: { worker_runs_used: 1 },
  });
  assert.equal(second.action, 'DISPATCH_QA');
  assert.equal(second.role_instance_id, 'qa-1');

  assert.deepEqual(
    protocol.checkBudget({ budget: item.budget, worker_runs_used: 2 }),
    { ok: false, reason: 'run_limit_exhausted' },
  );

  const terminal = protocol.route({
    work_item: item,
    research_results: [researchTerminal],
    qa_results: [qaResult(item, researchTerminal.result_id)],
    dispatches: [first.dispatch_identity, second.dispatch_identity],
    usage: { worker_runs_used: 2 },
  });
  assert.deepEqual(
    {
      action: terminal.action,
      disposition: terminal.disposition,
      reason: terminal.reason,
      founder_gate: terminal.founder_gate,
    },
    {
      action: 'STOP',
      disposition: 'PASS',
      reason: 'founder_lead_terminal_gate',
      founder_gate: true,
    },
  );
});

test('QA candidate leaves current-main Research workflow byte-identical', () => {
  assert.equal(gitBlobSha(research), currentMainResearchBlob);
});
