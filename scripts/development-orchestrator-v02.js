"use strict";

const { CONFIG, qaDepth, coreEligible, validateItem } = require("./development-orchestrator-v01.js");

const CANONICAL_VERDICT = /^QA (PASS|FAIL) — tested head ([0-9a-f]{40})$/;
const AUTHORIZED_QA_SOURCES = new Set(["comment", "review"]);
const REQUIRED_METADATA = [
  "owner", "risk", "status", "type", "priority", "integration_required",
  "promotion_type", "promotion_authorized", "founder_decision_required",
  "founder_gate", "founder_decision", "dependencies"
];

const SINGLETON_BODY_PATTERNS = {
  owner: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Owner(?:\*\*)?:\s*([^\n]+)/i,
  risk: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Risk(?:\*\*)?:\s*([^\n]+)/i,
  status: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Status(?:\*\*)?:\s*([^\n]+)/i,
  type: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Type(?:\*\*)?:\s*([^\n]+)/i,
  priority: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Priority(?:\*\*)?:\s*([^\n]+)/i,
  integration_required: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Integration required(?:\*\*)?:\s*([^\n]+)/i,
  promotion_type: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Promotion type(?:\*\*)?:\s*([^\n]+)/i,
  promotion_authorized: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Promotion authorized(?:\*\*)?:\s*([^\n]+)/i,
  founder_decision_required: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Founder decision required(?:\*\*)?:\s*([^\n]+)/i,
  founder_gate: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Founder gate(?:\*\*)?:\s*([^\n]+)/i,
  founder_decision: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Founder decision(?: when required)?(?:\*\*)?:\s*([^\n]+)/i,
  dependencies: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Dependencies(?:\*\*)?:\s*([^\n]+)/i
};

const AUDIT_ONLY_SINGLETON_PATTERNS = {
  qa_evidence: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?QA evidence(?: when applicable)?(?:\*\*)?:\s*([^\n]+)/i,
  exact_relevant_sha: /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Exact relevant SHA(?:\s*\/\s*source)?(?:\*\*)?:\s*([^\n]+)/i
};

const CANDIDATE_SHA_PATTERNS = [
  /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Exact (?:candidate|READY FOR QA|RC|remediated|research) head(?: SHA)?(?:\*\*)?:\s*`?([0-9a-f]{40})`?/i,
  /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Exact head(?:\*\*)?:\s*`?([0-9a-f]{40})`?/i
];

function boolValue(value) {
  if (value === true || value === "true" || value === "yes") return true;
  if (value === false || value === "false" || value === "no") return false;
  return value;
}

