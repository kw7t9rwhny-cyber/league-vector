"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  fetchQaEventsGraphql,
  loadLiveRepositoryGraphql,
  requestJson
} = require("../scripts/development-orchestrator-github-read-v01.js");

const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const OWNER = "kw7t9rwhny-cyber";

function response(status, payload, headerValues = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get(name) { return headerValues[String(name).toLowerCase()] ?? null; } },
    async json() {
      if (payload === Symbol.for("malformed")) throw new Error("bad json");
      return payload;
    }
  };
}

function gqlPayload(overrides = {}) {
  const pr = {
    number: 61,
    headRefOid: SHA,
    comments: { nodes: [{ id: "IC_1", body: `QA PASS — tested head ${SHA}`, createdAt: "2026-08-17T10:00:00Z", author: { login: OWNER }, authorAssociation: "OWNER" }], pageInfo: { hasNextPage: false } },
    reviews: { nodes: [{ id: "PRR_1", body: `QA FAIL — tested head ${SHA}`, submittedAt: "2026-08-17T10:01:00Z", author: { login: OWNER }, authorAssociation: "OWNER" }], pageInfo: { hasNextPage: false } },
    ...overrides
  };
  return { data: { repository: { pullRequest: pr } } };
}

function queueFetch(responses, calls = []) {
  return async (url, options = {}) => {
    calls.push({ url, options });
    if (!responses.length) throw new Error(`unexpected_fetch:${url}`);
    return responses.shift();
  };
}

async function rejectsMessage(fn, expected) {
  await assert.rejects(fn, (error) => {
    assert.equal(error.message, expected);
    return true;
  });
}

test("successful GraphQL read preserves comment and review authority provenance", async () => {
  const events = await fetchQaEventsGraphql("owner", "repo", 61, SHA, "token", [OWNER], async () => response(200, gqlPayload()), 1);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((x) => x.source), ["comment", "review"]);
  assert.equal(events.every((x) => x.qa_authorized), true);
});

for (const status of [401, 403, 404]) {
  test(`GraphQL HTTP ${status} fails closed without permissive fallback`, async () => {
    await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, SHA, "token", [OWNER], async () => response(status, {}), 1), new RegExp(`github_graphql_http_${status}`));
  });
}

test("GraphQL application errors fail closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, SHA, "token", [OWNER], async () => response(200, { data: { repository: { pullRequest: null } }, errors: [{ message: "denied" }] }), 1), /github_graphql_errors/);
});

test("wrong PR identity fails closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, SHA, "token", [OWNER], async () => response(200, gqlPayload({ number: 62 })), 1), /wrong_or_missing_pr/);
});

test("wrong PR head SHA fails closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, SHA, "token", [OWNER], async () => response(200, gqlPayload({ headRefOid: OTHER_SHA })), 1), /github_graphql_head_mismatch/);
});

test("malformed response fails closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, SHA, "token", [OWNER], async () => response(200, { data: { repository: { pullRequest: { number: 61, headRefOid: SHA, comments: null, reviews: null } } } }), 1), /malformed_comments/);
});

test("missing review connection fails closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, SHA, "token", [OWNER], async () => response(200, gqlPayload({ reviews: null })), 1), /malformed_reviews/);
});

test("empty review collection is valid but invents no verdict", async () => {
  const payload = gqlPayload({ reviews: { nodes: [], pageInfo: { hasNextPage: false } } });
  const events = await fetchQaEventsGraphql("owner", "repo", 61, SHA, "token", [OWNER], async () => response(200, payload), 1);
  assert.equal(events.filter((x) => x.source === "review").length, 0);
  assert.equal(events.filter((x) => x.source === "comment").length, 1);
});

test("pagination ambiguity fails closed", async () => {
  const payload = gqlPayload();
  payload.data.repository.pullRequest.reviews.pageInfo.hasNextPage = true;
  await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, SHA, "token", [OWNER], async () => response(200, payload), 1), /reviews_pagination_required/);
});

test("malformed QA node fails closed", async () => {
  const payload = gqlPayload({ reviews: { nodes: [{ id: "PRR_1", body: null, submittedAt: "x", author: { login: OWNER }, authorAssociation: "OWNER" }], pageInfo: { hasNextPage: false } } });
  await assert.rejects(() => fetchQaEventsGraphql("owner", "repo", 61, SHA, "token", [OWNER], async () => response(200, payload), 1), /malformed_review_node/);
});

