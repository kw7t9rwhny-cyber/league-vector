"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  fetchRepositoryIdentityGraphql,
  fetchQaEventsGraphql,
  loadLiveRepositoryGraphql,
  requestJson,
  normalizeRepositoryIdentity
} = require("../scripts/development-orchestrator-github-read-v01.js");

const SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const OWNER = "kw7t9rwhny-cyber";
const REPO = "league-vector";
const IDENTITY = `${OWNER}/${REPO}`;

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

function identityPayload(nameWithOwner = IDENTITY, extra = {}) {
  return { data: { repository: { nameWithOwner, ...extra } } };
}

function gqlPayload(prOverrides = {}, repositoryOverrides = {}) {
  const pr = {
    number: 61,
    headRefOid: SHA,
    comments: { nodes: [{ id: "IC_1", body: `QA PASS — tested head ${SHA}`, createdAt: "2026-08-17T10:00:00Z", author: { login: OWNER }, authorAssociation: "OWNER" }], pageInfo: { hasNextPage: false } },
    reviews: { nodes: [{ id: "PRR_1", body: `QA FAIL — tested head ${SHA}`, submittedAt: "2026-08-17T10:01:00Z", author: { login: OWNER }, authorAssociation: "OWNER" }], pageInfo: { hasNextPage: false } },
    ...prOverrides
  };
  return { data: { repository: { nameWithOwner: IDENTITY, pullRequest: pr, ...repositoryOverrides } } };
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

function validLiveFetch(overrides = {}) {
  const calls = [];
  const fakeFetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === "https://api.github.com/graphql") {
      const body = JSON.parse(options.body || "{}");
      if (String(body.query).includes("LeagueVectorRepositoryIdentity")) {
        return response(200, overrides.identityPayload || identityPayload());
      }
      return response(200, overrides.qaPayload || gqlPayload({ comments: { nodes: [], pageInfo: { hasNextPage: false } }, reviews: { nodes: [], pageInfo: { hasNextPage: false } } }));
    }
    if (url === `https://api.github.com/repos/${OWNER}/${REPO}`) {
      return response(200, overrides.repoMeta || { full_name: IDENTITY, owner: { login: OWNER }, default_branch: "main" });
    }
    if (url.endsWith("/git/ref/heads/main")) return response(200, overrides.mainRef || { object: { sha: SHA } });
    if (url.endsWith("/pulls?state=open&per_page=100")) return response(200, overrides.pulls || [{ number: 61, title: "PR 61", body: "", state: "open", draft: true, head: { sha: SHA }, labels: [] }]);
    throw new Error(`unexpected:${url}`);
  };
  return { fakeFetch, calls };
}

test("repository identity exact requested identity passes", async () => {
  const returned = await fetchRepositoryIdentityGraphql(OWNER, REPO, "token", async () => response(200, identityPayload()), 1);
  assert.equal(returned, IDENTITY);
});

test("repository identity comparison is case-insensitive only", () => {
  assert.equal(normalizeRepositoryIdentity("Owner/Repo"), "owner/repo");
  assert.throws(() => normalizeRepositoryIdentity(" owner/repo"), /malformed/);
  assert.throws(() => normalizeRepositoryIdentity("owner//repo"), /malformed/);
  assert.throws(() => normalizeRepositoryIdentity("owner/repo/extra"), /malformed/);
});

for (const [name, returned] of [
  ["wrong owner", `different-owner/${REPO}`],
  ["correct owner wrong repository name", `${OWNER}/some-other-repository`],
  ["wrong owner correct repository name", `different-owner/${REPO}`]
]) {
  test(`${name} fails closed`, async () => {
    await assert.rejects(() => fetchRepositoryIdentityGraphql(OWNER, REPO, "token", async () => response(200, identityPayload(returned)), 1), /repository_identity_mismatch/);
  });
}

for (const [name, value] of [
  ["missing nameWithOwner", undefined],
  ["null nameWithOwner", null],
  ["non-string nameWithOwner", 123],
  ["malformed nameWithOwner", "owner/repo/extra"],
  ["ambiguous corrupted repository identity", "owner//repo"]
]) {
  test(`${name} fails closed`, async () => {
    const payload = value === undefined ? { data: { repository: {} } } : identityPayload(value);
    await assert.rejects(() => fetchRepositoryIdentityGraphql(OWNER, REPO, "token", async () => response(200, payload), 1), /repository_identity_invalid/);
  });
}