function cleanToken(value) {
  return String(value || "").replace(/`/g, "").replace(/\*\*/g, "").trim();
}

function normalizePrefixed(value, prefix) {
  const cleaned = cleanToken(value);
  return cleaned.startsWith(`${prefix}:`) ? cleaned.slice(prefix.length + 1).trim() : cleaned;
}

function parseDependencyText(text) {
  const raw = cleanToken(text);
  if (!raw || /^none$/i.test(raw)) return [];
  const ids = [];
  for (const match of raw.matchAll(/#(\d+)/g)) ids.push(Number(match[1]));
  return [...new Set(ids)];
}

function allMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  return [...String(text).matchAll(new RegExp(regex.source, flags))];
}

function candidateShaEvidenceFromText(body = "") {
  const occurrences = [];
  for (const pattern of CANDIDATE_SHA_PATTERNS) {
    for (const match of allMatches(body, pattern)) {
      occurrences.push({ sha: match[1], index: match.index === undefined ? -1 : match.index });
    }
  }
  occurrences.sort((a, b) => a.index - b.index || a.sha.localeCompare(b.sha));
  if (occurrences.length === 0) return { sha: null, conflict: false, occurrences: [] };
  if (occurrences.length === 1) return { sha: occurrences[0].sha, conflict: false, occurrences };
  return { sha: null, conflict: true, occurrences };
}

function parseStructuredMetadata(body = "", labels = []) {
  const fields = {};
  const bodyFields = {};
  const bodyOccurrences = {};
  const labelFields = { owner: [], risk: [], status: [], type: [], priority: [] };
  const conflicts = [];
  const text = String(body);

  for (const [key, regex] of Object.entries(SINGLETON_BODY_PATTERNS)) {
    const matches = allMatches(text, regex);
    bodyOccurrences[key] = matches.map((match) => cleanToken(match[1]));
    if (matches.length > 1) {
      conflicts.push(`duplicate_${key}_declarations`);
      continue;
    }
    if (matches.length === 1) bodyFields[key] = cleanToken(matches[0][1]);
  }

  for (const [key, regex] of Object.entries(AUDIT_ONLY_SINGLETON_PATTERNS)) {
    const matches = allMatches(text, regex);
    bodyOccurrences[key] = matches.map((match) => cleanToken(match[1]));
    if (matches.length > 1) conflicts.push(`duplicate_${key}_declarations`);
  }

  const candidateEvidence = candidateShaEvidenceFromText(text);
  bodyOccurrences.candidate_sha = candidateEvidence.occurrences.map((entry) => entry.sha);
  if (candidateEvidence.conflict) conflicts.push("duplicate_candidate_sha_declarations");

  for (const prefix of ["owner", "risk", "status", "type", "priority"]) {
    if (bodyFields[prefix]) bodyFields[prefix] = normalizePrefixed(bodyFields[prefix], prefix);
  }

  for (const label of labels || []) {
    const name = typeof label === "string" ? label : label.name;
    if (!name) continue;
    for (const prefix of Object.keys(labelFields)) {
      if (name.startsWith(`${prefix}:`)) labelFields[prefix].push(normalizePrefixed(name, prefix));
    }
  }

  Object.assign(fields, bodyFields);
  for (const prefix of Object.keys(labelFields)) {
    const values = [...new Set(labelFields[prefix])];
    if (values.length > 1) conflicts.push(`multiple_${prefix}_labels`);
    if (values.length === 1) {
      if (bodyFields[prefix] !== undefined && bodyFields[prefix] !== values[0]) conflicts.push(`${prefix}_body_label_conflict`);
      fields[prefix] = values[0];
    }
  }

  if (fields.integration_required !== undefined) fields.integration_required = boolValue(String(fields.integration_required).toLowerCase());
  if (fields.promotion_authorized !== undefined) {
    const value = String(fields.promotion_authorized).toLowerCase();
    fields.promotion_authorized = boolValue(value === "not-applicable" ? false : value);
  }
  if (fields.founder_decision_required !== undefined) {
    const value = String(fields.founder_decision_required).toLowerCase();
    fields.founder_decision_required = value === "no" ? false : true;
    if (value !== "no" && value !== "yes") fields.founder_gate = fields.founder_gate || value;
  }
  if (fields.dependencies !== undefined) fields.dependencies = parseDependencyText(fields.dependencies);

  const missing = REQUIRED_METADATA.filter((key) => fields[key] === undefined);
  return {
    fields,
    body_fields: bodyFields,
    body_occurrences: bodyOccurrences,
    label_fields: labelFields,
    candidate_sha_evidence: candidateEvidence,
    conflicts: [...new Set(conflicts)].sort(),
    structured: missing.length === 0 && conflicts.length === 0,
    missing
  };
}

function eventIdentifier(event) {
  return event.id === undefined || event.id === null ? null : String(event.id);
}

function authorizedQaAuthorsFromEnvironment(repositoryOwner = null) {
  const explicit = String(process.env.LEAGUE_VECTOR_QA_AUTHORS || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (explicit.length) return [...new Set(explicit)];
  return repositoryOwner ? [repositoryOwner] : [];
}

function qaEventAuthorized(event, authorizedQaAuthors = []) {
  if (!AUTHORIZED_QA_SOURCES.has(event.source || "comment")) return false;
  if (event.qa_authorized === true) return true;
  if (event.qa_authorized === false) return false;
  const author = String(event.author_login || "").trim();
  return Boolean(author && authorizedQaAuthors.includes(author));
}

function parseVerdicts(events = [], options = {}) {
  const authorizedQaAuthors = options.authorizedQaAuthors || [];
  const verdicts = [];
  for (const event of events) {
    if (!qaEventAuthorized(event, authorizedQaAuthors)) continue;
    const body = String(event.body || "").trim();
    const match = body.match(CANONICAL_VERDICT);
    if (!match) continue;
    verdicts.push({
      verdict: match[1].toLowerCase(),
      tested_sha: match[2],
      created_at: event.submitted_at || event.created_at || "",
      source: event.source || "comment",
      event_id: eventIdentifier(event),
      author_login: event.author_login || null,
      author_association: event.author_association || null,
      authority: "authorized-qa-identity+exact-record"
    });
  }
  verdicts.sort((a, b) => {
    const byTime = String(a.created_at).localeCompare(String(b.created_at));
    if (byTime) return byTime;
    const bySha = a.tested_sha.localeCompare(b.tested_sha);
    if (bySha) return bySha;
    const byVerdict = a.verdict.localeCompare(b.verdict);
    if (byVerdict) return byVerdict;
    const bySource = String(a.source).localeCompare(String(b.source));
    if (bySource) return bySource;
    const byAuthor = String(a.author_login || "").localeCompare(String(b.author_login || ""));
    if (byAuthor) return byAuthor;
    return String(a.event_id || "").localeCompare(String(b.event_id || ""));
  });
  return verdicts;
}

function latestVerdictForHead(verdicts, headSha) {
  const applicable = verdicts.filter((entry) => entry.tested_sha === headSha);
  if (!applicable.length) return null;
  const latestTimestamp = applicable[applicable.length - 1].created_at;
  const latestEvents = applicable.filter((entry) => entry.created_at === latestTimestamp);
  const decisions = new Set(latestEvents.map((entry) => entry.verdict));
  if (decisions.size > 1) {
    return {
      verdict: "conflicted", tested_sha: headSha, created_at: latestTimestamp,
      source: "conflicting-authorized-canonical-verdicts", event_id: null,
      author_login: null, authority: "conflicted-authorized-evidence", conflicted: true,
      evidence_count: latestEvents.length
    };
  }
  return latestEvents[latestEvents.length - 1];
}

function latestVerdict(verdicts) {
  return verdicts.length ? verdicts[verdicts.length - 1] : null;
}

function observedLegacyState(pr) {
  const text = `${pr.body || ""}\n${(pr.events || []).map((x) => x.body || "").join("\n")}`;
  if (/MORE .*RESEARCH REQUIRED|MORE RESEARCH REQUIRED|READY_FOR_QA=false/i.test(text)) return "more-research-required";
  if (/READY FOR QA/i.test(text)) return "candidate-ready-observed";
  if (/BLOCKED/i.test(text)) return "blocked-observed";
  return "legacy-unstructured";
}

function normalizePr(pr) {
  const meta = parseStructuredMetadata(pr.body || "", pr.labels || []);
  const verdicts = parseVerdicts(pr.events || [], { authorizedQaAuthors: pr.authorized_qa_authors || [] });
  const latest = latestVerdict(verdicts);
  const current = latestVerdictForHead(verdicts, pr.head_sha);
  const conflicts = [...(meta.conflicts || [])];
  const bodyCandidate = meta.candidate_sha_evidence || candidateShaEvidenceFromText(pr.body || "");
  if (pr.candidate_sha_conflict === true && !conflicts.includes("duplicate_candidate_sha_declarations")) conflicts.push("duplicate_candidate_sha_declarations");
  if (bodyCandidate.sha && pr.declared_candidate_sha && bodyCandidate.sha !== pr.declared_candidate_sha) conflicts.push("candidate_sha_adapter_body_conflict");
  const structured = meta.missing.length === 0 && conflicts.length === 0;
  const ownerValid = Boolean(meta.fields.owner && CONFIG.owners.includes(meta.fields.owner) && !conflicts.some((x) => x.includes("owner")));
  const item = {
    id: Number(pr.number), title: pr.title, owner: meta.fields.owner, risk: meta.fields.risk,
    status: meta.fields.status, type: meta.fields.type, priority: meta.fields.priority,
    integration_required: meta.fields.integration_required, promotion_type: meta.fields.promotion_type,
    promotion_authorized: meta.fields.promotion_authorized, founder_decision_required: meta.fields.founder_decision_required,
    founder_gate: meta.fields.founder_gate, founder_decision: meta.fields.founder_decision,
    dependencies: meta.fields.dependencies, head_sha: pr.head_sha,
    declared_candidate_sha: pr.declared_candidate_sha || bodyCandidate.sha || null,
    qa_verdict: current ? current.verdict : null, qa_tested_sha: current ? current.tested_sha : null
  };
  return {
    ...item, open: pr.state === "open", draft: Boolean(pr.draft), structured,
    missing_metadata: meta.missing, metadata_conflicts: [...new Set(conflicts)].sort(), metadata_body_fields: meta.body_fields,
    metadata_body_occurrences: meta.body_occurrences, metadata_label_fields: meta.label_fields, owner_authority_valid: ownerValid,
    legacy_observed_state: structured ? null : observedLegacyState(pr), verdicts,
    latest_qa_verdict: latest, current_qa_verdict: current,
    qa_fresh: Boolean(current && current.verdict === "pass" && current.tested_sha === pr.head_sha),
    qa_failed_current: Boolean(current && current.verdict === "fail"),
    qa_conflicted_current: Boolean(current && current.verdict === "conflicted"),
    qa_stale: Boolean(latest && latest.tested_sha !== pr.head_sha),
    head_matches_declared: item.declared_candidate_sha ? item.declared_candidate_sha === pr.head_sha : null
  };
}

function dependencyState(item, byId) {
  const missing = [];
  for (const id of item.dependencies || []) {
    const dependency = byId[id];
    if (!dependency || !dependency.structured || !["qa-passed", "ready-for-core", "waiting-founder", "live-test", "closed"].includes(dependency.status)) missing.push(id);
  }
  return { satisfied: missing.length === 0, missing };
}

function safeNextAction(item, byId) {
  if (!item.open) return "NO_ACTION";
  if (!item.structured) return item.legacy_observed_state === "more-research-required" ? "MORE_RESEARCH_REQUIRED" : "NO_ACTION";
  if (!item.owner_authority_valid) return "NO_ACTION";
  const deps = dependencyState(item, byId);
  if (!deps.satisfied) return "BLOCKED_DEPENDENCY";
  if (item.qa_conflicted_current || item.qa_failed_current) return "RETURN_TO_OWNER";
  if (item.status === "ready-for-qa") return "SEND_TO_QA";
  if (item.status === "waiting-founder") return "WAITING_ON_FOUNDER";
  if (item.type === "research") return item.status === "blocked" ? "BLOCKED_DEPENDENCY" : "MORE_RESEARCH_REQUIRED";
  const validationErrors = validateItem(item, Object.values(byId).filter((x) => x.structured));
  if (!validationErrors.length && coreEligible(item, byId)) return "READY_FOR_CORE_REVIEW";
  return "NO_ACTION";
}

function deriveQueues(prs) {
  const items = prs.map(normalizePr);
  const byId = Object.fromEntries(items.map((item) => [item.id, item]));
  for (const item of items) {
    const deps = dependencyState(item, byId);
    item.dependencies_satisfied = deps.satisfied;
    item.blocked_dependencies = deps.missing;
    item.recommended_action = safeNextAction(item, byId);
    item.recommended_qa_depth = item.structured && item.risk ? qaDepth(item.risk, item.qa_failed_current || item.qa_conflicted_current) : null;
  }
  const structuredOpen = items.filter((item) => item.open && item.structured && item.owner_authority_valid);
  return {
    qa: structuredOpen.filter((item) => item.status === "ready-for-qa" && !item.qa_fresh && !item.qa_failed_current && !item.qa_conflicted_current),
    core: structuredOpen.filter((item) => item.recommended_action === "READY_FOR_CORE_REVIEW"),
    remediation: structuredOpen.filter((item) => item.qa_conflicted_current || item.qa_failed_current || item.status === "qa-failed"),
    founder: structuredOpen.filter((item) => item.status === "waiting-founder" && item.founder_decision !== "approved"),
    research: structuredOpen.filter((item) => item.type === "research"),
    legacy: items.filter((item) => item.open && (!item.structured || !item.owner_authority_valid)), items
  };
}

function compactItem(item) {
  return {
    number: item.id, title: item.title, owner: item.owner || null, risk: item.risk || null,
    status: item.status || null, head_sha: item.head_sha, declared_candidate_sha: item.declared_candidate_sha,
    head_matches_declared: item.head_matches_declared,
    qa_status: item.qa_conflicted_current ? "conflicted" : item.qa_failed_current ? "fail" : item.qa_fresh ? "pass-fresh" : item.qa_stale ? "stale" : "none",
    previous_qa_verdict: item.latest_qa_verdict, dependencies: item.dependencies || [],
    dependencies_satisfied: item.dependencies_satisfied, founder_gate: item.founder_gate || null,
    founder_decision: item.founder_decision || null, recommended_qa_depth: item.recommended_qa_depth,
    recommended_action: item.recommended_action, structured: item.structured,
    owner_authority_valid: item.owner_authority_valid, missing_metadata: item.missing_metadata,
    metadata_conflicts: item.metadata_conflicts, legacy_observed_state: item.legacy_observed_state
  };
}

function handoffFor(item) {
  if (!item) throw new Error("item_not_found");
  const lines = [
    `League Vector Orchestrator handoff — PR #${item.id}`, `Target: ${item.title}`,
    `Exact current head: ${item.head_sha}`, `Owner: ${item.owner || "legacy/unstructured"}`,
    `Risk: ${item.risk || "unknown"}`, `Status: ${item.status || item.legacy_observed_state || "unknown"}`,
    `QA: ${item.qa_conflicted_current ? `CONFLICTED on ${item.head_sha}` : item.qa_failed_current ? `FAIL on ${item.head_sha}` : item.qa_fresh ? `PASS on ${item.head_sha}` : item.qa_stale ? `STALE (latest tested ${item.latest_qa_verdict.tested_sha})` : "none"}`,
    `Dependencies: ${(item.dependencies || []).length ? item.dependencies.map((id) => `#${id}`).join(", ") : "none declared"}`,
    `Founder gate: ${item.founder_gate || "none/unknown"}; decision: ${item.founder_decision || "unknown"}`,
    `Recommended next action: ${item.recommended_action}`
  ];
  if (!item.structured || !item.owner_authority_valid) lines.push(`FAIL-CLOSED: legacy/unstructured or invalid authority metadata; missing metadata: ${(item.missing_metadata || []).join(", ")}; conflicts: ${(item.metadata_conflicts || []).join(", ")}`);
  return lines.join("\n");
}

