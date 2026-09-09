'use strict';

const crypto = require('node:crypto');

const WORK_ITEM_MARKER = 'LV_RESEARCH_QA_WORK_ITEM_V1';
const RESULT_MARKER = 'LV_PROTOCOL_TERMINAL_RESULT_V1';
const DISPATCH_MARKER = 'LV_PROTOCOL_DISPATCH_CLAIM_V1';
const SCHEMA_VERSION = 'research-qa-protocol/v1';
const RESULT_SCHEMA_VERSION = 'research-qa-terminal-result/v1';
const CLAIM_SCHEMA_VERSION = 'research-qa-dispatch-claim/v1';
const ROLES = new Set(['research', 'qa']);
const RISK = new Set(['low', 'medium', 'high', 'live']);
const QA_REQUIREMENTS = new Set(['none', 'one', 'dual', 'installed-state', 'security']);
const CONFIDENTIALITY = new Set(['public', 'confidential-engineering', 'restricted-rd']);
const QA_STATUSES = new Set(['PASS', 'FAIL', 'BLOCKED']);
const RESEARCH_STATUSES = new Set(['COMPLETE', 'FAIL', 'BLOCKED']);
const ALLOWED_ACTIONS = Object.freeze({
  research: new Set(['read_repository', 'read_work_item', 'write_terminal_result']),
  qa: new Set(['read_repository', 'read_work_item', 'read_upstream_result', 'write_terminal_result']),
});
const REQUIRED_FORBIDDEN = new Set([
  'mutate_production', 'merge', 'install', 'deploy', 'release', 'change_authority',
  'change_qa_criteria', 'dispatch_worker', 'remediate',
]);
const TRUSTED_RESULT_WRITER = Object.freeze({ id: 41898282, login: 'github-actions[bot]', type: 'Bot' });
const TRUSTED_PROTOCOL_PERMISSIONS = new Set(['admin', 'maintain', 'write']);

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}
function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function fail(reason, details = {}) { return { ok: false, reason, ...details }; }
function pass(value = {}) { return { ok: true, ...value }; }
function isPlainObject(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function exactKeys(obj, required, optional = []) {
  if (!isPlainObject(obj)) return false;
  const allowed = new Set([...required, ...optional]);
  return required.every((k) => Object.prototype.hasOwnProperty.call(obj, k)) && Object.keys(obj).every((k) => allowed.has(k));
}
function stringArray(value, { min = 0, max = 32 } = {}) {
  return Array.isArray(value) && value.length >= min && value.length <= max && value.every((v) => typeof v === 'string' && v.length > 0 && v.length <= 500);
}
function parseMarkedJson(body, marker) {
  if (typeof body !== 'string' || body.includes('\r')) return fail('malformed_text');
  const lines = body.split('\n');
  if (lines[0] !== marker || lines.length !== 2) return fail('malformed_marker_envelope');
  try { return pass({ value: JSON.parse(lines[1]) }); } catch { return fail('malformed_json'); }
}
function serializeMarkedJson(marker, value) { return `${marker}\n${canonicalJson(value)}`; }

function validateInputIdentity(input) {
  if (!exactKeys(input, ['repository', 'commit_sha', 'tree_sha'])) return fail('invalid_input_identity_shape');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.repository)) return fail('invalid_input_repository');
  if (!/^[a-f0-9]{40}$/.test(input.commit_sha)) return fail('invalid_input_commit_sha');
  if (!/^[a-f0-9]{40}$/.test(input.tree_sha)) return fail('invalid_input_tree_sha');
  return pass();
}

function validateBudget(budget) {
  if (!exactKeys(budget, ['max_worker_runs', 'max_actions_runtime_minutes'], ['max_ai_cost_or_credits'])) return fail('invalid_budget_shape');
  if (budget.max_worker_runs !== 1) return fail('invalid_max_worker_runs');
  if (budget.max_actions_runtime_minutes !== 10) return fail('invalid_max_actions_runtime');
  if (budget.max_ai_cost_or_credits !== undefined && budget.max_ai_cost_or_credits !== null) return fail('ai_budget_measurement_not_supported_v1');
  return pass();
}

