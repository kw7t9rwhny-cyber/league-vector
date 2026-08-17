"use strict";

const Stage2 = require("./development-orchestrator-v02.js");

const API_VERSION = "2022-11-28";
const GRAPHQL_URL = "https://api.github.com/graphql";
const DEFAULT_MAX_ATTEMPTS = 3;

function authorizedQaAuthors(repositoryOwner = null) {
  const explicit = String(process.env.LEAGUE_VECTOR_QA_AUTHORS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (explicit.length) return [...new Set(explicit)];
  return repositoryOwner ? [repositoryOwner] : [];
}

function requestHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
    "Content-Type": "application/json"
  };
}

function httpError(status, url, response) {
  const remaining = response && response.headers && response.headers.get
    ? response.headers.get("x-ratelimit-remaining")
    : null;
  const category = status === 403 && remaining === "0" ? "github_rate_limited" : "github_http";
  const error = new Error(`${category}_${status}:${url}`);
  error.status = status;
  error.url = url;
  error.category = category;
  return error;
}

function transientStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

async function requestJson(url, token, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const maxAttempts = options.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const method = options.method || "GET";
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchImpl(url, { method, headers: requestHeaders(token), body });
    if (response.ok) {
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error(`github_malformed_json:${url}`); }
      return payload;
    }
    lastError = httpError(response.status, url, response);
    if (!transientStatus(response.status) || attempt === maxAttempts) throw lastError;
  }
  throw lastError || new Error(`github_request_failed:${url}`);
}

const PR_EVIDENCE_QUERY = `
query Stage2PullRequestEvidence($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
      headRefOid
      comments(first: 100) {
        nodes { id body createdAt authorAssociation author { login } }
        pageInfo { hasNextPage }
      }
      reviews(first: 100) {
        nodes { id body submittedAt authorAssociation author { login } }
        pageInfo { hasNextPage }
      }
    }
  }
}`;

function requireConnection(connection, name, prNumber) {
  if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo || typeof connection.pageInfo.hasNextPage !== "boolean") {
    throw new Error(`github_graphql_malformed_${name}:pr_${prNumber}`);
  }
  if (connection.pageInfo.hasNextPage) throw new Error(`github_graphql_${name}_pagination_exceeded:pr_${prNumber}`);
  return connection.nodes;
}

async function readPullRequestEvidence(owner, repo, pr, token, options = {}) {
  const payload = await requestJson(GRAPHQL_URL, token, {
    ...options,
    method: "POST",
    body: { query: PR_EVIDENCE_QUERY, variables: { owner, repo, number: Number(pr.number) } }
  });
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) throw new Error(`github_graphql_missing_data:pr_${pr.number}`);
  if (Array.isArray(payload.errors) && payload.errors.length) throw new Error(`github_graphql_errors:pr_${pr.number}`);
  const repository = payload.data && payload.data.repository;
  const pullRequest = repository && repository.pullRequest;
  if (!pullRequest) throw new Error(`github_graphql_pr_unavailable:pr_${pr.number}`);
  if (Number(pullRequest.number) !== Number(pr.number)) throw new Error(`github_graphql_pr_identity_mismatch:pr_${pr.number}`);
  if (!pr.head || typeof pr.head.sha !== "string" || pullRequest.headRefOid !== pr.head.sha) {
    throw new Error(`github_graphql_pr_head_mismatch:pr_${pr.number}`);
  }
  const comments = requireConnection(pullRequest.comments, "comments", pr.number);
  const reviews = requireConnection(pullRequest.reviews, "reviews", pr.number);
  return { comments, reviews };
}

function eventFromGraphql(node, source, authorizedAuthors) {
  if (!node || typeof node.id !== "string" || typeof node.body !== "string") throw new Error(`github_graphql_malformed_${source}_event`);
  const authorLogin = node.author && typeof node.author.login === "string" ? node.author.login : null;
  return {
    body: node.body,
    created_at: source === "comment" ? node.createdAt : null,
    submitted_at: source === "review" ? node.submittedAt : null,
    source,
    id: node.id,
    author_login: authorLogin,
    author_association: node.authorAssociation || null,
    qa_authorized: Boolean(authorLogin && authorizedAuthors.includes(authorLogin) && Stage2.AUTHORIZED_QA_SOURCES.has(source))
  };
}

function validateRepositoryName(repository) {
  if (typeof repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("invalid_repository_identity");
  return repository.split("/");
}

async function loadLiveRepository(repository, token, options = {}) {
  if (!token) throw new Error("missing_github_token");
  const [owner, repo] = validateRepositoryName(repository);
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const requestOptions = { fetchImpl: options.fetchImpl, maxAttempts: options.maxAttempts || DEFAULT_MAX_ATTEMPTS };
  const repoMeta = await requestJson(base, token, requestOptions);
  if (!repoMeta || !repoMeta.owner || typeof repoMeta.owner.login !== "string" || typeof repoMeta.default_branch !== "string") throw new Error("github_repository_metadata_malformed");
  const qaAuthors = options.authorizedQaAuthors || authorizedQaAuthors(repoMeta.owner.login);
  const mainRef = await requestJson(`${base}/git/ref/heads/${repoMeta.default_branch}`, token, requestOptions);
  if (!mainRef || !mainRef.object || typeof mainRef.object.sha !== "string") throw new Error("github_default_branch_ref_malformed");
  const pulls = await requestJson(`${base}/pulls?state=open&per_page=100`, token, requestOptions);
  if (!Array.isArray(pulls)) throw new Error("github_open_pulls_malformed");

  const prs = [];
  for (const pr of pulls) {
    if (!pr || !Number.isSafeInteger(Number(pr.number)) || !pr.head || typeof pr.head.sha !== "string") throw new Error("github_open_pr_record_malformed");
    const evidence = await readPullRequestEvidence(owner, repo, pr, token, requestOptions);
    const comments = evidence.comments.map((node) => eventFromGraphql(node, "comment", qaAuthors));
    const reviews = evidence.reviews.map((node) => eventFromGraphql(node, "review", qaAuthors));
    const candidateEvidence = Stage2.candidateShaEvidenceFromText(pr.body || "");
    prs.push({
      number: pr.number,
      title: pr.title,
      body: pr.body || "",
      state: pr.state,
      draft: pr.draft,
      head_sha: pr.head.sha,
      labels: pr.labels || [],
      authorized_qa_authors: qaAuthors,
      declared_candidate_sha: candidateEvidence.sha,
      candidate_sha_conflict: candidateEvidence.conflict,
      events: [...comments, ...reviews]
    });
  }
  return {
    main_sha: mainRef.object.sha,
    source: "live-github-read-only",
    qa_authority: { authorized_authors: qaAuthors, sources: [...Stage2.AUTHORIZED_QA_SOURCES], record_policy: "verdict-only-exact-body" },
    prs
  };
}

module.exports = {
  API_VERSION,
  GRAPHQL_URL,
  PR_EVIDENCE_QUERY,
  transientStatus,
  requestJson,
  readPullRequestEvidence,
  loadLiveRepository
};

if (require.main === module) {
  (async () => {
    const repository = process.env.GITHUB_REPOSITORY || process.env.LEAGUE_VECTOR_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;
    if (!repository || !token) throw new Error("live_mode_requires_GITHUB_REPOSITORY_and_GITHUB_TOKEN");
    const data = await loadLiveRepository(repository, token);
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  })().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  });
}
