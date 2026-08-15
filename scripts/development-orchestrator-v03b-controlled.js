"use strict";

const Stage2 = require("./development-orchestrator-v02.js");
const Stage3A = require("./development-orchestrator-v03a.js");
const Stage3B = require("./development-orchestrator-v03b.js");

const CONTROLLED_VERSION = "lv-development-orchestrator-stage3b-controlled-v0.1";
const TRUSTED_REPOSITORY = "kw7t9rwhny-cyber/league-vector";
const FOUNDER_ENVIRONMENT = "stage3b-controlled-activation";
const FOUNDER_AUTH_SOURCE = "github-protected-environment-job-admission";
const REPOSITORY_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/;
const PR_RE = /^[1-9][0-9]*$/;
const SAFE_REQUEST_ID_RE = /^[A-Za-z0-9:_-]{1,128}$/;
const SAFE_DOCS_URL_RE = /^https:\/\/docs\.github\.com\//i;
const TOKEN_PATTERN_RE = /(?:Bearer\s+[^\s]+|github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+)/gi;

function canonicalRepository(value) {
  if (typeof value !== "string" || !REPOSITORY_RE.test(value)) throw new Error("invalid_repository");
  return value;
}

function canonicalPrNumber(value) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error("invalid_target_pr_number");
    return value;
  }
  if (typeof value !== "string" || !PR_RE.test(value)) throw new Error("invalid_target_pr_number");
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || String(number) !== value) throw new Error("invalid_target_pr_number");
  return number;
}

function parseTargetPr(value) {
  return canonicalPrNumber(value);
}

function founderActivationGate(attestation) {
  if (!attestation || typeof attestation !== "object" || Array.isArray(attestation)) {
    return {allowed:false,reason:"founder_environment_attestation_missing",source:null,environment:null,verified:false};
  }
  const source = attestation.source;
  const environment = attestation.environment;
  const verified = attestation.verified === true;
  const protectionVerified = attestation.protection_verified === true;
  const activated = attestation.activation === "job-admitted";
  if (source !== FOUNDER_AUTH_SOURCE) return {allowed:false,reason:"founder_environment_source_unverified",source:source||null,environment:environment||null,verified:false};
  if (environment !== FOUNDER_ENVIRONMENT) return {allowed:false,reason:"founder_environment_identity_mismatch",source,environment:environment||null,verified:false};
  if (!verified || !protectionVerified) return {allowed:false,reason:"founder_environment_protection_unverified",source,environment,verified:false};
  if (!activated) return {allowed:false,reason:"founder_environment_job_admission_missing_or_malformed",source,environment,verified:true};
  return {allowed:true,reason:"founder_environment_job_admission_verified",source,environment,verified:true};
}

function canonicalMutationsOnly(plan) {
  const errors = Stage3B.validateMutationAllowlist(plan);
  if (errors.length) return {valid:false,errors};
  for (const mutation of plan.mutations || []) {
    if (!(mutation.label.startsWith("status:") || mutation.label.startsWith("owner:"))) {
      return {valid:false,errors:[`non_orchestrator_label:${mutation.label}`]};
    }
  }
  return {valid:true,errors:[]};
}

function planForTarget(data, targetPr) {
  const number = canonicalPrNumber(targetPr);
  const queues = Stage2.deriveQueues(data.prs || []);
  const item = queues.items.find((x) => x.id === number);
  const rawPr = (data.prs || []).find((x) => x.number === number);
  if (!item || !rawPr) throw new Error("target_pr_not_found");
  const byId = Object.fromEntries(queues.items.map((x) => [x.id,x]));
  return {queues,item,rawPr,plan:Stage3A.planItem(item,rawPr,byId,data.main_sha||null)};
}

function previewFrom(data, targetPr) {
  const number = canonicalPrNumber(targetPr);
  const {item,rawPr,plan} = planForTarget(data,number);
  const labels = (rawPr.labels || []).map((x) => typeof x === "string" ? x : x.name).filter(Boolean).sort();
  const proposedAdd = (plan.mutations || []).filter((x) => x.operation === "ADD_LABEL").map((x) => x.label);
  const proposedRemove = (plan.mutations || []).filter((x) => x.operation === "REMOVE_LABEL").map((x) => x.label);
  const p = plan.provenance || {};
  return {
    schema:"lv-stage3b-controlled-preview-v0.1",version:CONTROLLED_VERSION,authorization:false,target_pr:number,
    current_head:rawPr.head_sha||null,
    stage2_state:{status:item.status||null,owner:item.owner||null,type:item.type||null,risk:item.risk||null,priority:item.priority||null,recommended_action:item.recommended_action||null,structured:Boolean(item.structured)},
    stage3a_disposition:plan.disposition,stage3a_reason:plan.reason,current_labels:labels,
    proposed_labels:{add:proposedAdd,remove:proposedRemove},exact_mutations:plan.mutations||[],
    qa:{state:plan.qa_state||"none",tested_sha:plan.qa_tested_sha||null},
    founder:{required:item.founder_decision_required,gate:item.founder_gate||null,decision:item.founder_decision||null},
    dependencies:p.dependencies||[],current_main:p.main_sha||data.main_sha||null,replay_fingerprint:p.fingerprint||null
  };
}