function validateContextRefs(refs) {
  if (!Array.isArray(refs) || refs.length > 12) return fail('invalid_context_refs');
  for (const ref of refs) {
    if (!exactKeys(ref, ['kind', 'ref'], ['immutable_identity', 'required'])) return fail('invalid_context_ref_shape');
    if (!['public_file', 'evidence', 'private_handoff'].includes(ref.kind)) return fail('invalid_context_ref_kind');
    if (typeof ref.ref !== 'string' || ref.ref.length < 1 || ref.ref.length > 500) return fail('invalid_context_ref');
    if (ref.immutable_identity !== undefined && (typeof ref.immutable_identity !== 'string' || ref.immutable_identity.length > 200)) return fail('invalid_context_ref_identity');
    if (ref.required !== undefined && typeof ref.required !== 'boolean') return fail('invalid_context_ref_required');
  }
  return pass();
}

function validateWorkItem(item, { publicRuntime = true } = {}) {
  const required = ['schema_version','work_item_id','objective','role','risk','input_identity','context_refs','allowed_actions','forbidden_actions','expected_terminal_result','qa_requirement','founder_gate','confidentiality','budget','replay_identity'];
  const optional = ['dependencies'];
  if (!exactKeys(item, required, optional)) return fail('invalid_work_item_shape');
  if (item.schema_version !== SCHEMA_VERSION) return fail('unsupported_work_item_schema');
  if (!/^[a-z0-9][a-z0-9._-]{5,95}$/.test(item.work_item_id)) return fail('invalid_work_item_id');
  if (typeof item.objective !== 'string' || item.objective.length < 10 || item.objective.length > 1500) return fail('invalid_objective');
  if (!ROLES.has(item.role)) return fail('invalid_role');
  if (!RISK.has(item.risk)) return fail('invalid_risk');
  const inputCheck = validateInputIdentity(item.input_identity); if (!inputCheck.ok) return inputCheck;
  const contextCheck = validateContextRefs(item.context_refs); if (!contextCheck.ok) return contextCheck;
  if (!stringArray(item.allowed_actions, { min: 1, max: 8 })) return fail('invalid_allowed_actions');
  const allowed = ALLOWED_ACTIONS[item.role];
  if (item.allowed_actions.some((a) => !allowed.has(a))) return fail('unauthorized_allowed_action');
  if (!stringArray(item.forbidden_actions, { min: REQUIRED_FORBIDDEN.size, max: 24 })) return fail('invalid_forbidden_actions');
  if ([...REQUIRED_FORBIDDEN].some((a) => !item.forbidden_actions.includes(a))) return fail('missing_forbidden_action');
  if (item.expected_terminal_result !== `${item.role}-terminal-result/v1`) return fail('wrong_expected_terminal_result');
  if (!QA_REQUIREMENTS.has(item.qa_requirement)) return fail('invalid_qa_requirement');
  if (item.role === 'research' && item.qa_requirement !== 'one') return fail('research_requires_one_qa');
  if (item.role === 'qa' && item.qa_requirement !== 'none') return fail('qa_must_stop');
  if (typeof item.founder_gate !== 'string' || item.founder_gate !== 'founder-lead-stop-after-qa') return fail('invalid_founder_gate');
  if (!CONFIDENTIALITY.has(item.confidentiality)) return fail('invalid_confidentiality');
  if (publicRuntime && item.confidentiality !== 'public') return fail('public_runtime_confidentiality_block');
  const budgetCheck = validateBudget(item.budget); if (!budgetCheck.ok) return budgetCheck;
  if (!/^[a-f0-9]{64}$/.test(item.replay_identity)) return fail('invalid_replay_identity');
  if (item.dependencies !== undefined && !stringArray(item.dependencies, { max: 8 })) return fail('invalid_dependencies');
  if (item.role === 'research' && item.dependencies?.length) return fail('research_dependencies_not_supported_v1');
  if (item.role === 'qa' && (!item.dependencies || item.dependencies.length !== 1)) return fail('qa_requires_one_research_dependency');
  return pass();
}

function computeWorkItemIdentity(workItem) {
  return sha256(canonicalJson(workItem));
}

