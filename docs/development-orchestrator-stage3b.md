# Development Orchestrator Stage 3B v0.2 — guarded label executor

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

Before every inverse operation Stage 3B:

- re-fetches live state;
- reconstructs the exact expected partial transaction state;
- verifies exact head and open state;
- verifies all protected structured metadata, singleton-conflict state, QA evidence, Founder state and dependency snapshots;
- verifies the current Orchestrator status/owner labels exactly match the state Stage 3B itself should have produced;
- verifies the label effect being inverted is still present/absent exactly as expected;
- refuses rollback if a same-label or conflicting Orchestrator human change occurred.

Unrelated non-Orchestrator labels may coexist with a provably safe rollback because rollback protection compares the authority state and Orchestrator-owned transaction labels rather than overwriting unrelated labels.

After every inverse operation, Stage 3B re-reads again and verifies the protected post-state. If any rollback precondition or postcondition cannot be proven, rollback stops, `manual_review_required=true`, and the executor reports `failed-or-partial`. It never guesses or overwrites concurrent human state.

## Exact default-branch authentication

The mocked/test execute path requires all of:

- `LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE=1`;
- `LEAGUE_VECTOR_STAGE3B_ACTIVATED=1`;
- GitHub event exactly `workflow_dispatch`;
- repository default-branch provenance supplied as `GITHUB_DEFAULT_BRANCH`;
- `GITHUB_REF === refs/heads/<default branch>`;
- `GITHUB_REF_TYPE === branch`;
- `GITHUB_REF_NAME === <default branch>`;
- non-fork execution.

A tag named `main`, another branch, push, schedule, pull request, missing activation/request flag, missing default-branch provenance or fork execution all fail closed.

The checked-in workflow never supplies the activation flags as `1` and never invokes Stage 3B with `--execute`.

## Current zero-write boundary

This candidate still exposes only `GitHubReadOnlyAdapter`, which can re-read live repository state. There is **no** real `addLabel`/`removeLabel` GitHub adapter checked in.

Workflow permissions remain exactly:

- `contents: read`
- `pull-requests: read`
- `issues: read`

There is no `pull_request_target`, no `issues:write`, no `pull-requests:write`, no `contents:write`, and no `actions:write`.

Stage 3B does not comment, assign, create PRs/branches, merge, deploy, make Founder decisions, promote models/research, invoke paid services, modify Prospective Archive data or modify production football behavior.

## Preserved authority

Stage 3B continues to inherit and re-evaluate:

- authenticated verdict-only QA evidence;
- exact-SHA freshness and stale/head-movement invalidation;
- same-timestamp conflicting QA fail-closed behavior;
- canonical owner and duplicate-singleton metadata contracts;
- raw-research/Core firewall and explicit promotion boundary;
- Founder pending/rejected/approved semantics;
- dependency blocking;
- malicious GitHub prose inertness;
- deterministic Stage-3A replay provenance.

## Audit output

Audit records include executor version/mode, PR/head/fingerprint, expected-before and desired-after states, mutations attempted/completed, per-write revalidation results, rollback attempts/completions, rollback revalidation results, manual-review requirement, post-write verification and abort reason. Tokens/secrets are never included.

## Adversarial coverage

The test suite includes two-mutation transactions where, after mutation 1, each of the following independently changes: type to research, body owner, duplicate Owner metadata, duplicate Founder metadata, Founder decision, promotion metadata, status/risk/integration metadata, dependency **status** with unchanged dependency IDs, authenticated QA PASS to FAIL, QA conflict, candidate head SHA, current main SHA, relevant Orchestrator labels, fresh Stage-3A disposition and remaining mutation list. Mutation 2 must never execute in every case.

Rollback tests cover unrelated human labels, same/conflicting Orchestrator status changes, head movement, QA/Founder/dependency changes and ambiguous server-applied writes. Unsafe rollback always becomes `failed-or-partial` with manual review required.

## Activation boundary

Even after QA and merge, this Stage-3B architecture remains inactive because there is no real write adapter and no write permission. A future activation requires a separate Founder-authorized, exact-SHA independently QA-reviewed candidate. Stage 3C is not implemented or authorized here.
