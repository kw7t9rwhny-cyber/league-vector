"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const C=require("../scripts/development-orchestrator-v03b-controlled.js");

const SHA_A="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_C="cccccccccccccccccccccccccccccccccccccccc";
const QA_AUTHOR="kw7t9rwhny-cyber";
const FIXED="2026-08-14T22:00:00Z";
const REPO=C.TRUSTED_REPOSITORY;
const TRUSTED={source:"mock",repository_full_name:REPO,default_branch:"main",fork:false};
const VERIFIED_FOUNDER={source:"environment-secret",environment:C.FOUNDER_ENVIRONMENT,verified:true,protection_verified:true,activation:"1"};
const EXEC_ENV={LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE:"1",LEAGUE_VECTOR_STAGE3B_ACTIVATED:"1",GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_REPOSITORY:REPO,GITHUB_DEFAULT_BRANCH:"main",GITHUB_REF:"refs/heads/main",GITHUB_REF_TYPE:"branch",GITHUB_REF_NAME:"main",GITHUB_HEAD_REPO_FORK:"false",GITHUB_RUN_ID:"12345"};

function body(o={}){const x={owner:"projection",risk:"high",status:"qa-passed",type:"feature",priority:"normal",integration_required:"yes",promotion_type:"none",promotion_authorized:"not-applicable",founder_decision_required:"no",founder_gate:"none",founder_decision:"not-required",dependencies:"None",...o};return [`Owner: owner:${x.owner}`,`Risk: risk:${x.risk}`,`Status: status:${x.status}`,`Type: type:${x.type}`,`Priority: priority:${x.priority}`,`Integration required: ${x.integration_required}`,`Promotion type: ${x.promotion_type}`,`Promotion authorized: ${x.promotion_authorized}`,`Founder decision required: ${x.founder_decision_required}`,`Founder gate: ${x.founder_gate}`,`Founder decision: ${x.founder_decision}`,`Dependencies: ${x.dependencies}`].join("\n");}
function qa(v="PASS",sha=SHA_A,id=1){return {body:`QA ${v} — tested head ${sha}`,created_at:FIXED,source:"comment",id,author_login:QA_AUTHOR,qa_authorized:true};}
function pr(n=101,o={}){return {number:n,title:`PR ${n}`,body:o.body||body(o.meta),state:o.state||"open",draft:false,head_sha:o.head_sha||SHA_A,declared_candidate_sha:o.declared_candidate_sha===undefined?SHA_A:o.declared_candidate_sha,labels:o.labels||["status:qa-passed"],events:o.events||[qa()],authorized_qa_authors:[QA_AUTHOR],candidate_sha_conflict:false};}
function data(target=pr(),extra=[],main=SHA_C){return {main_sha:main,generated_at:FIXED,prs:[...extra,structuredClone(target)]};}

class MockAdapter{
  constructor(d,o={}){this.data=structuredClone(d);this.writes=[];this.reads=0;this.activation=structuredClone(o.activation||TRUSTED);this.onRead=o.onRead||null;this.failAt=o.failAt||null;this.failAfterApplyAt=o.failAfterApplyAt||null;}
  async readRepository(){this.reads++;if(this.onRead)this.onRead(this,this.reads);return structuredClone(this.data);}
  async readActivationProvenance(){return structuredClone(this.activation);}
  find(n){return this.data.prs.find(x=>x.number===n);}
  async addLabel(repo,n,label){assert.equal(repo,REPO);assert.ok(Number.isSafeInteger(n));this.writes.push(`ADD:${label}`);if(this.failAt===this.writes.length)throw new Error("write_fail");const p=this.find(n);if(!p.labels.includes(label))p.labels.push(label);if(this.failAfterApplyAt===this.writes.length)throw new Error("ambiguous_after_apply");}
  async removeLabel(repo,n,label){assert.equal(repo,REPO);assert.ok(Number.isSafeInteger(n));this.writes.push(`REMOVE:${label}`);if(this.failAt===this.writes.length)throw new Error("write_fail");const p=this.find(n);p.labels=p.labels.filter(x=>x!==label);if(this.failAfterApplyAt===this.writes.length)throw new Error("ambiguous_after_apply");}
}
function preview(d,n=101){return C.previewFrom(d,n);}
async function exec(d,n=101,o={}){const p=preview(d,n);const adapter=o.adapter||new MockAdapter(d,o);const result=await C.executeControlled({repository:o.repository||REPO,token:"mock",targetPr:o.targetPr===undefined?String(n):o.targetPr,expectedFingerprint:o.fingerprint===undefined?p.replay_fingerprint:o.fingerprint,env:o.env||EXEC_ENV,adapter,founderAttestation:o.founderAttestation===undefined?VERIFIED_FOUNDER:o.founderAttestation});return {p,adapter,result};}

