# Development Orchestrator Stage 3B — Protected Environment Activation v0.1

Status: development / QA candidate only. No live mutation is authorized by this document.

## Scope

This layer bridges the already-merged Stage 3B Controlled Activation executor to the GitHub Environment `stage3b-controlled-activation` for one manually dispatched PR transaction only.

It does not add bulk execution, schedules, PR/comment/workflow-run triggers, automatic routing, merge, deployment, assignments, comments, body/title edits, Founder work-item decisions, QA verdict generation, model promotion, Stage 3C, or football/product behavior.

## Independently observed live environment configuration

Core independently observed through the GitHub repository API:

- environment name: `stage3b-controlled-activation`
- required reviewer rule present
- required reviewer: `kw7t9rwhny-cyber`
- `prevent_self_review=false`
- `can_admins_bypass=false`
- custom deployment branch policy enabled
- exactly one deployment branch rule: `main`, type `branch`

Core could **not** list environment secret names with the available GitHub integration; the environment-secrets endpoint returned HTTP 403. Therefore this candidate does not claim independent API proof that `LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED` exists. Independent QA must verify the secret **name only** in repository Environment settings before any first live test. The secret value must never be read or exposed.

## GitHub guarantees relied upon

GitHub documents the following Environment semantics:

1. A job referencing an Environment does not proceed to a runner until the Environment's protection rules pass.
2. Environment secrets are only available to jobs that reference that Environment and only after required approval/protection rules pass.
3. When the same secret name exists at organization, repository, and Environment levels, the Environment secret has highest precedence.

League Vector does not treat a generic `vars.*` value as Founder authority.

The execute job is statically bound to:

```yaml
environment:
  name: stage3b-controlled-activation
```

and the activation secret is consumed only inside that job.

## League Vector checks layered on top

Before the protected wrapper delegates to the previously QA-approved Controlled Activation executor it requires:

- `workflow_dispatch`
- exact repository `kw7t9rwhny-cyber/league-vector`
- `GITHUB_REF=refs/heads/main`
- `GITHUB_REF_TYPE=branch`
- `GITHUB_REF_NAME=main`
- exact workflow ref on `refs/heads/main`
- `LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE=1`
- `LEAGUE_VECTOR_STAGE3B_ACTIVATED=1`
- static Environment binding name `stage3b-controlled-activation`
- live GitHub Environment metadata successfully re-read
- required Founder reviewer still present
- administrator bypass still disabled
- exact `main`-only branch policy still present
- post-approval activation secret resolves exactly to `1`
- exact preview replay fingerprint
- then the complete inherited Stage 2 + Stage 3A + Stage 3B revalidation before every write

Any missing or changed gate denies execution.

## Secret-source limitation and pre-live-test requirement

The GitHub API available to Core cannot independently enumerate Environment secret names. Because a lower-scope same-name secret could exist if the Environment secret were absent, the first live test remains blocked until independent QA verifies in the GitHub Environment UI/settings that the Environment secret name `LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED` exists.

Once that name is independently verified, GitHub's documented secret precedence means the Environment secret is the value resolved for the environment-bound job if same-name lower-scope secrets also exist. Lower-scope configuration cannot bypass the Environment approval because the execute job itself cannot start before the Environment protection rules pass.

## Permissions

Workflow-level permissions remain empty.

Preview/dry-run job:

- `contents: read`
- `pull-requests: read`
- `issues: read`

Execute job only:

- `contents: read`
- `pull-requests: read`
- `issues: write`

No `pull-requests:write`, `contents:write`, `actions:write`, `deployments:write`, `packages:write`, administration permission, or `pull_request_target` exists.

`issues:write` is used only because GitHub's Issues Labels API is the API family used for adding/removing labels on PRs/issues.

## One-PR execution contract

A workflow invocation accepts exactly one `target_pr_number` matching the canonical positive decimal grammar. Dry-run remains the default mode. There is no `all`, queue, range, list, wildcard, fan-out, recursive, scheduled, or event-driven execution path.

The only write operations implemented are:

- `ADD_LABEL`
- `REMOVE_LABEL`

for exact canonical Stage-1 `status:*` and `owner:*` labels.

## Preview and approval flow

Intended future live sequence, not executed during candidate development:

1. Founder manually dispatches dry-run for one harmless test PR.
2. Preview artifact records target/head/Stage-2 state/Stage-3A disposition/current labels/proposed mutations/QA state/Founder state/dependencies/replay fingerprint.
3. Preview must show exactly one intended canonical mutation.
4. Founder manually dispatches execute mode for the same one PR.
5. The execute job waits at `stage3b-controlled-activation` for that workflow run's Environment approval.
6. After approval, GitHub starts the environment-bound job and exposes its Environment secrets.
7. League Vector re-reads live Environment metadata and then revalidates preview/Stage 2/Stage 3A/Stage 3B state before each write.

Environment approval authorizes only that one pending job. It does not approve future workflow runs or any Founder-gated product/model/business decision.

## Rollback

The previously QA-approved concurrency-safe rollback contract remains unchanged. Rollback occurs only if exact transaction-owned partial state can still be proven. If human/protected state changed or an ambiguous write cannot be safely reversed, execution stops with `failed-or-partial` and `manual_review_required=true`.

## First live test procedure — design only

Do not create or execute this test during candidate development.

After HIGH-risk QA passes this candidate and the Environment secret name is independently verified:

- create a dedicated Orchestrator-only harmless PR
- no football/product/configuration behavior
- canonical structured metadata with `status:ready-for-qa`
- omit the matching GitHub status label intentionally
- dry-run must propose exactly `ADD_LABEL status:ready-for-qa`
- no owner/Core/Founder/QA/promotion transition
- inspect preview exact head and fingerprint
- separately obtain Founder approval to perform the first live controlled transaction

## Audit

The protected audit records workflow run ID, target PR input, trusted repository, Founder Environment name, secret **name only**, live Environment verification result, controlled Stage-3B audit, abort reason, and manual-review requirement. It explicitly records `secret_value_recorded=false` and never emits secret values or tokens.

## Activation status

This PR is development + QA only. Do not dispatch execute mode, do not create the first-live-test PR, do not mutate a real label, and do not implement Stage 3C.
