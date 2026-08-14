"use strict";

const fs = require("fs");
const crypto = require("crypto");
const Stage1 = require("./development-orchestrator-v01.js");
const Stage2 = require("./development-orchestrator-v02.js");

const CANONICAL_STATUS_LABELS = new Set(Stage1.CONFIG.states.map((state) => `status:${state}`));
const CANONICAL_OWNERS = new Set(Stage1.CONFIG.owners);
const CANONICAL_OWNER_LABELS = new Set(Stage1.CONFIG.owners.map((owner) => `owner:${owner}`));
const QA_LIKE = /^QA\s+(PASS|FAIL)\b/i;
const QA_CANONICAL = /^QA (PASS|FAIL) — tested head [0-9a-f]{40}$/;

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
  return value;
}
function stableJson(value) { return JSON.stringify(stableObject(value)); }
function sha256(value) { return crypto.createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex"); }
function labelNames(rawPr) { return (rawPr.labels || []).map((x) => typeof x === "string" ? x : x.name).filter(Boolean).sort(); }
function labelsWithPrefix(rawPr, prefix) { return labelNames(rawPr).filter((name) => name.startsWith(`${prefix}:`)); }

function qaEventProvenance(rawPr) {
  return (rawPr.events || []).map((event) => {
    const body = String(event.body || "").trim();
    const authorized = Stage2.qaEventAuthorized(event, rawPr.authorized_qa_authors || []);
    return {
      event_id: event.id === undefined || event.id === null ? null : String(event.id),
      source: event.source || "comment",
      author_login: event.author_login || null,
      author_association: event.author_association || null,
      created_at: event.submitted_at || event.created_at || "",
      authorized_qa_source: authorized,
      record_policy: authorized && QA_CANONICAL.test(body) ? "authorized-canonical-verdict-only" : authorized ? "authorized-noncanonical-inert" : "unauthorized-inert",
      body_sha256: sha256(body)
    };
  }).sort((a,b)=>stableJson(a).localeCompare(stableJson(b)));
}

function malformedAuthorizedQaEvidence(rawPr) {
  const malformed = [];
  for (const event of rawPr.events || []) {
    if (!Stage2.qaEventAuthorized(event, rawPr.authorized_qa_authors || [])) continue;
    const body = String(event.body || "").trim();
    if (QA_LIKE.test(body) && !QA_CANONICAL.test(body)) malformed.push({ source:event.source||"comment", author:event.author_login||null, event_id:event.id||null });
  }
  return malformed;
}

function qaState(item) {
  if (item.qa_conflicted_current) return "conflicted";
  if (item.qa_failed_current) return "fail";
  if (item.qa_fresh) return "pass-fresh";
  if (item.qa_stale) return "stale";
  return "none";
}
function dependencySnapshot(item, byId) {
  return (item.dependencies || []).map((id) => {
    const dep = byId[id];
    if (!dep) return { id, missing:true };
    return { id, status:dep.status||null, head_sha:dep.head_sha||null, qa_state:qaState(dep), qa_tested_sha:dep.qa_tested_sha||null, structured:Boolean(dep.structured) };
  });
}

function ownerAuthority(item, rawPr) {
  const ownerLabels = labelsWithPrefix(rawPr,"owner");
  if (!item.owner) return { valid:false, reason:"missing_owner" };
  if (!CANONICAL_OWNERS.has(item.owner)) return { valid:false, reason:"unsupported_owner", detail:item.owner };
  if ((item.metadata_conflicts || []).some((x)=>x.includes("owner"))) return { valid:false, reason:"owner_metadata_conflict", detail:item.metadata_conflicts.filter((x)=>x.includes("owner")) };
  if (ownerLabels.length > 1) return { valid:false, reason:"ambiguous_owner_labels", detail:ownerLabels };
  if (ownerLabels.some((label)=>!CANONICAL_OWNER_LABELS.has(label))) return { valid:false, reason:"unsupported_owner_label", detail:ownerLabels };
  if (ownerLabels.length === 1 && ownerLabels[0] !== `owner:${item.owner}`) return { valid:false, reason:"owner_label_body_conflict", detail:ownerLabels };
  return { valid:true, owner:item.owner };
}

function provenanceFor(item, rawPr, byId, mainSha) {
  const snapshot = {
    schema:"lv-stage3a-plan-provenance-v0.3", main_sha:mainSha||null, pr:item.id,
    head_sha:item.head_sha||null, declared_candidate_sha:item.declared_candidate_sha||null,
    labels:labelNames(rawPr), metadata:{ owner:item.owner||null, risk:item.risk||null, status:item.status||null, type:item.type||null, priority:item.priority||null, integration_required:item.integration_required, promotion_type:item.promotion_type||null, promotion_authorized:item.promotion_authorized, founder_decision_required:item.founder_decision_required, founder_gate:item.founder_gate||null, founder_decision:item.founder_decision||null, dependencies:item.dependencies||[], conflicts:item.metadata_conflicts||[], body_occurrences:item.metadata_body_occurrences||{} },
    qa:{ state:qaState(item), tested_sha:item.qa_tested_sha||null, current_event:item.current_qa_verdict||null, latest_event:item.latest_qa_verdict||null, event_provenance:qaEventProvenance(rawPr) },
    dependencies:dependencySnapshot(item,byId)
  };
  return { ...snapshot, fingerprint:sha256(snapshot) };
}

function statusMutations(rawPr,targetStatus) {
  const current=labelsWithPrefix(rawPr,"status"), target=`status:${targetStatus}`;
  if (!CANONICAL_STATUS_LABELS.has(target)) throw new Error(`unsupported_target_status:${targetStatus}`);
  const mutations=[];
  for (const label of current) if (label!==target) mutations.push({operation:"REMOVE_LABEL",label});
  if (!current.includes(target)) mutations.push({operation:"ADD_LABEL",label:target});
  return mutations;
}
function handoffPreview(item,route,reason,mutations) {
  return ["ORCHESTRATOR HANDOFF PREVIEW — NO GITHUB MUTATION",`PR: #${item.id}`,`Exact head: ${item.head_sha}`,`Current owner: ${item.owner||"unknown"}`,`Proposed route: ${route||"none"}`,`Reason: ${reason}`,`Risk: ${(item.risk||"unknown").toUpperCase()}`,`QA: ${qaState(item)}${item.qa_tested_sha?` (${item.qa_tested_sha})`:""}`,`Proposed label changes: ${mutations.length?mutations.map((m)=>`${m.operation} ${m.label}`).join("; "):"none"}`,"No GitHub mutation performed. This preview is not a QA verdict, Founder decision, merge, release, or model-promotion authorization."].join("\n");
}
function noOpPlan(item,rawPr,byId,mainSha,reason,detail=null) {
  return { pr:item.id,title:item.title,evaluated_head_sha:item.head_sha||null,qa_tested_sha:item.qa_tested_sha||null,qa_state:qaState(item),stage2_recommended_action:item.recommended_action||"NO_ACTION",disposition:"NO_MUTATION",reason,detail,proposed_route:null,mutations:[],handoff_preview:null,provenance:provenanceFor(item,rawPr,byId,mainSha) };
}

function planItem(item,rawPr,byId,mainSha) {
  if (!item||!rawPr) throw new Error("missing_plan_item");
  if (!item.open) return noOpPlan(item,rawPr,byId,mainSha,"closed_or_merged_pr");
  if (!item.structured) return noOpPlan(item,rawPr,byId,mainSha,"legacy_or_unstructured_metadata",{missing:item.missing_metadata||[],conflicts:item.metadata_conflicts||[]});
  const owner=ownerAuthority(item,rawPr);
  if (!owner.valid) return noOpPlan(item,rawPr,byId,mainSha,owner.reason,owner.detail||null);
  const statusLabels=labelsWithPrefix(rawPr,"status");
  if (statusLabels.length>1) return noOpPlan(item,rawPr,byId,mainSha,"ambiguous_status_labels",statusLabels);
  const malformed=malformedAuthorizedQaEvidence(rawPr);
  if (malformed.length) return noOpPlan(item,rawPr,byId,mainSha,"malformed_authorized_qa_record",malformed);
  if (item.declared_candidate_sha&&item.declared_candidate_sha!==item.head_sha) return noOpPlan(item,rawPr,byId,mainSha,"candidate_head_moved");
  if (item.qa_conflicted_current) return noOpPlan(item,rawPr,byId,mainSha,"qa_evidence_conflicted");
  if (item.qa_stale) return noOpPlan(item,rawPr,byId,mainSha,"qa_evidence_stale");
  if (!item.dependencies_satisfied) return noOpPlan(item,rawPr,byId,mainSha,"blocked_dependency",item.blocked_dependencies||[]);
  if (item.founder_decision==="rejected") return noOpPlan(item,rawPr,byId,mainSha,"founder_decision_rejected");

  let targetStatus=null, route=null, reason=item.recommended_action;
  switch(item.recommended_action) {
    case "SEND_TO_QA": targetStatus="ready-for-qa"; route="qa"; break;
    case "RETURN_TO_OWNER": targetStatus="qa-failed"; route=owner.owner; break;
    case "READY_FOR_CORE_REVIEW":
      if (item.type==="research") return noOpPlan(item,rawPr,byId,mainSha,"raw_research_firewall");
      if (!item.qa_fresh||item.qa_tested_sha!==item.head_sha) return noOpPlan(item,rawPr,byId,mainSha,"core_requires_fresh_exact_sha_qa");
      targetStatus="ready-for-core"; route="core"; break;
    case "WAITING_ON_FOUNDER":
      if (item.founder_decision==="approved") return noOpPlan(item,rawPr,byId,mainSha,"founder_already_approved_requires_fresh_stage2_re_evaluation");
      targetStatus="waiting-founder"; route="founder"; break;
    case "BLOCKED_DEPENDENCY": return noOpPlan(item,rawPr,byId,mainSha,"blocked_dependency",item.blocked_dependencies||[]);
    case "MORE_RESEARCH_REQUIRED": return noOpPlan(item,rawPr,byId,mainSha,item.type==="research"?"research_remains_with_canonical_owner":"non_research_more_research_signal",item.type==="research"?owner.owner:null);
    default: return noOpPlan(item,rawPr,byId,mainSha,"no_authorized_routine_handoff");
  }
  const mutations=statusMutations(rawPr,targetStatus);
  return { pr:item.id,title:item.title,evaluated_head_sha:item.head_sha,qa_tested_sha:item.qa_tested_sha||null,qa_state:qaState(item),stage2_recommended_action:item.recommended_action,disposition:mutations.length?"WOULD_MUTATE":"WOULD_ROUTE_ONLY",reason,detail:null,proposed_route:route,mutations,handoff_preview:handoffPreview(item,route,reason,mutations),provenance:provenanceFor(item,rawPr,byId,mainSha) };
}

function commandCenterPreview(data,queues,plans,generatedAt) {
  const compact=(item)=>({pr:item.id,title:item.title,owner:item.owner||null,risk:item.risk||null,status:item.status||null,head_sha:item.head_sha||null,qa_state:qaState(item),recommended_action:item.recommended_action});
  return { schema:"lv-command-center-stage3a-preview-v0.3",operational:false,mutation_mode:"dry-run-read-only",generated_at:generatedAt,provenance:{main_sha:data.main_sha||null,stage2_source:"merged-main-shared-authority-layer",plan_fingerprints:plans.map((p)=>({pr:p.pr,fingerprint:p.provenance.fingerprint}))},qa_queue:queues.qa.map(compact),core_queue:queues.core.map(compact),remediation_queue:queues.remediation.map(compact),founder_queue:queues.founder.map(compact),research_queue:queues.research.map(compact),blocked:queues.items.filter((x)=>x.open&&x.structured&&!x.dependencies_satisfied).map(compact),stale_qa:queues.items.filter((x)=>x.open&&x.qa_stale).map(compact),conflicted_qa:queues.items.filter((x)=>x.open&&x.qa_conflicted_current).map(compact),legacy_unstructured_count:queues.legacy.length };
}

function derivePlan(data) {
  const queues=Stage2.deriveQueues(data.prs||[]), byId=Object.fromEntries(queues.items.map((x)=>[x.id,x])), rawById=Object.fromEntries((data.prs||[]).map((x)=>[Number(x.number),x]));
  const keepReasons=new Set(["qa_evidence_stale","qa_evidence_conflicted","blocked_dependency","founder_decision_rejected","candidate_head_moved","missing_owner","unsupported_owner","owner_metadata_conflict","owner_label_body_conflict","ambiguous_owner_labels","unsupported_owner_label"]);
  const plans=queues.items.filter((x)=>x.open&&x.structured).map((x)=>planItem(x,rawById[x.id],byId,data.main_sha||null)).filter((p)=>p.disposition!=="NO_MUTATION"||keepReasons.has(p.reason));
  const generatedAt=data.generated_at||process.env.ORCHESTRATOR_GENERATED_AT||null;
  return { schema:"lv-development-orchestrator-stage3a-plan-v0.3",source:"stage2-live-github-plus-stage3a-read-only-planner",mutation_mode:"dry-run-read-only",main_sha:data.main_sha||null,generated_at:generatedAt,plans,command_center_preview:commandCenterPreview(data,queues,plans,generatedAt),counts:{would_mutate:plans.filter((p)=>p.disposition==="WOULD_MUTATE").length,would_route_only:plans.filter((p)=>p.disposition==="WOULD_ROUTE_ONLY").length,blocked_or_no_mutation:plans.filter((p)=>p.disposition==="NO_MUTATION").length,legacy_unstructured_suppressed:queues.legacy.length},queues };
}
function humanPlan(plan) {
  const lines=[`PR #${plan.pr} — ${plan.title}`,`Exact evaluated head: ${plan.evaluated_head_sha||"unknown"}`,`QA: ${plan.qa_state}${plan.qa_tested_sha?` (${plan.qa_tested_sha})`:""}`,`Stage-2 action: ${plan.stage2_recommended_action}`,`Disposition: ${plan.disposition}`,`Reason: ${plan.reason}`,`Route: ${plan.proposed_route||"none"}`,`Replay fingerprint: ${plan.provenance.fingerprint}`];
  lines.push(plan.mutations.length?"Proposed mutations:":"Proposed mutations: none");
  for (const m of plan.mutations) lines.push(`  WOULD ${m.operation.replace("_"," ")}: ${m.label}`);
  if (plan.handoff_preview) lines.push("",plan.handoff_preview);
  return lines.join("\n");
}
async function loadInput(args) {
  const fixtureIndex=args.indexOf("--fixture");
  if (fixtureIndex>=0) return JSON.parse(fs.readFileSync(args[fixtureIndex+1],"utf8"));
  const repository=process.env.GITHUB_REPOSITORY||process.env.LEAGUE_VECTOR_REPOSITORY, token=process.env.GITHUB_TOKEN;
  if (!repository||!token) throw new Error("live_mode_requires_GITHUB_REPOSITORY_and_GITHUB_TOKEN");
  return Stage2.loadLiveRepository(repository,token);
}

module.exports={ stableJson,sha256,qaEventProvenance,malformedAuthorizedQaEvidence,ownerAuthority,provenanceFor,planItem,derivePlan,commandCenterPreview,humanPlan };

if (require.main===module) {
  (async()=>{
    const args=process.argv.slice(2), json=args.includes("--json"), data=await loadInput(args), result=derivePlan(data);
    const positional=args.filter((arg,index)=>arg!=="--json"&&arg!=="--fixture"&&args[index-1]!=="--fixture"), command=positional[0]||"plan";
    if (command!=="plan") throw new Error(`unknown_command:${command}`);
    const requestedPr=positional[1]?Number(positional[1]):null;
    if (requestedPr) {
      const item=result.queues.items.find((x)=>x.id===requestedPr), rawPr=(data.prs||[]).find((x)=>Number(x.number)===requestedPr);
      if (!item||!rawPr) throw new Error("item_not_found");
      const byId=Object.fromEntries(result.queues.items.map((x)=>[x.id,x])), plan=planItem(item,rawPr,byId,data.main_sha||null);
      process.stdout.write(json?`${JSON.stringify(plan,null,2)}\n`:`${humanPlan(plan)}\n`); return;
    }
    if (json) { const output={...result}; delete output.queues; process.stdout.write(`${JSON.stringify(output,null,2)}\n`); }
    else process.stdout.write(`League Vector Orchestrator Stage 3A — DRY RUN ONLY\nmain ${result.main_sha||"unknown"}\nWould mutate ${result.counts.would_mutate} | Route only ${result.counts.would_route_only} | Blocked/no mutation ${result.counts.blocked_or_no_mutation} | Legacy suppressed ${result.counts.legacy_unstructured_suppressed}\n\n${result.plans.map(humanPlan).join("\n\n")}\n`);
  })().catch((error)=>{process.stderr.write(`${error.message}\n`);process.exit(2);});
}