function sanitizeDiagnosticText(value, token = null) {
  if (typeof value !== "string") return null;
  let safe = value.replace(TOKEN_PATTERN_RE,"[REDACTED]");
  if (typeof token === "string" && token.length >= 6) safe = safe.split(token).join("[REDACTED]");
  return safe.slice(0,512);
}

function safeGitHubDiagnostic({response,operation,bodyText,token}) {
  let parsed = null;
  try { parsed = bodyText ? JSON.parse(bodyText) : null; } catch (_) { parsed = null; }
  const rawMessage = parsed && typeof parsed.message === "string" ? parsed.message : (bodyText || response.statusText || "GitHub request failed");
  const rawDocs = parsed && typeof parsed.documentation_url === "string" ? parsed.documentation_url : null;
  const requestIdRaw = response && response.headers && typeof response.headers.get === "function" ? response.headers.get("x-github-request-id") : null;
  return {
    status: Number(response.status),
    operation: String(operation || "request"),
    message: sanitizeDiagnosticText(rawMessage,token),
    documentation_url: rawDocs && SAFE_DOCS_URL_RE.test(rawDocs) ? rawDocs.slice(0,512) : null,
    request_id: requestIdRaw && SAFE_REQUEST_ID_RE.test(requestIdRaw) ? requestIdRaw : null
  };
}

