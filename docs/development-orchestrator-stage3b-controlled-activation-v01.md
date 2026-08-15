# Development Orchestrator Stage 3B — Controlled Activation v0.1

Status: candidate only; HIGH RISK; not activated on production `main`.

**LIVE ACTIVATION BLOCKED — FOUNDER ENVIRONMENT PROTECTION NOT VERIFIED.**

## Scope

This candidate retains the smallest real GitHub mutation surface for Development Orchestrator Stage 3B. One manual `workflow_dispatch` targets exactly one explicitly supplied PR number. The real adapter can perform only Stage-3A-produced `ADD_LABEL` / `REMOVE_LABEL` operations for canonical Stage-1 `status:*` and `owner:*` labels.

There is no queue-wide execution, fan-out, schedule, pull-request event execution, comment trigger, merge trigger, retry loop, cascade, or Stage 3C.

## Permissions

Preview/dry-run:

- `contents: read`
- `pull-requests: read`
- `issues: read`

Execute permission ceiling:

- `contents: read`
- `pull-requests: read`
- `issues: write`

GitHub manages PR labels through the Issues Labels API, so `issues:write` is sufficient. No `pull-requests:write`, `contents:write`, `actions:write`, deployment/package/admin/secrets/workflow write, or `pull_request_target` is granted.

## Founder activation source — fail closed

The prior candidate consumed `LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED` through `${{ vars.* }}`. That does not authenticate environment scope because `vars` may resolve organization, repository, or environment configuration.

GitHub documents two relevant facts:

1. a job referencing an environment cannot access that environment's secrets until configured environment protection rules pass; and
2. secrets can exist at organization, repository, and environment scopes, with environment scope taking precedence when present.

The second fact means `${{ secrets.NAME }}` still cannot prove source scope if the environment secret is missing: a same-name repository/organization secret may remain resolvable. Therefore this candidate does **not** treat either `${{ vars.* }}` or `${{ secrets.* }}` as Founder source authentication.

The controlled code accepts Founder authorization only through an explicit attestation object with all of:

- `source=environment-secret`
- `environment=stage3b-controlled-activation`
- `verified=true`
- `protection_verified=true`
- `activation="1"`

That attestation exists only in deterministic/mock tests. The real CLI intentionally supplies no attestation because GitHub Actions does not expose a runtime primitive in the permitted permission model that proves a value came from this exact environment rather than repository/org secret scope. Real execution therefore denies before any adapter read/write.

Repository- or organization-level variables of the old activation name are ignored and cannot satisfy the gate. Ambiguous, missing, malformed, wrong-environment, or unverified activation provenance denies.

### Current environment state and auto-create hazard

Independent QA verified that `stage3b-controlled-activation` does not currently exist. Remediation rechecked the GitHub environment endpoint and it still returns 404. GitHub documents that running a workflow referencing a nonexistent environment can automatically create that environment without protection rules or secrets.

Therefore this remediation deliberately removes any runnable `environment: stage3b-controlled-activation` reference. `mode=execute` produces a blocked audit and exits before any write-capable command. This avoids silently creating an unprotected environment during remediation.

A future separately authorized change may wire live execution only after the Founder environment has been explicitly created and its protection/source mechanism independently verified. This PR does not create or activate it.

## Exact target PR grammar

External `target_pr_number` input must match exactly:

`^[1-9][0-9]*$`

No trimming or normalization occurs. `"123"` is valid. Leading/trailing whitespace, tabs/newlines, plus signs, leading zeros, exponent notation, decimals, lists, ranges, arrays/objects, zero, negatives, NaN/Infinity, and unsafe integers are rejected.

Internal code may pass an already-validated positive safe-integer number.

## Real adapter repository/PR contract

`GitHubControlledLabelAdapter` remains the only real mutation adapter and exposes only `addLabel` and `removeLabel` beyond inherited reads.

At each write entry it now validates, before any network request:

- repository is an exact ASCII `owner/repo` canonical form;
- repository exactly equals trusted `kw7t9rwhny-cyber/league-vector`;
- PR is either a positive safe integer or an exact canonical decimal string with no normalization/coercion;
- label is in the immutable Stage-1 canonical allowlist.

Rejected repository examples include URLs, query/fragment/path payloads, encoded separators, whitespace, extra slashes, traversal, backslashes, empty owner/repo, and Unicode lookalikes. Rejected PR examples include `1e2`, `100.0`, ` 100 `, `+100`, `00100`, newline/path/encoded payloads, zero/negative/decimal values, NaN/Infinity, unsafe integers, arrays, and objects.

