"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const research=read(".github/workflows/stage3c-research-worker.md");
const qa=read(".github/workflows/stage3c-qa-worker.md");
const repo="kw7t9rwhny-cyber/league-vector",issue=53,r1="stage3c-v0.1-r1",r2="stage3c-v0.1-r2";
const sha=v=>crypto.createHash("sha256").update(v,"utf8").digest("hex");
const body=(revision,state)=>`Fixture revision: ${revision}\n\nEligibility: ${state}\n`;
function eligible({repoName=repo,issueNumber=53,revision=r2,before=body(r2,"DORMANT"),after=body(r2,"READY"),attempt="1"}={}){
  const val=b=>{if(typeof b!=="string")return null;const m=[...b.matchAll(/^Eligibility: ([^\r\n]+)$/gm)];return m.length===1?m[0][1]:null};
  const rev=b=>typeof b==="string"?[...b.matchAll(new RegExp(`^Fixture revision: ${revision.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}$`,"gm"))].length:0;
  return repoName===repo&&issueNumber===issue&&attempt==="1"&&rev(before)===1&&rev(after)===1&&val(before)==="DORMANT"&&val(after)==="READY"&&after===before.replace(/^Eligibility: DORMANT$/m,"Eligibility: READY");
}
function activationId(revision,updatedAt="2026-08-17T14:00:00Z"){
  const before=body(revision,"DORMANT"),after=body(revision,"READY");
  return sha(JSON.stringify({repository:repo,fixture_issue:53,fixture_revision:revision,transition:"DORMANT->READY",previous_body_sha256:sha(before),current_body_sha256:sha(after),issue_updated_at:updatedAt}));
}
function researchResult(revision,runId=9001){return `STAGE3C_RESEARCH_RESULT v0.1\nworker_role: research-worker-a\nfixture_issue: 53\nfixture_revision: ${revision}\nresearch_run_id: ${runId}\nresearch_run_number: 1\nrepository_source_path: docs/ARCHITECTURE.md\nobserved_fact: exists\ncompletion_status: complete`;}
function qaAuthorizes({revision=r2,result=researchResult(r2),conclusion="success",event="issues",branch="main",name="Stage 3C Research Worker A",workflowPath=".github/workflows/stage3c-research-worker.lock.yml"}={}){
  return revision===r2&&result.includes(`fixture_revision: ${r2}`)&&!result.includes(`fixture_revision: ${r1}`)&&conclusion==="success"&&event==="issues"&&branch==="main"&&name==="Stage 3C Research Worker A"&&workflowPath===".github/workflows/stage3c-research-worker.lock.yml";
}

test("r2 is the only eligible fixture revision",()=>{
  assert.equal(eligible(),true);
  assert.equal(eligible({revision:r1,before:body(r1,"DORMANT"),after:body(r1,"READY")}),false);
  assert.equal(eligible({before:body(r2,"READY"),after:body(r2,"READY")}),false);
  assert.equal(eligible({before:body(r2,"BLOCKED"),after:body(r2,"READY")}),false);
  assert.equal(eligible({before:body(r2,"UNKNOWN"),after:body(r2,"READY")}),false);
  assert.equal(eligible({repoName:"attacker/repo"}),false);
  assert.equal(eligible({issueNumber:54}),false);
  assert.equal(eligible({attempt:"2"}),false);
});

test("r1 and r2 activation identities are distinct",()=>{
  assert.notEqual(activationId(r1),activationId(r2));
  assert.match(activationId(r2),/^[a-f0-9]{64}$/);
});

test("Research source is r2-bound and installation push cannot qualify",()=>{
  assert.ok(research.includes("const revision = 'stage3c-v0.1-r2'"));
  assert.ok(research.includes("Fixture revision: stage3c-v0\\.1-r2"));
  assert.ok(research.includes("types: [edited]"));
  assert.ok(research.includes("needs.pre_activation.outputs.exact_transition_result == 'success'"));
  assert.ok(!research.includes("const revision = 'stage3c-v0.1-r1'"));
  assert.ok(!/\bon:\s*\n\s*push:/m.test(research));
});

test("r1 claims and results cannot authorize r2",()=>{
  assert.notEqual(activationId(r1),activationId(r2));
  assert.equal(qaAuthorizes({result:researchResult(r1)}),false);
  assert.equal(qaAuthorizes({revision:r1,result:researchResult(r1)}),false);
  assert.equal(qaAuthorizes({result:researchResult(r2)}),true);
});

test("Worker B retains exact successful Research authority contract",()=>{
  assert.ok(qa.includes("workflows: ['Stage 3C Research Worker A']"));
  assert.ok(qa.includes("branches: [main]"));
  assert.ok(qa.includes("wr.path !== '.github/workflows/stage3c-research-worker.lock.yml'"));
  assert.ok(qa.includes("wr.conclusion !== 'success'"));
  assert.ok(qa.includes("fixture_revision: stage3c-v0.1-r2"));
  for(const bad of [
    {conclusion:"failure"},{conclusion:"cancelled"},{conclusion:"timed_out"},{conclusion:"skipped"},{event:"push"},{branch:"feature"},{name:"Other Research"},{workflowPath:".github/workflows/other.yml"},{result:researchResult(r1)}
  ]) assert.equal(qaAuthorizes(bad),false);
});

test("prior claim/replay/concurrency fail-closed controls remain present",()=>{
  for(const s of ["stage3c-research-fixture-53","cancel-in-progress: false","stage3c-activation-claim/v1","authorityRelevantClaimRecord","unsupported_schema_version","unsupported_marker_version","duplicate_marker","malformed_canonical_claim","multiple_same_activation_claims","activation_already_claimed","GITHUB_RUN_ATTEMPT !== '1'","stale_activation"]) assert.ok(research.includes(s),s);
});

test("Worker independence and production firewall remain intact",()=>{
  assert.ok(research.includes("engine: codex"));
  assert.ok(qa.includes("engine: codex"));
  assert.ok(qa.includes("fresh independent Codex execution"));
  assert.ok(qa.includes("workflow_run"));
  for(const text of [research,qa]){
    assert.ok(text.includes("contents: read"));
    assert.ok(text.includes("issues: read"));
    assert.ok(text.includes("pull-requests: false"));
    assert.doesNotMatch(text,/pull_request_target|merge_pull_request|deployments: write|contents: write|actions: write/);
  }
});
