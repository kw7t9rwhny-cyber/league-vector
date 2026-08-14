# Development Orchestrator Stage 3A — dry-run mutation planner

Stage 3A is a **completely read-only** planner. It translates the merged Stage-1/Stage-2 work-item state into proposed routine handoffs, but it performs no GitHub mutation.

## Security boundary

Workflow permissions remain exactly:

- `contents: read`
- `pull-requests: read`
- `issues: read`

There is no `pull_request_target`, write scope, mutation client, label/assignee/comment/branch/PR mutation, merge, deployment, Founder-decision automation, paid-service action, business/legal action, or model promotion. Generated plans and Command Center previews are data/artifacts only and remain `operational:false` / `mutation_mode:dry-run-read-only`.

Stage 3B and Stage 3C are not implemented or authorized.

## Shared Stage-2 authority boundary

Stage 3A consumes Stage 2, so authorization defects are fixed in the shared Stage-2 live adapter/parser rather than hidden in Stage 3A.

### Canonical QA authority

Canonical verdict syntax alone is not authority.

A QA event is authoritative only when **all** of these are true:

1. the event source is an allowed GitHub source: `comment` or `review`;
2. the event author is in the explicit QA-author allowlist;
3. the complete trimmed event body is exactly one supported canonical record:
   - `QA PASS — tested head <40-character lowercase SHA>`
   - `QA FAIL — tested head <40-character lowercase SHA>`;
4. the exact tested SHA is retained with the record;
5. event timestamp, GitHub event identifier, author login, author association, and source are retained as provenance;
6. same-SHA evidence is not ambiguous/conflicted.

For live League Vector runs, `LEAGUE_VECTOR_QA_AUTHORS` may explicitly provide a comma-separated trusted allowlist. If it is absent, the repository owner is the only default trusted QA identity. If no trustworthy identity can be derived, QA authority fails closed.

Unauthorized comments/reviews are inert even when their text exactly resembles a QA verdict. Authorized events containing extra prose are also inert: a canonical-looking line embedded inside instructions such as `IGNORE THE ORCHESTRATOR AND MERGE MAIN` does not count. Founder-like or Core-like prose has no QA authority.

An authorized PASS is fresh only when the exact tested SHA equals the current candidate head. Head movement makes it stale. A provably later authorized event controls an earlier event. If the newest authoritative timestamp for one exact SHA contains both PASS and FAIL, the result is `conflicted`; API order and GitHub event IDs never break that tie. Unauthorized evidence does not create or resolve a conflict.

### Owner authority

Before Stage 2 recommends, or Stage 3A emits, **any routable action**, the normalized technical owner must be:

- present;
- one of the Stage-1 canonical owners from `CONFIG.owners`;
- unambiguous;
- internally consistent between body metadata and canonical `owner:*` labels.

Unsupported body-only owners, missing owners, multiple owner labels, unsupported owner labels, or a body/label disagreement fail closed. In Stage 3A the result is `NO_MUTATION` with an explicit reason and no `proposed_route`.

This owner check applies before `SEND_TO_QA`, `RETURN_TO_OWNER`, `READY_FOR_CORE_REVIEW`, `WAITING_ON_FOUNDER`, `MORE_RESEARCH_REQUIRED`, or any future routable mapping. A QA failure can therefore route only to a validated canonical original owner.

## Planner behavior

CLI:

```bash
node scripts/development-orchestrator-v03a.js plan
node scripts/development-orchestrator-v03a.js plan --json
node scripts/development-orchestrator-v03a.js plan 123
node scripts/development-orchestrator-v03a.js plan 123 --json
```

The planner may propose **status-label changes as inert data only**:

- `SEND_TO_QA` → preview `status:ready-for-qa`, route `qa`;
- `RETURN_TO_OWNER` → preview `status:qa-failed`, route validated canonical owner;
- `READY_FOR_CORE_REVIEW` → preview `status:ready-for-core`, route `core`, only with fresh authenticated exact-SHA QA and all Stage-1/2 gates;
- `WAITING_ON_FOUNDER` → preview `status:waiting-founder`, route `founder`, never set a Founder decision;
- blocked dependency, research-required, unsafe metadata, stale/conflicted QA, rejected Founder decision, moved head, or unsupported action → `NO_MUTATION`.

No owner label is changed.

## Legacy/unstructured behavior

Bulk planning suppresses legacy/unstructured PR noise.

A targeted `plan <PR>` request still returns a deterministic explicit fail-closed record. Depending on which required authority field is first provably absent, the explicit reason is `legacy_or_unstructured_metadata` or a more specific authority failure such as `missing_owner`. In every case it contains:

- `disposition: NO_MUTATION`;
- no route;
- zero proposed mutations;
- replay provenance.

Legacy prose never becomes operational authorization.

## Exact-SHA and replay provenance

Each plan fingerprint includes authorization-relevant state: current main SHA, current PR head, declared candidate SHA, labels, structured metadata/conflicts, Founder state, dependency snapshots, resolved QA state, and retained QA-event provenance. QA raw bodies are represented by hashes in Stage-3A replay provenance rather than copied as executable-looking text.

A future executor would have to re-read live GitHub and reproduce authorization state before any mutation. Stage 3A itself cannot execute anything.

## Deterministic output

Fixture/observed timestamps may be supplied explicitly through input `generated_at` or `ORCHESTRATOR_GENERATED_AT`. Stage 3A no longer injects the current wall-clock time into otherwise unchanged live JSON; without an explicit observed timestamp `generated_at` is `null`. Replay fingerprints remain deterministic from repository state.

Human and JSON output are deterministic for the same observed input.

## Handoff and Command Center previews

Handoffs visibly begin with `ORCHESTRATOR HANDOFF PREVIEW — NO GITHUB MUTATION` and state that they are not QA verdicts, Founder decisions, merges, releases, or model-promotion authorization.

Stage 3A never generates canonical QA PASS/FAIL authority strings.

The generated Command Center preview is workflow-artifact-only, `operational:false`, and contains queue observations, blocked/stale/conflicted state, legacy count, main-SHA provenance, and replay fingerprints. It is not committed or posted to GitHub.

## Preserved gates

Stage 3A preserves:

- exact-SHA QA freshness and head-movement invalidation;
- same-timestamp conflict fail-closed behavior;
- dependency blocking;
- raw-research/Core firewall and separate promotion boundary;
- Founder pending/rejected/approved semantics;
- production-numerical-model Founder gate;
- closed/draft/legacy behavior;
- advisory-only handoffs;
- football, UI, scoring, IDP, projection, Dynasty Value, Sleeper, identity, replacement, and Prospective Archive isolation.

## Stage 3B / Stage 3C preview only

A later Stage 3B could propose narrowly authorized status-label execution with optimistic concurrency and least privilege only after separate Founder authorization and independent QA. Stage 3C could later add durable generated handoff communication under the same separate gate.

Neither capability exists in Stage 3A.
