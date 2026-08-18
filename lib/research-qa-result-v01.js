"use strict";
const c=require("./research-qa-contract-v01.js");
const {validateWorkItem,nonempty,stringArray,TRUSTED_WRITERS,validateSubstance,deriveResultId,objectExactKeys,RESULT_SCHEMA_VERSION,ROLES,TERMINAL_STATES,validateInputIdentity,canonical,sha256,fail}=c;
const WORKFLOW_PATHS=Object.freeze({research:".github/workflows/research-qa-research-v01.yml",qa:".github/workflows/research-qa-qa-v01.yml"});
function buildAuthoritativeResult({work_item, role=work_item?.role, role_instance_id, worker_run_id, run_attempt, upstream_result_ids=[], writer_identity, created_at, substance}) {
  validateWorkItem(work_item); if(!ROLES.has(role)) fail("invalid_role",role); nonempty(role_instance_id,"role_instance_id",128);
  if (!/^[1-9][0-9]*$/.test(String(worker_run_id))) fail("invalid_worker_run");
  if (!Number.isInteger(run_attempt)||run_attempt<1) fail("invalid_run_attempt");
  stringArray(upstream_result_ids,"upstream_result_ids",16,64);
  if (!TRUSTED_WRITERS.has(writer_identity)) fail("untrusted_writer",writer_identity);
  if (!Number.isFinite(Date.parse(created_at))) fail("invalid_created_at");
  validateSubstance(role,substance);
  const provenance={schema_version:RESULT_SCHEMA_VERSION,result_id:"",work_item_id:work_item.work_item_id,role,role_instance_id,worker_run_id:String(worker_run_id),run_attempt,input_identity:work_item.input_identity,upstream_result_ids:[...upstream_result_ids],writer_identity,created_at,terminal_state:"terminal"};
  provenance.result_id=deriveResultId(provenance); return {...provenance, substance:JSON.parse(JSON.stringify(substance))};
}
function validateTerminalResult(r, expectation) {
  objectExactKeys(r, ["schema_version","result_id","work_item_id","role","role_instance_id","worker_run_id","run_attempt","input_identity","upstream_result_ids","writer_identity","created_at","terminal_state","substance"]);
  if (r.schema_version!==RESULT_SCHEMA_VERSION) fail("unsupported_schema","result");
  if (!/^[a-f0-9]{64}$/.test(r.result_id)) fail("invalid_result_id"); if (!ROLES.has(r.role)) fail("invalid_role",r.role);
  nonempty(r.work_item_id,"work_item_id",128); nonempty(r.role_instance_id,"role_instance_id",128);
  if (!/^[1-9][0-9]*$/.test(String(r.worker_run_id))) fail("invalid_worker_run"); if (!Number.isInteger(r.run_attempt)||r.run_attempt<1) fail("invalid_run_attempt");
  validateInputIdentity(r.input_identity); stringArray(r.upstream_result_ids,"upstream_result_ids",16,64);
  if (!TRUSTED_WRITERS.has(r.writer_identity)) fail("untrusted_writer"); if (!Number.isFinite(Date.parse(r.created_at))) fail("invalid_created_at");
  if (!TERMINAL_STATES.has(r.terminal_state)) fail("invalid_terminal_state"); validateSubstance(r.role,r.substance);
  if (r.result_id!==deriveResultId(r)) fail("result_identity_mismatch");
  if (expectation) {
    if (r.work_item_id!==expectation.work_item_id) fail("wrong_work_item"); if (r.role!==expectation.role) fail("wrong_role"); if (r.role_instance_id!==expectation.role_instance_id) fail("wrong_role_instance");
    if (expectation.worker_run_id !== undefined && String(r.worker_run_id)!==String(expectation.worker_run_id)) fail("wrong_worker");
    if (expectation.run_attempt !== undefined && r.run_attempt!==expectation.run_attempt) fail("wrong_run_attempt");
    if (canonical(r.input_identity)!==canonical(expectation.input_identity)) fail("wrong_input_identity");
    if (canonical(r.upstream_result_ids)!==canonical(expectation.upstream_result_ids||[])) fail("wrong_upstream_result");
    if (expectation.not_before && Date.parse(r.created_at)<Date.parse(expectation.not_before)) fail("stale_result");
  }
  return true;
}
function proofArtifactName(result){validateTerminalResult(result);return `lv-rqa-proof-${sha256(canonical(result))}`;}
function validateRunProvenance(result, run, {repository, now=new Date().toISOString()}={}) {
  validateTerminalResult(result);
  if(!run||typeof run!=="object") fail("missing_worker_run_provenance");
  if(String(run.id)!==String(result.worker_run_id)) fail("wrong_worker_run_provenance");
  if(Number(run.run_attempt)!==result.run_attempt) fail("wrong_run_attempt_provenance");
  if(run.event!=="workflow_dispatch") fail("wrong_worker_event");
  if(run.path!==WORKFLOW_PATHS[result.role]) fail("wrong_worker_workflow");
  if(run.repository?.full_name!==repository||repository!==result.input_identity.repository) fail("wrong_worker_repository");
  if(run.head_branch!=="main") fail("wrong_worker_ref");
  const started=Date.parse(run.run_started_at||run.created_at), created=Date.parse(result.created_at), observed=Date.parse(now);
  if(!Number.isFinite(started)||started>created) fail("worker_result_chronology_mismatch");
  if(!Number.isFinite(observed)||created>observed+60000) fail("worker_result_future_time");
  if(run.status==="completed"&&run.conclusion!=="success") fail("worker_run_not_successful");
  if(!["in_progress","completed"].includes(run.status)) fail("invalid_worker_run_status");
  return true;
}
function validateRunProofArtifact(result, artifacts){
  validateTerminalResult(result); if(!Array.isArray(artifacts)) fail("invalid_worker_run_artifacts");
  const expected=proofArtifactName(result), matches=artifacts.filter(a=>a?.name===expected&&!a.expired);
  if(matches.length===0) fail("missing_worker_run_proof_artifact"); if(matches.length>1) fail("duplicate_worker_run_proof_artifact");
  if(String(matches[0].workflow_run?.id||result.worker_run_id)!==String(result.worker_run_id)) fail("wrong_worker_run_proof_artifact");
  return true;
}
function proveExactlyOneTerminal(results, expectation) {
  if (!Array.isArray(results)) fail("invalid_results"); const candidates=[];
  for (const r of results) { try { validateTerminalResult(r,expectation); candidates.push(r); } catch (e) { if (["wrong_work_item","wrong_role","wrong_role_instance","wrong_worker"].includes(e.code)) continue; throw e; } }
  if (candidates.length===0) fail("missing_terminal_result"); if (candidates.length>1) fail("duplicate_terminal_result"); return candidates[0];
}
module.exports={WORKFLOW_PATHS,buildAuthoritativeResult,validateTerminalResult,proofArtifactName,validateRunProvenance,validateRunProofArtifact,proveExactlyOneTerminal};
