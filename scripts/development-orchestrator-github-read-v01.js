"use strict";

const fs = require("node:fs");

const API_VERSION = "2022-11-28";
const AUTHORIZED_QA_SOURCES = new Set(["comment", "review"]);
const SNAPSHOT_SCHEMA = "lv-development-orchestrator-github-read-v0.1";

function headers(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
    "Content-Type": "application/json"
  };
}

async function githubJson(url, token, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: headers(token) });
  if (!response || typeof response.ok !== "boolean") throw new Error("github_rest_malformed_response");
  if (!response.ok) throw new Error(`github_rest_http_${response.status}:${url}`);
  const data = await response.json();
  if (data === null || typeof data !== "object") throw new Error(`github_rest_malformed_json:${url}`);
  return data;
}

const QA_EVENTS_QUERY = `query LeagueVectorQaEvents($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
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

async function fetchQaEventsGraphql(owner, repo, prNumber, token, authorizedQaAuthors, fetchImpl = fetch) {
  const response = await fetchImpl("https://api.github.com/graphql", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ query: QA_EVENTS_QUERY, variables: { owner, repo, number: prNumber } })
  });
  if (!response || typeof response.ok !== "boolean") throw new Error("github_graphql_malformed_response");
  if (!response.ok) throw new Error(`github_graphql_http_${response.status}:pr_${prNumber}`);
  const payload = await response.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error(`github_graphql_malformed_json:pr_${prNumber}`);
  if (Array.isArray(payload.errors) && payload.errors.length) throw new Error(`github_graphql_errors:pr_${prNumber}`);
  const pullRequest = payload.data && payload.data.repository && payload.data.repository.pullRequest;
  if (!pullRequest || Number(pullRequest.number) !== Number(prNumber)) throw new Error(`github_graphql_wrong_or_missing_pr:${prNumber}`);
  const comments = requireConnection(pullRequest.comments, "comments", prNumber);
  const reviews = requireConnection(pullRequest.reviews, "reviews", prNumber);
  const makeEvent = (x, source) => {
    if (!x || typeof x !== "object" || typeof x.id !== "string") throw new Error(`github_graphql_malformed_${source}_node:pr_${prNumber}`);
    const authorLogin = x.author && typeof x.author.login === "string" ? x.author.login : null;
    return {
      body: typeof x.body === "string" ? x.body : "",
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

async function loadLiveRepositoryGraphql(repository, token, options = {}) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || "")) throw new Error("invalid_repository");
  if (!token) throw new Error("missing_github_token");
  const [owner, repo] = repository.split("/");
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const fetchImpl = options.fetchImpl || fetch;
  const repoMeta = await githubJson(base, token, fetchImpl);
  if (!repoMeta.owner || typeof repoMeta.owner.login !== "string" || typeof repoMeta.default_branch !== "string") throw new Error("github_rest_malformed_repository_metadata");
  const authorizedQaAuthors = options.authorizedQaAuthors || [repoMeta.owner.login];
  const mainRef = await githubJson(`${base}/git/ref/heads/${repoMeta.default_branch}`, token, fetchImpl);
  if (!mainRef.object || typeof mainRef.object.sha !== "string" || !/^[0-9a-f]{40}$/i.test(mainRef.object.sha)) throw new Error("github_rest_malformed_main_ref");
  const pulls = await githubJson(`${base}/pulls?state=open&per_page=100`, token, fetchImpl);
  if (!Array.isArray(pulls)) throw new Error("github_rest_malformed_pulls");
  if (pulls.length === 100) throw new Error("github_rest_open_pr_pagination_required");
  const prs = [];
  for (const pr of pulls) {
    if (!pr || !Number.isInteger(pr.number) || !pr.head || typeof pr.head.sha !== "string" || typeof pr.title !== "string") throw new Error("github_rest_malformed_pull_request");
    const events = await fetchQaEventsGraphql(owner, repo, pr.number, token, authorizedQaAuthors, fetchImpl);
    const candidateEvidence = candidateShaEvidenceFromText(pr.body || "");
    prs.push({
      number: pr.number,
      title: pr.title,
      body: pr.body || "",
      state: pr.state,
      draft: Boolean(pr.draft),
      head_sha: pr.head.sha,
      labels: pr.labels || [],
      authorized_qa_authors: authorizedQaAuthors,
      declared_candidate_sha: candidateEvidence.sha,
      candidate_sha_conflict: candidateEvidence.conflict,
      events
    });
  }
  return {
    snapshot_schema: SNAPSHOT_SCHEMA,
    main_sha: mainRef.object.sha,
    qa_authority: { authorized_authors: authorizedQaAuthors, sources: [...AUTHORIZED_QA_SOURCES], record_policy: "verdict-only-exact-body" },
    prs
  };
}

module.exports = { API_VERSION, QA_EVENTS_QUERY, SNAPSHOT_SCHEMA, githubJson, fetchQaEventsGraphql, loadLiveRepositoryGraphql };

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
