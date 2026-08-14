# Development Orchestrator Stage 3B v0.3 — guarded label executor

Stage 3B introduces **future** capability to execute the narrow status/owner-label mutations produced by QA-approved Stage 3A plans. This candidate remains **inactive and completely read only in checked-in GitHub Actions**. It contains no real GitHub write adapter.

## Foundation

Stage 3B builds on merged Stage 3A. The authority chain remains:

`Stage 2 live state -> Stage 3A deterministic plan -> Stage 3B full live revalidation -> allowlisted label transaction`

Stage 3B never independently decides what should happen and never treats a cached Stage-3A plan as a reusable authorization token.

## Mutation allowlist

The executor understands only exact `ADD_LABEL` and `REMOVE_LABEL` operations for exact canonical Stage-1 `status:*` and `owner:*` labels. Case variants, whitespace variants, Unicode lookalikes, unknown labels, unknown operations and arbitrary repository labels fail closed before any adapter write.

## Full revalidation before every write

Immediately before **every individual mutation**, Stage 3B performs the complete authority pipeline again:

1. re-fetch the live repository/PR state;
2. rebuild the full Stage-2 normalized work item and dependency graph;
3. rerun Stage-3A `planItem()` against that fresh state;
4. recompute Stage-3A provenance/replay fingerprint;
5. independently construct the transaction's expected intermediate repository state from the original authorized snapshot plus only Stage 3B's already-completed mutations;
6. rerun Stage 2 and Stage 3A over that expected intermediate state;
7. require the fresh live plan/provenance to equal the expected intermediate plan/provenance;
8. require the fresh mutation list to equal the exact remaining suffix of the originally authorized mutation list.

This revalidates PR open state, exact candidate head SHA, all structured/singleton metadata, canonical owner, type, status, risk, priority, integration requirement, promotion type/authorization, Founder requirements/gate/decision, authenticated QA evidence/state/tested SHA, dependency IDs **and dependency status/head/QA snapshots**, current main SHA, relevant labels, replay fingerprint, fresh disposition and exact remaining mutations.

Any difference stops before the next write. There is no downstream route continuation after an abort.

## Transaction model

A transaction records an immutable initial authorized repository snapshot, expected-before state, desired-after Orchestrator-label state and the original Stage-3A mutation sequence.

For each operation:

1. perform the full revalidation above;
2. record the revalidation result;
3. apply exactly one allowlisted operation through the injected adapter;
4. treat only a clearly successful adapter return as completed;
5. repeat from a fresh repository read for the next operation.

A server-applied/client-error ambiguity is never reported as success. If the executor cannot prove what happened, the transaction is `failed-or-partial` and requires manual review.

## Concurrency-safe rollback

Rollback is **not** automatic authority to mutate.

Before every inverse operation Stage 3B re-fetches live state, reconstructs the exact expected partial transaction state, verifies exact head/open state, all protected structured metadata, singleton-conflict state, QA evidence, Founder state, dependency snapshots and the exact Stage-3B-owned Orchestrator label effect. Same/conflicting Orchestrator human changes, head/QA/Founder/dependency races, ambiguous state or unverifiable post-state stop rollback and force `failed-or-partial` with `manual_review_required=true`.

Unrelated non-Orchestrator labels may coexist with a provably safe rollback because rollback protection never overwrites unrelated labels.

## Activation trust boundary

Stage 3B v0.3 separates **trusted repository provenance** from **runtime/environment assertions**.

### Trusted provenance

For a future execute path, repository authority must be obtained independently through the injected adapter's `readActivationProvenance(repository)` contract. The checked-in `GitHubReadOnlyAdapter` implements this as a read-only call to GitHub's repository metadata API and returns only:

- provenance source: `github-repository-api`;
- canonical `repository_full_name`;
- actual repository `default_branch`;
- actual repository `fork` boolean.

These are authorization facts. They cannot be replaced by caller-supplied environment variables.

Trusted provenance fails closed if the provenance object is missing, the source is missing, repository identity is malformed or differs from the requested repository, default branch is missing/empty/malformed, or fork state is not an actual boolean.

### Runtime/environment assertions

The following remain execution-context observations, not repository authority:

- `GITHUB_REPOSITORY`;
- `GITHUB_EVENT_NAME`;
- `GITHUB_REF`;
- `GITHUB_REF_TYPE`;
- `GITHUB_REF_NAME`;
- `GITHUB_DEFAULT_BRANCH` if present;
- `GITHUB_HEAD_REPO_FORK` if present;
- the explicit Stage-3B request/activation flags.

