# Stage 3C Default-Branch Installation / Live-Proof Recovery v0.1

## Status

**READY FOR QA — HIGH RISK**

This is an installation/recovery candidate only. It does **not** authorize merge, Codex/OpenAI inference, manual worker dispatch, Issue #53 activation, deployment, release, or production change.

## STAGE3C-LIVE-ATTEMPT-001

Fixture: Issue #53, `stage3c-v0.1-r1`.

Founder action: one authorized `Eligibility: DORMANT` → `Eligibility: READY` edit.

Observed result:

- Research Worker A: NOT STARTED
- QA Worker B: NOT STARTED
- Codex executions: 0
- autonomous A→B handoffs: 0
- production changes: 0

Classification: **VALID DIAGNOSTIC FAILURE — WORKFLOWS NOT INSTALLED ON DEFAULT BRANCH**.

At activation time, repository default branch `main` did not contain `.github/workflows/stage3c-research-worker.lock.yml` or `.github/workflows/stage3c-qa-worker.lock.yml`. The implementation existed on PR #54's branch. GitHub documents that `issues` workflows must exist on the default branch to receive those events, and that a `workflow_run` workflow only triggers when its workflow file exists on the default branch. No Research run existed, so Worker B had no authoritative parent execution.

Attempt #1 remains durable Issue #53 history. Never replay r1 by READY→DORMANT→READY.

## Installation choice

Chosen: **Option B — isolated installation PR from `main`**.

Do not use PR #54 itself as installation authority. This boundary is intentionally separate so development/remediation history cannot be mistaken for default-branch installation authorization.

The installation candidate imports the reviewed Stage 3C source/validation/test/documentation material from PR #54 candidate `a93c57dc1486c39cf29db39858f04569377003af`. The two generated hardened locks are **not claimed byte-identical to the old PR #54 lock blobs**: current verified `gh-aw v0.86.2` strict compilation regenerated them. The candidate therefore requires fresh HIGH-risk QA and cannot inherit PR #54's exact-SHA PASS.

Current compiler-generated lock Git blob identities:

- Research lock: `03b8dfd957b0fe73a7c40aa6582b4b25ac91662d`
- QA lock: `b5cf34371dc192d81282dec684a8adc5e022bce6`

The temporary compiler-capture workflow used during preparation has been removed from the candidate. Its compiler phase passed; an attempted Actions-token push was rejected by GitHub because the token lacked workflow-file permission. No permission widening, Codex execution, Issue mutation, or `main` mutation resulted.

## SHA / authority model

Keep four identities separate:

1. **Original PR #54 QA candidate:** `a93c57dc1486c39cf29db39858f04569377003af`.
2. **Installation PR candidate:** the exact current head of PR #60 after this document commit.
3. **Installed main SHA:** unknown until a separately Founder-authorized merge/install occurs.
4. **Fixture input revision:** `stage3c-v0.1-r2`, external Issue #53 state, not a Git SHA.

Fail closed. A merge commit, squash, rebase, or later commit may create a different installed SHA. Prior QA does not silently authorize that SHA. Before live Attempt #2, independent HIGH-risk QA must bind to the actual executable tree on the actual installed `main` SHA.

Tree/file equivalence can support provenance but does not replace exact installed-state authorization.

## Why this installation candidate remains r1-bound

The reviewed Stage 3C worker sources still bind to `stage3c-v0.1-r1`. r1's authorized activation is consumed.

Issue #53 is now prepared as a genuinely new future fixture:

- `Fixture revision: stage3c-v0.1-r2`
- `Eligibility: DORMANT`

Therefore this installation candidate cannot authorize r2 and cannot replay r1. After default-branch installation/registration is proven, a **separate minimal r2 executable revision** must update fixture-bound constants/results, regenerate locks with the verified compiler, pass the complete Stage 3C adversarial suite, and receive fresh exact-state QA before live use.

## Default-branch registration proof

After future installation, but before any r2 activation, prove all of the following from live GitHub state:

1. Research generated workflow exists on `main`.
2. QA generated workflow exists on `main`.
3. Actions registry reports `Stage 3C Research Worker A` active at `.github/workflows/stage3c-research-worker.lock.yml`.
4. Actions registry reports `Stage 3C QA Worker B` active at `.github/workflows/stage3c-qa-worker.lock.yml`.
5. Research trigger is `issues` / `edited`.
6. QA trigger is `workflow_run` / `completed` naming exactly `Stage 3C Research Worker A`, with intended `main` filtering.
7. Registration is not inferred from stale PR-branch registry history.