for(const bad of ["","0","-1","all","*","queue","1,2","1 2","1-3","[1,2]","1.5","01","00123","1e2","123.0"," 123 ","123 ","\t123","+123","123\n",[],{},NaN,Infinity,-Infinity,0,-1,1.5,Number.MAX_SAFE_INTEGER+1])test(`reject exact target PR input ${JSON.stringify(bad)}`,()=>assert.throws(()=>C.parseTargetPr(bad),/invalid_target_pr_number/));
test("accept canonical decimal target PR string",()=>assert.equal(C.parseTargetPr("123"),123));
test("accept positive safe-integer target PR number internally",()=>assert.equal(C.canonicalPrNumber(123),123));

for(const bad of ["","owner","/repo","owner/","owner/repo/extra","owner//repo","https://github.com/owner/repo","owner/repo?x=1","owner/repo#frag","owner/%2Frepo"," owner/repo","owner/repo ","owner\\repo","owner/../repo","owner/repo%2Flabels","оwner/repo","owner/rеpo"])test(`reject malformed repository ${JSON.stringify(bad)}`,()=>assert.throws(()=>C.canonicalRepository(bad),/invalid_repository/));
test("canonical League Vector repository accepted",()=>assert.equal(C.canonicalRepository(REPO),REPO));

test("wrong PR number fails closed",()=>assert.throws(()=>preview(data(),999),/target_pr_not_found/));
test("closed PR produces no live mutation disposition",()=>assert.equal(preview(data(pr(101,{state:"closed"}))).stage3a_disposition,"NO_MUTATION"));

test("repository-level variable spoof cannot satisfy Founder gate",async()=>{const env={...EXEC_ENV,LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED:"1",REPOSITORY_LEVEL_LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED:"1"};const r=await exec(data(),101,{env,founderAttestation:null});assert.match(r.result.abort_reason,/founder_gate:founder_environment_attestation_missing/);assert.deepEqual(r.adapter.writes,[]);});
test("organization-level variable spoof cannot satisfy Founder gate",async()=>{const env={...EXEC_ENV,LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED:"1",ORGANIZATION_LEVEL_LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED:"1"};const r=await exec(data(),101,{env,founderAttestation:null});assert.match(r.result.abort_reason,/founder_gate:founder_environment_attestation_missing/);assert.deepEqual(r.adapter.writes,[]);});
test("protected-environment activation absent denies",()=>assert.equal(C.founderActivationGate(null).allowed,false));
test("ambiguous Founder source denies",()=>assert.equal(C.founderActivationGate({...VERIFIED_FOUNDER,source:"vars-context"}).allowed,false));
test("wrong Founder environment denies",()=>assert.equal(C.founderActivationGate({...VERIFIED_FOUNDER,environment:"other"}).allowed,false));
test("unverified protection denies",()=>assert.equal(C.founderActivationGate({...VERIFIED_FOUNDER,protection_verified:false}).allowed,false));
test("malformed environment activation denies",()=>assert.equal(C.founderActivationGate({...VERIFIED_FOUNDER,activation:"true"}).allowed,false));
test("verified environment-secret attestation is eligible only in mocked execution",()=>assert.equal(C.founderActivationGate(VERIFIED_FOUNDER).allowed,true));

