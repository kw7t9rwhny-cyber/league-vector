"use strict";
const c=require("./research-qa-contract-v01.js");
const {validateWorkItem,nonempty,stringArray,TRUSTED_WRITERS,validateSubstance,deriveResultId,objectExactKeys,RESULT_SCHEMA_VERSION,ROLES,TERMINAL_STATES,validateInputIdentity,canonical,fail}=c;
function buildAuthoritativeResult({work_item, role_instance_id, worker_run_id, run_attempt, upstream_result_ids=[], writer_identity, created_at, substance}) {
  validateWorkItem(work_item); nonempty(role_instance_id,"role_instance_id",128);
  if (!/^[1-9][0-9]*$/.test(String(worker_run_id))) fail("invalid_worker_run");
  if (!Number.isInteger(run_attempt)||run_attempt<1) fail("invalid_run_attempt");
  stringArray(upstream_result_ids,"upstream_result_ids",16,64);
  if (!TRUSTED_WRITERS.has(writer_identity)) fail("untrusted_writer",writer_identity);
  if (!Number.isFinite(Date.parse(created_at))) fail("invalid_created_at");
  validateSubstance(work_item.role,substance);
  const provenance={schema_version:RESULT_SCHEMA_VERSION,result_id:"",work_item_id:work_item.work_item_id,role:work_item.role,role_instance_id,worker_run_id:String(worker_run_id),run_attempt,input_identity:work_item.input_identity,upstream_result_ids:[...upstream_result_ids],writer_identity,created_at,terminal_state:"terminal"};
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
function proveExactlyOneTerminal(results, expectation) {
  if (!Array.isArray(results)) fail("invalid_results"); const candidates=[];
  for (const r of results) { try { validateTerminalResult(r,expectation); candidates.push(r); } catch (e) { if (["wrong_work_item","wrong_role","wrong_role_instance","wrong_worker"].includes(e.code)) continue; throw e; } }
  if (candidates.length===0) fail("missing_terminal_result"); if (candidates.length>1) fail("duplicate_terminal_result"); return candidates[0];
}
module.exports={buildAuthoritativeResult,validateTerminalResult,proveExactlyOneTerminal};
