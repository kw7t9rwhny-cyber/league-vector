"use strict";

const fs = require("node:fs");

const API_VERSION = "2022-11-28";
const AUTHORIZED_QA_SOURCES = new Set(["comment", "review"]);
const SNAPSHOT_SCHEMA = "lv-development-orchestrator-github-read-v0.1";
const MAX_READ_ATTEMPTS = 3;

function headers(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
    "Content-Type": "application/json"
  };
}

function isTransientStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

function classifyHttp(prefix, status, url, response) {
  const remaining = response && response.headers && typeof response.headers.get === "function"
    ? response.headers.get("x-ratelimit-remaining")
    : null;
  if (status === 403 && remaining === "0") return `${prefix}_rate_limited_403:${url}`;
  return `${prefix}_http_${status}:${url}`;
}

async function requestJson(url, token, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const maxAttempts = options.maxAttempts || MAX_READ_ATTEMPTS;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchImpl(url, { method: options.method || "GET", headers: headers(token), body: options.body });
    if (!response || typeof response.ok !== "boolean") throw new Error(`${options.prefix || "github"}_malformed_response`);
    if (response.ok) {
      try {
        const data = await response.json();
        if (data === null || typeof data !== "object") throw new Error("invalid_json_shape");
        return data;
      } catch (error) {
        if (error && String(error.message || "").startsWith(`${options.prefix || "github"}_`)) throw error;
        throw new Error(`${options.prefix || "github"}_malformed_json:${url}`);
      }
    }
    const message = classifyHttp(options.prefix || "github", response.status, url, response);
    lastError = new Error(message);
    if (!isTransientStatus(response.status) || attempt === maxAttempts) throw lastError;
  }
  throw lastError || new Error(`${options.prefix || "github"}_request_failed:${url}`);
}

async function githubJson(url, token, fetchImpl = fetch, maxAttempts = MAX_READ_ATTEMPTS) {
  return requestJson(url, token, { fetchImpl, maxAttempts, prefix: "github_rest" });
}

const QA_EVENTS_QUERY = `query LeagueVectorQaEvents($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
      headRefOid
      comments(first: 100) {
        nodes { id body createdAt author { login } authorAssociation }
        pageInfo { hasNextPage }
      }
      reviews(first: 100) {
        nodes { id body submittedAt author { login } authorAssociation }
        pageInfo { hasNextPage }
      }
    }
  }
}`;

function requireConnection(connection, name, prNumber) {
  if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo || typeof connection.pageInfo.hasNextPage !== "boolean") {
    throw new Error(`github_graphql_malformed_${name}:pr_${prNumber}`);
  }
  if (connection.pageInfo.hasNextPage) throw new Error(`github_graphql_${name}_pagination_required:pr_${prNumber}`);
  return connection.nodes;
}

async function fetchQaEventsGraphql(owner, repo, prNumber, expectedHeadSha, token, authorizedQaAuthors, fetchImpl = fetch, maxAttempts = MAX_READ_ATTEMPTS) {
  const payload = await requestJson("https://api.github.com/graphql", token, {
    fetchImpl,
    maxAttempts,
    prefix: "github_graphql",
    method: "POST",
    body: JSON.stringify({ query: QA_EVENTS_QUERY, variables: { owner, repo, number: prNumber } })
  });
  if (Array.isArray(payload.errors) && payload.errors.length) throw new Error(`github_graphql_errors:pr_${prNumber}`);
  const pullRequest = payload.data && payload.data.repository && payload.data.repository.pullRequest;
  if (!pullRequest || Number(pullRequest.number) !== Number(prNumber)) throw new Error(`github_graphql_wrong_or_missing_pr:${prNumber}`);
  if (typeof pullRequest.headRefOid !== "string" || pullRequest.headRefOid !== expectedHeadSha) throw new Error(`github_graphql_head_mismatch:pr_${prNumber}`);
  const comments = requireConnection(pullRequest.comments, "comments", prNumber);
  const reviews = requireConnection(pullRequest.reviews, "reviews", prNumber);
  const makeEvent = (x, source) => {
    if (!x || typeof x !== "object" || typeof x.id !== "string" || typeof x.body !== "string") throw new Error(`github_graphql_malformed_${source}_node:pr_${prNumber}`);
    const authorLogin = x.author && typeof x.author.login === "string" ? x.author.login : null;
    return {
      body: x.body,
      created_at: source === "comment" ? (x.createdAt || "") : "",
      submitted_at: source === "review" ? (x.submittedAt || "") : "",
      source,
      id: x.id,
      author_login: authorLogin,
      author_association: x.authorAssociation || null,
      qa_authorized: Boolean(authorLogin && authorizedQaAuthors.includes(authorLogin) && AUTHORIZED_QA_SOURCES.has(source))
    };
  };
  return [...comments.map((x) => makeEvent(x, "comment")), ...reviews.map((x) => makeEvent(x, "review"))];
}

