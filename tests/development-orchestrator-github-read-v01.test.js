"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { fetchQaEventsGraphql, loadLiveRepositoryGraphql } = require("../scripts/development-orchestrator-github-read-v01.js");

const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER = "kw7t9rwhny-cyber";

function response(status, payload) {
  return { ok: status >= 200 && status < 300, status, async json() { return payload; } };
}

function gqlPayload(overrides = {}) {
  const pr = {
    number: 61,
    comments: { nodes: [{ id: "IC_1", body: `QA PASS — tested head ${SHA}`, createdAt: "2026-08-17T10:00:00Z", author: { login: OWNER }, authorAssociation: "OWNER" }], pageInfo: { hasNextPage: false } },
    reviews: { nodes: [{ id: "PRR_1", body: `QA FAIL — tested head ${SHA}`, submittedAt: "2026-08-17T10:01:00Z", author: { login: OWNER }, authorAssociation: "OWNER" }], pageInfo: { hasNextPage: false } },
    ...overrides
  };
  return { data: { repository: { pullRequest: pr } } };
}

test("successful GraphQL read preserves comment and review authority provenance", async () => {
  const events = await fetchQaEventsGraphql("owner", "repo", 61, "token", [OWNER], async () => response(200, gqlPayload()));
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((x) => x.source), ["comment", "review"]);
  assert.equal(events.every((x) => x.qa_authorized), true);
});

for (const status of [401, 403, 404, 429, 500, 503]) {
  test(`GraphQL HTTP ${status} fails closed`, async () => {
    await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, "token", [OWNER], async () => response(status, {})), new RegExp(`github_graphql_http_${status}`));
  });
}

test("GraphQL application errors fail closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, "token", [OWNER], async () => response(200, { errors: [{ message: "denied" }] })), /github_graphql_errors/);
});

test("wrong PR identity fails closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, "token", [OWNER], async () => response(200, gqlPayload({ number: 62 }))), /wrong_or_missing_pr/);
});

test("malformed response fails closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, "token", [OWNER], async () => response(200, { data: { repository: { pullRequest: { number: 61, comments: null, reviews: null } } } })), /malformed_comments/);
});

test("pagination ambiguity fails closed", async () => {
  const payload = gqlPayload();
  payload.data.repository.pullRequest.reviews.pageInfo.hasNextPage = true;
  await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, "token", [OWNER], async () => response(200, payload)), /reviews_pagination_required/);
});

test("missing review data is a valid empty collection, not an invented verdict", async () => {
  const payload = gqlPayload({ reviews: { nodes: [], pageInfo: { hasNextPage: false } } });
  const events = await fetchQaEventsGraphql("owner", "repo", 61, "token", [OWNER], async () => response(200, payload));
  assert.equal(events.filter((x) => x.source === "review").length, 0);
  assert.equal(events.filter((x) => x.source === "comment").length, 1);
});

test("repository snapshot binds live PR number and head SHA", async () => {
  const calls = [];
  const fakeFetch = async (url, options = {}) => {
    calls.push([url, options.method || "GET"]);
    if (url === "https://api.github.com/repos/owner/repo") return response(200, { owner: { login: OWNER }, default_branch: "main" });
    if (url.endsWith("/git/ref/heads/main")) return response(200, { object: { sha: SHA } });
    if (url.endsWith("/pulls?state=open&per_page=100")) return response(200, [{ number: 61, title: "PR 61", body: "", state: "open", draft: true, head: { sha: SHA }, labels: [] }]);
    if (url === "https://api.github.com/graphql") return response(200, gqlPayload({ comments: { nodes: [], pageInfo: { hasNextPage: false } }, reviews: { nodes: [], pageInfo: { hasNextPage: false } } }));
    throw new Error(`unexpected:${url}`);
  };
  const snapshot = await loadLiveRepositoryGraphql("owner/repo", "token", { fetchImpl: fakeFetch, authorizedQaAuthors: [OWNER] });
  assert.equal(snapshot.main_sha, SHA);
  assert.equal(snapshot.prs[0].number, 61);
  assert.equal(snapshot.prs[0].head_sha, SHA);
  assert.ok(calls.some(([url, method]) => url === "https://api.github.com/graphql" && method === "POST"));
});
