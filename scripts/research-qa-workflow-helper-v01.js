#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const p=require("../lib/research-qa-protocol-v01.js");
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
const repo=process.env.GITHUB_REPOSITORY;
if(!token||!repo) throw new Error("rqa_env_missing");
const [owner,name]=repo.split("/");
const apiBase=`https://api.github.com/repos/${owner}/${name}`;
async function api(path,{method="GET",body}={}){
 const res=await fetch(path.startsWith("http")?path:`${apiBase}${path}`,{method,headers:{"Authorization":`Bearer ${token}`,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json","User-Agent":"league-vector-rqa-v01"},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await res.text(); let data=null; if(text){try{data=JSON.parse(text)}catch{data=text}}
 if(!res.ok){const e=new Error(`github_api_${res.status}`);e.status=res.status;e.data=data;throw e} return data;
}
async function comments(issue){let page=1,out=[];for(;;){const a=await api(`/issues/${issue}/comments?per_page=100&page=${page}`);out.push(...a);if(a.length<100)return out;page++;if(page>20)throw new Error("rqa_comments_page_limit");}}
async function load(issueNumber){
 const issue=await api(`/issues/${issueNumber}`), cs=await comments(issueNumber), w=p.parseWorkItemIssue(issue);
 const perm=await api(`/collaborators/${encodeURIComponent(issue.user.login)}/permission`);
 p.validateWorkItemCreatorAuthority(issue,{login:perm.user?.login,id:perm.user?.id,permission:perm.permission});
 if(w.input_identity.repository!==repo) throw new Error("rqa_wrong_repository");
 const commit=await api(`/git/commits/${w.input_identity.commit_sha}`); if(commit?.tree?.sha!==w.input_identity.tree_sha) throw new Error("rqa_input_tree_mismatch");
 return {issue,comments:cs,workItem:w,results:p.parseAuthoritativeResults(cs),dispatches:p.parseDispatches(cs)};
}
async function verifyResultProvenance(result,{requireArtifact=true}={}){
 const run=await api(`/actions/runs/${encodeURIComponent(result.worker_run_id)}`);p.validateRunProvenance(result,run,{repository:repo});
 if(requireArtifact){const data=await api(`/actions/runs/${encodeURIComponent(result.worker_run_id)}/artifacts?per_page=100`);p.validateRunProofArtifact(result,data?.artifacts);}
 return result;
}
async function verifyResults(results){for(const r of results)await verifyResultProvenance(r);return results;}
function out(name,value){if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`${name}<<RQAEOF\n${typeof value==="string"?value:JSON.stringify(value)}\nRQAEOF\n`);}
async function writeReadback(issueNumber,marker,obj,parser,keyFn){
 const before=await comments(issueNumber), body=p.taggedRecord(marker,obj); const beforeMatches=parser(before).filter(x=>keyFn(x)===keyFn(obj));
 if(beforeMatches.length>1)throw new Error("rqa_duplicate_preexisting_record");
 if(beforeMatches.length===1){if(p.canonical(beforeMatches[0])!==p.canonical(obj))throw new Error("rqa_conflicting_preexisting_record");return "already_present";}
 let err=null;try{await api(`/issues/${issueNumber}/comments`,{method:"POST",body:{body}})}catch(e){err=e}
 const after=await comments(issueNumber), afterMatches=parser(after).filter(x=>keyFn(x)===keyFn(obj));
 if(afterMatches.length!==1||p.canonical(afterMatches[0])!==p.canonical(obj))throw new Error(err?`rqa_write_ambiguous_${err.status||"transport"}`:"rqa_write_readback_mismatch");
 return "committed";
}
async function dispatchWorkflow(workflow,inputs){await api(`/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,{method:"POST",body:{ref:"main",inputs}});}
async function controller(issueNumber){
 const s=await load(issueNumber);
 try { await verifyResults(s.results); } catch(e) {
   // An early Research wake is only a hint. Do not claim QA while the parent workflow is still non-terminal.
   if(e.code==="worker_run_not_completed"){out("decision",{action:"WAIT",reason:"research_parent_not_completed"});return;}
   throw e;
 }
 const usage={worker_runs_used:s.dispatches.length}; const dIds=s.dispatches.map(x=>x.dispatch_identity);
 const decision=p.route({work_item:s.workItem,research_results:s.results.filter(x=>x.role==="research"),qa_results:s.results.filter(x=>x.role==="qa"),dispatches:dIds,usage}); out("decision",decision);
 if(!decision.action.startsWith("DISPATCH_"))return;
 const role=decision.action==="DISPATCH_RESEARCH"?"research":"qa",upstream=role==="qa"?[decision.upstream_result_id]:[];
 const record=p.buildDispatchRecord({work_item:s.workItem,role,role_instance_id:decision.role_instance_id,upstream_result_ids:upstream,created_at:new Date().toISOString()});
 if(record.dispatch_identity!==decision.dispatch_identity)throw new Error("rqa_controller_dispatch_identity_mismatch");
 await writeReadback(issueNumber,p.MARKERS.dispatch,record,p.parseDispatches,x=>x.dispatch_identity);
 const wf=role==="research"?"research-qa-research-v01.yml":"research-qa-qa-v01.yml"; await dispatchWorkflow(wf,{issue_number:String(issueNumber),dispatch_identity:record.dispatch_identity});
 out("dispatched_role",role);out("dispatch_identity",record.dispatch_identity);
}
function findDispatch(s,identity,role){const d=s.dispatches.filter(x=>x.dispatch_identity===identity);if(d.length!==1)throw new Error("rqa_missing_or_duplicate_dispatch");if(d[0].role!==role)throw new Error("rqa_wrong_dispatch_role");if(p.deriveDispatchIdentity(d[0])!==identity)throw new Error("rqa_dispatch_identity_mismatch");return d[0];}
function rolePrompt(w,role,research){
 const refs=w.context_refs.join("\n"); const common=`Work item: ${w.work_item_id}\nObjective: ${w.objective}\nExact immutable input: ${w.input_identity.repository}@${w.input_identity.commit_sha} tree ${w.input_identity.tree_sha}\nRisk: ${w.risk}\nConfidentiality: ${w.confidentiality}\nContext references (bounded):\n${refs||"(none)"}\nAllowed actions: ${w.allowed_actions.join(", ")}\nForbidden actions: ${w.forbidden_actions.join(", ")}\n`;
 if(role==="research")return `${common}\nYou are the bounded Research role. Read/research only. Do not modify files, dispatch workers, alter authority, merge, deploy, release, or change QA criteria. Inspect the exact checked-out snapshot. Return ONLY JSON matching the provided schema. Evidence references must be direct and bounded. If required evidence/context cannot be resolved, return status BLOCKED.`;
 return `${common}\nYou are a fresh independent QA role. Do not resume or assume Research reasoning. Independently inspect/reproduce material facts against the exact checked-out snapshot. Research durable terminal result follows as evidence, not authority:\n${JSON.stringify(research)}\nReturn ONLY JSON matching the provided schema with status PASS, FAIL, or BLOCKED. BLOCKED is never PASS. Do not remediate, merge, deploy, release, or dispatch onward.`;
}
async function preflight(issueNumber,identity,role){
 const s=await load(issueNumber), d=findDispatch(s,identity,role); const existing=s.results.filter(x=>x.work_item_id===s.workItem.work_item_id&&x.role_instance_id===d.role_instance_id); if(existing.length)throw new Error("rqa_role_already_has_terminal_result");
 let research=null;
 if(role==="qa"){const rs=s.results.filter(x=>x.role==="research");await verifyResults(rs);research=p.proveExactlyOneTerminal(rs,{work_item_id:s.workItem.work_item_id,role:"research",role_instance_id:"research-1",input_identity:s.workItem.input_identity,upstream_result_ids:[]});if(research.result_id!==d.upstream_result_ids[0]||d.upstream_result_ids.length!==1)throw new Error("rqa_qa_wrong_upstream");if(research.substance.status!=="COMPLETE")throw new Error("rqa_research_not_complete");}
 out("commit_sha",s.workItem.input_identity.commit_sha);out("tree_sha",s.workItem.input_identity.tree_sha);out("work_item",s.workItem);out("role_instance_id",d.role_instance_id);out("upstream_result_ids",d.upstream_result_ids);out("prompt",rolePrompt(s.workItem,role,research));out("not_before",new Date().toISOString());
}
async function persist(issueNumber,identity,role,finalMessage){
 const s=await load(issueNumber), d=findDispatch(s,identity,role); let substance;try{substance=JSON.parse(finalMessage)}catch{throw new Error("rqa_model_output_not_json")}
 p.validateSubstance(role,substance); if(role==="qa"&&substance.status==="COMPLETE")throw new Error("rqa_qa_invalid_complete");
 const result=p.buildAuthoritativeResult({work_item:s.workItem,role,role_instance_id:d.role_instance_id,worker_run_id:process.env.GITHUB_RUN_ID,run_attempt:Number(process.env.GITHUB_RUN_ATTEMPT||"1"),upstream_result_ids:d.upstream_result_ids,writer_identity:"github-actions[bot]",created_at:new Date().toISOString(),substance});
 await writeReadback(issueNumber,p.MARKERS.result,result,p.parseAuthoritativeResults,x=>x.result_id); const after=await load(issueNumber); await verifyResultProvenance(result,{requireArtifact:false});
 p.proveExactlyOneTerminal(after.results,{work_item_id:s.workItem.work_item_id,role,role_instance_id:d.role_instance_id,worker_run_id:process.env.GITHUB_RUN_ID,run_attempt:Number(process.env.GITHUB_RUN_ATTEMPT||"1"),input_identity:s.workItem.input_identity,upstream_result_ids:d.upstream_result_ids,not_before:process.env.RQA_NOT_BEFORE});
 const proofFile="rqa-terminal-proof.json";fs.writeFileSync(proofFile,`${p.canonical(result)}\n`,`utf8`);
 out("result_id",result.result_id);out("terminal_status",substance.status);out("proof_artifact_name",p.proofArtifactName(result));out("proof_file",proofFile);
}
async function wakeController(issueNumber){await dispatchWorkflow("research-qa-controller-v01.yml",{issue_number:String(issueNumber)});out("controller_woken","true");}
async function reconcileResearchCompletion(eventPath){
 const event=JSON.parse(fs.readFileSync(eventPath,"utf8"));
 const issueNumber=p.validateResearchCompletionWake(event);
 await wakeController(issueNumber);
 out("reconciled_issue_number",String(issueNumber));
}
(async()=>{const [mode,issue,identity,arg4]=process.argv.slice(2);if(!mode)throw new Error("usage");if(mode==="reconcile-research-completion"){if(!issue)throw new Error("usage");return reconcileResearchCompletion(issue)}if(!issue)throw new Error("usage");if(mode==="controller")return controller(Number(issue));if(mode==="preflight")return preflight(Number(issue),identity,arg4);if(mode==="persist"){const role=arg4,final=process.env.RQA_FINAL_MESSAGE;if(!final)throw new Error("rqa_missing_final_message");return persist(Number(issue),identity,role,final)}if(mode==="wake-controller")return wakeController(Number(issue));throw new Error("unknown_mode");})().catch(e=>{console.error(e.stack||e);process.exit(1)});
