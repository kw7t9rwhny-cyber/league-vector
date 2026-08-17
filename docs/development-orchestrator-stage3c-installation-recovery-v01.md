# Stage 3C Default-Branch Installation / Live-Proof Recovery v0.1

## Status

**READY FOR QA — HIGH RISK**

This document covers installation and recovery procedure only. It does not authorize another live agent execution, any OpenAI inference, any manual worker dispatch, any fixture activation, merge, deployment, release, or production change.

## Live proof Attempt #1

Attempt identifier: `STAGE3C-LIVE-ATTEMPT-001`

Fixture: Issue #53, `stage3c-v0.1-r1`.

Founder action: one authorized `Eligibility: DORMANT` → `Eligibility: READY` edit.

Observed result:

- Research Worker A: NOT STARTED
- QA Worker B: NOT STARTED
- Codex executions: 0
- autonomous A→B handoffs: 0
- production changes: 0

Classification: **VALID DIAGNOSTIC FAILURE — WORKFLOWS NOT INSTALLED ON DEFAULT BRANCH**.

At the time of the activation, repository default branch `main` did not contain the generated Stage 3C Research or QA executable workflow files. The Stage 3C implementation existed only on PR #54's branch. GitHub documents that an `issues` event triggers a workflow only when its workflow file exists on the default branch, and applies the same default-branch prerequisite to `workflow_run`. The activation therefore could not start Research Worker A, and without a Research run there could be no authoritative downstream `workflow_run` parent for Worker B.

Attempt #1 is preserved in Issue #53 history and must not be replayed by toggling r1 back to DORMANT and READY.

## Installation choice

Chosen path: **Option B — isolated installation PR**.

Do not merge PR #54 as the installation mechanism.

The installation PR is based directly on the current `main` branch and copies the seven Stage 3C files from the dual-QA-passed PR #54 candidate `a93c57dc1486c39cf29db39858f04569377003af` without semantic modification:

- `.github/workflows/stage3c-agentic-compile-validation.yml`
- `.github/workflows/stage3c-research-worker.md`
- `.github/workflows/stage3c-research-worker.lock.yml`
- `.github/workflows/stage3c-qa-worker.md`
- `.github/workflows/stage3c-qa-worker.lock.yml`
- `tests/development-orchestrator-stage3c-agentic.test.js`
- `docs/development-orchestrator-stage3c-two-worker-proof-v01.md`

Rationale:

1. It isolates **installation authority** from PR #54's development/remediation history.
2. It allows byte/blob identity of the previously reviewed Stage 3C files to be audited directly.
3. It does not reinterpret the prior QA PASS as permission to run a different fixture revision.
4. It leaves production application code untouched.
5. It provides a simple rollback boundary consisting only of Stage 3C proof infrastructure.

## Why the installation candidate intentionally remains r1-bound

The dual-QA-passed executable hard-codes fixture revision `stage3c-v0.1-r1`. That activation has been consumed by Attempt #1.

Issue #53 has therefore been advanced to a new future fixture revision `stage3c-v0.1-r2` with `Eligibility: DORMANT`.

This installation PR intentionally copies the reviewed r1 executable **unchanged**. Consequently, even after installation, the executable cannot authorize the current r2 fixture. That is a safety property during installation and registration verification, not an attempt to reuse r1.

After installation/registration is proven, a separate minimal r2 executable revision must change the fixture-bound constants/results from r1 to r2, regenerate the hardened locks with the verified official `gh-aw` toolchain, run the complete Stage 3C adversarial/security suite, and receive fresh exact-candidate and exact-installed-SHA QA before Attempt #2 can be authorized.

## SHA and authority model

Three identities must remain distinct:

### 1. Original QA candidate SHA

`a93c57dc1486c39cf29db39858f04569377003af`

This SHA proves what the two independent HIGH-risk QA teams reviewed in PR #54. Its QA authority does not automatically transfer to another commit SHA.

### 2. Installation PR candidate SHA

The isolated installation PR has its own candidate commit SHA. Its seven Stage 3C files must be proven byte/blob-identical to the corresponding files at `a93c57dc1486c39cf29db39858f04569377003af`, apart from this new recovery document which is non-executable.

### 3. Installed `main` SHA

After a future Founder-authorized installation merge, `main` will have an actual installed SHA. Merge-commit, squash, and rebase strategies can create a SHA different from either candidate. File/tree equality is useful audit evidence but does not silently transfer exact-SHA authorization.

**Fail-closed rule:** before any future live activation, QA must bind to the actual default-branch executable at the actual installed `main` SHA. If the installed SHA or executable tree changes after QA, the live authorization is stale.

### Fixture input revision

`stage3c-v0.1-r2` is external fixture state on Issue #53. It is neither a Git commit nor installation authority. The future r2 executable and the r2 Issue state must both be independently verified.

## Default-branch registration proof

File presence alone is necessary but not sufficient evidence for the next live proof.

After future installation and before any r2 activation, require all of:

1. direct repository inspection proves both generated worker workflow files exist on `main`;
2. repository Actions workflow registry identifies the Research executable as `Stage 3C Research Worker A`, active, at `.github/workflows/stage3c-research-worker.lock.yml`;
3. registry identifies `Stage 3C QA Worker B`, active, at `.github/workflows/stage3c-qa-worker.lock.yml`;
4. Research source/executable trigger is `issues` / `edited`;
5. QA source/executable trigger is `workflow_run`, `completed`, naming exactly `Stage 3C Research Worker A`, with the intended `main` branch filter;
6. no registration check is satisfied merely by an old/stale workflow-registry entry from a PR branch.