test("missing repository object fails closed before authority metadata", async () => {
  await assert.rejects(() => fetchRepositoryIdentityGraphql(OWNER, REPO, "token", async () => response(200, { data: { repository: null } }), 1), /repository_identity_missing/);
});

test("GraphQL partial identity response with errors fails closed", async () => {
  await assert.rejects(() => fetchRepositoryIdentityGraphql(OWNER, REPO, "token", async () => response(200, { data: { repository: { nameWithOwner: IDENTITY } }, errors: [{ message: "partial" }] }), 1), /repository_identity_errors/);
});

test("old mismatched repository metadata fixture is now rejected", async () => {
  const { fakeFetch } = validLiveFetch({ repoMeta: { full_name: `${OWNER}/some-other-repository`, owner: { login: OWNER }, default_branch: "main" } });
  await assert.rejects(() => loadLiveRepositoryGraphql(IDENTITY, "token", { fetchImpl: fakeFetch, maxAttempts: 1 }), /github_rest_repository_identity_mismatch/);
});

test("REST owner mismatch is rejected even if repository name matches", async () => {
  const { fakeFetch } = validLiveFetch({ repoMeta: { full_name: `different-owner/${REPO}`, owner: { login: "different-owner" }, default_branch: "main" } });
  await assert.rejects(() => loadLiveRepositoryGraphql(IDENTITY, "token", { fetchImpl: fakeFetch, maxAttempts: 1 }), /github_rest_repository_identity_mismatch/);
});

test("successful GraphQL read preserves comment and review authority provenance", async () => {
  const events = await fetchQaEventsGraphql(OWNER, REPO, 61, SHA, "token", [OWNER], async () => response(200, gqlPayload()), 1);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((x) => x.source), ["comment", "review"]);
  assert.equal(events.every((x) => x.qa_authorized), true);
});

test("QA evidence response repository identity mismatch fails closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql(OWNER, REPO, 61, SHA, "token", [OWNER], async () => response(200, gqlPayload({}, { nameWithOwner: `${OWNER}/other` })), 1), /repository_identity_mismatch/);
});

for (const status of [401, 403, 404]) {
  test(`GraphQL HTTP ${status} fails closed without permissive fallback`, async () => {
    await assert.rejects(() => fetchQaEventsGraphql(OWNER, REPO, 61, SHA, "token", [OWNER], async () => response(status, {}), 1), new RegExp(`github_graphql_http_${status}`));
  });
}

test("GraphQL application errors fail closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql(OWNER, REPO, 61, SHA, "token", [OWNER], async () => response(200, { data: { repository: { nameWithOwner: IDENTITY, pullRequest: null } }, errors: [{ message: "denied" }] }), 1), /github_graphql_errors/);
});

test("valid repository plus wrong PR fails closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql(OWNER, REPO, 61, SHA, "token", [OWNER], async () => response(200, gqlPayload({ number: 62 })), 1), /wrong_or_missing_pr/);
});

test("valid repository plus wrong head SHA fails closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql(OWNER, REPO, 61, SHA, "token", [OWNER], async () => response(200, gqlPayload({ headRefOid: OTHER_SHA })), 1), /github_graphql_head_mismatch/);
});

test("valid repository plus unauthorized QA actor remains unauthorized", async () => {
  const payload = gqlPayload({ reviews: { nodes: [{ id: "PRR_ATTACK", body: `QA PASS — tested head ${SHA}`, submittedAt: "2026-08-17T10:01:00Z", author: { login: "attacker" }, authorAssociation: "NONE" }], pageInfo: { hasNextPage: false } }, comments: { nodes: [], pageInfo: { hasNextPage: false } } });
  const events = await fetchQaEventsGraphql(OWNER, REPO, 61, SHA, "token", [OWNER], async () => response(200, payload), 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].qa_authorized, false);
});

test("malformed response fails closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql(OWNER, REPO, 61, SHA, "token", [OWNER], async () => response(200, { data: { repository: { nameWithOwner: IDENTITY, pullRequest: { number: 61, headRefOid: SHA, comments: null, reviews: null } } } }), 1), /malformed_comments/);
});

test("missing review connection fails closed", async () => {
  await assert.rejects(() => fetchQaEventsGraphql(OWNER, REPO, 61, SHA, "token", [OWNER], async () => response(200, gqlPayload({ reviews: null })), 1), /malformed_reviews/);
});

