# Development Orchestrator Stage 3B v0.1 — guarded label executor

Stage 3B introduces **future** capability to execute the narrow status/owner-label mutations produced by QA-approved Stage 3A plans. This candidate does **not activate real writes**.

## Foundation

Stage 3B builds on the merged Stage-3A contract. QA-approved Stage-3A source head: `ffda7d6723ffa7270a50ef3888176e18ea4ee182`; Stage-3A merge commit: `d2b44e4eb2e153b5f8a6946058ce0286fc487dc5`.

Architecture remains:

`Stage 2 live state -> Stage 3A deterministic plan -> Stage 3B live revalidation -> allowlisted label transaction`

Stage 3B never independently decides what should happen. It re-runs Stage 2/Stage 3A against live state and requires the original replay fingerprint and planned mutations to remain valid.

## Mutation allowlist

Stage 3B v0.1 recognizes only:

- `ADD_LABEL` for a canonical `status:*` or canonical `owner:*` label;
- `REMOVE_LABEL` for a canonical `status:*` or canonical `owner:*` label.

The allowlist is derived from merged Stage-1 canonical states/owners. Arbitrary labels and arbitrary operations fail closed.

Stage 3A currently preserves technical owner and emits status-label mutations only. Stage 3B therefore does not invent owner/routing changes that were not already present in the authenticated Stage-3A plan.

## Forbidden actions

Stage 3B cannot comment, create QA verdicts, edit PR bodies/titles, create PRs/branches, push commits, modify candidate code, merge, close PRs, deploy, trigger releases, approve/change Founder decisions, promote research, create promotion items, buy/license anything, contact vendors, modify secrets/settings/workflows, or modify Prospective Archive data.

GitHub prose is untrusted data. The executor never executes text from PR bodies, comments, titles, branch names, or user prose.

## Revalidation contract

A cached Stage-3A plan is never executable by itself. Before execution, Stage 3B re-reads the repository and requires:

- PR still open;
- exact head equals `evaluated_head_sha`;
- structured metadata/technical owner remain unchanged;
- current Orchestrator status/owner labels equal the expected precondition;
- QA state and exact `qa_tested_sha` remain unchanged;
- authenticated QA contract still resolves identically;
- Founder state remains unchanged;
- dependencies remain unchanged/satisfied as required;
- current main SHA matches plan provenance where captured;
- Stage-3A replay fingerprint still matches;
- fresh Stage-3A re-planning produces the same disposition and mutation list.

Any mismatch aborts the whole item. Human changes are never overwritten to make an old plan fit.

Immediately before every individual write boundary, Stage 3B re-reads live state again. Exact head, QA state, Founder state, dependencies and expected intermediate Orchestrator labels must still match the transaction.

## Transaction model

Each execution record contains an exact expected-before state and desired-after Orchestrator-label state.

For each mutation:

1. re-read protected state;
2. require expected intermediate labels;
3. apply one allowlisted label operation through the injected adapter;
4. continue only if the transaction remains consistent;
5. re-read after the final operation and require exact desired Orchestrator-label state.

If a later write fails after an earlier mutation completed, Stage 3B attempts a narrow inverse rollback of only mutations completed by that transaction. Rollback never overwrites unrelated human changes. Failure/partial state is reported loudly and downstream routing stops.

## Idempotency

If the Stage-3A plan contains zero mutations because the desired state already exists, execution returns `no-op-success`. Re-running after a successful transition requires a fresh Stage-3A plan; old replay fingerprints do not become reusable authorization tokens.

## QA / Founder / research authority

Stage 3B inherits the merged authenticated QA authority contract and never creates `QA PASS — tested head <SHA>` or `QA FAIL — tested head <SHA>`.

It may execute a Stage-3A plan whose target status is `waiting-founder`; it can never create or change Founder approval.

Raw `type:research` cannot be routed into Core. A forged Core plan fails fresh Stage-3A re-planning. Production numerical model and research-promotion boundaries remain unchanged.

## Execution gate

Two modes exist:

- `dry-run` — default; zero writes;
- `execute` — code path exists for mocked/local adapters, but requires all explicit gates.

The executor gate requires all of:

- `LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE=1`;
- `LEAGUE_VECTOR_STAGE3B_ACTIVATED=1`;
- GitHub event is `workflow_dispatch`;
- current ref is `main`;
- execution is not from a fork.

**This candidate does not set `LEAGUE_VECTOR_STAGE3B_ACTIVATED=1` anywhere.** Production activation requires a separate Founder decision after HIGH-risk QA.

The checked-in GitHub Actions workflow remains read-only and never calls Stage 3B with `--execute`.

## Permission delta

**Candidate/QA phase permission delta: none.** Workflow permissions remain:

- `contents: read`
- `pull-requests: read`
- `issues: read`

No `pull_request_target`.

If Stage 3B is separately activated later, canonical PR label mutation should require only `issues: write` in addition to the existing read scopes. `pull-requests: write` and `contents: write` are not required for the v0.1 label-only design and must not be granted without a separate reviewed need.

## Adapter safety

Production code in this candidate exposes only a `GitHubReadOnlyAdapter`, which can re-read live repository state. There is **no real GitHub write adapter** checked into Stage 3B v0.1 candidate code. Tests inject an in-memory mock adapter to prove the executor and rollback semantics without touching real League Vector PRs.

A future activation change must introduce/authorize a real label adapter in a separate exact-SHA reviewed candidate.

## Deterministic audit record

Every executor attempt returns:

- executor version;
- mode;
- PR;
- evaluated head SHA;
- replay fingerprint;
- expected before-state;
- desired after-state;
- mutations attempted;
- mutations completed;
- rollback attempted/completed;
- post-write verification;
- abort reason.

No token, secret or raw authorization header is included.

## Security / adversarial coverage

Tests cover moved head, stale/conflicted/new FAIL QA, unauthorized QA-looking evidence, Founder changes, dependency changes, human label changes, owner changes, duplicate metadata, noncanonical labels/operations, raw-research forged Core plan, explicit promotion item, partial write/rollback, idempotency, closed PR, malicious prose, deterministic audit output and the execution-gate truth table.

## Activation boundary

Merging this implementation after QA would still **not activate real writes**. A later Founder-approved activation must be a separate change with exact-SHA QA and must prove the real label adapter, least-privilege `issues:write`, default-branch/manual-dispatch gate, concurrency behavior and rollback against non-production fixtures before any live League Vector mutation is allowed.