## Installation must not run Codex

Installing these files is a repository commit/merge operation, while Research Worker A is event-driven by an `issues: edited` event. Installation does not itself constitute the required Issue #53 `DORMANT` → `READY` event.

The current fixture is r2/DORMANT while the exact-copy installation executable remains r1-bound. Therefore any Stage 3C Research run would additionally fail the fixture-revision/transition gate before Codex.

Do not edit Issue #53 as part of installation. After installation, explicitly verify that no Stage 3C Research or QA Codex execution occurred and that GitHub did not retroactively process Attempt #1.

## r1 history and r2 separation

r1 remains historical evidence:

`stage3c-v0.1-r1` + DORMANT→READY = `STAGE3C-LIVE-ATTEMPT-001`.

r2 is a different future fixture:

`stage3c-v0.1-r2` + DORMANT now; no r2 activation is authorized by this document.

The existing activation-identity formula includes repository, Issue #53, fixture revision, exact transition, hashes of the authoritative previous/current Issue bodies, and Issue `updated_at`. Therefore an eventual r2 DORMANT→READY event necessarily has different activation material from r1. Static QA for the future r2 executable must prove this separation and re-run replay/adversarial tests before live use.

Attempt #1 produced no Research run and therefore no Research activation claim or Research result capable of authorizing Worker B. The diagnostic Issue comment is not a Research result and does not substitute for a worker execution.

## Worker B installation checks

The currently reviewed Worker B contract must remain intact during installation and future r2 revision. Its authority gate checks the triggering Research run's repository, workflow name, exact workflow path, `issues` event, `main` head branch, successful conclusion, first run attempt, and durable correlated Research result.

Before Attempt #2, adversarial QA must cover at least:

- Research workflow display-name mismatch;
- workflow path/identity mismatch;
- wrong branch;
- failed Research run;
- cancelled Research run;
- replayed Research run;
- successful but non-authoritative Research run;
- missing/duplicate/malformed Research result;
- stale r1 result or fixture revision;
- no parent Research run.

A `workflow_run` event may wake Worker B, but the existing authority gate must remain what determines whether Worker B Codex is reachable.

## Security contract

Installation and any later r2 revision must preserve:

- least privilege;
- worker `contents: read` / `issues: read` model-visible permissions;
- narrowly constrained safe-output comments to Issue #53;
- no broad PAT;
- no `pull_request_target`;
- no automatic branch creation, PR creation, merge, release, deployment, or production publishing;
- no Founder-decision automation;
- generated-lock security and deterministic reproduction;
- Research exact-transition gating, replay protection, claim-schema fail-closed behavior, and bounded concurrency;
- QA fresh independent Codex execution and authoritative Research correlation;
- `OPENAI_API_KEY` repository-secret/native engine authentication only, without retrieval, logging, prompt/comment/artifact persistence, repository persistence, or use as a GitHub write credential.

## Rollback

If installation is found unsafe before live activation, use a reviewed PR to remove/disable only the Stage 3C proof workflow/source/validation files installed by this boundary. Do not modify unrelated production or Development Orchestrator workflows. Preserve Issue #53 and Attempt #1 diagnostic history.

## Required QA before Attempt #2

A future live attempt requires independent HIGH-risk QA that verifies:

1. actual installed/default-branch executable workflow identity;
2. actual default-branch Actions registration of both workers;
3. new fixture revision r2;
4. r2 remains cleanly `Eligibility: DORMANT` until separate Founder authorization;
5. r1 cannot replay or authorize r2;
6. r2 produces a distinct activation identity;
7. installation itself produced zero Codex executions and no retroactive run;
8. Worker B `workflow_run` names/correlates the actual installed Research workflow;
9. exact installed SHA/tree is the executable QA reviewed;
10. production/security firewall remains intact;
11. future r2 sources and compiler-generated locks pass the complete prior Stage 3C claim/replay/concurrency/schema/Worker-B suites;
12. any post-QA executable or installed-SHA movement makes QA stale.

## Future Attempt #2 procedure — not authorized here

1. Founder separately approves installation of the reviewed installation PR.
2. Install Stage 3C infrastructure on `main`.
3. Verify both worker executables are actually registered active default-branch workflows and verify zero Codex executions occurred during installation.
4. Produce the separate minimal r2 executable revision; regenerate locks with the verified official compiler; independently HIGH-risk QA that exact candidate.
5. Founder separately approves installation of that reviewed r2 executable revision.
6. Install it on `main`; establish the exact installed `main` SHA/tree; independently HIGH-risk QA the actual installed executable and registration.
7. Verify Issue #53 remains `stage3c-v0.1-r2` + `Eligibility: DORMANT` and no stale r1 authority exists.
8. Founder separately authorizes `STAGE3C-LIVE-ATTEMPT-002` on that exact installed state.
9. Founder performs exactly one r2 `Eligibility: DORMANT` → `Eligibility: READY` edit.
10. Founder performs zero action between workers.
11. Worker A must start automatically, invoke Codex, and write one durable correlated Research result.
12. GitHub `workflow_run` must automatically start Worker B without manual rescue.
13. Worker B must be a fresh Codex execution, independently verify repository truth, and write one durable PASS/FAIL verdict.
14. Confirm no duplicate chain and no production/merge/deploy/release action occurred during the handoff.

No step in this document authorizes Steps 1, 5, 8, or 9. Founder approval remains required at each stated gate.