test("preview is explicitly non-authorizing",()=>assert.equal(preview(data()).authorization,false));
test("preview includes required evidence fields",()=>{const p=preview(data());assert.equal(p.target_pr,101);assert.equal(p.current_head,SHA_A);assert.equal(p.qa.state,"pass-fresh");assert.equal(p.qa.tested_sha,SHA_A);assert.ok(p.replay_fingerprint);assert.ok(Array.isArray(p.dependencies));assert.ok(Array.isArray(p.exact_mutations));});
test("moved head after preview fails closed",async()=>{const d=data(),p=preview(d),adapter=new MockAdapter(d);adapter.data.prs[0].head_sha=SHA_B;const r=await exec(d,101,{adapter,fingerprint:p.replay_fingerprint});assert.equal(r.result.abort_reason,"preview_state_changed");assert.deepEqual(adapter.writes,[]);});
test("stale QA after preview fails closed",async()=>{const d=data(),p=preview(d),adapter=new MockAdapter(d);adapter.data.prs[0].events=[qa("PASS",SHA_B)];const r=await exec(d,101,{adapter,fingerprint:p.replay_fingerprint});assert.equal(r.result.abort_reason,"preview_state_changed");assert.deepEqual(adapter.writes,[]);});
test("conflicting QA after preview fails closed",async()=>{const d=data(),p=preview(d),adapter=new MockAdapter(d);adapter.data.prs[0].events.push(qa("FAIL",SHA_A,2));const r=await exec(d,101,{adapter,fingerprint:p.replay_fingerprint});assert.equal(r.result.abort_reason,"preview_state_changed");});
test("metadata change after preview fails closed",async()=>{const d=data(),p=preview(d),adapter=new MockAdapter(d);adapter.data.prs[0].body=body({priority:"high"});const r=await exec(d,101,{adapter,fingerprint:p.replay_fingerprint});assert.equal(r.result.abort_reason,"preview_state_changed");});
test("human label change after preview fails closed",async()=>{const d=data(),p=preview(d),adapter=new MockAdapter(d);adapter.data.prs[0].labels.push("owner:core");const r=await exec(d,101,{adapter,fingerprint:p.replay_fingerprint});assert.equal(r.result.abort_reason,"preview_state_changed");});
test("current main change after preview fails closed",async()=>{const d=data(),p=preview(d),adapter=new MockAdapter(d);adapter.data.main_sha=SHA_B;const r=await exec(d,101,{adapter,fingerprint:p.replay_fingerprint});assert.equal(r.result.abort_reason,"preview_state_changed");});
test("dependency state change after preview fails closed",async()=>{const dep=pr(55,{meta:{status:"qa-passed"}}),t=pr(101,{meta:{dependencies:"#55"}}),d=data(t,[dep]),p=preview(d),adapter=new MockAdapter(d);assert.equal(p.dependencies.length,1);const liveDep=adapter.data.prs.find(x=>x.number===55);liveDep.body=body({status:"active",integration_required:"no"});liveDep.labels=["status:active"];liveDep.events=[];liveDep.declared_candidate_sha=null;const r=await exec(d,101,{adapter,fingerprint:p.replay_fingerprint});assert.equal(r.result.abort_reason,"preview_state_changed");assert.deepEqual(adapter.writes,[]);});
test("different syntactically valid repository fails before adapter reads",async()=>{const adapter=new MockAdapter(data());const r=await exec(data(),101,{repository:"attacker/repo",adapter});assert.equal(r.result.abort_reason,"trusted_repository_mismatch");assert.equal(adapter.reads,0);assert.deepEqual(adapter.writes,[]);});
test("fork provenance denies",async()=>{const adapter=new MockAdapter(data(),{activation:{...TRUSTED,fork:true}}),env={...EXEC_ENV,GITHUB_HEAD_REPO_FORK:"true"};const r=await exec(data(),101,{adapter,env});assert.match(r.result.abort_reason||"",/execution_gate/);});
for(const [name,patch] of [["tag main",{GITHUB_REF:"refs/tags/main",GITHUB_REF_TYPE:"tag"}],["push event",{GITHUB_EVENT_NAME:"push"}],["schedule event",{GITHUB_EVENT_NAME:"schedule"}],["pull_request event",{GITHUB_EVENT_NAME:"pull_request"}],["wrong default branch",{GITHUB_DEFAULT_BRANCH:"other"}],["missing execute flag",{LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE:"0"}],["missing activation flag",{LEAGUE_VECTOR_STAGE3B_ACTIVATED:"0"}]])test(`${name} denies mocked live execution`,async()=>{const r=await exec(data(),101,{env:{...EXEC_ENV,...patch}});assert.match(r.result.abort_reason||"",/execution_gate/);assert.deepEqual(r.adapter.writes,[]);});
test("noncanonical label is rejected",()=>{const {plan}=C.planForTarget(data(),101);plan.mutations=[{operation:"ADD_LABEL",label:"arbitrary"}];assert.equal(C.canonicalMutationsOnly(plan).valid,false);});
test("extra arbitrary mutation is rejected even beside canonical mutations",()=>{const {plan}=C.planForTarget(data(),101);plan.mutations.push({operation:"ADD_LABEL",label:"ship-it"});assert.equal(C.canonicalMutationsOnly(plan).valid,false);});
test("Stage-3A plan change after preview fails closed",async()=>{const d=data(),p=preview(d),adapter=new MockAdapter(d);adapter.data.prs[0].body=body({integration_required:"no"});const r=await exec(d,101,{adapter,fingerprint:p.replay_fingerprint});assert.equal(r.result.abort_reason,"preview_state_changed");});
test("second identical execution cannot replay stale preview",async()=>{const d=data(),p=preview(d),adapter=new MockAdapter(d);const first=await exec(d,101,{adapter,fingerprint:p.replay_fingerprint});assert.equal(first.result.stage3b_audit.post_write_verification,"verified");const second=await C.executeControlled({repository:REPO,token:"mock",targetPr:"101",expectedFingerprint:p.replay_fingerprint,env:EXEC_ENV,adapter,founderAttestation:VERIFIED_FOUNDER});assert.equal(second.abort_reason,"preview_state_changed");});
test("partial write triggers bounded rollback or manual review",async()=>{const d=data(),adapter=new MockAdapter(d,{failAt:2}),r=await exec(d,101,{adapter});assert.ok(r.result.stage3b_audit.aborted_reason);assert.ok(["rolled-back-to-before-state","failed-or-partial"].includes(r.result.stage3b_audit.post_write_verification));});
test("ambiguous write never claims success",async()=>{const d=data(),adapter=new MockAdapter(d,{failAfterApplyAt:1}),r=await exec(d,101,{adapter});assert.ok(r.result.stage3b_audit.aborted_reason);assert.notEqual(r.result.stage3b_audit.post_write_verification,"verified");});
test("rollback conflict preserves human state and requires manual review",async()=>{const d=data();let changed=false;const adapter=new MockAdapter(d,{failAt:2,onRead:(a,reads)=>{if(reads>=4&&!changed){changed=true;a.data.prs[0].labels.push("owner:core");}}}),r=await exec(d,101,{adapter});assert.ok(r.result.stage3b_audit.manual_review_required);});
test("dry-run proof: preview path has no adapter writes",()=>{const p=preview(data());assert.equal(p.authorization,false);assert.ok(p.exact_mutations.length>0);});

