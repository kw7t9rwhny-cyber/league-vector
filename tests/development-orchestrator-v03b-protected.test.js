"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../scripts/development-orchestrator-v03b-protected.js");

const REPO = P.TRUSTED_REPOSITORY;
const ENVIRONMENT = P.FOUNDER_ENVIRONMENT;
const GOOD_ENV = {
  id: 19923616351,
  name: ENVIRONMENT,
  can_admins_bypass: false,
  protection_rules: [
    {
      id: 1,
      type: "required_reviewers",
      prevent_self_review: false,
      reviewers: [{ type: "User", reviewer: { login: P.FOUNDER_REVIEWER } }]
    },
    { id: 2, type: "branch_policy" }
  ],
  deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }
};
const GOOD_POLICIES = { total_count: 1, branch_policies: [{ id: 1, name: "main", type: "branch" }] };
const GOOD_RUNTIME = {
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REPOSITORY: REPO,
  GITHUB_REF: "refs/heads/main",
  GITHUB_REF_TYPE: "branch",
  GITHUB_REF_NAME: "main",
  GITHUB_WORKFLOW_REF: P.EXPECTED_WORKFLOW_REF,
  LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE: "1",
  LEAGUE_VECTOR_STAGE3B_ACTIVATED: "1",
  LEAGUE_VECTOR_STAGE3B_ENVIRONMENT_NAME: ENVIRONMENT,
  GITHUB_RUN_ID: "123"
};

function attestation(o = {}) {
  return P.buildFounderAttestation({
    env: o.env || GOOD_RUNTIME,
    environment: o.environment === undefined ? GOOD_ENV : o.environment,
    policies: o.policies === undefined ? GOOD_POLICIES : o.policies,
    activationSecret: o.activationSecret === undefined ? "1" : o.activationSecret
  });
}

for (const [name, patch, reason] of [
  ["wrong environment name", { LEAGUE_VECTOR_STAGE3B_ENVIRONMENT_NAME: "other" }, "environment_binding_name_mismatch"],
  ["wrong repository", { GITHUB_REPOSITORY: "attacker/repo" }, "repository_identity_mismatch"],
  ["wrong branch", { GITHUB_REF: "refs/heads/feature", GITHUB_REF_NAME: "feature" }, "ref_not_default_branch"],
  ["tag main", { GITHUB_REF: "refs/tags/main", GITHUB_REF_TYPE: "tag" }, "ref_not_default_branch"],
  ["push event", { GITHUB_EVENT_NAME: "push" }, "event_not_workflow_dispatch"],
  ["schedule event", { GITHUB_EVENT_NAME: "schedule" }, "event_not_workflow_dispatch"],
  ["pull request event", { GITHUB_EVENT_NAME: "pull_request" }, "event_not_workflow_dispatch"],
  ["wrong workflow ref", { GITHUB_WORKFLOW_REF: `${REPO}/${P.WORKFLOW_PATH}@refs/heads/feature` }, "workflow_ref_not_trusted_main_workflow"],
  ["missing execute flag", { LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE: "0" }, "execute_flag_missing"],
  ["missing activation flag", { LEAGUE_VECTOR_STAGE3B_ACTIVATED: "0" }, "stage3b_activation_flag_missing"]
]) {
  test(`${name} denies protected activation`, () => {
    const result = P.validateRuntimeContext({ ...GOOD_RUNTIME, ...patch });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, reason);
  });
}

test("authorized same-repository main workflow_dispatch runtime is eligible only after environment checks", () => {
  assert.equal(P.validateRuntimeContext(GOOD_RUNTIME).allowed, true);
});

test("environment missing denies", () => {
  const result = attestation({ environment: null });
  assert.equal(result.gate.allowed, false);
  assert.equal(result.gate.reason, "environment_metadata_missing");
});

test("wrong live environment name denies", () => {
  const result = attestation({ environment: { ...GOOD_ENV, name: "other" } });
  assert.equal(result.gate.allowed, false);
});

test("administrator bypass enabled denies", () => {
  const result = attestation({ environment: { ...GOOD_ENV, can_admins_bypass: true } });
  assert.equal(result.gate.allowed, false);
});

