# Reusable Research → QA Protocol v0.1

This directory defines the public technical contract for a bounded GitHub-native `Research → QA → Founder/Lead STOP` protocol. It does not authorize a pilot, merge, installation, deployment, release, remediation, or Stage 3D.

## Deliberately narrow v0.1 contract

The public v0.1 runtime accepts only the semantics it actually implements:

- initial work-item role: `research`;
- QA requirement: exactly `one` fresh QA;
- terminal result type: exactly `lv-rqa-terminal-result/v1`;
- Founder gate: required and `true`;
- confidentiality: `public` only;
- authoritative budget: `max_worker_runs` only;
- generic dependency fields: unsupported and rejected.

Stronger QA classes (`dual`, `installed-state`, `security`), no-QA routing, private/restricted persistence, generic dependency scheduling, and enforceable AI-credit/Actions-runtime ceilings are outside v0.1. They must not be represented as authoritative work-item constraints until their semantics are implemented.

## Durable state

A work-item issue body is exactly two lines:

1. `LV_RQA_WORK_ITEM_V1`
2. one canonical JSON object satisfying `work-item.schema.json`.

The issue creator must still be resolved through GitHub repository permission state by deterministic infrastructure. The workflow-dispatch issue number is only a wake-up pointer and never establishes authority.

Authoritative dispatch claims and terminal results are GitHub Actions-bot comments using `LV_RQA_DISPATCH_V1` and `LV_RQA_TERMINAL_RESULT_V1`, followed by one canonical JSON line. Trusted protocol comments require the canonical GitHub Actions bot identity; marker-shaped comments from other actors are ignored rather than treated as authority. Writes that affect downstream eligibility use read → write → readback reconciliation.

## Immutable input

`input_identity` binds repository, exact 40-character commit SHA, and exact tree SHA. Every Controller/worker execution re-fetches the commit and proves tree equality before progression. Moving branch labels are not authority.

The workflow execution ref and immutable research input are intentionally separate: protocol workflows execute from the installed `main` workflow while the model job checks out the exact immutable `input_identity.commit_sha` for inspection.

## Worker/result separation and run provenance

Codex receives a read-only checkout and returns only `worker-substance.schema.json` substance. The model does not provide trusted writer identity, run identity, input identity, result identity, role-instance identity, creation time, terminal state, or upstream authority.

The deterministic persistence job constructs that provenance, validates substance, writes the terminal result, reads it back, and exercises the same production validator to prove exactly one current-run result before the workflow's terminal job can be green.

Before a durable result can grant downstream eligibility, deterministic infrastructure independently fetches the asserted GitHub Actions run and verifies the asserted run ID and run attempt, repository, exact Research-versus-QA workflow path, `workflow_dispatch` event, installed `main` ref, and result/run chronology. Generic Actions-bot authorship plus self-consistent envelope fields is not sufficient.

Research status is `COMPLETE` or `BLOCKED`. QA is a fresh independent execution and may return only `PASS`, `FAIL`, or `BLOCKED`. All QA dispositions stop at the Founder/Lead gate. `BLOCKED` is never PASS.

## Routing and replay

The deterministic Controller can only dispatch `research-1` followed by `qa-1`. Dispatch identity is SHA-256 over work item, role instance, immutable input identity, and upstream result IDs. A durable duplicate dispatch claim blocks rather than becoming a second valid progression.

The v0.1 transport is explicit GitHub `workflow_dispatch`, selected so the Controller needs `actions: write` rather than repository `contents: write`. Transport inputs are correlation pointers only. Workers always re-read durable state.

An ambiguous workflow-dispatch API outcome is not blindly retried. The durable dispatch claim remains inspectable and the current execution fails closed for manual/reconciliation review.

## Concurrency and budget

Concurrency is serialized per issue/role transition while unrelated work-item issues can run independently. `max_worker_runs` is the only authoritative v0.1 budget ceiling and is enforced from durable dispatch cardinality. Research and QA model jobs have hard 15-minute Actions job timeouts as execution safety limits, but those timeouts are not represented as accumulated authoritative work-item budget accounting.

AI credits/cost and Actions runtime may be recorded as nullable telemetry when independently available. Unknown telemetry remains unknown/null; it is not converted into a fictional enforceable budget counter.

## Context references and public-only persistence

`context_refs` is intentionally bounded (16 entries, 512 characters each) and is passed as references, not expanded history. This public runtime accepts only `confidentiality: public`. Confidential/private/restricted work must not enter this public persistence path. A separate deterministic private persistence boundary would be required before those classifications could be accepted in a future protocol version.

A worker that cannot resolve required evidence/context is required to return `BLOCKED`.

## Permissions

Model-facing Research and QA jobs remain `contents: read` with Codex `:read-only`. Deterministic infrastructure receives only the additional repository permissions needed for durable Issue state, workflow dispatch, and authenticated Actions metadata reads. No v0.1 job receives `contents: write`, pull-request write, deployment write, or package write.

## Workflow registry preflight

Current workflow-registry enablement is a separate pre-live fact. This v0.1 candidate does not claim that workflow source presence or historical runs prove registry enablement. The standing machine-readable registry preflight requirement remains required before a live pilot where workflow enablement is consequential.

## Telemetry

The validator exposes a small `lv-rqa-telemetry/v1` record supporting role timestamps, wall time, Founder interventions, manual prompt transfers, worker executions, QA cycles, rework count, nullable AI credits, nullable Actions runtime, deterministic defects caught, QA defects caught, and terminal disposition. No dashboard or institutional-memory system is included.

## Explicit exclusions

There is no Implementation→QA runtime, autonomous remediation loop, automatic merge, automatic install, deployment, release, dual-QA aggregation, installed-state/security QA routing, private persistence, generic dependency scheduler, enforceable AI-credit/runtime budget accounting, mixed-model routing, institutional memory, learned routing, general role graph, or Stage 3D behavior in this candidate.