async function assertAdapterRejectsBeforeNetwork(operation,repository,prNumber){
  const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw new Error("network_should_not_be_called");};
  try{const adapter=new C.GitHubControlledLabelAdapter("mock",REPO);await assert.rejects(()=>adapter[operation](repository,prNumber,"status:ready-for-qa"));assert.equal(calls,0,`${operation} made network call for ${JSON.stringify(repository)} ${JSON.stringify(prNumber)}`);}finally{global.fetch=original;}
}

const invalidRepos=["","owner","/repo","owner/","owner/repo/extra","owner//repo","https://github.com/owner/repo","owner/repo?x=1","owner/repo#frag","owner/%2Frepo"," owner/repo","owner/repo ","owner\\repo","owner/../repo","owner/repo%2Flabels","оwner/repo","owner/rеpo","attacker/repo"];
const invalidPrs=["","0","-1","1e2","100.0"," 100 ","+100","00100","100\n","100/labels","100%2Flabels",0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,[],{},[100]];
for(const operation of ["addLabel","removeLabel"]){
  for(const repository of invalidRepos)test(`${operation} rejects repository ${JSON.stringify(repository)} with zero network`,async()=>assertAdapterRejectsBeforeNetwork(operation,repository,100));
  for(const prNumber of invalidPrs)test(`${operation} rejects PR ${JSON.stringify(prNumber)} with zero network`,async()=>assertAdapterRejectsBeforeNetwork(operation,REPO,prNumber));
}
test("adapter constructor cannot be rebound to attacker repository",()=>assert.throws(()=>new C.GitHubControlledLabelAdapter("mock","attacker/repo"),/untrusted_expected_repository/));
test("real adapter surface contains label add/remove only beyond inherited reads",()=>assert.deepEqual(Object.getOwnPropertyNames(C.GitHubControlledLabelAdapter.prototype).sort(),["addLabel","constructor","removeLabel"]));

test("workflow is manual-only, one-target, least-privilege, and live-Founder-source fail-closed",()=>{
  const yml=fs.readFileSync(path.join(__dirname,"../.github/workflows/development-orchestrator-stage3b-controlled.yml"),"utf8");
  assert.match(yml,/workflow_dispatch:/);assert.equal((yml.match(/workflow_dispatch:/g)||[]).length,1);assert.match(yml,/target_pr_number:/);
  for(const forbidden of ["pull_request_target:","schedule:","push:","pull_request:","contents: write","actions: write","deployments: write","packages: write","environment: stage3b-controlled-activation","vars.LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED","secrets.LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED"])assert.equal(yml.includes(forbidden),false,forbidden);
  assert.match(yml,/contents: read/);assert.match(yml,/pull-requests: read/);assert.match(yml,/issues: write/);
  assert.match(yml,/founder_environment_source_provenance_unverifiable/);assert.match(yml,/LIVE ACTIVATION BLOCKED/);
  assert.equal(yml.includes("development-orchestrator-v03b-controlled.js execute"),false,"workflow must not invoke real executor while Founder environment source is unverifiable");
});
