"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../scripts/development-orchestrator-v03b-controlled.js");

const REPO = C.TRUSTED_REPOSITORY;
const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_MAIN = "cccccccccccccccccccccccccccccccccccccccc";
const FIXED = "2026-08-15T11:00:00Z";
const VERIFIED_FOUNDER = {source:C.FOUNDER_AUTH_SOURCE,environment:C.FOUNDER_ENVIRONMENT,verified:true,protection_verified:true,activation:"job-admitted"};
const EXEC_ENV = {LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE:"1",LEAGUE_VECTOR_STAGE3B_ACTIVATED:"1",GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_REPOSITORY:REPO,GITHUB_DEFAULT_BRANCH:"main",GITHUB_REF:"refs/heads/main",GITHUB_REF_TYPE:"branch",GITHUB_REF_NAME:"main",GITHUB_HEAD_REPO_FORK:"false",GITHUB_RUN_ID:"403-test"};

function headers(values={}) { return {get:(name)=>values[String(name).toLowerCase()]||null}; }
function response({status=403,statusText="Forbidden",body={},headers:headerValues={}}={}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: headers(headerValues),
    async text(){ return typeof body === "string" ? body : JSON.stringify(body); },
    async json(){ return typeof body === "string" ? JSON.parse(body) : body; }
  };
}
async function withFetch(mock,fn){ const original=global.fetch; global.fetch=mock; try{return await fn();} finally{global.fetch=original;} }

function body(){return [
  "Owner: owner:core",
  "Risk: risk:low",
  "Status: status:ready-for-qa",
  "Type: type:infrastructure",
  "Priority: priority:low",
  "Integration required: no",
  "Promotion type: none",
  "Promotion authorized: not-applicable",
  "Founder decision required: no",
  "Founder gate: none",
  "Founder decision: not-required",
  "Dependencies: None"
].join("\n");}
function fixture(){return {main_sha:SHA_MAIN,generated_at:FIXED,prs:[{number:50,title:"fixture",body:body(),state:"open",draft:false,head_sha:SHA_A,declared_candidate_sha:SHA_A,labels:["owner:core"],events:[],authorized_qa_authors:["kw7t9rwhny-cyber"],candidate_sha_conflict:false}]};}

class FailingWriteAdapter {
  constructor(data){this.data=structuredClone(data);this.writes=[];}
  async readRepository(){return structuredClone(this.data);}
  async readActivationProvenance(){return {source:"mock",repository_full_name:REPO,default_branch:"main",fork:false};}
  async addLabel(repo,pr,label){this.writes.push(`ADD:${label}`);throw new Error('github_api_error:{"status":403,"operation":"add_label","message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest/issues/labels","request_id":"REQ403"}');}
  async removeLabel(repo,pr,label){this.writes.push(`REMOVE:${label}`);throw new Error("unexpected_remove");}
}

test("public exports do not expose generic authenticated GitHub request helpers",()=>{
  assert.equal(Object.prototype.hasOwnProperty.call(C,"githubJson"),false);
  for(const [name,value] of Object.entries(C)) {
    if(typeof value !== "function") continue;
    assert.doesNotMatch(name,/github.*(?:request|json|fetch)|(?:request|fetch).*github/i);
  }
});

test("pure diagnostic sanitizer preserves safe GitHub fields and request ID",()=>{
  const token="ghs_SUPERSECRETVALUE";
  const diagnostic=C.safeGitHubDiagnostic({
    response:response({status:403,statusText:"Forbidden",headers:{"x-github-request-id":"ABC1:DEF2:403"}}),
    operation:"add_label",
    bodyText:JSON.stringify({message:"Resource not accessible by integration",documentation_url:"https://docs.github.com/rest/issues/labels"}),
    token
  });
  assert.deepEqual(diagnostic,{status:403,operation:"add_label",message:"Resource not accessible by integration",documentation_url:"https://docs.github.com/rest/issues/labels",request_id:"ABC1:DEF2:403"});
  assert.ok(!JSON.stringify(diagnostic).includes(token));
});

test("pure diagnostic sanitizer redacts credentials and rejects untrusted documentation URL",()=>{
  const token="github_pat_REAL_SECRET_123456";
  const diagnostic=C.safeGitHubDiagnostic({
    response:response({status:403,headers:{"x-github-request-id":"REQ-1"}}),
    operation:"add_label",
    bodyText:JSON.stringify({message:`Bearer abc123 ${token} ghp_ANOTHERSECRET123456`,documentation_url:"https://attacker.invalid/secret"}),
    token
  });
  const text=JSON.stringify(diagnostic);
  assert.ok(!text.includes(token));
  assert.ok(!text.includes("abc123"));
  assert.ok(!text.includes("ghp_ANOTHERSECRET123456"));
  assert.equal(diagnostic.documentation_url,null);
});

test("missing canonical repository label fails before mutation POST", async()=>{
  const calls=[];
  await withFetch(async(url,options={})=>{
    calls.push({url,method:options.method||"GET"});
    return response({status:404,body:{message:"Not Found",documentation_url:"https://docs.github.com/rest/issues/labels"}});
  },async()=>{
    const adapter=new C.GitHubControlledLabelAdapter("mock-token",REPO);
    await assert.rejects(()=>adapter.addLabel(REPO,50,"status:ready-for-qa"),/canonical_repository_label_missing:status:ready-for-qa/);
  });
  assert.deepEqual(calls.map(x=>x.method),["GET"]);
});