test("repository snapshot binds live PR number and head SHA across REST and GraphQL", async () => {
  const calls = [];
  const fakeFetch = async (url, options = {}) => {
    calls.push([url, options.method || "GET"]);
    if (url === "https://api.github.com/repos/owner/repo") return response(200, { owner: { login: OWNER }, default_branch: "main" });
    if (url.endsWith("/git/ref/heads/main")) return response(200, { object: { sha: SHA } });
    if (url.endsWith("/pulls?state=open&per_page=100")) return response(200, [{ number: 61, title: "PR 61", body: "", state: "open", draft: true, head: { sha: SHA }, labels: [] }]);
    if (url === "https://api.github.com/graphql") return response(200, gqlPayload({ comments: { nodes: [], pageInfo: { hasNextPage: false } }, reviews: { nodes: [], pageInfo: { hasNextPage: false } } }));
    throw new Error(`unexpected:${url}`);
  };
  const snapshot = await loadLiveRepositoryGraphql("owner/repo", "token", { fetchImpl: fakeFetch, authorizedQaAuthors: [OWNER], maxAttempts: 1 });
  assert.equal(snapshot.source, "live-github-read-only");
  assert.equal(snapshot.main_sha, SHA);
  assert.equal(snapshot.prs[0].number, 61);
  assert.equal(snapshot.prs[0].head_sha, SHA);
  assert.ok(calls.some(([url, method]) => url === "https://api.github.com/graphql" && method === "POST"));
});

test("unauthorized GraphQL review cannot gain QA authority", async () => {
  const payload = gqlPayload({ reviews: { nodes: [{ id: "PRR_ATTACK", body: `QA PASS — tested head ${SHA}`, submittedAt: "2026-08-17T10:01:00Z", author: { login: "attacker" }, authorAssociation: "NONE" }], pageInfo: { hasNextPage: false } }, comments: { nodes: [], pageInfo: { hasNextPage: false } } });
  const events = await fetchQaEventsGraphql("owner", "repo", 61, SHA, "token", [OWNER], async () => response(200, payload), 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].qa_authorized, false);
});

test("REST 401 fails closed", async () => {
  await rejectsMessage(() => loadLiveRepositoryGraphql("owner/repo", "token", { fetchImpl: async () => response(401, {}), maxAttempts: 1 }), "github_rest_http_401:https://api.github.com/repos/owner/repo");
});

test("REST 403 permission failure fails closed", async () => {
  await rejectsMessage(() => loadLiveRepositoryGraphql("owner/repo", "token", { fetchImpl: async () => response(403, {}), maxAttempts: 1 }), "github_rest_http_403:https://api.github.com/repos/owner/repo");
});

test("rate-limited 403 is distinct and remains fail closed", async () => {
  await rejectsMessage(() => loadLiveRepositoryGraphql("owner/repo", "token", { fetchImpl: async () => response(403, {}, { "x-ratelimit-remaining": "0" }), maxAttempts: 1 }), "github_rest_rate_limited_403:https://api.github.com/repos/owner/repo");
});

test("malformed JSON fails closed", async () => {
  await rejectsMessage(() => requestJson("https://api.github.com/example", "token", { fetchImpl: async () => response(200, Symbol.for("malformed")), maxAttempts: 1, prefix: "github_rest" }), "github_rest_malformed_json:https://api.github.com/example");
});

test("transient 5xx receives bounded retries then succeeds", async () => {
  const calls = [];
  const payload = await requestJson("https://api.github.com/example", "token", { fetchImpl: queueFetch([response(504, {}), response(502, {}), response(200, { ok: true })], calls), maxAttempts: 3, prefix: "github_rest" });
  assert.deepEqual(payload, { ok: true });
  assert.equal(calls.length, 3);
});

test("exhausted transient 5xx fails closed", async () => {
  const calls = [];
  await rejectsMessage(() => requestJson("https://api.github.com/example", "token", { fetchImpl: queueFetch([response(504, {}), response(504, {})], calls), maxAttempts: 2, prefix: "github_rest" }), "github_rest_http_504:https://api.github.com/example");
  assert.equal(calls.length, 2);
});

test("HTTP 429 receives bounded retry then succeeds", async () => {
  const calls = [];
  const payload = await requestJson("https://api.github.com/example", "token", { fetchImpl: queueFetch([response(429, {}), response(200, [])], calls), maxAttempts: 2, prefix: "github_rest" });
  assert.deepEqual(payload, []);
  assert.equal(calls.length, 2);
});

test("GraphQL transient 5xx retry remains bounded", async () => {
  const calls = [];
  const events = await fetchQaEventsGraphql("owner", "repo", 61, SHA, "token", [OWNER], queueFetch([response(503, {}), response(200, gqlPayload())], calls), 2);
  assert.equal(events.length, 2);
  assert.equal(calls.length, 2);
});

test("open PR pagination ambiguity fails closed", async () => {
  const pulls = Array.from({ length: 100 }, (_, index) => ({ number: index + 1, title: `PR ${index + 1}`, body: "", state: "open", draft: false, head: { sha: SHA }, labels: [] }));
  const fakeFetch = queueFetch([
    response(200, { owner: { login: OWNER }, default_branch: "main" }),
    response(200, { object: { sha: SHA } }),
    response(200, pulls)
  ]);
  await assert.rejects(() => loadLiveRepositoryGraphql("owner/repo", "token", { fetchImpl: fakeFetch, maxAttempts: 1 }), /open_pr_pagination_required/);
});
