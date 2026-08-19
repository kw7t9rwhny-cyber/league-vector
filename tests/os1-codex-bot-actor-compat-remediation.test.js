const fs = require('node:fs');
const assert = require('node:assert/strict');
const test = require('node:test');

const researchPath = '.github/workflows/research-qa-research-v01.yml';
const controllerPath = '.github/workflows/research-qa-controller-v01.yml';
const helperPath = 'scripts/research-qa-workflow-helper-v01.js';

const research = fs.readFileSync(researchPath, 'utf8');
const controller = fs.readFileSync(controllerPath, 'utf8');
const helper = fs.readFileSync(helperPath, 'utf8');

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

test('Controller still identifies the same Research workflow', () => {
  assert.match(controller, /research-qa-research-v01\.yml/);
});

test('Controller/helper still represent one Research worker authority', () => {
  assert.match(controller + helper, /max_research_workers|research_worker_count|research_worker/i);
});

test('third-worker prohibition remains represented', () => {
  assert.match(controller + helper, /third_worker_prohibited|third worker|third-worker/i);
});
