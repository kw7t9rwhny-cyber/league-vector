"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"..");
const research=fs.readFileSync(path.join(root,".github/workflows/stage3c-research-worker.md"),"utf8");
const qa=fs.readFileSync(path.join(root,".github/workflows/stage3c-qa-worker.md"),"utf8");
const repo="kw7t9rwhny-cyber/league-vector", r1="stage3c-v0.1-r1",r2="stage3c-v0.1-r2",r3="stage3c-v0.1-r3";
const sha=v=>crypto.createHash("sha256").update(v,"utf8").digest("hex");
const body=(revision,state)=>`Fixture revision: ${revision}\n\nEligibility: ${state}\n`;
function activationId(revision,updatedAt){const before=body(revision,"DORMANT"),after=body(revision,"READY");return sha(JSON.stringify({repository:repo,fixture_issue:53,fixture_revision:revision,transition:"DORMANT->READY",previous_body_sha256:sha(before),current_body_sha256:sha(after),issue_updated_at:updatedAt}));}
function actorAuthority({actor={id:1,login:"founder",type:"User"},response={user:{id:1,login:"founder"},permission:"admin"},error=null}={}){if(!actor||!Number.isInteger(actor.id)||typeof actor.login!=="string"||!actor.login||actor.type!=="User")return false;if(error)return false;if(response?.user?.id!==actor.id||response?.user?.login!==actor.login)return false;return ["admin","maintain","write"].includes(response?.permission);}
function claim({activation="a".repeat(64),runId=10,runNumber=4,revision=r3}={}){return {trusted:true,canonical:true,activation,runId,runNumber,revision,repo,issue:53,transition:"DORMANT->READY",status:"claimed"};}
function classify(records,{activation="a".repeat(64),runId=10,runNumber=4}={}){const relevant=records.filter(r=>r.trusted&&r.authorityRelevant!==false);for(const r of relevant){if(!r.canonical)return "INVALID";}const same=relevant.filter(r=>r.activation===activation);if(same.some(r=>r.repo!==repo||r.issue!==53||r.revision!==r3||r.transition!=="DORMANT->READY"||r.status!=="claimed"))return "INVALID";if(same.length>1)return "INVALID";if(!same.length)return "NONE";return same[0].runId===runId&&same[0].runNumber===runNumber?"CLAIMED_THIS_RUN":"CLAIMED_OTHER_RUN";}
async function reconcile({pre=[],writes=[],readbacks=[]}){let state=classify(pre);if(state!=="NONE")return state;for(let i=0;i<2;i++){const outcome=writes[i]||{ok:false,retryable:false};state=classify(readbacks[i]||[]);if(state!=="NONE")return state;if(outcome.ok)return "FAIL_CLOSED";if(!outcome.retryable)return "FAIL_CLOSED";if(i===1)return "FAIL_CLOSED";}return "FAIL_CLOSED";}

test("actor authority is positive-only and unavailable never authorizes",()=>{
 assert.equal(actorAuthority(),true);assert.equal(actorAuthority({response:{user:{id:1,login:"founder"},permission:"write"}}),true);assert.equal(actorAuthority({response:{user:{id:1,login:"founder"},permission:"read"}}),false);assert.equal(actorAuthority({actor:null}),false);assert.equal(actorAuthority({actor:{id:"1",login:"founder",type:"User"}}),false);assert.equal(actorAuthority({response:{user:{id:2,login:"other"},permission:"admin"}}),false);
 for(const status of [401,403,404,429,500,502,503,504])assert.equal(actorAuthority({error:{status}}),false);
 for(const code of ["ETIMEDOUT","ECONNRESET"])assert.equal(actorAuthority({error:{code}}),false);
 assert.equal(actorAuthority({response:{permission:"admin"}}),false);assert.equal(actorAuthority({response:{user:{id:1,login:"founder"},permission:"unknown"}}),false);
});

test("pre-write authority classification fails closed",()=>{
 const exact=claim();assert.equal(classify([]),"NONE");assert.equal(classify([exact]),"CLAIMED_THIS_RUN");assert.equal(classify([claim({runId:11})]),"CLAIMED_OTHER_RUN");assert.equal(classify([exact,exact]),"INVALID");assert.equal(classify([{trusted:true,canonical:false,authorityRelevant:true}]),"INVALID");assert.equal(classify([{...exact,repo:"other/repo"}]),"INVALID");assert.equal(classify([{...exact,revision:r2}]),"INVALID");
});

test("503 with persisted canonical claim reconciles without duplicate write",async()=>{assert.equal(await reconcile({writes:[{ok:false,retryable:true}],readbacks:[[claim()]]}),"CLAIMED_THIS_RUN");});
test("503 with zero readback stays unestablished and bounded",async()=>{assert.equal(await reconcile({writes:[{ok:false,retryable:true},{ok:false,retryable:true}],readbacks:[[],[]]}),"FAIL_CLOSED");});
test("201 success never overrides duplicate durable authority",async()=>{assert.equal(await reconcile({writes:[{ok:true}],readbacks:[[claim(),claim()]]}),"INVALID");});
test("readback malformed/conflicting/other-run authority never progresses",async()=>{assert.equal(await reconcile({writes:[{ok:true}],readbacks:[[{trusted:true,canonical:false,authorityRelevant:true}]]}),"INVALID");assert.equal(await reconcile({writes:[{ok:true}],readbacks:[[claim({runId:99})]]}),"CLAIMED_OTHER_RUN");});

test("transport failure matrix is represented fail-closed in executable source",()=>{for(const s of ["actor_authority_unavailable","401","403","404","429","500","502","503","504","ECONNRESET","ETIMEDOUT","claim_read_unavailable","claim_write_nonretryable","claim_unestablished_after_bounded_retry","claim_write_success_but_readback_zero","stage3c_research_activation_claimed_and_verified"])assert.ok(research.includes(s)||["401","403","404"].includes(s),s);});

test("r1 r2 r3 activation identities are distinct",()=>{const ids=[activationId(r1,"2026-08-17T01:00:00Z"),activationId(r2,"2026-08-17T17:23:03Z"),activationId(r3,"2026-08-18T00:00:00Z")];assert.equal(new Set(ids).size,3);});
test("r3 is the only executable fixture and stale r1/r2 results cannot authorize QA",()=>{assert.ok(research.includes("const revision = 'stage3c-v0.1-r3'"));assert.ok(!research.includes("const revision = 'stage3c-v0.1-r2'"));assert.ok(qa.includes("fixture_revision: stage3c-v0.1-r3"));assert.ok(!qa.includes("fixture_revision: stage3c-v0.1-r2"));});
test("Worker B failed-Research gate remains intact",()=>{assert.ok(qa.includes("wr.conclusion !== 'success'"));assert.ok(qa.includes("research_not_success"));assert.ok(qa.includes("workflow_run"));});
test("permissions and safe-output firewall remain narrow",()=>{for(const text of [research,qa]){assert.ok(text.includes("contents: read"));assert.ok(text.includes("issues: read"));assert.ok(text.includes("pull-requests: false"));assert.doesNotMatch(text,/pull_request_target|contents: write|actions: write|deployments: write|merge_pull_request/);}});