function deriveQaWorkItem(researchWorkItem) {
  const check = validateWorkItem(researchWorkItem); if (!check.ok) throw new Error(check.reason);
  if (researchWorkItem.role !== 'research') throw new Error('qa_derivation_requires_research_work_item');
  return {
    ...researchWorkItem,
    role: 'qa',
    allowed_actions: ['read_repository','read_work_item','read_upstream_result','write_terminal_result'],
    expected_terminal_result: 'qa-terminal-result/v1',
    qa_requirement: 'none',
    dependencies: ['research-primary'],
  };
}

function validateTrustedIssuer(issue, permissionData) {
  const user = issue?.user;
  if (!user || user.type !== 'User' || !Number.isInteger(user.id) || typeof user.login !== 'string' || user.login.length === 0) return fail('malformed_work_item_issuer');
  if (permissionData?.user?.login !== user.login || permissionData?.user?.id !== user.id) return fail('work_item_issuer_identity_mismatch');
  if (!TRUSTED_PROTOCOL_PERMISSIONS.has(permissionData?.permission)) return fail('work_item_issuer_not_authorized');
  return pass();
}

function computeResultId({ workItemId, workItemIdentity, role, roleInstanceId, workerRunId, runAttempt, inputIdentity, upstreamResultIds }) {
  return sha256(canonicalJson({ work_item_id: workItemId, work_item_identity: workItemIdentity, role, role_instance_id: roleInstanceId, worker_run_id: workerRunId, run_attempt: runAttempt, input_identity: inputIdentity, upstream_result_ids: upstreamResultIds }));
}
function computeDispatchIdentity({ workItem, role, roleInstanceId, upstreamResultIds = [] }) {
  return sha256(canonicalJson({ schema: CLAIM_SCHEMA_VERSION, replay_identity: workItem.replay_identity, work_item_id: workItem.work_item_id, work_item_identity: computeWorkItemIdentity(workItem), role, role_instance_id: roleInstanceId, input_identity: workItem.input_identity, upstream_result_ids: upstreamResultIds }));
}

function validateSubstance(substance, role) {
  if (!exactKeys(substance, ['status','claims_or_findings','evidence_refs','artifact_refs','limitations','recommended_next_action'])) return fail('invalid_substance_shape');
  const statuses = role === 'qa' ? QA_STATUSES : RESEARCH_STATUSES;
  if (!statuses.has(substance.status)) return fail('invalid_substance_status');
  if (!Array.isArray(substance.claims_or_findings) || substance.claims_or_findings.length > 32 || substance.claims_or_findings.some((v) => typeof v !== 'string' || v.length > 2000)) return fail('invalid_claims_or_findings');
  if (!stringArray(substance.evidence_refs, { max: 32 })) return fail('invalid_evidence_refs');
  if (!stringArray(substance.artifact_refs, { max: 16 })) return fail('invalid_artifact_refs');
  if (typeof substance.limitations !== 'string' || substance.limitations.length > 2000) return fail('invalid_limitations');
  if (typeof substance.recommended_next_action !== 'string' || substance.recommended_next_action.length > 1000) return fail('invalid_recommended_next_action');
  return pass();
}

function buildTerminalResult({ workItem, role, roleInstanceId, workerRunId, runAttempt, upstreamResultIds = [], substance, writerIdentity = TRUSTED_RESULT_WRITER, createdAt, telemetry }) {
  const wi = validateWorkItem(workItem); if (!wi.ok) throw new Error(wi.reason);
  if (workItem.role !== role) throw new Error('role_work_item_mismatch');
  const sub = validateSubstance(substance, role); if (!sub.ok) throw new Error(sub.reason);
  const workItemIdentity = computeWorkItemIdentity(workItem);
  const resultId = computeResultId({ workItemId: workItem.work_item_id, workItemIdentity, role, roleInstanceId, workerRunId, runAttempt, inputIdentity: workItem.input_identity, upstreamResultIds });
  return {
    schema_version: RESULT_SCHEMA_VERSION,
    result_id: resultId,
    work_item_id: workItem.work_item_id,
    work_item_identity: workItemIdentity,
    role,
    role_instance_id: roleInstanceId,
    worker_run_id: Number(workerRunId),
    run_attempt: Number(runAttempt),
    input_identity: workItem.input_identity,
    upstream_result_ids: upstreamResultIds,
    writer_identity: writerIdentity,
    created_at: createdAt,
    terminal_state: 'terminal',
    substance,
    telemetry: telemetry || {},
  };
}

