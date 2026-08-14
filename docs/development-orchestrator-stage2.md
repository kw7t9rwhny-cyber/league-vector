# Development Orchestrator Stage 2 — queue discovery / handoff automation

Stage 2 is a deterministic, read-only GitHub discovery layer. It does not replace the Stage 1 work-item state machine; it consumes Stage 1 metadata plus live GitHub PR heads and canonical QA verdicts to answer what needs QA, Core, remediation, Founder review, or more research.

## Security boundary

Stage 2 has only:

- `contents: read`
- `pull-requests: read`
- `issues: read`

It does **not** use `pull_request_target` and does not mutate labels, assignees, comments, branches, PRs, merges, deployments, Founder decisions, paid services, legal/business state, or production-model promotion. Handoff generation is text only.

## Live GitHub adapter

`scripts/development-orchestrator-v02.js` reads the repository default-branch SHA, open pull requests, PR bodies/labels, issue comments, and review bodies through the GitHub REST API using the read-only `GITHUB_TOKEN`.

Operational truth comes from live GitHub state. `docs/command-center-status.json` remains a non-operational schema example with `operational:false` and is never consumed as current state.

The adapter derives:

- PR number/title
- exact current head SHA
- declared candidate SHA when an exact candidate form is present
- complete Stage 1 metadata when explicitly supplied
- canonical QA PASS/FAIL events, including GitHub event identifiers when available
- dependency IDs
- Founder gate/decision fields
- draft/open state

No missing field is inferred.

## Canonical QA verdict freshness

Only an exact line matching either of these counts:

`QA PASS — tested head <40-char SHA>`

`QA FAIL — tested head <40-char SHA>`

Verdicts are resolved independently for each exact tested SHA. A PASS is fresh only when its tested SHA equals the current PR head. A provably later current-head FAIL defeats an earlier current-head PASS. A provably later current-head PASS may supersede an earlier FAIL when the timestamp ordering is authoritative and the exact-SHA contract is otherwise satisfied. A commit after a PASS makes the previous PASS stale automatically. Malformed PASS language or comments without an exact tested SHA do not authorize anything.

GitHub comment/review timestamps can have insufficient resolution to prove ordering. Therefore, if the latest timestamp for one exact SHA contains both canonical PASS and canonical FAIL evidence, Stage 2 reports that SHA as `conflicted`. It does not use API array order, source ordering, or event identifiers to guess which verdict came later. A conflicted verdict is invalid QA evidence, cannot satisfy Stage 1's PASS requirement, cannot enter Core, is routed to remediation/owner review, and is displayed as conflicted in machine-readable status and text handoffs. Duplicate PASS events or duplicate FAIL events at the same timestamp do not create a false conflict. Conflicting verdicts on another SHA do not contaminate the current head.

GitHub event identifiers are retained for deterministic provenance where available, but identifiers are not treated as proof of temporal precedence when timestamps are tied.

## Structured versus legacy items

A work item is operationally structured only when the Stage 1 metadata fields are present explicitly:

- owner
- risk
- status
- type
- priority
- integration required
- promotion type
- promotion authorized
- Founder decision required
- Founder gate
- Founder decision
- dependencies

Legacy PRs may still contain prose such as `READY FOR QA`, `MORE RESEARCH REQUIRED`, or historical QA comments. Stage 2 can expose those signals as **legacy observations**, but they do not enter canonical QA/Core/Founder queues and cannot authorize boundary transitions. Missing metadata fails closed.

This is intentional during migration: old PRs do not become trusted merely because their prose resembles the new contract.

## Queues

### QA

Structured open items at `status:ready-for-qa` without a fresh PASS and without a current-head FAIL/conflict. Output includes current/declared SHA, SHA match, newest verdict, stale/fresh/conflicted state, dependencies, Founder state, and recommended QA depth.

### Core

Structured items are included only when Stage 1 `coreEligible()` succeeds: fresh exact-SHA QA PASS, integration required, dependencies satisfied, raw-research firewall satisfied, promotion authorization satisfied, and Founder approval satisfied when required. Conflicted QA evidence never satisfies this gate.

### Remediation

Structured current-head QA FAIL or conflicted items, plus `status:qa-failed`. A FAIL on an older SHA does not automatically remediate a newer candidate; the moved head is treated as needing fresh QA instead.

### Founder

Structured `status:waiting-founder` items with a decision still required. Routine engineering work is excluded.

### Research

Structured raw research work remains research-only regardless of `integration_required`. Research never enters Core without a separate non-research promotion/integration item under the Stage 1 contract.

### Legacy

Open items missing canonical Stage 1 fields. Observed prose state is advisory only and cannot authorize actions.

## Safe recommended actions

Stage 2 can emit only advisory text:

- `SEND_TO_QA`
- `RETURN_TO_OWNER`
- `READY_FOR_CORE_REVIEW`
- `WAITING_ON_FOUNDER`
- `BLOCKED_DEPENDENCY`
- `MORE_RESEARCH_REQUIRED`
- `NO_ACTION`

No action is executed.

## CLI

Live mode requires `GITHUB_REPOSITORY` and a read-only `GITHUB_TOKEN`:

```bash
node scripts/development-orchestrator-v02.js status
node scripts/development-orchestrator-v02.js status --json
node scripts/development-orchestrator-v02.js queue qa --json
node scripts/development-orchestrator-v02.js queue core --json
node scripts/development-orchestrator-v02.js queue remediation --json
node scripts/development-orchestrator-v02.js queue founder --json
node scripts/development-orchestrator-v02.js queue research --json
node scripts/development-orchestrator-v02.js handoff 32
```

Fixture mode is available for deterministic tests with `--fixture <path>`.

`handoff` produces text only: target PR, current SHA, owner/risk/status, QA freshness/conflict state, dependencies, Founder gate, and safe recommended next action. Legacy items include an explicit fail-closed warning and list missing metadata.

## Dogfood expectations for the current repository

Stage 2 is deliberately expected to classify many currently open League Vector PRs as legacy/unstructured because they predate Stage 1. Examples observed during development include current IDP missing-stat research, Rookie→Year-2 research, older projection research, and superseded integration/release PRs. Their prose can be surfaced, but canonical queue eligibility remains closed until they carry complete Stage 1 metadata.

This is preferable to silently converting legacy prose into operational authorization.

## Rollout toward Stage 3

Stage 2 is read-only and advisory. Stage 3 may eventually generate an operational Command Center status document and may introduce tightly controlled GitHub state/handoff mutations. Stage 3 is **not implemented here**.

Any Stage 3 write capability requires separate Founder authorization and independent QA. Before automated research-promotion item creation is ever introduced, creation-time provenance must explicitly bind the promotion item to validated research evidence/dependencies, preserving the retained Stage 1 P2 hardening requirement.
