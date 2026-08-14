# Development Orchestrator Stage 3B — Controlled Activation v0.1

Status: candidate only; HIGH RISK; not activated on production `main`.

## Scope

This candidate adds the smallest real GitHub mutation surface for Development Orchestrator Stage 3B. One manual `workflow_dispatch` may target exactly one explicitly supplied positive-integer PR number. The only possible writes are Stage-3A-produced `ADD_LABEL` / `REMOVE_LABEL` operations for canonical Stage-1 `status:*` and `owner:*` labels.

There is no queue-wide execution, no fan-out, no schedule, no pull-request event execution, no comment trigger, no merge trigger, no retry loop, and no cascade into another PR.

## Permissions

Preview job:

- `contents: read`
- `pull-requests: read`
- `issues: read`

Execute job only:

- `contents: read`
- `pull-requests: read`
- `issues: write`

GitHub represents pull-request labels through the Issues labels API, so `issues:write` is sufficient for adding/removing PR labels. The candidate does not grant `pull-requests:write`, `contents:write`, `actions:write`, deployments, packages, administration, secrets, or workflow-write permission.

The real adapter exposes only `addLabel` and `removeLabel` beyond inherited read methods. Both reject any label outside the exact Stage-1 status/owner allowlist before issuing a request. It is not a generic GitHub mutation client.

## Activation gates

Live execution requires every existing Stage-3B gate plus a separate Founder control:

1. event is exactly `workflow_dispatch`;
2. repository identity is fetched from the GitHub repository API and exactly matches runtime repository context;
3. repository provenance says `fork === false`;
4. trusted default branch is fetched from repository metadata;
5. `GITHUB_REF`, `GITHUB_REF_TYPE`, and `GITHUB_REF_NAME` exactly identify that trusted default branch;
6. exactly one positive-integer `target_pr_number` is supplied;
7. `LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE=1`;
8. `LEAGUE_VECTOR_STAGE3B_ACTIVATED=1`;
9. separate `LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED=1`;
10. the execute job is assigned to the GitHub Environment `stage3b-controlled-activation`.

Any missing, malformed, conflicting, ambiguous, fork, wrong-event, wrong-ref, wrong-repository, or wrong-branch state denies execution.

### Founder environment requirement

The repository connector used during candidate development cannot configure or verify GitHub Environment protection rules. Therefore this PR deliberately does **not** claim that the protected environment is already configured. Before any future first live test, the Founder must separately configure `stage3b-controlled-activation` with required approval/reviewer protection supported by the repository plan/settings and define the environment-level variable `LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED=1` only inside that protected environment.

If that protection cannot be configured and independently verified, Stage 3B controlled activation must remain disabled. The candidate does not silently substitute a weaker gate.

## Preview-first flow

Every manual invocation first runs a read-only preview. Preview includes:

- target PR;
- current head SHA;
- Stage-2 status/owner/type/risk/priority/recommended action;
- Stage-3A disposition and reason;
- current labels;
- exact proposed add/remove labels;
- QA state and tested SHA;
- Founder work-item state;
- dependency snapshot;
- current main SHA;
- replay fingerprint.

Preview has `authorization:false`. It is evidence only and cannot authorize a mutation.

For `mode=dry-run` (default), the workflow ends after preview/dry-run proof with no job possessing `issues:write`.

For `mode=execute`, the write job is separately blocked behind the protected Founder environment. After approval, it recomputes trusted repository provenance and the complete live Stage-2/Stage-3A plan and requires the new replay fingerprint to equal the preview fingerprint before entering Stage 3B execution.

## One-PR execution contract

`target_pr_number` must match `^[1-9][0-9]*$`. Values such as `all`, `*`, `queue`, lists, ranges, arrays, zero, negatives, decimals, or multiple numbers are rejected. No code path iterates over the Stage-2 queue for mutation. A single invocation constructs and executes only the plan for the one selected PR.

## Full revalidation contract

The existing QA-passed inactive Stage-3B executor remains authoritative. Immediately before each individual label write it re-reads live repository state, rebuilds Stage 2, replans Stage 3A, and verifies the expected remaining mutation suffix. Revalidation covers open state, exact head, replay fingerprint, disposition, mutation set, QA state/tested SHA, dependencies, Founder state, structured metadata, owner/type/promotion state, current main provenance, and expected labels.

If anything changes, execution stops before the next write and attempts rollback only when transaction-owned state remains exactly provable.

## Rollback

Rollback remains reverse-order and concurrency-safe. Before each rollback mutation, the executor re-reads live state and compares a protected snapshot. If it cannot prove that the state is still transaction-owned, rollback stops and reports `failed-or-partial` with `manual_review_required=true`. Human changes are never overwritten merely to restore the transaction.

Ambiguous transport/write outcomes never claim success.

## Audit

Controlled execution output records:

- workflow run ID;
- target PR;
- expected preview fingerprint;
- trusted repository identity;
- trusted default branch;
- fork provenance;
- Founder activation gate state;
- nested Stage-3B audit containing exact head, replay fingerprint, expected-before state/labels, desired-after labels, mutation attempts/completions, every pre-write revalidation, rollback attempts/completions/revalidations, post-write verification, abort reason, and `manual_review_required`.

Tokens and secrets are never written into the audit.

## First live test plan — NOT EXECUTED BY THIS PR

Create a dedicated harmless Orchestrator validation PR containing only documentation/test-fixture material and canonical structured metadata. No football/product code, projection math, Dynasty Value, Rookie, IDP, scoring, Sleeper, identity, replacement, UI, archive, or production asset change may be included.

Safest initial transition: a single canonical **status-label synchronization to `status:ready-for-qa`** for a harmless PR whose structured body is already `status:ready-for-qa` and whose Stage-2 action is `SEND_TO_QA`, while the actual GitHub status label is intentionally absent. Stage 3A should therefore propose exactly one mutation: `ADD_LABEL status:ready-for-qa`. This avoids QA-result creation, Core routing, Founder decision changes, owner routing, promotion, or any production-facing transition.

Required first-test procedure:

1. create the dedicated harmless test PR;
2. independently QA its exact structured state and confirm the one-mutation Stage-3A preview;
3. configure and verify the protected `stage3b-controlled-activation` environment and required Founder approval;
4. run controlled workflow in `dry-run` mode and inspect preview artifact;
5. Founder separately approves the protected environment execution;
6. invoke `mode=execute` for that one PR only;
7. verify exactly one `status:ready-for-qa` label addition and no other repository mutation;
8. rerun dry-run to prove the transaction is now a no-op;
9. retain audit artifact for independent QA.

This PR does not create that test PR and does not perform the mutation.

## Explicit non-capabilities

Controlled Activation v0.1 cannot comment, assign, edit bodies/titles, create issues/PRs/branches, push code, merge, close PRs, approve/request review, deploy, create QA verdicts, change Founder decisions, create promotion work, invoke external services, scan-and-mutate queues, schedule itself, or cascade to another PR.

Stage 3C is out of scope.