async function githubJson(url, token, options = {}) {
  const response = await fetch(url,{...options,headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${token}`,"X-GitHub-Api-Version":"2022-11-28",...(options.headers||{})}});
  if (!response.ok) {
    let bodyText = "";
    try { bodyText = await response.text(); } catch (_) { bodyText = ""; }
    const diagnostic = safeGitHubDiagnostic({response,operation:options.operation||"request",bodyText,token});
    const error = new Error(`github_api_error:${JSON.stringify(diagnostic)}`);
    error.githubDiagnostic = diagnostic;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

async function assertRepositoryLabelExists(token,repository,label) {
  try {
    const result = await githubJson(`https://api.github.com/repos/${repository}/labels/${encodeURIComponent(label)}`,token,{operation:"get_repository_label"});
    if (!result || typeof result !== "object" || Array.isArray(result) || typeof result.name !== "string" || result.name !== label) {
      throw new Error(`canonical_repository_label_response_invalid:${label}`);
    }
  } catch (error) {
    if (error && error.githubDiagnostic && error.githubDiagnostic.status === 404) throw new Error(`canonical_repository_label_missing:${label}`);
    throw error;
  }
}

class GitHubControlledLabelAdapter extends Stage3B.GitHubReadOnlyAdapter {
  constructor(token, expectedRepository = TRUSTED_REPOSITORY) {
    super(token);
    this.expectedRepository = canonicalRepository(expectedRepository);
    if (this.expectedRepository !== TRUSTED_REPOSITORY) throw new Error("untrusted_expected_repository");
  }
  async addLabel(repository, pr, label) {
    const repo = canonicalRepository(repository);
    if (repo !== this.expectedRepository) throw new Error("repository_identity_mismatch");
    const number = canonicalPrNumber(pr);
    if (!Stage3B.CANONICAL_LABEL_ALLOWLIST.has(label)) throw new Error(`noncanonical_label:${label}`);
    await assertRepositoryLabelExists(this.token,repo,label);
    await githubJson(`https://api.github.com/repos/${repo}/issues/${number}/labels`,this.token,{method:"POST",operation:"add_label",headers:{"Content-Type":"application/json"},body:JSON.stringify({labels:[label]})});
  }
  async removeLabel(repository, pr, label) {
    const repo = canonicalRepository(repository);
    if (repo !== this.expectedRepository) throw new Error("repository_identity_mismatch");
    const number = canonicalPrNumber(pr);
    if (!Stage3B.CANONICAL_LABEL_ALLOWLIST.has(label)) throw new Error(`noncanonical_label:${label}`);
    await githubJson(`https://api.github.com/repos/${repo}/issues/${number}/labels/${encodeURIComponent(label)}`,this.token,{method:"DELETE",operation:"remove_label"});
  }
}

async function buildLivePreview({repository,token,targetPr}) {
  const repo = canonicalRepository(repository);
  if (repo !== TRUSTED_REPOSITORY) throw new Error("untrusted_repository");
  const number = parseTargetPr(targetPr);
  const data = await Stage2.loadLiveRepository(repo,token);
  return {data,preview:previewFrom(data,number),plan:planForTarget(data,number).plan};
}

async function executeControlled({repository,token,targetPr,expectedFingerprint,env=process.env,adapter=null,founderAttestation=null}) {
  const repo = canonicalRepository(repository);
  const number = parseTargetPr(targetPr);
  const founder = founderActivationGate(founderAttestation);
  const result = {schema:"lv-stage3b-controlled-audit-v0.1",workflow_run_id:env.GITHUB_RUN_ID||null,target_pr:number,founder_activation:founder,expected_preview_fingerprint:expectedFingerprint||null,trusted_repository_identity:null,trusted_default_branch:null,trusted_fork:null,stage3b_audit:null,abort_reason:null,manual_review_required:false};
  if (repo !== TRUSTED_REPOSITORY) {result.abort_reason="trusted_repository_mismatch";return result;}
  if (!founder.allowed) {result.abort_reason=`founder_gate:${founder.reason}`;return result;}
  if (!expectedFingerprint || !/^[0-9a-f]{64}$/.test(expectedFingerprint)) {result.abort_reason="missing_or_invalid_preview_fingerprint";return result;}

  const writeAdapter = adapter || new GitHubControlledLabelAdapter(token,TRUSTED_REPOSITORY);
  const trusted = await writeAdapter.readActivationProvenance(repo);
  result.trusted_repository_identity = trusted.repository_full_name||null;
  result.trusted_default_branch = trusted.default_branch||null;
  result.trusted_fork = trusted.fork;
  if (trusted.repository_full_name !== TRUSTED_REPOSITORY) {result.abort_reason="trusted_repository_provenance_mismatch";return result;}

  const live = await writeAdapter.readRepository(repo);
  const {plan} = planForTarget(live,number);
  if ((plan.provenance&&plan.provenance.fingerprint)!==expectedFingerprint) {result.abort_reason="preview_state_changed";return result;}
  const mutationCheck = canonicalMutationsOnly(plan);
  if (!mutationCheck.valid) {result.abort_reason=`mutation_allowlist:${mutationCheck.errors.join("|")}`;return result;}
  if (!plan.mutations||plan.mutations.length===0) {result.abort_reason="no_live_mutation_authorized";return result;}

  const audit = await Stage3B.executePlan({plan,repository:repo,adapter:writeAdapter,mode:"execute",env});
  result.stage3b_audit=audit;result.abort_reason=audit.aborted_reason||null;result.manual_review_required=Boolean(audit.manual_review_required);
  return result;
}

module.exports={CONTROLLED_VERSION,TRUSTED_REPOSITORY,FOUNDER_ENVIRONMENT,FOUNDER_AUTH_SOURCE,canonicalRepository,canonicalPrNumber,parseTargetPr,founderActivationGate,canonicalMutationsOnly,planForTarget,previewFrom,sanitizeDiagnosticText,safeGitHubDiagnostic,buildLivePreview,executeControlled,GitHubControlledLabelAdapter};

if (require.main===module) {
  (async()=>{
    const args=process.argv.slice(2),command=args[0]||"preview",targetIndex=args.indexOf("--target-pr");
    if(targetIndex<0||args[targetIndex+1]===undefined) throw new Error("--target-pr <canonical-positive-integer> required");
    const targetPr=parseTargetPr(args[targetIndex+1]);
    const repository=process.env.GITHUB_REPOSITORY||process.env.LEAGUE_VECTOR_REPOSITORY,token=process.env.GITHUB_TOKEN;
    if(!repository||!token) throw new Error("GITHUB_REPOSITORY_and_GITHUB_TOKEN_required");
    if(command==="preview"){const {preview}=await buildLivePreview({repository,token,targetPr});process.stdout.write(`${JSON.stringify(preview,null,2)}\n`);return;}
    if(command!=="execute") throw new Error(`unknown_command:${command}`);
    const fingerprintIndex=args.indexOf("--expected-fingerprint"),expectedFingerprint=fingerprintIndex>=0?args[fingerprintIndex+1]:null;
    // The raw Controlled Activation CLI is never a live Founder-authorization source. Only the protected
    // Environment wrapper may construct the job-admission attestation after GitHub admits that exact job.
    const result=await executeControlled({repository,token,targetPr,expectedFingerprint,env:process.env,founderAttestation:null});
    process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
    const ok=result.stage3b_audit&&["verified","no-op-success"].includes(result.stage3b_audit.post_write_verification)&&!result.abort_reason;
    if(!ok) process.exitCode=2;
  })().catch((error)=>{process.stderr.write(`${error.message}\n`);process.exit(2);});
}
