"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  GRAPHQL_URL,
  requestJson,
  readPullRequestEvidence,
  loadLiveRepository
} = require("../scripts/development-orchestrator-live-reader-v01.js");

const SHA = "a".repeat(40);

function headers(values = {}) {
  return { get(name) { return values[String(name).toLowerCase()] ?? null; } };
}

function response(status, payload, headerValues = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: headers(headerValues),
    async json() {
      if (payload === Symbol.for("malformed")) throw new Error("bad json");
      return payload;
    }
  };
}

function graphqlPayload(overrides = {}) {
  const pullRequest = {
    number: 61,
    headRefOid: SHA,
    comments: { nodes: [], pageInfo: { hasNextPage: false } },
    reviews: { nodes: [], pageInfo: { hasNextPage: false } },
    ...overrides
  };
  return { data: { repository: { pullRequest } } };
}

function liveSequence(graphql = graphqlPayload()) {
  return [
    response(200, { owner: { login: "kw7t9rwhny-cyber" }, default_branch: "main" }),
    response(200, { object: { sha: "b".repeat(40) } }),
    response(200, [{ number: 61, title: "PR 61", body: "", state: "open", draft: true, head: { sha: SHA }, labels: [] }]),
    response(200, graphql)
  ];
}

function sequenceFetch(sequence, calls = []) {
  return async (url, options = {}) => {
    calls.push({ url, options });
    if (!sequence.length) throw new Error(`unexpected_fetch:${url}`);
    return sequence.shift();
  };
}

async function rejectsMessage(fn, expected) {
  await assert.rejects(fn, (error) => {
    assert.equal(error.message, expected);
    return true;
  });
}

test("successful live read uses GraphQL for PR comments/reviews and preserves read-only QA events", async () => {
  const calls = [];
  const payload = graphqlPayload({
    comments: { nodes: [{ id: "IC_1", body: `QA FAIL — tested head ${SHA}`, createdAt: "2026-08-17T00:00:00Z", authorAssociation: "OWNER", author: { login: "kw7t9rwhny-cyber" } }], pageInfo: { hasNextPage: false } },
    reviews: { nodes: [{ id: "PRR_1", body: `QA PASS — tested head ${SHA}`, submittedAt: "2026-08-17T00:01:00Z", authorAssociation: "OWNER", author: { login: "kw7t9rwhny-cyber" } }], pageInfo: { hasNextPage: false } }
  });
  const data = await loadLiveRepository("kw7t9rwhny-cyber/league-vector", "secret", { fetchImpl: sequenceFetch(liveSequence(payload), calls), maxAttempts: 1 });
  assert.equal(data.source, "live-github-read-only");
  assert.equal(data.prs.length, 1);
  assert.equal(data.prs[0].events.length, 2);
  assert.deepEqual(data.prs[0].events.map((event) => event.source), ["comment", "review"]);
  assert.ok(data.prs[0].events.every((event) => event.qa_authorized === true));
  assert.equal(calls[3].url, GRAPHQL_URL);
  assert.equal(calls[3].options.method, "POST");
  assert.match(calls[3].options.body, /Stage2PullRequestEvidence/);
});

test("REST 401 fails closed", async () => {
  await rejectsMessage(() => loadLiveRepository("kw7t9rwhny-cyber/league-vector", "secret", { fetchImpl: sequenceFetch([response(401, {})]), maxAttempts: 1 }), "github_http_401:https://api.github.com/repos/kw7t9rwhny-cyber/league-vector");
});

test("REST 403 permission failure fails closed", async () => {
  await rejectsMessage(() => loadLiveRepository("kw7t9rwhny-cyber/league-vector", "secret", { fetchImpl: sequenceFetch([response(403, {})]), maxAttempts: 1 }), "github_http_403:https://api.github.com/repos/kw7t9rwhny-cyber/league-vector");
});

test("rate-limited 403 is classified distinctly and fails closed", async () => {
  await rejectsMessage(() => loadLiveRepository("kw7t9rwhny-cyber/league-vector", "secret", { fetchImpl: sequenceFetch([response(403, {}, { "x-ratelimit-remaining": "0" })]), maxAttempts: 3 }), "github_rate_limited_403:https://api.github.com/repos/kw7t9rwhny-cyber/league-vector");
});

test("GraphQL HTTP 404 fails closed instead of becoming empty review evidence", async () => {
  const seq = liveSequence();
  seq[3] = response(404, {});
  await rejectsMessage(() => loadLiveRepository("kw7t9rwhny-cyber/league-vector", "secret", { fetchImpl: sequenceFetch(seq), maxAttempts: 1 }), `github_http_404:${GRAPHQL_URL}`);
});

