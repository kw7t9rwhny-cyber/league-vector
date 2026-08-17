# Stage 3C Default-Branch Installation / Live-Proof Recovery v0.1

## Status

**READY FOR QA — HIGH RISK**

Installation/recovery procedure only. This document does not authorize live agent execution, OpenAI inference, manual worker dispatch, fixture activation, merge, deployment, release, or production change.

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

At activation time, default branch `main` did not contain the generated Stage 3C Research or QA executable workflow files. GitHub requires the workflow file to exist on the default branch for the `issues` event and for downstream `workflow_run`. Attempt #1 is preserved in Issue #53 history and r1 must not be replayed.

## Installation choice

Chosen: **Option B — isolated installation PR based directly on `main`**.

Do not use PR #54 itself as the installation mechanism.

Five non-generated Stage 3C files in this installation boundary remain byte/blob-identical to the dual-QA-reviewed PR #54 candidate `a93c57dc1486c39cf29db39858f04569377003af`:

- `.github/workflows/stage3c-agentic-compile-validation.yml`
- `.github/workflows/stage3c-research-worker.md`
- `.github/workflows/stage3c-qa-worker.md`
- `tests/development-orchestrator-stage3c-agentic.test.js`
- `docs/development-orchestrator-stage3c-two-worker-proof-v01.md`

The two generated hardened locks are treated separately. On the installation branch, verified official `gh-aw` v0.86.2 strict validation and strict compilation succeeded, but the old PR #54 lock bytes did not reproduce. The deterministic gate therefore failed closed. A temporary installation-only compiler workflow regenerated the locks from the unchanged reviewed sources using the verified official compiler. The final candidate uses the resulting compiler bytes verbatim:

- Research lock Git blob: `03b8dfd957b0fe73a7c40aa6582b4b25ac91662d`
- Research lock SHA-256: `9809c6568d4c3b021f6cca1e37252d72cb009758a317f43116b94d89f8498eeb`
- QA lock Git blob: `b5cf34371dc192d81282dec684a8adc5e022bce6`
- QA lock SHA-256: `e69cad84306d6d257c5f822c8257cb1e9773084480bbf2714015117cc75c2a83`

The temporary compiler workflow is excluded from the final candidate tree. It did not invoke Codex, read `OPENAI_API_KEY`, edit Issue #53, dispatch a worker, merge, deploy, or release.

Because the generated executable bytes differ from the previous PR #54 candidate, **fresh HIGH-risk QA is mandatory**. Prior QA PASS is historical evidence, not execution authority for this installation candidate.

Option B is preferred because it isolates installation authority from PR #54's development history, keeps unchanged source identity auditable, binds the executable to current verified compiler output, leaves production application code untouched, and gives Stage 3C a narrow rollback boundary.

## Intentional r1 binding during installation

The worker sources remain hard-bound to fixture revision `stage3c-v0.1-r1`. That activation was consumed by Attempt #1.

Issue #53 is now a new future fixture:

- `Fixture revision: stage3c-v0.1-r2`
- `Eligibility: DORMANT`

The installation executable therefore cannot authorize the current r2 fixture. This is intentional fail-closed installation posture, not reuse of r1.

After installation and default-branch registration are proven, a separate minimal r2 executable revision must update the fixture-bound identity/results required for r2, regenerate hardened locks with the verified official `gh-aw` toolchain, rerun the complete Stage 3C adversarial/security suite, and receive fresh exact-candidate and exact-installed-SHA QA before Attempt #2 can be authorized.

## SHA / authority model

Four identities remain distinct.

### Original PR #54 QA candidate

`a93c57dc1486c39cf29db39858f04569377003af`

This identifies what the prior dual independent QA teams reviewed. Its PASS does not transfer automatically to a different commit or regenerated executable.

### Installation PR candidate

PR #60 has its own exact head SHA. Independent HIGH-risk QA must review that exact head, including current compiler-generated locks and this recovery procedure.

### Installed `main` SHA

A future Founder-authorized merge/install will create the actual installed default-branch state. Merge commit, squash, or rebase strategies can produce an installed SHA different from the PR candidate. Tree/file equality is useful audit evidence but is not a substitute for exact installed authority.

**Fail closed:** before any future live activation, QA must bind to the actual executable at the actual installed `main` SHA/tree. Any executable or installed-SHA movement after QA makes live authorization stale.

### Fixture input revision

`stage3c-v0.1-r2` is external Issue #53 state. It is not a Git SHA and grants no execution authority by itself.

## Default-branch registration proof

After future installation and before any r2 activation, require all of:

1. direct repository inspection proves both generated worker workflow files exist on `main`;
2. Actions registry identifies active `Stage 3C Research Worker A` at `.github/workflows/stage3c-research-worker.lock.yml`;
3. Actions registry identifies active `Stage 3C QA Worker B` at `.github/workflows/stage3c-qa-worker.lock.yml`;
4. Research executable trigger is `issues` / `edited`;
5. QA executable trigger is `workflow_run` / `completed`, naming exactly `Stage 3C Research Worker A`, with the intended `main` branch filter;
6. a stale/non-default-branch registry entry alone is not accepted as proof.

