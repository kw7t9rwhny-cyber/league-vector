"use strict";
const c=require("./research-qa-contract-v01.js"),r=require("./research-qa-result-v01.js");
const {canonical,fail,objectExactKeys,validateWorkItem,ROLES,nonempty,validateInputIdentity,stringArray,deriveDispatchIdentity}=c,{validateTerminalResult}=r;
function reconcileWrite({before, attempted, after}) {
  const a=canonical(attempted), b=(before||[]).map(canonical), cc=(after||[]).map(canonical);
  const beforeCount=b.filter(x=>x===a).length, afterCount=cc.filter(x=>x===a).length;
  if (beforeCount>1 || afterCount>1) return {ok:false,reason:"duplicate_authoritative_write"};
  if (afterCount===1) return {ok:true,state:beforeCount===1?"already_present":"committed"};
  if (afterCount===0) return {ok:false,reason:"write_not_established"};
  return {ok:false,reason:"ambiguous_write"};
}
const MARKERS=Object.freeze({workItem:"LV_RQA_WORK_ITEM_V1",result:"LV_RQA_TERMINAL_RESULT_V1",dispatch:"LV_RQA_DISPATCH_V1"});
function taggedRecord(marker,obj){ return `${marker}\n${canonical(obj)}`; }
function parseTaggedRecord(text,marker){
  if(typeof text!=="string"||text.includes("\r")) return null; const lines=text.split("\n");
  if(lines[0]!==marker||lines.length!==2) return null; try { return JSON.parse(lines[1]); } catch { return null; }
}
function parseWorkItemIssue(issue){
  if(!issue||!Number.isInteger(issue.number)||!issue.user) fail("invalid_issue");
  const w=parseTaggedRecord(issue.body,MARKERS.workItem); if(!w) fail("missing_or_malformed_work_item"); validateWorkItem(w); return w;
}
function trustedDurableWriter(comment){ return comment?.user?.login==="github-actions[bot]" && comment?.user?.type==="Bot"; }
function parseAuthoritativeResults(comments){
  const out=[]; for(const x of comments||[]){ const parsed=parseTaggedRecord(x.body,MARKERS.result); if(!parsed) continue; if(!trustedDurableWriter(x)) fail("untrusted_writer"); validateTerminalResult(parsed); out.push(parsed); } return out;
}
function validateDispatchRecord(d){
  objectExactKeys(d,["schema_version","dispatch_identity","work_item_id","role","role_instance_id","input_identity","upstream_result_ids","created_at","state"]);
  if(d.schema_version!=="lv-rqa-dispatch/v1") fail("unsupported_schema","dispatch"); if(!/^[a-f0-9]{64}$/.test(d.dispatch_identity)) fail("invalid_dispatch_identity");
  if(!ROLES.has(d.role)) fail("invalid_role",d.role); nonempty(d.work_item_id,"work_item_id",128); nonempty(d.role_instance_id,"role_instance_id",128);
  validateInputIdentity(d.input_identity); stringArray(d.upstream_result_ids,"upstream_result_ids",16,64);
  if(!Number.isFinite(Date.parse(d.created_at))) fail("invalid_created_at"); if(d.state!=="claimed") fail("invalid_dispatch_state");
  if(deriveDispatchIdentity(d)!==d.dispatch_identity) fail("dispatch_identity_mismatch"); return true;
}
function parseDispatches(comments){
  const out=[]; for(const x of comments||[]){ const parsed=parseTaggedRecord(x.body,MARKERS.dispatch); if(!parsed) continue; if(!trustedDurableWriter(x)) fail("untrusted_writer"); validateDispatchRecord(parsed); out.push(parsed); } return out;
}
function buildDispatchRecord({work_item,role,role_instance_id,upstream_result_ids=[],created_at}){
  validateWorkItem(work_item); if(!ROLES.has(role)) fail("invalid_role"); nonempty(role_instance_id,"role_instance_id",128); stringArray(upstream_result_ids,"upstream_result_ids",16,64);
  const core={schema_version:"lv-rqa-dispatch/v1",dispatch_identity:"",work_item_id:work_item.work_item_id,role,role_instance_id,input_identity:work_item.input_identity,upstream_result_ids:[...upstream_result_ids],created_at,state:"claimed"};
  core.dispatch_identity=deriveDispatchIdentity(core); return core;
}
function validateWorkItemCreatorAuthority(issue,permission){
  if(!issue?.user||typeof issue.user.login!=="string"||!Number.isInteger(issue.user.id)) fail("invalid_issue_creator"); const allowed=new Set(["admin","maintain","write"]);
  if(!permission||permission.login!==issue.user.login||permission.id!==issue.user.id||!allowed.has(permission.permission)) fail("untrusted_work_item_creator"); return true;
}
function telemetryRecord({work_item_id,role,role_instance_id,started_at,ended_at,queued_at,worker_executions=1,founder_interventions=0,manual_prompt_transfers=0,qa_cycles=0,rework_count=0,ai_credits=null,actions_runtime_minutes=null,deterministic_defects_caught=0,qa_defects_caught=0,terminal_disposition}) {
  for (const t of [started_at,ended_at]) if (!Number.isFinite(Date.parse(t))) fail("invalid_telemetry_time");
  const out={schema_version:"lv-rqa-telemetry/v1",work_item_id,role,role_instance_id,queued_at:queued_at||null,started_at,ended_at,wall_time_ms:Date.parse(ended_at)-Date.parse(started_at),worker_executions,founder_interventions,manual_prompt_transfers,qa_cycles,rework_count,ai_credits,actions_runtime_minutes,deterministic_defects_caught,qa_defects_caught,terminal_disposition};
  if (out.wall_time_ms<0) fail("invalid_telemetry_time"); return out;
}
module.exports={MARKERS,reconcileWrite,telemetryRecord,taggedRecord,parseTaggedRecord,parseWorkItemIssue,parseAuthoritativeResults,validateDispatchRecord,parseDispatches,buildDispatchRecord,validateWorkItemCreatorAuthority};