function trustedActionsIdentity(value) {
  return isPlainObject(value) && value.id === TRUSTED_RESULT_WRITER.id && value.login === TRUSTED_RESULT_WRITER.login && value.type === TRUSTED_RESULT_WRITER.type;
}

function validateTerminalResult(result, { workItem, expectedRole, expectedRoleInstanceId, expectedWorkerRunId, expectedRunAttempt = 1, expectedUpstreamResultIds = [], commentAuthor, now = Date.now(), maxAgeMs = 60 * 60 * 1000 }) {
  const required = ['schema_version','result_id','work_item_id','work_item_identity','role','role_instance_id','worker_run_id','run_attempt','input_identity','upstream_result_ids','writer_identity','created_at','terminal_state','substance','telemetry'];
  if (!exactKeys(result, required)) return fail('invalid_terminal_result_shape');
  if (result.schema_version !== RESULT_SCHEMA_VERSION) return fail('unsupported_result_schema');
  if (result.work_item_id !== workItem.work_item_id) return fail('wrong_work_item');
  const workItemIdentity = computeWorkItemIdentity(workItem);
  if (result.work_item_identity !== workItemIdentity) return fail('wrong_work_item_identity');
  if (result.role !== expectedRole || workItem.role !== expectedRole) return fail('wrong_worker_role');
  if (result.role_instance_id !== expectedRoleInstanceId) return fail('wrong_role_instance');
  if (result.worker_run_id !== Number(expectedWorkerRunId)) return fail('wrong_worker_run');
  if (result.run_attempt !== Number(expectedRunAttempt) || result.run_attempt !== 1) return fail('replayed_run');
  if (canonicalJson(result.input_identity) !== canonicalJson(workItem.input_identity)) return fail('wrong_input_identity');
  if (canonicalJson(result.upstream_result_ids) !== canonicalJson(expectedUpstreamResultIds)) return fail('wrong_upstream_result');
  if (!trustedActionsIdentity(result.writer_identity)) return fail('untrusted_writer_claim');
  if (commentAuthor && !trustedActionsIdentity(commentAuthor)) return fail('untrusted_comment_author');
  if (result.terminal_state !== 'terminal') return fail('wrong_terminal_state');
  const created = Date.parse(result.created_at); if (!Number.isFinite(created) || created > now + 60_000 || now - created > maxAgeMs) return fail('stale_or_invalid_result_time');
  const expectedId = computeResultId({ workItemId: result.work_item_id, workItemIdentity, role: result.role, roleInstanceId: result.role_instance_id, workerRunId: result.worker_run_id, runAttempt: result.run_attempt, inputIdentity: result.input_identity, upstreamResultIds: result.upstream_result_ids });
  if (result.result_id !== expectedId) return fail('wrong_result_id');
  const substanceCheck = validateSubstance(result.substance, expectedRole); if (!substanceCheck.ok) return substanceCheck;
  if (!isPlainObject(result.telemetry)) return fail('invalid_telemetry');
  return pass();
}

function parseResultComment(comment) {
  const parsed = parseMarkedJson(comment?.body, RESULT_MARKER); if (!parsed.ok) return parsed;
  return pass({ result: parsed.value, author: comment.user, comment });
}
function parseDispatchClaimComment(comment) {
  const parsed = parseMarkedJson(comment?.body, DISPATCH_MARKER); if (!parsed.ok) return parsed;
  return pass({ claim: parsed.value, author: comment.user, comment });
}
function parseWorkItemIssue(issue) {
  const parsed = parseMarkedJson(issue?.body, WORK_ITEM_MARKER); if (!parsed.ok) return parsed;
  const validated = validateWorkItem(parsed.value); if (!validated.ok) return validated;
  return pass({ workItem: parsed.value });
}