## Installation must not start Codex

Installation is a Git/default-branch change, not an Issue #53 edit. The Research trigger is `issues: edited`; GitHub does not retroactively replay the prior r1 Issue event merely because a workflow is later installed. Do not edit Issue #53 during installation.

Additionally, Issue #53 is r2/DORMANT while this executable remains r1-bound. After installation, explicitly verify zero Stage 3C Research/QA Codex executions occurred and no stale r1 event/result acquired authority.

## r1 / r2 replay separation

r1 historical identity:

`stage3c-v0.1-r1` + its original DORMANT→READY Issue edit = `STAGE3C-LIVE-ATTEMPT-001`.

r2 future identity:

`stage3c-v0.1-r2` + DORMANT now; no activation authorized.

Worker A's activation material includes repository, Issue #53, fixture revision, exact transition, previous/current Issue body hashes, and Issue `updated_at`. A future r2 DORMANT→READY event therefore has distinct activation material from r1. Fresh r2 static/adversarial QA must verify that distinction and prove r1 claims/results cannot authorize or block r2 incorrectly.

Attempt #1 produced no Research run, no valid Research result, and therefore no parent execution capable of authorizing Worker B.

## Worker B default-branch checks

Preserve the existing fail-closed correlation contract: repository, Research workflow display name, exact workflow path, `issues` event, `main` branch, successful conclusion, first run attempt, and one durable correlated Research result.

Fresh QA must attack display-name/path mismatch, wrong branch, failed/cancelled/replayed Research, successful non-authoritative Research, missing/duplicate/malformed result, stale r1 result, and absent parent run. `workflow_run` may wake Worker B, but only the authority gate may make QA Codex reachable.

## Security contract

Preserve least privilege, generated-lock security, bounded concurrency, Worker-A exact-transition/replay/schema gates, Worker-B fresh independent Codex execution and authoritative correlation, safe-output constraints, and native gh-aw/Codex secret isolation.

No broad PAT, `pull_request_target`, automatic merge, deployment, release, production publishing, Founder-decision automation, or OpenAI secret retrieval/logging/persistence is authorized.

## Rollback

If installation is unsafe before live activation, remove/disable only the Stage 3C proof workflows/source/validation files through a reviewed PR. Do not disturb unrelated production workflows. Preserve Issue #53 and Attempt #1 history.

## Required QA before Attempt #2

Independent HIGH-risk QA must verify:

1. exact installation candidate and compiler-generated locks;
2. after authorized installation, actual installed/default-branch executable identity and exact installed SHA/tree;
3. both worker workflows are actually registered active on `main`;
4. r2 is the new fixture revision and remains DORMANT;
5. r1 cannot replay;
6. r2 creates a distinct activation identity;
7. installation itself produced zero Codex executions and no retroactive r1 run;
8. Worker B `workflow_run` references/correlates the actual installed Worker-A identity;
9. production/security firewall remains intact;
10. future r2 sources and regenerated locks pass the complete prior claim/replay/concurrency/schema/Worker-B adversarial suite;
11. any executable or installed-SHA movement after QA makes authorization stale.

## Future STAGE3C-LIVE-ATTEMPT-002 — NOT AUTHORIZED HERE

1. Founder separately authorizes installation of the reviewed PR #60 candidate.
2. Install Stage 3C r1-bound proof infrastructure on `main`.
3. Verify both worker workflows are registered active on `main`; verify zero Codex execution and no retroactive r1 event.
4. Create a separate minimal r2 executable revision; regenerate both locks with the verified compiler; HIGH-risk QA the exact candidate.
5. Founder separately authorizes installation of that r2 executable revision.
6. Install r2 executable on `main`; record actual installed SHA/tree; HIGH-risk QA actual installed executable and registration.
7. Confirm Issue #53 is still `stage3c-v0.1-r2` + `Eligibility: DORMANT` and no stale r1 authority exists.
8. Founder separately authorizes `STAGE3C-LIVE-ATTEMPT-002` against that exact installed state.
9. Founder performs exactly one r2 `DORMANT` → `READY` edit.
10. Founder performs zero action between workers.
11. Worker A must start automatically, invoke Codex, and write one durable correlated Research result.
12. GitHub `workflow_run` must automatically start Worker B without manual rescue.
13. Worker B must be a fresh Codex execution, independently verify repository truth, and write one durable PASS/FAIL verdict.
14. Confirm no duplicate chain and no production/merge/deploy/release action occurred during the handoff.

No step in this document authorizes merge, r2 activation, or Codex execution.
