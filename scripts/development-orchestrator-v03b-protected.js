"use strict";

const Controlled = require("./development-orchestrator-v03b-controlled.js");

const VERSION = "lv-development-orchestrator-stage3b-protected-environment-v0.1";
const TRUSTED_REPOSITORY = Controlled.TRUSTED_REPOSITORY;
const FOUNDER_ENVIRONMENT = Controlled.FOUNDER_ENVIRONMENT;
const FOUNDER_REVIEWER = "kw7t9rwhny-cyber";
const WORKFLOW_PATH = ".github/workflows/development-orchestrator-stage3b-controlled.yml";
const EXPECTED_WORKFLOW_REF = `${TRUSTED_REPOSITORY}/${WORKFLOW_PATH}@refs/heads/main`;
const FOUNDER_AUTH_SOURCE = "github-protected-environment-job-admission";

function deny(reason, extra = {}) {
  return { allowed: false, reason, ...extra };
}

function validateRuntimeContext(env = process.env) {
  if (env.GITHUB_EVENT_NAME !== "workflow_dispatch") return deny("event_not_workflow_dispatch");
  if (env.GITHUB_REPOSITORY !== TRUSTED_REPOSITORY) return deny("repository_identity_mismatch");
  if (env.GITHUB_REF !== "refs/heads/main") return deny("ref_not_default_branch");
  if (env.GITHUB_REF_TYPE !== "branch") return deny("ref_type_not_branch");
  if (env.GITHUB_REF_NAME !== "main") return deny("ref_name_not_main");
  if (env.GITHUB_WORKFLOW_REF !== EXPECTED_WORKFLOW_REF) return deny("workflow_ref_not_trusted_main_workflow");
  if (env.LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE !== "1") return deny("execute_flag_missing");
  if (env.LEAGUE_VECTOR_STAGE3B_ACTIVATED !== "1") return deny("stage3b_activation_flag_missing");
  if (env.LEAGUE_VECTOR_STAGE3B_ENVIRONMENT_NAME !== FOUNDER_ENVIRONMENT) return deny("environment_binding_name_mismatch");
  return { allowed: true, reason: "runtime_context_valid" };
}

function validateEnvironmentMetadata(environment, policies) {
  if (!environment || typeof environment !== "object") return deny("environment_metadata_missing");
  if (environment.name !== FOUNDER_ENVIRONMENT) return deny("environment_identity_mismatch");
  if (environment.can_admins_bypass !== false) return deny("environment_admin_bypass_not_disabled");
  const rules = Array.isArray(environment.protection_rules) ? environment.protection_rules : [];
  const reviewerRule = rules.find((rule) => rule && rule.type === "required_reviewers");
  if (!reviewerRule) return deny("required_reviewer_rule_missing");
  if (reviewerRule.prevent_self_review !== false) return deny("prevent_self_review_not_compatible_with_founder_approval_flow");
  const reviewers = Array.isArray(reviewerRule.reviewers) ? reviewerRule.reviewers : [];
  const reviewerLogins = reviewers
    .filter((entry) => entry && entry.type === "User" && entry.reviewer && typeof entry.reviewer.login === "string")
    .map((entry) => entry.reviewer.login);
  if (!reviewerLogins.includes(FOUNDER_REVIEWER)) return deny("founder_required_reviewer_missing");
  if (!environment.deployment_branch_policy || environment.deployment_branch_policy.custom_branch_policies !== true) {
    return deny("custom_branch_policy_missing");
  }
  const branchPolicies = Array.isArray(policies && policies.branch_policies) ? policies.branch_policies : [];
  if (branchPolicies.length !== 1 || branchPolicies[0].name !== "main" || branchPolicies[0].type !== "branch") {
    return deny("deployment_branch_policy_not_exact_main");
  }
  return {
    allowed: true,
    reason: "protected_environment_metadata_valid",
    environment_id: environment.id || null,
    reviewer: FOUNDER_REVIEWER,
    prevent_self_review: reviewerRule.prevent_self_review,
    can_admins_bypass: environment.can_admins_bypass,
    branch_policy: { name: "main", type: "branch" }
  };
}