const malformedSuccesses = [
  ["empty object",{}],
  ["null",null],
  ["array",[]],
  ["string",JSON.stringify("status:ready-for-qa")],
  ["null name",{name:null}],
  ["numeric name",{name:123}],
  ["empty name",{name:""}],
  ["wrong name",{name:"status:wrong"}],
  ["case variant",{name:"STATUS:READY-FOR-QA"}],
  ["whitespace variant",{name:" status:ready-for-qa "}]
];

for(const [caseName,preflightBody] of malformedSuccesses) {
  test(`HTTP 200 ${caseName} repository-label response fails closed before POST`, async()=>{
    const calls=[];
    await withFetch(async(url,options={})=>{
      const method=options.method||"GET";
      calls.push({url,method});
      if(method!=="GET") throw new Error("mutation_post_must_not_occur");
      return response({status:200,body:preflightBody});
    },async()=>{
      const adapter=new C.GitHubControlledLabelAdapter("mock-token",REPO);
      await assert.rejects(()=>adapter.addLabel(REPO,50,"status:ready-for-qa"),/canonical_repository_label_response_invalid:status:ready-for-qa/);
    });
    assert.deepEqual(calls.map(x=>x.method),["GET"]);
  });
}

test("exact HTTP 200 repository-label identity may proceed to controlled POST", async()=>{
  const calls=[];
  await withFetch(async(url,options={})=>{
    const method=options.method||"GET";
    calls.push({url,method});
    if(method==="GET") return response({status:200,body:{name:"status:ready-for-qa"}});
    return response({status:200,body:[{name:"status:ready-for-qa"}]});
  },async()=>{
    const adapter=new C.GitHubControlledLabelAdapter("mock-token",REPO);
    await adapter.addLabel(REPO,50,"status:ready-for-qa");
  });
  assert.deepEqual(calls.map(x=>x.method),["GET","POST"]);
});

test("403 add-label denial is preserved with zero automatic retry", async()=>{
  const calls=[];
  await withFetch(async(url,options={})=>{
    const method=options.method||"GET"; calls.push({url,method});
    if(method==="GET") return response({status:200,body:{name:"status:ready-for-qa"}});
    return response({status:403,body:{message:"Resource not accessible by integration",documentation_url:"https://docs.github.com/rest/issues/labels"},headers:{"x-github-request-id":"REQ-403"}});
  },async()=>{
    const adapter=new C.GitHubControlledLabelAdapter("mock-token",REPO);
    await assert.rejects(()=>adapter.addLabel(REPO,50,"status:ready-for-qa"),error=>{
      assert.equal(error.githubDiagnostic.status,403);
      assert.equal(error.githubDiagnostic.operation,"add_label");
      assert.equal(error.githubDiagnostic.request_id,"REQ-403");
      return true;
    });
  });
  assert.equal(calls.length,2);
  assert.deepEqual(calls.map(x=>x.method),["GET","POST"]);
});

test("unexpected GitHub policy denial is preserved without secondary mutation", async()=>{
  let calls=0;
  await withFetch(async(url,options={})=>{
    calls++;
    if((options.method||"GET")==="GET") return response({status:200,body:{name:"status:ready-for-qa"}});
    return response({status:403,body:{message:"Repository policy denied this operation",documentation_url:"https://docs.github.com/actions/security-guides/automatic-token-authentication"}});
  },async()=>{
    const adapter=new C.GitHubControlledLabelAdapter("mock-token",REPO);
    await assert.rejects(()=>adapter.addLabel(REPO,50,"status:ready-for-qa"),error=>{
      assert.match(error.message,/Repository policy denied this operation/);
      return true;
    });
  });
  assert.equal(calls,2);
});

test("first-write 403 stops transaction, performs no rollback, and requires manual review", async()=>{
  const data=fixture();
  const preview=C.previewFrom(data,50);
  assert.equal(preview.exact_mutations.length,1);
  assert.deepEqual(preview.exact_mutations[0],{operation:"ADD_LABEL",label:"status:ready-for-qa"});
  const adapter=new FailingWriteAdapter(data);
  const result=await C.executeControlled({repository:REPO,token:"mock",targetPr:"50",expectedFingerprint:preview.replay_fingerprint,env:EXEC_ENV,adapter,founderAttestation:VERIFIED_FOUNDER});
  assert.match(result.abort_reason,/github_api_error/);
  assert.equal(result.manual_review_required,true);
  assert.deepEqual(result.stage3b_audit.mutations_attempted,["ADD_LABEL:status:ready-for-qa"]);
  assert.deepEqual(result.stage3b_audit.mutations_completed,[]);
  assert.deepEqual(result.stage3b_audit.rollback_attempted,[]);
  assert.deepEqual(result.stage3b_audit.rollback_completed,[]);
  assert.equal(result.stage3b_audit.post_write_verification,"failed-or-partial");
  assert.deepEqual(adapter.writes,["ADD:status:ready-for-qa"]);
});
