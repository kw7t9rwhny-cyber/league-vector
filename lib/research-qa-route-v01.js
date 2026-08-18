"use strict";
const c=require("./research-qa-contract-v01.js"),r=require("./research-qa-result-v01.js");
const {validateBudget,validateWorkItem,deriveDispatchIdentity}=c,{proveExactlyOneTerminal}=r;
function checkBudget({budget, worker_runs_used}) {
  validateBudget(budget);
  if (!Number.isInteger(worker_runs_used)||worker_runs_used<0) return {ok:false,reason:"invalid_worker_run_usage"};
  if (worker_runs_used>=budget.max_worker_runs) return {ok:false,reason:"run_limit_exhausted"};
  return {ok:true};
}
function route({work_item,research_results=[],qa_results=[],dispatches=[],usage}) {
  validateWorkItem(work_item);
  const budget=checkBudget({budget:work_item.budget,...usage});
  if (!budget.ok) return {action:"STOP",disposition:"BLOCKED",reason:budget.reason,founder_gate:true};
  const researchExpectation={work_item_id:work_item.work_item_id,role:"research",role_instance_id:"research-1",input_identity:work_item.input_identity,upstream_result_ids:[]};
  let rr=null;
  try { rr=proveExactlyOneTerminal(research_results,researchExpectation); } catch(e) {
    if (e.code==="missing_terminal_result") {
      const id=deriveDispatchIdentity({work_item_id:work_item.work_item_id,role_instance_id:"research-1",input_identity:work_item.input_identity});
      if (dispatches.includes(id)) return {action:"STOP",disposition:"BLOCKED",reason:"replayed_dispatch",founder_gate:true};
      return {action:"DISPATCH_RESEARCH",dispatch_identity:id,role_instance_id:"research-1"};
    }
    return {action:"STOP",disposition:"BLOCKED",reason:e.code,founder_gate:true};
  }
  if (rr.substance.status==="BLOCKED") return {action:"STOP",disposition:"BLOCKED",reason:"research_blocked",founder_gate:true,research_result_id:rr.result_id};
  const qaExpectation={work_item_id:work_item.work_item_id,role:"qa",role_instance_id:"qa-1",input_identity:work_item.input_identity,upstream_result_ids:[rr.result_id]};
  let qr=null;
  try { qr=proveExactlyOneTerminal(qa_results,qaExpectation); } catch(e) {
    if (e.code==="missing_terminal_result") {
      const id=deriveDispatchIdentity({work_item_id:work_item.work_item_id,role_instance_id:"qa-1",input_identity:work_item.input_identity,upstream_result_ids:[rr.result_id]});
      if (dispatches.includes(id)) return {action:"STOP",disposition:"BLOCKED",reason:"replayed_dispatch",founder_gate:true};
      return {action:"DISPATCH_QA",dispatch_identity:id,role_instance_id:"qa-1",upstream_result_id:rr.result_id};
    }
    return {action:"STOP",disposition:"BLOCKED",reason:e.code,founder_gate:true};
  }
  return {action:"STOP",disposition:qr.substance.status,reason:"founder_lead_terminal_gate",founder_gate:true,research_result_id:rr.result_id,qa_result_id:qr.result_id};
}
module.exports={checkBudget,route};