Runtime values can restrict execution but cannot create trusted repository facts. If runtime repository/default/fork assertions conflict with independently trusted repository provenance, execution is denied. Malformed fork assertions are denied. Missing required runtime event/ref/repository context is denied.

## Exact default-branch authentication

Execute eligibility requires all of:

- explicit execute request;
- explicit Stage-3B activation flag;
- valid trusted repository provenance;
- runtime repository identity matching the trusted repository;
- event exactly `workflow_dispatch`;
- `GITHUB_REF === refs/heads/<trusted default branch>`;
- `GITHUB_REF_TYPE === branch`;
- `GITHUB_REF_NAME === <trusted default branch>`;
- trusted repository fork state exactly `false`;
- no conflicting runtime default-branch or fork assertion.

Therefore `GITHUB_DEFAULT_BRANCH=feature` cannot authorize `refs/heads/feature` when GitHub repository metadata says the default branch is `main`. A tag named `main`, another branch, push, schedule, pull request, missing trusted default-branch provenance, malformed trusted branch data or conflicting event/runtime metadata all fail closed.

## Non-fork authentication

Non-fork authority comes only from the independently fetched trusted repository `fork` boolean. Missing, string-valued, malformed or otherwise unknown fork provenance fails closed. A caller assertion such as `GITHUB_HEAD_REPO_FORK=false` can never override trusted `fork=true`; conflicts deny execution.

Pull-request execution remains forbidden because execute eligibility requires `workflow_dispatch`. A future same-repository default-branch manual dispatch is eligible only in mocked/test execution after every other gate succeeds; this candidate still has no real write adapter.

## Current zero-write boundary

This candidate exposes only `GitHubReadOnlyAdapter`. It can re-read live repository state and read GitHub repository metadata. There is **no** real `addLabel`/`removeLabel` GitHub adapter checked in.

Workflow permissions remain exactly:

- `contents: read`
- `pull-requests: read`
- `issues: read`

There is no `pull_request_target`, no `issues:write`, no `pull-requests:write`, no `contents:write`, and no `actions:write`.

The checked-in workflow never invokes Stage 3B with `--execute` and never sets either activation flag to `1`.

Stage 3B does not comment, assign, create PRs/branches, merge, deploy, make Founder decisions, promote models/research, invoke paid services, modify Prospective Archive data or modify production football behavior.

## Preserved authority

Stage 3B continues to inherit and re-evaluate authenticated verdict-only QA evidence, exact-SHA freshness, stale/head-movement invalidation, same-timestamp conflicting QA fail-closed behavior, canonical owner and duplicate-singleton metadata contracts, raw-research/Core firewall, explicit promotion boundary, Founder gates, dependency blocking, malicious GitHub prose inertness and deterministic Stage-3A replay provenance.

## Audit output

Audit records include executor version/mode, PR/head/fingerprint, expected-before and desired-after states, the sanitized activation-gate decision/provenance classification, mutations attempted/completed, per-write revalidation results, rollback attempts/completions, rollback revalidation results, manual-review requirement, post-write verification and abort reason. Tokens/secrets are never included.

## Adversarial coverage

In addition to the previously passing two-mutation transaction and rollback race suite, Stage 3B v0.3 explicitly tests:

- untrusted environment attempting to redefine the trusted default branch;
- trusted default branch differing from environment assertions;
- trusted default branch missing, empty or malformed;
- tag named `main`;
- trusted non-fork provenance;
- trusted fork provenance;
- missing or malformed trusted fork provenance;
- untrusted non-fork assertion conflicting with trusted fork state;
- malformed fork assertions;
- missing trusted provenance adapter/object;
- trusted repository identity conflict;
- runtime repository identity conflict/missing context;
- fork pull-request context;
- valid same-repository default-branch `workflow_dispatch` in the mock executor only.

All prior full per-write Stage-2/Stage-3A replan, exact remaining mutation suffix, current-main/dependency-status/singleton metadata race, raw-research, authenticated QA, Founder, rollback, ambiguous-write, idempotency, canonical-label and deterministic-audit tests remain required.

## Activation boundary

Even after QA and merge, this Stage-3B architecture remains inactive because there is no real write adapter and no write permission. A future activation requires a separate Founder-authorized, exact-SHA independently QA-reviewed candidate. Stage 3C is not implemented or authorized here.

This document describes the inactive architecture under HIGH-risk QA. It does not authorize Stage 3B execution or Stage 3C.