## Installation must not run Codex

Installing the files is a repository operation, not the required Issue #53 `DORMANT` → `READY` edit. Do not edit Issue #53 during installation.

The current fixture is r2/DORMANT while the installation sources remain r1-bound. Immediately after installation, empirically verify that no Stage 3C Research or QA worker run occurred, no Codex inference was consumed, and Attempt #1 was not retroactively processed.

## r1 / r2 replay separation

Historical r1 identity:

`stage3c-v0.1-r1` + DORMANT→READY = `STAGE3C-LIVE-ATTEMPT-001`.

Future r2 posture:

`stage3c-v0.1-r2` + DORMANT. No r2 activation is authorized in this cycle.

The existing Worker-A activation identity includes repository, Issue #53, fixture revision, exact transition, previous/current body hashes, and Issue `updated_at`. A future r2 DORMANT→READY event therefore has distinct activation material. The future r2 executable QA must prove this statically and rerun replay/adversarial tests.

Attempt #1 produced no Research run and no Research result. Its diagnostic comment cannot become a Worker-B parent or substitute for an authoritative Research result.

## Worker B default-branch checks

The existing Worker B source remains unchanged in this installation. Before Worker B Codex is reachable, it checks the triggering Research run's repository, workflow name, exact workflow path, `issues` event, `main` head branch, successful conclusion, first run attempt, and durable correlated Research result.

Before Attempt #2, adversarial QA must include display-name mismatch, workflow path mismatch, wrong branch, failed Research run, cancelled Research run, replayed Research run, successful but non-authoritative Research run, missing/duplicate/malformed Research result, stale r1 result/revision, and no parent Research run.

A `workflow_run` event may wake Worker B; only the authority contract may grant execution eligibility.

## Security contract

Installation and later r2 work must preserve:

- least privilege;
- model-visible worker `contents: read` / `issues: read`;
- narrowly constrained safe-output comments to Issue #53;
- no broad PAT;
- no `pull_request_target`;
- no automatic branch creation, PR creation, merge, release, deployment, or production publishing;
- no Founder-decision automation;
- generated-lock security and deterministic reproduction;
- Worker-A exact-transition gating, replay protection, schema/version fail-closed behavior, and bounded concurrency;
- Worker-B fresh independent Codex execution and authoritative Research correlation;
- `OPENAI_API_KEY` repository-secret/native engine authentication only, without retrieval, logging, prompt/comment/artifact/repository persistence, or use as a GitHub write credential.

## Rollback

If installation is found unsafe before live activation, use a reviewed PR to remove or disable only the Stage 3C proof workflows/source/validation files installed by this boundary. Do not disturb unrelated production or Development Orchestrator workflows. Preserve Issue #53 and Attempt #1 diagnostic history.

## Required QA before Attempt #2

Independent HIGH-risk QA must verify:

1. actual installed/default-branch executable identity;
2. actual default-branch Actions registration of both workers;
3. fixture revision r2;
4. clean r2 `Eligibility: DORMANT` state until separate Founder authorization;
5. r1 cannot replay or authorize r2;
6. r2 creates a distinct activation identity;
7. installation produced zero Codex executions and no retroactive run;
8. Worker B `workflow_run` names/correlates the actual installed Research workflow;
9. exact installed SHA/tree is what QA reviewed;
10. production/security firewall remains intact;
11. future r2 compiler-generated locks and full prior Stage 3C claim/replay/concurrency/schema/Worker-B suites are green;
12. post-QA executable/SHA movement makes QA stale.

## Future Attempt #2 — not authorized here

1. Founder separately approves the reviewed installation PR.
2. Install Stage 3C infrastructure on `main`.
3. Verify both workers are registered active default-branch workflows and verify installation produced zero Codex executions.
4. Produce a separate minimal r2 executable revision; regenerate locks with verified official compiler; independently HIGH-risk QA that exact candidate.
5. Founder separately approves installation of the reviewed r2 executable revision.
6. Install r2 on `main`; establish actual installed SHA/tree; independently HIGH-risk QA the installed executable and registration.
7. Verify Issue #53 remains r2/DORMANT and no stale r1 authority exists.
8. Founder separately authorizes `STAGE3C-LIVE-ATTEMPT-002` on that exact installed state.
9. Founder performs exactly one r2 DORMANT→READY edit.
10. Founder performs zero action between workers.
11. Worker A starts automatically, genuinely invokes Codex, and writes one durable correlated Research result.
12. GitHub `workflow_run` starts Worker B automatically without manual rescue.
13. Worker B is a fresh Codex execution, independently verifies repository truth, and writes one durable PASS/FAIL verdict.
14. Confirm no duplicate chain and no production/merge/deploy/release action occurred during the handoff.

No step in this document authorizes installation, r2 installation, Attempt #2 authorization, or r2 activation. Founder approval remains required at each stated gate.