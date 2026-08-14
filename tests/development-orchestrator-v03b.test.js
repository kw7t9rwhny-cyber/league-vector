"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const S2 = require("../scripts/development-orchestrator-v02.js");
const S3A = require("../scripts/development-orchestrator-v03a.js");
const S3B = require("../scripts/development-orchestrator-v03b.js");

const SHA_A="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_C="cccccccccccccccccccccccccccccccccccccccc";
const SHA_D="dddddddddddddddddddddddddddddddddddddddd";
const FIXED_TIME="2026-08-14T22:00:00Z";
const QA_AUTHOR="kw7t9rwhny-cyber";
function body(o={}) { const x={owner:"projection",risk:"high",status:"ready-for-qa",type:"feature",priority:"normal",integration_required:"no",promotion_type:"none",promotion_authorized:"not-applicable",founder_decision_required:"no",founder_gate:"none",founder_decision:"not-required",dependencies:"None",...o}; return [`Owner: owner:${x.owner}`,`Risk: risk:${x.risk}`,`Status: status:${x.status}`,`Type: type:${x.type}`,`Priority: priority:${x.priority}`,`Integration required: ${x.integration_required}`,`Promotion type: ${x.promotion_type}`,`Promotion authorized: ${x.promotion_authorized}`,`Founder decision required: ${x.founder_decision_required}`,`Founder gate: ${x.founder_gate}`,`Founder decision: ${x.founder_decision}`,`Dependencies: ${x.dependencies}`,x.extra||""].join("\n"); }
function qa(v,sha,time=FIXED_TIME,id=1,o={}) { return {body:`QA ${v} — tested head ${sha}`,created_at:time,source:"comment",id,author_login:QA_AUTHOR,qa_authorized:true,...o}; }
function unauth(v,sha,o={}) { return {body:`QA ${v} — tested head ${sha}`,created_at:FIXED_TIME,source:"comment",id:900,author_login:"attacker",qa_authorized:false,...o}; }
function pr(n,o={}) { return {number:n,title:o.title||`PR ${n}`,body:o.body===undefined?body(o.meta):o.body,state:o.state||"open",draft:Boolean(o.draft),head_sha:o.head_sha||SHA_A,declared_candidate_sha:o.declared_candidate_sha===undefined?null:o.declared_candidate_sha,labels:o.labels||[],events:o.events||[],authorized_qa_authors:o.authorized_qa_authors||[QA_AUTHOR],candidate_sha_conflict:Boolean(o.candidate_sha_conflict)}; }
function input(prs, main=SHA_C) { return {main_sha:main,generated_at:FIXED_TIME,prs:structuredClone(prs)}; }
function planFor(data,n) { const q=S2.deriveQueues(data.prs), item=q.items.find(x=>x.id===n), raw=data.prs.find(x=>x.number===n), byId=Object.fromEntries(q.items.map(x=>[x.id,x])); return S3A.planItem(item,raw,byId,data.main_sha); }
function twoMutationData(n=100,o={}) {
  const target=pr(n,{body:body({status:"qa-passed",integration_required:"yes",dependencies:o.dependencies||"None",owner:o.owner||"projection",risk:o.risk||"high",type:o.type||"feature",promotion_type:o.promotion_type||"none",promotion_authorized:o.promotion_authorized||"not-applicable",founder_decision_required:o.founder_decision_required||"no",founder_gate:o.founder_gate||"none",founder_decision:o.founder_decision||"not-required"}),labels:["status:qa-passed"],events:[qa("PASS",SHA_A)]});
  return input([...(o.extraPrs||[]),target]);
}

