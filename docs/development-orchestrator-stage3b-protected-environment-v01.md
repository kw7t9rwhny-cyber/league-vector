# Development Orchestrator Stage 3B — Protected Environment Activation v0.1

Status: development / QA candidate only. No live mutation is authorized by this document.

## Scope

This layer bridges the already-merged Stage 3B Controlled Activation executor to the GitHub Environment `stage3b-controlled-activation` for one manually dispatched PR transaction only.

It does not add bulk execution, schedules, PR/comment/workflow-run triggers, automatic routing, merge, deployment, assignments, comments, body/title edits, Founder work-item decisions, QA verdict generation, model promotion, Stage 3C, or football/product behavior.

## Founder authorization model

Founder authorization is the admission of the **execute job itself** through the exact protected GitHub Environment `stage3b-controlled-activation`.

The execute job is statically bound to:

```yaml
environment:
  name: stage3b-controlled-activation
```

The Environment has the Founder GitHub account as the required reviewer. GitHub holds that Environment-bound execute job until applicable Environment protection succeeds. Approval authorizes only that pending job for that one manual workflow run; it does not authorize future runs or any Founder-gated football/model/business decision.

No secret, repository variable, organization variable, or generic `secrets.*`/`vars.*` value is Founder authority. The workflow does not read `LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED` or any replacement secret to create authorization.

## Why the secret-source defect is removed

GitHub resolves a `secrets.NAME` expression by scope precedence but does not expose which scope supplied the resolved value. Therefore a generic same-name secret cannot prove Environment provenance.

Stage 3B no longer tries to make that claim. Secret-source provenance is not part of the authorization model. A repository, organization, or Environment secret with the old activation name—present, absent, `1`, or any other value—has no effect on Founder authority because it is not read by the protected workflow or wrapper.

The Environment secret-name inventory remains unobservable to the available GitHub integration (HTTP 403), but that gap is no longer an authorization prerequisite.

## Independently observed live Environment configuration

Core independently observed through the GitHub repository API:

- environment name: `stage3b-controlled-activation`
- required reviewer rule present
- required reviewer: `kw7t9rwhny-cyber`
- `prevent_self_review=false`
- `can_admins_bypass=false`
- custom deployment branch policy enabled
- exactly one deployment branch rule: `main`, type `branch`

No secret value was requested or exposed.

## GitHub guarantees relied upon

League Vector relies on GitHub's protected-Environment execution semantics: a job that references a protected Environment must satisfy the Environment's deployment protection rules before the job proceeds to runner execution. In this configuration, that protection includes the required Founder reviewer and the deployment-branch restriction.

League Vector does **not** rely on GitHub secret precedence as proof of authorization and does not claim secret-source provenance.

## League Vector checks layered on top

After GitHub admits the Environment-bound job, before delegating to the previously QA-approved Controlled Activation executor, the protected wrapper requires:

- `workflow_dispatch`
- exact repository `kw7t9rwhny-cyber/league-vector`
- `GITHUB_REF=refs/heads/main`
- `GITHUB_REF_TYPE=branch`
- `GITHUB_REF_NAME=main`
- exact workflow ref on `refs/heads/main`
- `LEAGUE_VECTOR_ORCHESTRATOR_EXECUTE=1`
- `LEAGUE_VECTOR_STAGE3B_ACTIVATED=1`
- exact Environment binding name `stage3b-controlled-activation`
- live GitHub Environment metadata successfully re-read
- required Founder reviewer still present
- `prevent_self_review=false`
- administrator bypass still disabled
- exactly one deployment branch policy, `main`, type `branch`
- exact preview replay fingerprint
- complete inherited Stage 2 + Stage 3A + Stage 3B revalidation before every write

Any missing or changed gate denies execution.

The protected wrapper creates an internal attestation with source `github-protected-environment-job-admission`. That attestation describes the protected job-admission model; it does not claim that GitHub exposes a cryptographic approval token or secret-source identity.

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

1. Create a dedicated harmless Orchestrator-only test PR after this remediation receives independent HIGH-risk QA PASS.
2. Manually dispatch dry-run for exactly that PR.
3. Preview artifact records target/head/Stage-2 state/Stage-3A disposition/current labels/proposed mutations/QA state/Founder work-item state/dependencies/replay fingerprint.
4. Preview must show exactly one intended canonical mutation: `ADD_LABEL status:ready-for-qa`.
5. Separately dispatch execute mode for the same one PR only when a first-live-test transaction is explicitly authorized.
6. The execute job waits at `stage3b-controlled-activation` for that workflow run's Founder Environment approval.
7. After GitHub admits the protected job, League Vector re-reads live Environment metadata and revalidates preview/Stage 2/Stage 3A/Stage 3B state before each write.

Environment approval authorizes only that one pending job. It does not approve future workflow runs or any Founder-gated product/model/business decision.

## Rollback

The previously QA-approved concurrency-safe rollback contract remains unchanged. Rollback occurs only if exact transaction-owned partial state can still be proven. If human/protected state changed or an ambiguous write cannot be safely reversed, execution stops with `failed-or-partial` and `manual_review_required=true`.

## First live test procedure — design only

Do not create or execute this test during remediation candidate development.

After HIGH-risk QA passes this candidate:

- create a dedicated Orchestrator-only harmless PR
- no football/product/configuration behavior
- canonical structured metadata with `status:ready-for-qa`
- omit the matching GitHub status label intentionally
- dry-run must propose exactly `ADD_LABEL status:ready-for-qa`
- no owner/Core/Founder/QA/promotion transition
- inspect preview exact head and fingerprint
- separately obtain Founder approval to perform the first live controlled transaction

No secret-name verification is required for authorization because secrets are not part of the Founder gate.

## Audit

The protected audit records workflow run ID, target PR input, trusted repository, Founder Environment name, authorization model, live Environment verification result, controlled Stage-3B audit, abort reason, and manual-review requirement. It records `secret_authority=none` and does not emit or consume a Founder activation secret.

## Activation status

This PR is development + QA only. Do not dispatch execute mode, do not create the first-live-test PR, do not mutate a real label, and do not implement Stage 3C.
