const crypto = require("node:crypto");

const WORK_ITEM_SCHEMA_VERSION = "lv-rqa-work-item/v1";
const RESULT_SCHEMA_VERSION = "lv-rqa-terminal-result/v1";
const ROLES = new Set(["research", "qa"]);
const RISKS = new Set(["low", "medium", "high", "live"]);
const CONFIDENTIALITY = new Set(["public", "confidential-engineering", "restricted-rd"]);
const QA_REQS = new Set(["none", "one", "dual", "installed-state", "security"]);
const RESEARCH_STATUSES = new Set(["COMPLETE", "BLOCKED"]);
const QA_STATUSES = new Set(["PASS", "FAIL", "BLOCKED"]);
const TERMINAL_STATES = new Set(["terminal"]);
const TRUSTED_WRITERS = new Set(["github-actions[bot]"]);

function sha256(value) { return crypto.createHash("sha256").update(String(value), "utf8").digest("hex"); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])]));
  return value;
}
function canonical(value) { return JSON.stringify(stable(value)); }
function fail(code, detail="") { const e = new Error(detail ? `${code}:${detail}` : code); e.code = code; throw e; }
function nonempty(v, name, max=4096) { if (typeof v !== "string" || v.length < 1 || v.length > max) fail("invalid_field", name); }
function stringArray(v,name,maxItems=32,maxLen=512) { if (!Array.isArray(v) || v.length > maxItems || v.some(x=>typeof x!=="string"||!x||x.length>maxLen)) fail("invalid_field", name); }
function objectExactKeys(obj, required, optional=[]) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) fail("invalid_object");
  const allowed=new Set([...required,...optional]);
  for (const k of required) if (!(k in obj)) fail("missing_field",k);
  for (const k of Object.keys(obj)) if (!allowed.has(k)) fail("unknown_field",k);
}
function validateInputIdentity(x) {
  objectExactKeys(x, ["repository","commit_sha","tree_sha"]);
  nonempty(x.repository,"input_identity.repository",200);
  if (!/^[a-f0-9]{40}$/.test(x.commit_sha)) fail("invalid_input_identity","commit_sha");
  if (!/^[a-f0-9]{40}$/.test(x.tree_sha)) fail("invalid_input_identity","tree_sha");
  return true;
}
function validateBudget(b) {
  objectExactKeys(b, ["max_worker_runs"], ["max_ai_credits","max_actions_runtime_minutes"]);
  if (!Number.isInteger(b.max_worker_runs) || b.max_worker_runs<1 || b.max_worker_runs>20) fail("invalid_budget","max_worker_runs");
  for (const k of ["max_ai_credits","max_actions_runtime_minutes"]) if (k in b) {
    if (typeof b[k] !== "number" || !Number.isFinite(b[k]) || b[k] < 0) fail("invalid_budget",k);
  }
  return true;
}
function validateWorkItem(w) {
  objectExactKeys(w, ["schema_version","work_item_id","objective","role","risk","input_identity","context_refs","allowed_actions","forbidden_actions","expected_terminal_result","qa_requirement","founder_gate","confidentiality","budget","replay_identity"], ["dependencies"]);
  if (w.schema_version !== WORK_ITEM_SCHEMA_VERSION) fail("unsupported_schema","work_item");
  nonempty(w.work_item_id,"work_item_id",128); nonempty(w.objective,"objective",2000);
  if (!ROLES.has(w.role)) fail("invalid_role",w.role); if (!RISKS.has(w.risk)) fail("invalid_risk",w.risk);
  validateInputIdentity(w.input_identity); stringArray(w.context_refs,"context_refs",16,512); stringArray(w.allowed_actions,"allowed_actions",16,128); stringArray(w.forbidden_actions,"forbidden_actions",32,128);
  nonempty(w.expected_terminal_result,"expected_terminal_result",128); if (!QA_REQS.has(w.qa_requirement)) fail("invalid_qa_requirement",w.qa_requirement);
  if (typeof w.founder_gate !== "boolean") fail("invalid_field","founder_gate"); if (!CONFIDENTIALITY.has(w.confidentiality)) fail("invalid_confidentiality",w.confidentiality);
  validateBudget(w.budget); if (!/^[a-f0-9]{64}$/.test(w.replay_identity)) fail("invalid_replay_identity"); if (w.replay_identity !== deriveReplayIdentity(w)) fail("replay_identity_mismatch");
  if ("dependencies" in w) stringArray(w.dependencies,"dependencies",16,128); return true;
}
function deriveReplayIdentity({work_item_id, role, input_identity, objective}) { return sha256(canonical({work_item_id, role, input_identity, objective})); }
function deriveDispatchIdentity({work_item_id, role_instance_id, input_identity, upstream_result_ids=[]}) { return sha256(canonical({work_item_id,role_instance_id,input_identity,upstream_result_ids})); }
function deriveResultId(p) { return sha256(canonical({work_item_id:p.work_item_id,role:p.role,role_instance_id:p.role_instance_id,worker_run_id:String(p.worker_run_id),run_attempt:p.run_attempt,input_identity:p.input_identity,upstream_result_ids:p.upstream_result_ids})); }
function validateSubstance(role, s) {
  objectExactKeys(s, ["status","claims_or_findings","evidence_refs","artifact_refs","limitations","recommended_next_action"]);
  if (role==="research" && !RESEARCH_STATUSES.has(s.status)) fail("invalid_status","research");
  if (role==="qa" && !QA_STATUSES.has(s.status)) fail("invalid_status","qa");
  if (!Array.isArray(s.claims_or_findings) || s.claims_or_findings.length>64 || s.claims_or_findings.some(x=>typeof x!=="string"||!x||x.length>2000)) fail("invalid_field","claims_or_findings");
  stringArray(s.evidence_refs,"evidence_refs",64,512); stringArray(s.artifact_refs,"artifact_refs",32,512);
  if (typeof s.limitations!=="string" || s.limitations.length>4000) fail("invalid_field","limitations");
  if (typeof s.recommended_next_action!=="string" || s.recommended_next_action.length>2000) fail("invalid_field","recommended_next_action");
  return true;
}
module.exports={WORK_ITEM_SCHEMA_VERSION,RESULT_SCHEMA_VERSION,ROLES,TERMINAL_STATES,TRUSTED_WRITERS,sha256,canonical,fail,nonempty,stringArray,objectExactKeys,validateInputIdentity,validateBudget,validateWorkItem,deriveReplayIdentity,deriveDispatchIdentity,deriveResultId,validateSubstance};