function statusSummary(queues, mainSha) {
  return {
    version: "lv-development-orchestrator-stage2-v0.3", source: "live-github-read-only", main_sha: mainSha,
    counts: { qa: queues.qa.length, core: queues.core.length, remediation: queues.remediation.length, founder: queues.founder.length, research: queues.research.length, legacy_unstructured: queues.legacy.length },
    qa: queues.qa.map(compactItem), core: queues.core.map(compactItem), remediation: queues.remediation.map(compactItem),
    founder: queues.founder.map(compactItem), research: queues.research.map(compactItem), legacy: queues.legacy.map(compactItem)
  };
}

function humanQueue(name, items) {
  const heading = `${name.toUpperCase()} QUEUE (${items.length})`;
  const rows = items.map((item) => `#${item.id} ${item.title} | ${item.owner || "legacy"} | ${item.risk || "unknown"} | ${item.head_sha.slice(0, 12)} | ${item.recommended_action}`);
  return [heading, ...rows].join("\n");
}

async function githubJson(url, token) {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" } });
  if (!response.ok) throw new Error(`github_http_${response.status}:${url}`);
  return response.json();
}

function candidateShaFromText(body = "") {
  const evidence = candidateShaEvidenceFromText(body);
  return evidence.conflict ? null : evidence.sha;
}