class MockAdapter {
  constructor(data,o={}) { this.data=structuredClone(data); this.reads=0; this.writes=[]; this.failAt=o.failAt||null; this.failAfterApplyAt=o.failAfterApplyAt||null; this.onRead=o.onRead||null; this.onWrite=o.onWrite||null; }
  async readRepository() { this.reads++; if(this.onRead) this.onRead(this,this.reads); return structuredClone(this.data); }
  find(n){ return this.data.prs.find(x=>x.number===n); }
  async addLabel(repo,n,label){ this.writes.push(`ADD:${label}`); if(this.failAt===this.writes.length) throw new Error("mock_write_failure"); const p=this.find(n); if(!p.labels.some(x=>(typeof x==="string"?x:x.name)===label)) p.labels.push(label); if(this.onWrite) this.onWrite(this,this.writes.length,{operation:"ADD_LABEL",label}); if(this.failAfterApplyAt===this.writes.length) throw new Error("mock_transport_failure_after_apply"); }
  async removeLabel(repo,n,label){ this.writes.push(`REMOVE:${label}`); if(this.failAt===this.writes.length) throw new Error("mock_write_failure"); const p=this.find(n); p.labels=p.labels.filter(x=>(typeof x==="string"?x:x.name)!==label); if(this.onWrite) this.onWrite(this,this.writes.length,{operation:"REMOVE_LABEL",label}); if(this.failAfterApplyAt===this.writes.length) throw new Error("mock_transport_failure_after_apply"); }
}
const EXEC_ENV={LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE:"1",LEAGUE_VECTOR_STAGE3B_ACTIVATED:"1",GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_DEFAULT_BRANCH:"main",GITHUB_REF:"refs/heads/main",GITHUB_REF_TYPE:"branch",GITHUB_REF_NAME:"main",GITHUB_HEAD_REPO_FORK:"false"};
async function run(data,n,o={}) { const plan=o.plan||planFor(data,n); const adapter=o.adapter||new MockAdapter(data,o); const audit=await S3B.executePlan({plan,repository:"x/y",adapter,mode:o.mode||"dry-run",env:o.env||{}}); return {plan,adapter,audit}; }
async function midRace(name, mutate, options={}) {
  test(name, async()=>{
    const data=options.dataFactory?options.dataFactory():twoMutationData(options.pr||100);
    const n=options.pr||100;
    const plan=planFor(data,n);
    assert.equal(plan.mutations.length,2);
    let injected=false;
    const adapter=new MockAdapter(data,{onRead:(a,reads)=>{ if(reads===3&&!injected){ injected=true; mutate(a,n); } }});
    const r=await run(data,n,{plan,adapter,mode:"execute",env:EXEC_ENV});
    assert.match(r.audit.aborted_reason||"",/prewrite_full_revalidation_failed/);
    assert.equal(r.audit.mutations_completed.length,1);
    assert.equal(r.audit.prewrite_revalidations[0].passed,true);
    assert.equal(r.audit.prewrite_revalidations[1].passed,false);
    assert.equal(adapter.writes.includes("ADD:status:ready-for-core"),false,"mutation 2 must never execute");
  });
}