function buildDispatchClaim({ workItem, role, roleInstanceId, upstreamResultIds = [], createdAt }) {
  return {
    schema_version: CLAIM_SCHEMA_VERSION,
    dispatch_identity: computeDispatchIdentity({ workItem, role, roleInstanceId, upstreamResultIds }),
    work_item_id: workItem.work_item_id,
    work_item_identity: computeWorkItemIdentity(workItem),
    role,
    role_instance_id: roleInstanceId,
    input_identity: workItem.input_identity,
    upstream_result_ids: upstreamResultIds,
    created_at: createdAt,
    claim_state: 'claimed',
  };
}
function validateDispatchClaim(claim, { workItem, role, roleInstanceId, upstreamResultIds = [], commentAuthor }) {
  const required = ['schema_version','dispatch_identity','work_item_id','work_item_identity','role','role_instance_id','input_identity','upstream_result_ids','created_at','claim_state'];
  if (!exactKeys(claim, required)) return fail('invalid_dispatch_claim_shape');
  if (claim.schema_version !== CLAIM_SCHEMA_VERSION) return fail('unsupported_dispatch_claim_schema');
  if (claim.work_item_id !== workItem.work_item_id || claim.role !== role || claim.role_instance_id !== roleInstanceId) return fail('wrong_dispatch_target');
  if (claim.work_item_identity !== computeWorkItemIdentity(workItem)) return fail('wrong_dispatch_work_item_identity');
  if (canonicalJson(claim.input_identity) !== canonicalJson(workItem.input_identity) || canonicalJson(claim.upstream_result_ids) !== canonicalJson(upstreamResultIds)) return fail('wrong_dispatch_identity_material');
  if (claim.dispatch_identity !== computeDispatchIdentity({ workItem, role, roleInstanceId, upstreamResultIds })) return fail('wrong_dispatch_identity');
  if (claim.claim_state !== 'claimed') return fail('wrong_dispatch_claim_state');
  if (commentAuthor && !trustedActionsIdentity(commentAuthor)) return fail('untrusted_dispatch_claim_author');
  return pass();
}

function authoritativeResultsFor({ comments, workItem, role, roleInstanceId, expectedWorkerRunId, expectedRunAttempt = 1, expectedUpstreamResultIds = [], now = Date.now() }) {
  const candidates = [];
  const malformedFamily = [];
  for (const comment of comments || []) {
    if (typeof comment?.body !== 'string' || !comment.body.startsWith(`${RESULT_MARKER}\n`)) continue;
    const parsed = parseResultComment(comment);
    if (!parsed.ok) { malformedFamily.push(parsed.reason); continue; }
    const result = parsed.result;
    if (result.work_item_id !== workItem.work_item_id || result.role !== role || result.role_instance_id !== roleInstanceId) continue;
    const validated = validateTerminalResult(result, { workItem, expectedRole: role, expectedRoleInstanceId: roleInstanceId, expectedWorkerRunId, expectedRunAttempt, expectedUpstreamResultIds, commentAuthor: parsed.author, now });
    if (!validated.ok) malformedFamily.push(validated.reason); else candidates.push({ result, comment });
  }
  if (malformedFamily.length) return fail('malformed_authoritative_result_family', { findings: malformedFamily });
  if (candidates.length !== 1) return fail(candidates.length === 0 ? 'missing_terminal_result' : 'duplicate_terminal_result');
  return pass({ result: candidates[0].result, comment: candidates[0].comment });
}

function findRoleResults(comments, workItemId, role, roleInstanceId) {
  const results = [];
  let malformed = false;
  for (const comment of comments || []) {
    if (typeof comment?.body !== 'string' || !comment.body.startsWith(`${RESULT_MARKER}\n`)) continue;
    const parsed = parseResultComment(comment); if (!parsed.ok) { malformed = true; continue; }
    const r = parsed.result;
    if (r.work_item_id === workItemId && r.role === role && r.role_instance_id === roleInstanceId) results.push({ result: r, author: parsed.author, comment });
  }
  return { results, malformed };
}
function findRoleClaims(comments, workItemId, role, roleInstanceId) {
  const claims = [];
  let malformed = false;
  for (const comment of comments || []) {
    if (typeof comment?.body !== 'string' || !comment.body.startsWith(`${DISPATCH_MARKER}\n`)) continue;
    const parsed = parseDispatchClaimComment(comment); if (!parsed.ok) { malformed = true; continue; }
    const c = parsed.claim;
    if (c.work_item_id === workItemId && c.role === role && c.role_instance_id === roleInstanceId) claims.push({ claim: c, author: parsed.author, comment });
  }
  return { claims, malformed };
}