async function loadLiveRepository(repository, token, options = {}) {
  const [owner, repo] = repository.split("/");
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const repoMeta = await githubJson(base, token);
  const authorizedQaAuthors = options.authorizedQaAuthors || authorizedQaAuthorsFromEnvironment(repoMeta.owner && repoMeta.owner.login);
  const mainRef = await githubJson(`${base}/git/ref/heads/${repoMeta.default_branch}`, token);
  const pulls = await githubJson(`${base}/pulls?state=open&per_page=100`, token);
  const prs = [];
  for (const pr of pulls) {
    const [comments, reviews] = await Promise.all([
      githubJson(`${base}/issues/${pr.number}/comments?per_page=100`, token),
      githubJson(`${base}/pulls/${pr.number}/reviews?per_page=100`, token)
    ]);
    const makeEvent = (x, source) => ({
      body: x.body, created_at: x.created_at, submitted_at: x.submitted_at, source, id: x.id,
      author_login: x.user && x.user.login || null, author_association: x.author_association || null,
      qa_authorized: Boolean(x.user && authorizedQaAuthors.includes(x.user.login) && AUTHORIZED_QA_SOURCES.has(source))
    });
    const events = [...comments.map((x) => makeEvent(x, "comment")), ...reviews.map((x) => makeEvent(x, "review"))];
    const candidateEvidence = candidateShaEvidenceFromText(pr.body || "");
    prs.push({
      number: pr.number, title: pr.title, body: pr.body || "", state: pr.state, draft: pr.draft,
      head_sha: pr.head.sha, labels: pr.labels || [], authorized_qa_authors: authorizedQaAuthors,
      declared_candidate_sha: candidateEvidence.sha, candidate_sha_conflict: candidateEvidence.conflict, events
    });
  }
  return { main_sha: mainRef.object.sha, qa_authority: { authorized_authors: authorizedQaAuthors, sources: [...AUTHORIZED_QA_SOURCES], record_policy: "verdict-only-exact-body" }, prs };
}