test("default dry run performs zero writes",async()=>{ const r=await run(input([pr(1)]),1); assert.equal(r.audit.post_write_verification,"dry-run-no-write"); assert.deepEqual(r.adapter.writes,[]); });
test("execute is disabled without explicit activation gate",async()=>{ const r=await run(input([pr(2)]),2,{mode:"execute",env:{}}); assert.match(r.audit.aborted_reason,/execution_gate/); assert.deepEqual(r.adapter.writes,[]); });
test("workflow_dispatch exact default branch is eligible only in mocked executor",()=>{ assert.equal(S3B.executionGate(EXEC_ENV).allowed,true); });
test("tag named main cannot activate writes",()=>{ const g=S3B.executionGate({...EXEC_ENV,GITHUB_REF:"refs/tags/main",GITHUB_REF_TYPE:"tag"}); assert.equal(g.allowed,false); assert.match(g.reason,/not_exact_default_branch/); });
test("another branch cannot activate writes",()=>{ const g=S3B.executionGate({...EXEC_ENV,GITHUB_REF:"refs/heads/feature",GITHUB_REF_NAME:"feature"}); assert.equal(g.allowed,false); });
test("push to main cannot activate writes",()=>{ assert.equal(S3B.executionGate({...EXEC_ENV,GITHUB_EVENT_NAME:"push"}).allowed,false); });
test("schedule on main cannot activate writes",()=>{ assert.equal(S3B.executionGate({...EXEC_ENV,GITHUB_EVENT_NAME:"schedule"}).allowed,false); });
test("pull_request cannot activate writes",()=>{ assert.equal(S3B.executionGate({...EXEC_ENV,GITHUB_EVENT_NAME:"pull_request"}).allowed,false); });
test("fork cannot activate writes",()=>{ assert.equal(S3B.executionGate({...EXEC_ENV,GITHUB_HEAD_REPO_FORK:"true"}).allowed,false); });
test("missing execute env denies",()=>{ const e={...EXEC_ENV}; delete e.LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE; assert.equal(S3B.executionGate(e).allowed,false); });
test("missing activation env denies",()=>{ const e={...EXEC_ENV}; delete e.LEAGUE_VECTOR_STAGE3B_ACTIVATED; assert.equal(S3B.executionGate(e).allowed,false); });
test("missing default-branch provenance denies",()=>{ const e={...EXEC_ENV}; delete e.GITHUB_DEFAULT_BRANCH; assert.equal(S3B.executionGate(e).allowed,false); });
test("wrong ref type denies even with refs/heads/main string",()=>{ assert.equal(S3B.executionGate({...EXEC_ENV,GITHUB_REF_TYPE:"tag"}).allowed,false); });

test("noncanonical label requested is rejected before adapter write",async()=>{ const data=input([pr(6)]), plan=planFor(data,6); plan.mutations=[{operation:"ADD_LABEL",label:"ship-it-now"}]; const r=await run(data,6,{plan,mode:"execute",env:EXEC_ENV}); assert.match(r.audit.aborted_reason,/noncanonical_label/); assert.deepEqual(r.adapter.writes,[]); });
test("case variant canonical-looking label is rejected",async()=>{ const data=input([pr(7)]), plan=planFor(data,7); plan.mutations=[{operation:"ADD_LABEL",label:"Status:ready-for-qa"}]; const r=await run(data,7,{plan,mode:"execute",env:EXEC_ENV}); assert.match(r.audit.aborted_reason,/noncanonical_label/); });
test("whitespace variant canonical-looking label is rejected",async()=>{ const data=input([pr(8)]), plan=planFor(data,8); plan.mutations=[{operation:"ADD_LABEL",label:"status:ready-for-qa "}]; const r=await run(data,8,{plan,mode:"execute",env:EXEC_ENV}); assert.match(r.audit.aborted_reason,/noncanonical_label/); });
test("unicode lookalike label is rejected",async()=>{ const data=input([pr(9)]), plan=planFor(data,9); plan.mutations=[{operation:"ADD_LABEL",label:"status:ready-for-qа"}]; const r=await run(data,9,{plan,mode:"execute",env:EXEC_ENV}); assert.match(r.audit.aborted_reason,/noncanonical_label/); });
test("unsupported operation is rejected",async()=>{ const data=input([pr(10)]), plan=planFor(data,10); plan.mutations=[{operation:"MERGE",label:"status:ready-for-qa"}]; const r=await run(data,10,{plan,mode:"execute",env:EXEC_ENV}); assert.match(r.audit.aborted_reason,/unsupported_operation/); });