function assessControllerState({ researchWorkItem, qaWorkItem, comments }) {
  const rCheck = validateWorkItem(researchWorkItem); if (!rCheck.ok) return fail(`research_work_item:${rCheck.reason}`);
  const qCheck = validateWorkItem(qaWorkItem); if (!qCheck.ok) return fail(`qa_work_item:${qCheck.reason}`);
  if (researchWorkItem.work_item_id !== qaWorkItem.work_item_id) return fail('work_item_pair_mismatch');
  if (canonicalJson(researchWorkItem.input_identity) !== canonicalJson(qaWorkItem.input_identity)) return fail('paired_input_identity_mismatch');
  const rid = 'research-primary', qid = 'qa-primary';
  const researchResults = findRoleResults(comments, researchWorkItem.work_item_id, 'research', rid);
  const qaResults = findRoleResults(comments, qaWorkItem.work_item_id, 'qa', qid);
  const researchClaims = findRoleClaims(comments, researchWorkItem.work_item_id, 'research', rid);
  const qaClaims = findRoleClaims(comments, qaWorkItem.work_item_id, 'qa', qid);
  if (researchResults.malformed || qaResults.malformed || researchClaims.malformed || qaClaims.malformed) return fail('malformed_protocol_family');
  if (researchResults.results.length > 1 || qaResults.results.length > 1 || researchClaims.claims.length > 1 || qaClaims.claims.length > 1) return fail('duplicate_protocol_record');
  if (researchClaims.claims.length === 1) {
    const v = validateDispatchClaim(researchClaims.claims[0].claim, { workItem:researchWorkItem, role:'research', roleInstanceId:rid, upstreamResultIds:[], commentAuthor:researchClaims.claims[0].author });
    if (!v.ok) return fail(`invalid_research_dispatch_claim:${v.reason}`);
  }
  let validatedResearch = null;
  if (researchResults.results.length === 1) {
    const entry = researchResults.results[0];
    const v = validateTerminalResult(entry.result, { workItem: researchWorkItem, expectedRole:'research', expectedRoleInstanceId:rid, expectedWorkerRunId:entry.result.worker_run_id, expectedRunAttempt:1, expectedUpstreamResultIds:[], commentAuthor:entry.author });
    if (!v.ok) return fail(`invalid_research_result:${v.reason}`);
    validatedResearch = entry.result;
  }
  if (qaClaims.claims.length === 1) {
    if (!validatedResearch) return fail('qa_dispatch_without_research_result');
    const v = validateDispatchClaim(qaClaims.claims[0].claim, { workItem:qaWorkItem, role:'qa', roleInstanceId:qid, upstreamResultIds:[validatedResearch.result_id], commentAuthor:qaClaims.claims[0].author });
    if (!v.ok) return fail(`invalid_qa_dispatch_claim:${v.reason}`);
  }
  if (qaResults.results.length === 1) {
    if (!validatedResearch) return fail('qa_result_without_research_result');
    const entry = qaResults.results[0];
    const v = validateTerminalResult(entry.result, { workItem: qaWorkItem, expectedRole:'qa', expectedRoleInstanceId:qid, expectedWorkerRunId:entry.result.worker_run_id, expectedRunAttempt:1, expectedUpstreamResultIds:[validatedResearch.result_id], commentAuthor:entry.author });
    if (!v.ok) return fail(`invalid_qa_result:${v.reason}`);
    return pass({ state: 'FOUNDER_STOP', terminalDisposition: entry.result.substance.status, qaResult: entry.result, researchResult: validatedResearch });
  }
  if (validatedResearch) {
    if (validatedResearch.substance.status !== 'COMPLETE') return pass({ state: 'FOUNDER_STOP', terminalDisposition: validatedResearch.substance.status, researchResult: validatedResearch });
    if (qaClaims.claims.length === 1) return pass({ state: 'QA_DISPATCHED', researchResult: validatedResearch, dispatchClaim: qaClaims.claims[0].claim });
    return pass({ state: 'QA_ELIGIBLE', researchResult: validatedResearch });
  }
  if (researchClaims.claims.length === 1) return pass({ state: 'RESEARCH_DISPATCHED', dispatchClaim: researchClaims.claims[0].claim });
  return pass({ state: 'RESEARCH_ELIGIBLE' });
}