test("GraphQL HTTP 403 fails closed", async () => {
  const seq = liveSequence();
  seq[3] = response(403, {});
  await rejectsMessage(() => loadLiveRepository("kw7t9rwhny-cyber/league-vector", "secret", { fetchImpl: sequenceFetch(seq), maxAttempts: 1 }), `github_http_403:${GRAPHQL_URL}`);
});

test("malformed JSON fails closed", async () => {
  await rejectsMessage(() => requestJson("https://api.github.com/example", "secret", { fetchImpl: sequenceFetch([response(200, Symbol.for("malformed"))]), maxAttempts: 1 }), "github_malformed_json:https://api.github.com/example");
});

test("GraphQL errors fail closed", async () => {
  const seq = liveSequence();
  seq[3] = response(200, { data: { repository: { pullRequest: null } }, errors: [{ message: "denied" }] });
  await rejectsMessage(() => loadLiveRepository("kw7t9rwhny-cyber/league-vector", "secret", { fetchImpl: sequenceFetch(seq), maxAttempts: 1 }), "github_graphql_errors:pr_61");
});

test("missing GraphQL review data fails closed", async () => {
  const seq = liveSequence(graphqlPayload({ reviews: null }));
  await rejectsMessage(() => loadLiveRepository("kw7t9rwhny-cyber/league-vector", "secret", { fetchImpl: sequenceFetch(seq), maxAttempts: 1 }), "github_graphql_malformed_reviews:pr_61");
});

test("wrong PR identity fails closed", async () => {
  const pr = { number: 61, head: { sha: SHA } };
  await rejectsMessage(() => readPullRequestEvidence("kw7t9rwhny-cyber", "league-vector", pr, "secret", { fetchImpl: sequenceFetch([response(200, graphqlPayload({ number: 62 }))]), maxAttempts: 1 }), "github_graphql_pr_identity_mismatch:pr_61");
});

test("wrong PR head SHA fails closed", async () => {
  const pr = { number: 61, head: { sha: SHA } };
  await rejectsMessage(() => readPullRequestEvidence("kw7t9rwhny-cyber", "league-vector", pr, "secret", { fetchImpl: sequenceFetch([response(200, graphqlPayload({ headRefOid: "c".repeat(40) }))]), maxAttempts: 1 }), "github_graphql_pr_head_mismatch:pr_61");
});

test("review pagination beyond bounded evidence window fails closed", async () => {
  const seq = liveSequence(graphqlPayload({ reviews: { nodes: [], pageInfo: { hasNextPage: true } } }));
  await rejectsMessage(() => loadLiveRepository("kw7t9rwhny-cyber/league-vector", "secret", { fetchImpl: sequenceFetch(seq), maxAttempts: 1 }), "github_graphql_reviews_pagination_exceeded:pr_61");
});

test("transient 5xx receives bounded retry then succeeds", async () => {
  const calls = [];
  const fetchImpl = sequenceFetch([response(504, {}), response(502, {}), response(200, { ok: true })], calls);
  const payload = await requestJson("https://api.github.com/example", "secret", { fetchImpl, maxAttempts: 3 });
  assert.deepEqual(payload, { ok: true });
  assert.equal(calls.length, 3);
});

test("exhausted transient 5xx fails closed", async () => {
  const calls = [];
  await rejectsMessage(() => requestJson("https://api.github.com/example", "secret", { fetchImpl: sequenceFetch([response(504, {}), response(504, {})], calls), maxAttempts: 2 }), "github_http_504:https://api.github.com/example");
  assert.equal(calls.length, 2);
});

test("HTTP 429 receives bounded retry then succeeds", async () => {
  const calls = [];
  const payload = await requestJson("https://api.github.com/example", "secret", { fetchImpl: sequenceFetch([response(429, {}), response(200, [])], calls), maxAttempts: 2 });
  assert.deepEqual(payload, []);
  assert.equal(calls.length, 2);
});

test("malformed open-pull response fails closed", async () => {
  const seq = liveSequence();
  seq[2] = response(200, { not: "an array" });
  await rejectsMessage(() => loadLiveRepository("kw7t9rwhny-cyber/league-vector", "secret", { fetchImpl: sequenceFetch(seq), maxAttempts: 1 }), "github_open_pulls_malformed");
});

test("unrelated actor cannot gain QA authority through GraphQL transport", async () => {
  const payload = graphqlPayload({
    reviews: { nodes: [{ id: "PRR_ATTACK", body: `QA PASS — tested head ${SHA}`, submittedAt: "2026-08-17T00:01:00Z", authorAssociation: "NONE", author: { login: "attacker" } }], pageInfo: { hasNextPage: false } }
  });
  const data = await loadLiveRepository("kw7t9rwhny-cyber/league-vector", "secret", { fetchImpl: sequenceFetch(liveSequence(payload)), maxAttempts: 1 });
  assert.equal(data.prs[0].events[0].qa_authorized, false);
});