async function loadInput(args) {
  const fixtureIndex = args.indexOf("--fixture");
  if (fixtureIndex >= 0) {
    const fs = require("fs");
    return JSON.parse(fs.readFileSync(args[fixtureIndex + 1], "utf8"));
  }
  const repository = process.env.GITHUB_REPOSITORY || process.env.LEAGUE_VECTOR_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !token) throw new Error("live_mode_requires_GITHUB_REPOSITORY_and_GITHUB_TOKEN");
  return loadLiveRepository(repository, token);
}

module.exports = {
  CANONICAL_VERDICT, AUTHORIZED_QA_SOURCES, REQUIRED_METADATA, SINGLETON_BODY_PATTERNS,
  AUDIT_ONLY_SINGLETON_PATTERNS, parseStructuredMetadata, candidateShaEvidenceFromText,
  authorizedQaAuthorsFromEnvironment, qaEventAuthorized, parseVerdicts, normalizePr, deriveQueues,
  handoffFor, statusSummary, candidateShaFromText, loadLiveRepository
};

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const json = args.includes("--json");
    const filtered = args.filter((arg) => arg !== "--json" && arg !== "--fixture" && !arg.endsWith(".json"));
    const data = await loadInput(args);
    const queues = deriveQueues(data.prs || []);
    const command = filtered[0] || "status";
    if (command === "queue") {
      const name = filtered[1];
      if (!queues[name]) throw new Error(`unknown_queue:${name}`);
      const payload = queues[name].map(compactItem);
      process.stdout.write(json ? `${JSON.stringify(payload, null, 2)}\n` : `${humanQueue(name, queues[name])}\n`);
      return;
    }
    if (command === "handoff") {
      const id = Number(filtered[1]);
      const item = queues.items.find((entry) => entry.id === id);
      process.stdout.write(`${handoffFor(item)}\n`);
      return;
    }
    if (command === "status") {
      const payload = statusSummary(queues, data.main_sha || null);
      if (json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      else process.stdout.write(`League Vector Orchestrator Stage 2\nmain ${payload.main_sha || "unknown"}\nQA ${payload.counts.qa} | Core ${payload.counts.core} | Remediation ${payload.counts.remediation} | Founder ${payload.counts.founder} | Research ${payload.counts.research} | Legacy ${payload.counts.legacy_unstructured}\n`);
      return;
    }
    throw new Error(`unknown_command:${command}`);
  })().catch((error) => { process.stderr.write(`${error.message}\n`); process.exit(2); });
}