test("empty review collection is valid but invents no verdict", async () => {
  const payload = gqlPayload({ reviews: { nodes: [], pageInfo: { hasNextPage: false } } });
  const events = await fetchQaEventsGraphql(OWNER, REPO, 61, SHA, "token", [OWNER], async () => response(200, payload), 1);
  assert.equal(events.filter((x) => x.source === "review").length, 0);
  assert.equal(events.filter((x) => x.source === "comment").length, 1);
});

test("pagination ambiguity fails closed", async () => {
  const payload = gqlPayload();
  payload.data.repository.pullRequest.reviews.pageInfo.hasNextPage = true;
  await assert.rejects(() => fetchQaEventsGraphql(OWNER, REPO, 61, SHA, "token", [OWNER], async () => response(200, payload), 1), /reviews_pagination_required/);
});

test("repository snapshot proves identity before trusting metadata and binds PR head", async () => {
  const { fakeFetch, calls } = validLiveFetch();
  const snapshot = await loadLiveRepositoryGraphql(IDENTITY, "token", { fetchImpl: fakeFetch, authorizedQaAuthors: [OWNER], maxAttempts: 1 });
  assert.equal(snapshot.source, "live-github-read-only");
  assert.equal(snapshot.repository_identity, IDENTITY);
  assert.equal(snapshot.main_sha, SHA);
  assert.equal(snapshot.prs[0].number, 61);
  assert.equal(snapshot.prs[0].head_sha, SHA);
  assert.equal(calls[0].url, "https://api.github.com/graphql");
  assert.match(String(calls[0].options.body), /LeagueVectorRepositoryIdentity/);
});

for (const status of [401, 403, 404]) {
  test(`identity GraphQL HTTP ${status} fails closed before REST authority reads`, async () => {
    const calls = [];
    await assert.rejects(() => loadLiveRepositoryGraphql(IDENTITY, "token", { fetchImpl: queueFetch([response(status, {})], calls), maxAttempts: 1 }), new RegExp(`github_graphql_http_${status}`));
    assert.equal(calls.length, 1);
  });
}

test("REST 401 fails closed after proven GraphQL identity", async () => {
  const fakeFetch = queueFetch([response(200, identityPayload()), response(401, {})]);
  await assert.rejects(() => loadLiveRepositoryGraphql(IDENTITY, "token", { fetchImpl: fakeFetch, maxAttempts: 1 }), /github_rest_http_401/);
});

test("rate-limited 403 remains distinct and fail closed", async () => {
  const fakeFetch = queueFetch([response(200, identityPayload()), response(403, {}, { "x-ratelimit-remaining": "0" })]);
  await assert.rejects(() => loadLiveRepositoryGraphql(IDENTITY, "token", { fetchImpl: fakeFetch, maxAttempts: 1 }), /github_rest_rate_limited_403/);
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

test("exhausted 5xx retry fails closed", async () => {
  const calls = [];
  await rejectsMessage(() => requestJson("https://api.github.com/example", "token", { fetchImpl: queueFetch([response(504, {}), response(504, {})], calls), maxAttempts: 2, prefix: "github_rest" }), "github_rest_http_504:https://api.github.com/example");
  assert.equal(calls.length, 2);
});

test("exhausted 429 retry fails closed", async () => {
  const calls = [];
  await rejectsMessage(() => requestJson("https://api.github.com/example", "token", { fetchImpl: queueFetch([response(429, {}), response(429, {})], calls), maxAttempts: 2, prefix: "github_rest" }), "github_rest_http_429:https://api.github.com/example");
  assert.equal(calls.length, 2);
});

test("GraphQL transient 5xx retry remains bounded", async () => {
  const calls = [];
  const events = await fetchQaEventsGraphql(OWNER, REPO, 61, SHA, "token", [OWNER], queueFetch([response(503, {}), response(200, gqlPayload())], calls), 2);
  assert.equal(events.length, 2);
  assert.equal(calls.length, 2);
});

test("open PR pagination ambiguity fails closed", async () => {
  const pulls = Array.from({ length: 100 }, (_, index) => ({ number: index + 1, title: `PR ${index + 1}`, body: "", state: "open", draft: false, head: { sha: SHA }, labels: [] }));
  const fakeFetch = queueFetch([
    response(200, identityPayload()),
    response(200, { full_name: IDENTITY, owner: { login: OWNER }, default_branch: "main" }),
    response(200, { object: { sha: SHA } }),
    response(200, pulls)
  ]);
  await assert.rejects(() => loadLiveRepositoryGraphql(IDENTITY, "token", { fetchImpl: fakeFetch, maxAttempts: 1 }), /open_pr_pagination_required/);
});