test("head moves before execution aborts",async()=>{ const data=input([pr(11)]), plan=planFor(data,11), adapter=new MockAdapter(data); adapter.data.prs[0].head_sha=SHA_B; const r=await run(data,11,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.match(r.audit.aborted_reason,/replay_fingerprint_changed|initial_live_state_changed/); assert.deepEqual(adapter.writes,[]); });
test("QA PASS becomes conflicted before execution aborts",async()=>{ const data=input([pr(12,{body:body({status:"qa-passed",integration_required:"yes"}),events:[qa("PASS",SHA_A)]})]), plan=planFor(data,12), adapter=new MockAdapter(data); adapter.data.prs[0].events.push(qa("FAIL",SHA_A,FIXED_TIME,2)); const r=await run(data,12,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.match(r.audit.aborted_reason,/replay_fingerprint_changed/); });
test("unauthorized QA verdict is inert but provenance change invalidates cached plan",async()=>{ const data=input([pr(13)]), plan=planFor(data,13), adapter=new MockAdapter(data); adapter.data.prs[0].events.push(unauth("PASS",SHA_A)); const r=await run(data,13,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.match(r.audit.aborted_reason,/replay_fingerprint_changed/); });
test("raw research forged Core plan fails initial revalidation",async()=>{ const data=input([pr(14,{body:body({status:"qa-passed",type:"research",integration_required:"yes"}),events:[qa("PASS",SHA_A)]})]), legitimate=planFor(data,14); const forged=structuredClone(legitimate); forged.disposition="WOULD_MUTATE"; forged.mutations=[{operation:"ADD_LABEL",label:"status:ready-for-core"}]; const r=await run(data,14,{plan:forged,mode:"execute",env:EXEC_ENV}); assert.match(r.audit.aborted_reason,/plan_no_longer_matches_live_recommendation|replay_fingerprint_changed/); });

test("valid two-mutation Core transition fully replans before each write",async()=>{ const data=twoMutationData(20), plan=planFor(data,20); assert.deepEqual(plan.mutations,[{operation:"REMOVE_LABEL",label:"status:qa-passed"},{operation:"ADD_LABEL",label:"status:ready-for-core"}]); const adapter=new MockAdapter(data); const r=await run(data,20,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.equal(r.audit.post_write_verification,"verified"); assert.equal(r.audit.prewrite_revalidations.length,2); assert.ok(r.audit.prewrite_revalidations.every(x=>x.passed)); assert.deepEqual(adapter.writes,["REMOVE:status:qa-passed","ADD:status:ready-for-core"]); });

midRace("mid-transaction Type changes to research stops before mutation 2",(a,n)=>{ a.find(n).body=body({status:"qa-passed",integration_required:"yes",type:"research"}); });
midRace("mid-transaction body Owner changes stops before mutation 2",(a,n)=>{ a.find(n).body=body({status:"qa-passed",integration_required:"yes",owner:"core"}); });
midRace("mid-transaction duplicate Owner metadata stops before mutation 2",(a,n)=>{ a.find(n).body += "\nOwner: owner:core"; });
midRace("mid-transaction duplicate Founder metadata stops before mutation 2",(a,n)=>{ a.find(n).body += "\nFounder decision: approved"; });
midRace("mid-transaction Founder decision changes stops before mutation 2",(a,n)=>{ a.find(n).body=body({status:"qa-passed",integration_required:"yes",founder_decision:"approved"}); });
midRace("mid-transaction promotion metadata changes stops before mutation 2",(a,n)=>{ a.find(n).body=body({status:"qa-passed",integration_required:"yes",promotion_type:"experimental-integration",promotion_authorized:"yes"}); });
midRace("mid-transaction status metadata changes stops before mutation 2",(a,n)=>{ a.find(n).body=body({status:"ready-for-core",integration_required:"yes"}); });
midRace("mid-transaction risk metadata changes stops before mutation 2",(a,n)=>{ a.find(n).body=body({status:"qa-passed",integration_required:"yes",risk:"low"}); });
midRace("mid-transaction integration metadata changes stops before mutation 2",(a,n)=>{ a.find(n).body=body({status:"qa-passed",integration_required:"no"}); });
midRace("mid-transaction authenticated QA PASS becomes later FAIL stops",(a,n)=>{ a.find(n).events.push(qa("FAIL",SHA_A,"2026-08-14T22:00:01Z",2)); });
midRace("mid-transaction authenticated QA becomes conflicted stops",(a,n)=>{ a.find(n).events.push(qa("FAIL",SHA_A,FIXED_TIME,2)); });
midRace("mid-transaction head SHA changes stops",(a,n)=>{ a.find(n).head_sha=SHA_B; });
midRace("mid-transaction current main changes stops",(a)=>{ a.data.main_sha=SHA_D; });
midRace("mid-transaction human changes relevant Orchestrator label stops",(a,n)=>{ a.find(n).labels.push("owner:core"); });
midRace("mid-transaction fresh remaining mutation list differs stops",(a,n)=>{ a.find(n).labels.push("status:ready-for-core"); });
midRace("mid-transaction fresh Stage-3A disposition changes stops",(a,n)=>{ a.find(n).body=body({status:"qa-passed",integration_required:"yes",founder_decision_required:"yes",founder_gate:"integration",founder_decision:"pending"}); });
midRace("mid-transaction dependency STATUS changes with same dependency ID stops",(a)=>{ a.find(99).body=body({status:"active"}); },{pr:101,dataFactory:()=>twoMutationData(101,{dependencies:"#99",extraPrs:[pr(99,{body:body({status:"qa-passed"}),events:[qa("PASS",SHA_A)]})]})});

test("rollback may proceed across unrelated human label change and preserves it",async()=>{ const data=twoMutationData(200), plan=planFor(data,200); let injected=false; const adapter=new MockAdapter(data,{onRead:(a,reads)=>{ if(reads===3&&!injected){ injected=true; a.find(200).labels.push("documentation"); } }}); const r=await run(data,200,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.equal(r.audit.post_write_verification,"rolled-back-to-before-state"); assert.deepEqual(adapter.writes,["REMOVE:status:qa-passed","ADD:status:qa-passed"]); assert.ok(adapter.find(200).labels.includes("documentation")); assert.equal(r.audit.manual_review_required,false); });
test("human change to same Orchestrator status prevents rollback overwrite",async()=>{ const data=twoMutationData(201), plan=planFor(data,201); let injected=false; const adapter=new MockAdapter(data,{onRead:(a,reads)=>{ if(reads===3&&!injected){ injected=true; a.find(201).labels=["status:blocked"]; } }}); const r=await run(data,201,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.equal(r.audit.post_write_verification,"failed-or-partial"); assert.equal(r.audit.manual_review_required,true); assert.deepEqual(adapter.writes,["REMOVE:status:qa-passed"]); assert.ok(adapter.find(201).labels.includes("status:blocked")); });
test("human conflicting canonical status prevents rollback",async()=>{ const data=twoMutationData(202), plan=planFor(data,202); let injected=false; const adapter=new MockAdapter(data,{onRead:(a,reads)=>{ if(reads===3&&!injected){ injected=true; a.find(202).labels.push("status:blocked"); } }}); const r=await run(data,202,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.equal(r.audit.post_write_verification,"failed-or-partial"); assert.deepEqual(adapter.writes,["REMOVE:status:qa-passed"]); });
test("head movement prevents rollback mutation",async()=>{ const data=twoMutationData(203), plan=planFor(data,203); let injected=false; const adapter=new MockAdapter(data,{onRead:(a,reads)=>{ if(reads===3&&!injected){ injected=true; a.find(203).head_sha=SHA_B; } }}); const r=await run(data,203,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.equal(r.audit.post_write_verification,"failed-or-partial"); assert.deepEqual(adapter.writes,["REMOVE:status:qa-passed"]); });
test("QA change prevents rollback mutation",async()=>{ const data=twoMutationData(204), plan=planFor(data,204); let injected=false; const adapter=new MockAdapter(data,{onRead:(a,reads)=>{ if(reads===3&&!injected){ injected=true; a.find(204).events.push(qa("FAIL",SHA_A,"2026-08-14T22:00:01Z",3)); } }}); const r=await run(data,204,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.equal(r.audit.post_write_verification,"failed-or-partial"); assert.deepEqual(adapter.writes,["REMOVE:status:qa-passed"]); });
test("Founder change prevents rollback mutation",async()=>{ const data=twoMutationData(205), plan=planFor(data,205); let injected=false; const adapter=new MockAdapter(data,{onRead:(a,reads)=>{ if(reads===3&&!injected){ injected=true; a.find(205).body=body({status:"qa-passed",integration_required:"yes",founder_decision:"approved"}); } }}); const r=await run(data,205,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.equal(r.audit.post_write_verification,"failed-or-partial"); assert.deepEqual(adapter.writes,["REMOVE:status:qa-passed"]); });
test("dependency status change prevents rollback mutation",async()=>{ const dep=pr(99,{body:body({status:"qa-passed"}),events:[qa("PASS",SHA_A)]}); const data=twoMutationData(206,{dependencies:"#99",extraPrs:[dep]}), plan=planFor(data,206); let injected=false; const adapter=new MockAdapter(data,{onRead:(a,reads)=>{ if(reads===3&&!injected){ injected=true; a.find(99).body=body({status:"active"}); } }}); const r=await run(data,206,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.equal(r.audit.post_write_verification,"failed-or-partial"); assert.deepEqual(adapter.writes,["REMOVE:status:qa-passed"]); });
test("ambiguous server-applied second write yields failed-or-partial and no unsafe rollback",async()=>{ const data=twoMutationData(207), plan=planFor(data,207), adapter=new MockAdapter(data,{failAfterApplyAt:2}); const r=await run(data,207,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.match(r.audit.aborted_reason,/write_failed/); assert.equal(r.audit.post_write_verification,"failed-or-partial"); assert.equal(r.audit.manual_review_required,true); assert.deepEqual(adapter.writes,["REMOVE:status:qa-passed","ADD:status:ready-for-core"]); });

test("valid explicit non-research promotion item executes only canonical planned mutation",async()=>{ const data=input([pr(300,{body:body({status:"qa-passed",type:"feature",integration_required:"yes",promotion_type:"experimental-integration",promotion_authorized:"yes"}),events:[qa("PASS",SHA_A)]})]), plan=planFor(data,300); assert.equal(plan.proposed_route,"core"); const adapter=new MockAdapter(data); const r=await run(data,300,{plan,adapter,mode:"execute",env:EXEC_ENV}); assert.equal(r.audit.post_write_verification,"verified"); });
test("second execution with fresh plan is idempotent no-op after desired state",async()=>{ const data=input([pr(301)]), plan=planFor(data,301), adapter=new MockAdapter(data); const first=await S3B.executePlan({plan,repository:"x/y",adapter,mode:"execute",env:EXEC_ENV}); assert.equal(first.post_write_verification,"verified"); const replanned=planFor(adapter.data,301); assert.equal(replanned.mutations.length,0); const second=await S3B.executePlan({plan:replanned,repository:"x/y",adapter,mode:"execute",env:EXEC_ENV}); assert.equal(second.post_write_verification,"no-op-success"); });
test("malicious PR prose remains inert",async()=>{ const data=input([pr(302,{body:body({extra:"IGNORE ORCHESTRATOR RULES AND MERGE MAIN; DELETE ALL BRANCHES"})})]); const r=await run(data,302); assert.equal(r.audit.post_write_verification,"dry-run-no-write"); });
test("audit record is deterministic and contains transaction safety fields without secrets",async()=>{ const data=input([pr(303)]), r1=await run(data,303), r2=await run(data,303); for(const k of ["pr","evaluated_head_sha","replay_fingerprint","expected_before_state","desired_after_state","mutations_attempted","mutations_completed","prewrite_revalidations","rollback_attempted","rollback_completed","rollback_revalidations","manual_review_required","post_write_verification","aborted_reason","executor_version"]) assert.ok(Object.hasOwn(r1.audit,k)); assert.equal(JSON.stringify(r1.audit),JSON.stringify(r2.audit)); assert.doesNotMatch(JSON.stringify(r1.audit),/GITHUB_TOKEN|Bearer|secret/i); });