No `Number(pr)` coercion occurs before canonical validation, and tests prove invalid adapter inputs make zero network calls.

## Preview-first and one-PR contract

Every dispatch first builds a read-only deterministic preview containing target PR, current head, Stage-2 state, Stage-3A disposition, current labels, exact add/remove proposal, QA/tested SHA, Founder work-item state, dependency snapshot, current main, exact mutation list, and replay fingerprint. Preview is always `authorization:false`.

`mode=dry-run` ends without write permission in that job. `mode=execute` is currently fail-closed as described above. The underlying mocked controlled executor retains preview→execute replay fingerprint equality and targets one PR only.

## Full revalidation and rollback

The previously QA-passed inactive Stage-3B executor remains authoritative. In mocked execution, immediately before every individual write it re-reads live state, rebuilds Stage 2, replans Stage 3A, and validates exact remaining mutation suffix, open/exact-head state, QA/tested SHA, Founder work-item state, dependencies, structured metadata, owner/type/promotion state, current-main provenance, labels, disposition, and replay fingerprint.

Rollback remains reverse-order and concurrency-safe. If transaction ownership cannot still be proven, rollback stops with `failed-or-partial` and `manual_review_required=true`; human state is never overwritten. Ambiguous transport/write outcomes never claim success.

## Adversarial coverage

Controlled tests cover:

- repository-level variable spoof with environment activation missing;
- organization-level variable spoof with environment activation missing;
- missing/ambiguous/wrong-environment/unverified/malformed Founder attestation;
- verified environment attestation eligibility in mocked execution only;
- exact target whitespace/leading-zero/exponent/decimal attacks;
- malformed repository URLs, paths, queries, fragments, encodings, whitespace and Unicode lookalikes;
- direct `addLabel` and `removeLabel` PR coercion attacks;
- trusted-repository mismatch;
- zero-network proof for every invalid adapter repository/PR case;
- wrong/closed PR, moved head, stale/conflicting QA, fork/ref/event attacks;
- Stage-3A/metadata/label/dependency/current-main races after preview;
- arbitrary/noncanonical mutations;
- partial/ambiguous writes, rollback conflict, stale replay/second execution;
- workflow trigger/permission inspection and proof that live workflow does not invoke the real executor.

## Exact-head validation evidence

Candidate head: `34ec9170638f9117e826f5e769da8c4364c6ad86`.

Development Orchestrator run `31853059353`: PASS.

- Stage 1: 26/26 PASS
- Stage 2: 54/54 PASS
- Stage 3A: 48/48 PASS
- inherited Stage 3B: 68/68 PASS
- Controlled Activation: 164/164 PASS
- PR metadata audit: PASS
- Stage-2 live dogfood: PASS, read only
- Stage-3A live dogfood: PASS, zero mutations
- inactive Stage-3B dogfood: PASS, dry-run `no-op-success`, execute flags disabled

Full League Vector CI run `31853059398`: PASS on the same head.

- `npm run validate`: PASS
- Playwright E2E: PASS
- projection benchmark: PASS
- projection-v03 generation/static preview: PASS
- historical data audit: PASS
- live projection publisher: skipped on PR

No controlled execute workflow was dispatched. No real label adapter network request was made by CI. No live mutation, environment creation, merge, or production activation occurred. Production `main` remained `f876543a1f6126ea1321c7c8b0eeede62293b139` during validation.

## First live test plan — NOT EXECUTED

After a separately authorized Founder environment setup and independent verification, use a dedicated harmless Orchestrator-only PR whose structured body is already `status:ready-for-qa` but lacks that GitHub label. The intended first mutation remains exactly:

`ADD_LABEL status:ready-for-qa`

Before any future execute run, independently verify a dry-run artifact showing exactly one mutation, the exact target/head/fingerprint, and no owner/Core/Founder/QA/promotion transition.

This PR does not create the test PR, does not create the environment, does not run execute mode, and performs no live mutation.

## Explicit non-capabilities

Controlled Activation v0.1 cannot comment, assign, edit bodies/titles, create issues/PRs/branches, push, merge, close, approve/request review, deploy, create QA verdicts, change Founder decisions, create promotion work, invoke external services, scan-and-mutate queues, schedule itself, cascade, or implement Stage 3C.
