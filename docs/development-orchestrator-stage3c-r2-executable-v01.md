# Stage 3C R2 Executable Revision v0.1

Status: implementation candidate only. No live proof authorization.

## Base and history

R2_BASE_SHA: `ad5ca1a0f6821c2b066ed6111f0aaeba06c1ed82`.

This SHA is a direct descendant of Founder-authorized Stage 3C installation SHA `9e82982e49c2c00890b50f18c2c5fe9ed45fb797`. The only intervening commit changed `data/experimental/2026-projections.json`; no Stage 3C workflow, generated lock, compile validation, or Stage 3C authority/security contract changed.

`stage3c-v0.1-r1` remains consumed historical evidence for `STAGE3C-LIVE-ATTEMPT-001`. It must never be replayed or reconstructed.

Issue #53 is prepared as the future fixture `stage3c-v0.1-r2` with `Eligibility: DORMANT`.

## Narrow executable change

This revision changes only fixture-bound Research/QA contract material from `stage3c-v0.1-r1` to `stage3c-v0.1-r2`, plus directly dependent deterministic tests and compiler-generated hardened locks.

No workflow topology, role definition, safe-output mechanism, permission model, claim-authority design, concurrency design, `workflow_run` handoff, OpenAI authentication boundary, deployment behavior, or production League Vector logic is redesigned.

## Activation separation

Worker A remains triggered only by `issues: edited` and still requires the exact Issue #53 transition `Eligibility: DORMANT` to `Eligibility: READY` with no other body change.

The activation identity remains SHA-256 over repository identity, Issue #53, fixture revision, exact transition, previous/current body hashes, and issue `updated_at`. Because fixture revision and body hashes differ, r1 and r2 activation identities are distinct. r1 durable claim/result evidence therefore cannot equal r2 authority.

All existing fail-closed claim parsing, schema/version handling, replay, stale-event, duplicate/conflict, spoof, and serialized concurrency protections remain unchanged.

## Worker B

Worker B remains a separate fresh Codex workflow triggered by `workflow_run` completion of exact workflow name `Stage 3C Research Worker A` on `main`. It still requires successful authoritative Research completion and exact correlated durable Research evidence. Its fixture/result contract is updated only to require `stage3c-v0.1-r2`; stale r1 results are invalid.

## Security

Generated locks must be produced by verified official `gh-aw v0.86.2` using the established pinned runtime strategy. Locks are never hand-edited. Effective executable permissions and safe-output handlers must remain least privilege and byte-reproducible.

`OPENAI_API_KEY` remains repository-secret-only and must not be retrieved, printed, echoed, interpolated into prompts, persisted, or used as a GitHub write credential.

## Live safety

This PR must not activate Issue #53, dispatch Worker A or Worker B, or intentionally consume OpenAI/Codex inference. `STAGE3C-LIVE-ATTEMPT-002` remains separately Founder-gated after dual HIGH-risk QA of the same exact candidate and subsequent installed-state QA.
