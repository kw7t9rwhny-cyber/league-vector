# Reusable Research → QA Protocol v0.1

This directory defines the public technical contract for a bounded GitHub-native `Research → QA → Founder/Lead STOP` protocol. It does not authorize a pilot, merge, installation, deployment, release, remediation, or Stage 3D.

## Durable state

A work-item issue body is exactly two lines:

1. `LV_RQA_WORK_ITEM_V1`
2. one canonical JSON object satisfying `work-item.schema.json`.

The issue creator must still be resolved through GitHub repository permission state by deterministic infrastructure. The workflow-dispatch issue number is only a wake-up pointer and never establishes authority.

Authoritative dispatch claims and terminal results are GitHub Actions-bot comments using `LV_RQA_DISPATCH_V1` and `LV_RQA_TERMINAL_RESULT_V1`, followed by one canonical JSON line. Writes that affect downstream eligibility use read → write → readback reconciliation.

## Immutable input

`input_identity` binds repository, exact 40-character commit SHA, and exact tree SHA. Every Controller/worker execution re-fetches the commit and proves tree equality before progression. Moving branch labels are not authority.

## Worker/result separation

Codex receives a read-only checkout and returns only `worker-substance.schema.json` substance. The model does not provide trusted writer identity, run identity, input identity, result identity, role-instance identity, creation time, terminal state, or upstream authority.

The deterministic persistence job constructs that provenance, validates substance, writes the terminal result, reads it back, and exercises the same production validator to prove exactly one current-run result before the workflow's terminal job can be green.

Research status is `COMPLETE` or `BLOCKED`. QA is a fresh independent execution and may return only `PASS`, `FAIL`, or `BLOCKED`. All QA dispositions stop at the Founder/Lead gate. `BLOCKED` is never PASS.

## Routing and replay

The deterministic Controller can only dispatch `research-1` or `qa-1`. Dispatch identity is SHA-256 over work item, role instance, immutable input identity, and upstream result IDs. A durable duplicate dispatch claim blocks rather than becoming a second valid progression.

The v0.1 transport is explicit GitHub `workflow_dispatch`, selected so the Controller needs `actions: write` rather than repository `contents: write`. Transport inputs are correlation pointers only. Workers always re-read durable state.

An ambiguous workflow-dispatch API outcome is not blindly retried. The durable dispatch claim remains inspectable and the current execution fails closed for manual/reconciliation review.

## Concurrency and budget

Concurrency is serialized per issue/role transition while unrelated work-item issues can run independently. `max_worker_runs` is enforced from durable dispatch cardinality. Research and QA model jobs have hard 15-minute Actions timeouts; deterministic jobs have smaller hard timeouts. Optional AI-credit and runtime fields are represented in the contract and production validator, but v0.1 does not pretend to measure provider billing when the action does not expose reliable cost data.

## Context references

`context_refs` is intentionally bounded (16 entries, 512 characters each) and is passed as references, not expanded history. The first pilot is expected to use immutable public-repository references. Confidential/private coordination remains private and must not be copied into public work-item state. A worker that cannot resolve required evidence/context is required to return `BLOCKED`.

## Telemetry

The validator exposes a small `lv-rqa-telemetry/v1` record supporting role timestamps, wall time, Founder interventions, manual prompt transfers, worker executions, QA cycles, rework count, AI credits when available, Actions runtime when available, deterministic defects caught, QA defects caught, and terminal disposition. No dashboard or institutional-memory system is included.

## Explicit exclusions

There is no Implementation→QA runtime, autonomous remediation loop, automatic merge, automatic install, deployment, release, dual-QA aggregation, mixed-model routing, institutional memory, learned routing, general role graph, or Stage 3D behavior in this candidate.