function buildFounderAttestation({ env = process.env, environment, policies }) {
  const runtime = validateRuntimeContext(env);
  if (!runtime.allowed) return { gate: runtime, attestation: null };
  const protectedEnvironment = validateEnvironmentMetadata(environment, policies);
  if (!protectedEnvironment.allowed) return { gate: protectedEnvironment, attestation: null };
  return {
    gate: {
      allowed: true,
      reason: "github_protected_environment_job_admission_valid",
      environment: protectedEnvironment,
      workflow_ref: env.GITHUB_WORKFLOW_REF
    },
    attestation: {
      source: FOUNDER_AUTH_SOURCE,
      environment: FOUNDER_ENVIRONMENT,
      verified: true,
      protection_verified: true,
      activation: "job-admitted",
      derived_from: "environment_bound_execute_job_plus_live_environment_metadata"
    }
  };
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!response.ok) throw new Error(`github_http_${response.status}:environment_provenance`);
  return response.json();
}

async function readLiveEnvironment(repository, token) {
  if (repository !== TRUSTED_REPOSITORY) throw new Error("untrusted_repository");
  const base = `https://api.github.com/repos/${repository}/environments/${FOUNDER_ENVIRONMENT}`;
  const environment = await githubJson(base, token);
  const policies = await githubJson(`${base}/deployment-branch-policies`, token);
  return { environment, policies };
}

async function executeProtected({ repository, token, targetPr, expectedFingerprint, env = process.env, adapter = null }) {
  const audit = {
    schema: "lv-stage3b-protected-environment-audit-v0.1",
    version: VERSION,
    workflow_run_id: env.GITHUB_RUN_ID || null,
    target_pr_input: targetPr,
    trusted_repository: TRUSTED_REPOSITORY,
    founder_environment: FOUNDER_ENVIRONMENT,
    founder_authorization_model: "protected-environment-job-admission",
    secret_authority: "none",
    environment_verification: null,
    controlled_result: null,
    abort_reason: null,
    manual_review_required: false
  };

  const runtime = validateRuntimeContext(env);
  if (!runtime.allowed) {
    audit.abort_reason = runtime.reason;
    return audit;
  }

  let liveEnvironment;
  try {
    liveEnvironment = await readLiveEnvironment(repository, token);
  } catch (error) {
    audit.abort_reason = `environment_provenance_unavailable:${error.message}`;
    return audit;
  }

  const founder = buildFounderAttestation({ env, ...liveEnvironment });
  audit.environment_verification = founder.gate;
  if (!founder.gate.allowed || !founder.attestation) {
    audit.abort_reason = founder.gate.reason;
    return audit;
  }

  const result = await Controlled.executeControlled({
    repository,
    token,
    targetPr,
    expectedFingerprint,
    env,
    adapter,
    founderAttestation: founder.attestation
  });
  audit.controlled_result = result;
  audit.abort_reason = result.abort_reason || null;
  audit.manual_review_required = Boolean(result.manual_review_required);
  return audit;
}

module.exports = {
  VERSION,
  TRUSTED_REPOSITORY,
  FOUNDER_ENVIRONMENT,
  FOUNDER_REVIEWER,
  WORKFLOW_PATH,
  EXPECTED_WORKFLOW_REF,
  FOUNDER_AUTH_SOURCE,
  validateRuntimeContext,
  validateEnvironmentMetadata,
  buildFounderAttestation,
  readLiveEnvironment,
  executeProtected
};

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (args[0] !== "execute") throw new Error("protected_bridge_supports_execute_only");
    const targetIndex = args.indexOf("--target-pr");
    const fingerprintIndex = args.indexOf("--expected-fingerprint");
    if (targetIndex < 0 || args[targetIndex + 1] === undefined) throw new Error("--target-pr required");
    if (fingerprintIndex < 0 || args[fingerprintIndex + 1] === undefined) throw new Error("--expected-fingerprint required");
    const repository = process.env.GITHUB_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;
    if (!repository || !token) throw new Error("GITHUB_REPOSITORY_and_GITHUB_TOKEN_required");
    const audit = await executeProtected({
      repository,
      token,
      targetPr: args[targetIndex + 1],
      expectedFingerprint: args[fingerprintIndex + 1],
      env: process.env
    });
    process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
    const controlled = audit.controlled_result;
    const ok = controlled && controlled.stage3b_audit && ["verified", "no-op-success"].includes(controlled.stage3b_audit.post_write_verification) && !audit.abort_reason;
    if (!ok) process.exitCode = 2;
  })().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  });
}