function candidateShaEvidenceFromText(body = "") {
  const patterns = [
    /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Exact (?:candidate|READY FOR QA|RC|remediated|research) head(?: SHA)?(?:\*\*)?:\s*`?([0-9a-f]{40})`?/ig,
    /(?:^|\n)(?:[-*]\s*)?(?:\*\*)?Exact head(?:\*\*)?:\s*`?([0-9a-f]{40})`?/ig
  ];
  const occurrences = [];
  for (const pattern of patterns) for (const match of String(body).matchAll(pattern)) occurrences.push({ sha: match[1], index: match.index ?? -1 });
  occurrences.sort((a, b) => a.index - b.index || a.sha.localeCompare(b.sha));
  if (occurrences.length === 0) return { sha: null, conflict: false };
  if (occurrences.length === 1) return { sha: occurrences[0].sha, conflict: false };
  return { sha: null, conflict: true };
}

function authorizedQaAuthors(repositoryOwner = null) {
  const explicit = String(process.env.LEAGUE_VECTOR_QA_AUTHORS || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (explicit.length) return [...new Set(explicit)];
  return repositoryOwner ? [repositoryOwner] : [];
}

async function loadLiveRepositoryGraphql(repository, token, options = {}) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || "")) throw new Error("invalid_repository");
  if (!token) throw new Error("missing_github_token");
  const [owner, repo] = repository.split("/");
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const fetchImpl = options.fetchImpl || fetch;
  const maxAttempts = options.maxAttempts || MAX_READ_ATTEMPTS;
  const repoMeta = await githubJson(base, token, fetchImpl, maxAttempts);
  if (!repoMeta.owner || typeof repoMeta.owner.login !== "string" || typeof repoMeta.default_branch !== "string") throw new Error("github_rest_malformed_repository_metadata");
  const qaAuthors = options.authorizedQaAuthors || authorizedQaAuthors(repoMeta.owner.login);
  const mainRef = await githubJson(`${base}/git/ref/heads/${repoMeta.default_branch}`, token, fetchImpl, maxAttempts);
  if (!mainRef.object || typeof mainRef.object.sha !== "string" || !/^[0-9a-f]{40}$/i.test(mainRef.object.sha)) throw new Error("github_rest_malformed_main_ref");
  const pulls = await githubJson(`${base}/pulls?state=open&per_page=100`, token, fetchImpl, maxAttempts);
  if (!Array.isArray(pulls)) throw new Error("github_rest_malformed_pulls");
  if (pulls.length === 100) throw new Error("github_rest_open_pr_pagination_required");
  const prs = [];
  for (const pr of pulls) {
    if (!pr || !Number.isInteger(pr.number) || !pr.head || typeof pr.head.sha !== "string" || !/^[0-9a-f]{40}$/i.test(pr.head.sha) || typeof pr.title !== "string") throw new Error("github_rest_malformed_pull_request");
    const events = await fetchQaEventsGraphql(owner, repo, pr.number, pr.head.sha, token, qaAuthors, fetchImpl, maxAttempts);
    const candidateEvidence = candidateShaEvidenceFromText(pr.body || "");
    prs.push({
      number: pr.number,
      title: pr.title,
      body: pr.body || "",
      state: pr.state,
      draft: Boolean(pr.draft),
      head_sha: pr.head.sha,
      labels: pr.labels || [],
      authorized_qa_authors: qaAuthors,
      declared_candidate_sha: candidateEvidence.sha,
      candidate_sha_conflict: candidateEvidence.conflict,
      events
    });
  }
  return {
    snapshot_schema: SNAPSHOT_SCHEMA,
    source: "live-github-read-only",
    main_sha: mainRef.object.sha,
    qa_authority: { authorized_authors: qaAuthors, sources: [...AUTHORIZED_QA_SOURCES], record_policy: "verdict-only-exact-body" },
    prs
  };
}

module.exports = {
  API_VERSION,
  QA_EVENTS_QUERY,
  SNAPSHOT_SCHEMA,
  MAX_READ_ATTEMPTS,
  isTransientStatus,
  requestJson,
  githubJson,
  fetchQaEventsGraphql,
  loadLiveRepositoryGraphql
};

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const outputIndex = args.indexOf("--output");
    const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
    if (!output) throw new Error("output_path_required");
    const repository = process.env.GITHUB_REPOSITORY || process.env.LEAGUE_VECTOR_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;
    const data = await loadLiveRepositoryGraphql(repository, token);
    fs.writeFileSync(output, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ schema: data.snapshot_schema, main_sha: data.main_sha, prs: data.prs.length })}\n`);
  })().catch((error) => { process.stderr.write(`${error.message}\n`); process.exit(2); });
}