test("required reviewer missing denies", () => {
  const environment = structuredClone(GOOD_ENV);
  environment.protection_rules[0].reviewers = [{ type: "User", reviewer: { login: "attacker" } }];
  const result = attestation({ environment });
  assert.equal(result.gate.allowed, false);
});

test("required reviewer rule missing denies", () => {
  const environment = { ...GOOD_ENV, protection_rules: [{ type: "branch_policy" }] };
  const result = attestation({ environment });
  assert.equal(result.gate.allowed, false);
});

test("prevent-self-review incompatible with Founder self-approval flow denies", () => {
  const environment = structuredClone(GOOD_ENV);
  environment.protection_rules[0].prevent_self_review = true;
  const result = attestation({ environment });
  assert.equal(result.gate.allowed, false);
});

test("missing exact main branch policy denies", () => {
  const result = attestation({ policies: { total_count: 0, branch_policies: [] } });
  assert.equal(result.gate.allowed, false);
});

test("extra branch policy denies", () => {
  const result = attestation({ policies: { total_count: 2, branch_policies: [{ name: "main", type: "branch" }, { name: "feature", type: "branch" }] } });
  assert.equal(result.gate.allowed, false);
});

test("tag policy named main denies", () => {
  const result = attestation({ policies: { total_count: 1, branch_policies: [{ name: "main", type: "tag" }] } });
  assert.equal(result.gate.allowed, false);
});

test("environment secret missing denies", () => {
  const result = attestation({ activationSecret: "" });
  assert.equal(result.gate.allowed, false);
  assert.equal(result.gate.reason, "environment_activation_secret_missing_or_invalid");
});

test("environment secret wrong denies", () => {
  const result = attestation({ activationSecret: "0" });
  assert.equal(result.gate.allowed, false);
});

test("repository/org same-name assertion without protected environment cannot authorize", () => {
  const env = { ...GOOD_RUNTIME, LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED: "1", REPOSITORY_LEVEL_LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED: "1" };
  const result = P.buildFounderAttestation({ env, environment: null, policies: null, activationSecret: "1" });
  assert.equal(result.gate.allowed, false);
});

test("verified protected environment + exact secret produces controlled attestation", () => {
  const result = attestation();
  assert.equal(result.gate.allowed, true);
  assert.deepEqual(result.attestation, {
    source: "environment-secret",
    environment: ENVIRONMENT,
    verified: true,
    protection_verified: true,
    activation: "1",
    derived_from: "github_environment_job_plus_live_environment_metadata"
  });
});

test("workflow is manual-only, one-PR, environment-bound, and dry-run default", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "development-orchestrator-stage3b-controlled.yml"), "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+(schedule|pull_request|pull_request_target|push|workflow_run|issue_comment):/);
  assert.match(workflow, /target_pr_number:/);
  assert.match(workflow, /default: dry-run/);
  assert.match(workflow, /environment:\s*\n\s*name: stage3b-controlled-activation/);
  assert.match(workflow, /LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATION_SECRET: \$\{\{ secrets\.LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED \}\}/);
  assert.match(workflow, /LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE: "1"/);
  assert.match(workflow, /LEAGUE_VECTOR_STAGE3B_ACTIVATED: "1"/);
});

test("preview job remains read-only and execute permission ceiling is issues:write", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "development-orchestrator-stage3b-controlled.yml"), "utf8");
  const preview = workflow.split("  preview:")[1].split("  dry-run-proof:")[0];
  assert.match(preview, /contents: read/);
  assert.match(preview, /pull-requests: read/);
  assert.match(preview, /issues: read/);
  assert.doesNotMatch(preview, /issues: write/);
  const execute = workflow.split("  execute-one-pr:")[1];
  assert.match(execute, /contents: read/);
  assert.match(execute, /pull-requests: read/);
  assert.match(execute, /issues: write/);
  assert.doesNotMatch(execute, /pull-requests: write|contents: write|actions: write|deployments: write/);
});

test("secret value is never emitted into protected audit schema", async () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "development-orchestrator-v03b-protected.js"), "utf8");
  assert.match(source, /secret_value_recorded: false/);
  assert.doesNotMatch(source, /secret_value:/);
});
