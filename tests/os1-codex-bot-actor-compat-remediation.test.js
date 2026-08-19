const fs = require('node:fs');
const assert = require('node:assert/strict');

const researchPath = '.github/workflows/research-qa-research-v01.yml';
const controllerPath = '.github/workflows/research-qa-controller-v01.yml';
const helperPath = 'scripts/research-qa-workflow-helper-v01.js';

const research = fs.readFileSync(researchPath, 'utf8');
const controller = fs.readFileSync(controllerPath, 'utf8');
const helper = fs.readFileSync(helperPath, 'utf8');

const checks = [
  ['allow-bots true is scoped to Research Codex invocation', () => {
    const codex = research.match(/uses: openai\/codex-action@v1[\s\S]*?(?=\n\s{2}[a-zA-Z-]+:|\n\s{6}- name:|$)/)?.[0] || '';
    assert.match(codex, /allow-bots:\s*true/);
  }],
  ['Codex action remains @v1', () => assert.match(research, /uses: openai\/codex-action@v1/)],
  ['permission profile remains read-only', () => assert.match(research, /permission-profile:\s*["']?:read-only["']?/)],
  ['Research job contents permission remains read', () => assert.match(research, /research:[\s\S]*?permissions:\s*\n\s+contents:\s*read/)],
  ['no contents write permission exists in Research workflow', () => assert.doesNotMatch(research, /contents:\s*write/)],
  ['checkout credentials remain non-persistent', () => assert.match(research, /persist-credentials:\s*false/)],
  ['Research checkout remains bound to validated immutable commit_sha', () => assert.match(research, /ref:\s*\$\{\{ needs\.preflight\.outputs\.commit_sha \}\}/)],
  ['no allow-users wildcard is introduced', () => assert.doesNotMatch(research, /allow-users:\s*["']?\*/)],
  ['no broad allow-bot-users override is introduced', () => assert.doesNotMatch(research, /allow-bot-users:/)],
  ['no PAT or alternate write-token input is introduced', () => assert.doesNotMatch(research, /PAT|personal[_ -]?access[_ -]?token|write[_ -]?token/i)],
  ['Research remains workflow_dispatch-only worker', () => assert.match(research, /workflow_dispatch:/)],
  ['Research preflight remains required', () => assert.match(research, /research:\s*\n\s+needs:\s*preflight/)],
  ['terminal fail-closed guard remains', () => assert.match(research, /Reject false-green or partial Research completion/)],
  ['no retry command is introduced', () => assert.doesNotMatch(research, /\bretry\b/i)],
  ['no replacement-worker authority is introduced', () => assert.doesNotMatch(research, /replacement worker|replacement-worker/i)],
  ['Research workflow does not dispatch QA directly', () => assert.doesNotMatch(research, /research-qa-qa-v01|createWorkflowDispatch/)],
  ['Research workflow contains no public mutation CLI', () => assert.doesNotMatch(research, /\b(?:git push|gh pr create|gh issue create|gh release create)\b/)],
  ['Controller still identifies the same Research workflow', () => assert.match(controller, /research-qa-research-v01\.yml/)],
  ['Controller still enforces one Research worker', () => assert.match(controller + helper, /max_research_workers|research_worker_count|research_worker/i)],
  ['third-worker prohibition remains represented', () => assert.match(controller + helper, /third_worker_prohibited|third worker|third-worker/i)],
];

let passed = 0;
for (const [name, fn] of checks) {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}
console.log(`# tests ${checks.length}`);
console.log(`# pass ${passed}`);
console.log(`# fail ${checks.length - passed}`);