function enforceRunBudget({ workItem, comments, roleInstanceId }) {
  const claims = findRoleClaims(comments, workItem.work_item_id, workItem.role, roleInstanceId);
  if (claims.malformed) return fail('malformed_dispatch_claim_family');
  if (claims.claims.length >= workItem.budget.max_worker_runs) return fail('run_limit_exhausted');
  return pass({ used: claims.claims.length, remaining: workItem.budget.max_worker_runs - claims.claims.length });
}

function validateWorkerRunMetadata(run, { role, expectedRunId, expectedInputSha }) {
  const expectedPath = role === 'research' ? '.github/workflows/development-research-worker-v01.yml' : '.github/workflows/development-qa-worker-v01.yml';
  if (!run || Number(run.id) !== Number(expectedRunId)) return fail('wrong_workflow_run_id');
  if (run.event !== 'workflow_dispatch') return fail('wrong_workflow_event');
  if (run.path !== expectedPath) return fail('wrong_workflow_path');
  if (Number(run.run_attempt) !== 1) return fail('replayed_workflow_run');
  if (run.status !== 'completed' || run.conclusion !== 'success') return fail('worker_run_not_successful');
  if (expectedInputSha && run.head_sha !== expectedInputSha && run.head_sha !== undefined) return fail('workflow_head_mismatch');
  return pass();
}

function makeTelemetry({ workflowCreatedAt, runStartedAt, terminalAt, founderInterventions = 0, manualPromptTransfers = 0, qaCycles = 0, reworkCount = 0, deterministicDefectsCaught = 0, qaDefectsCaught = 0 }) {
  const start = Date.parse(runStartedAt || workflowCreatedAt);
  const created = Date.parse(workflowCreatedAt);
  const end = Date.parse(terminalAt);
  return {
    workflow_created_at: workflowCreatedAt,
    role_started_at: runStartedAt || workflowCreatedAt,
    role_terminal_at: terminalAt,
    queue_wait_ms: Number.isFinite(start) && Number.isFinite(created) ? Math.max(0, start - created) : null,
    wall_time_ms: Number.isFinite(end) && Number.isFinite(start) ? Math.max(0, end - start) : null,
    founder_interventions: founderInterventions,
    manual_prompt_transfers: manualPromptTransfers,
    worker_executions: 1,
    qa_cycles: qaCycles,
    rework_count: reworkCount,
    deterministic_defects_caught: deterministicDefectsCaught,
    qa_defects_caught: qaDefectsCaught,
    ai_cost_or_credits: null,
    actions_runtime_ms: Number.isFinite(end) && Number.isFinite(start) ? Math.max(0, end - start) : null,
  };
}

module.exports = {
  WORK_ITEM_MARKER, RESULT_MARKER, DISPATCH_MARKER, SCHEMA_VERSION, RESULT_SCHEMA_VERSION,
  canonicalJson, sha256, serializeMarkedJson, parseMarkedJson, validateWorkItem, validateInputIdentity,
  validateTrustedIssuer, deriveQaWorkItem, validateSubstance, buildTerminalResult, validateTerminalResult,
  parseResultComment, parseDispatchClaimComment, parseWorkItemIssue,
  buildDispatchClaim, validateDispatchClaim, computeDispatchIdentity, computeResultId, computeWorkItemIdentity,
  authoritativeResultsFor, assessControllerState, enforceRunBudget, validateWorkerRunMetadata, makeTelemetry,
};
