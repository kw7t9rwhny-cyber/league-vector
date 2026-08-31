# League Vector Product Task Pipeline v0.1

Status: bootstrap candidate only. No real product task has been executed. Installation does not authorize merge, deployment, release, customer delivery, payment, source-rights conclusions, or a follow-on task.

## Purpose and terminal boundary

This lane accepts one durable, separately Founder-approved, public-safe task contract and prepares one bounded draft implementation candidate for Founder review:

`approved contract → fail-closed preflight → isolated agent workspace → one restricted draft PR → exact-head deterministic validation → separate read-only QA → durable PASS, FAIL, or BLOCKED receipt`

Deterministic validation is not independent QA. A QA `PASS` requires `P0=0` and `P1=0`, remains bound to the exact base/head/tree/path identities, and does not authorize merge or deployment.

## Installed components

- `.github/workflows/product-task-pipeline-v01.md` is the human-readable GitHub Agentic Workflow. It is manual-dispatch only.
- `.github/workflows/product-task-pipeline-v01.lock.yml` is official compiler output and must never be hand-edited.
- `.github/workflows/product-task-pipeline-v01-exact-head.yml` explicitly validates the exact candidate because a PR created with `GITHUB_TOKEN` does not trigger ordinary PR automation.
- `.github/workflows/product-task-pipeline-v01-qa.yml` runs a separate `openai/codex-action` QA actor with the `:read-only` permission profile.
- `scripts/product-task-pipeline-v01.js` performs admission, exact identity checks, evidence persistence, workflow dispatch, and terminal state propagation.
- `lib/product-task-pipeline-v01.js` supplies strict pure validators used by the workflows and deterministic tests.
- `protocol/product-task-pipeline-v01/` defines the task, evidence, QA, and compiler-byte contracts.

The implementation and validation stages restore their verifier from the admitted starting commit before executing it. The QA stage restores its output schema from that same base. A task contract can never admit this pipeline's own helper, protocol, manifest, or operator document as a product-task target.

## Toolchain and immutable identities

| Item | Exact identity |
| --- | --- |
| Public starting commit | `42960af2578e09c545818847e28f26eb901a8ef0` |
| Public starting tree | `e68bf9eff8d35d3582b8ae4cf081ce6f86bb73cf` |
| gh-aw release | `v0.86.2` |
| gh-aw release/compiler commit | `48e5fa3ff52294d91d97715017a9f8693a48387f` |
| Agentic source SHA-256 | `af35230e5bec0d9c0cbc1b38f9b78acafa521a304e8a979006530accac1afa30` |
| Generated lock SHA-256 | `12fb89b233cf0e2ab0512d040ff13001bb046f7ec698cfff8f539b1bca16b96d` |
| Agent engine | Codex CLI `0.147.0` |
| Implementation model | `gpt-5.4-mini` |
| QA action | `openai/codex-action@f367b1e9572fd064ea71ef925ca24ee0f01080af` (`v1`) |
| QA Codex/model | Codex CLI `0.147.0`; `gpt-5.4-mini` |

The compiler manifest at `protocol/product-task-pipeline-v01/compiler-manifest.json` binds the source and generated lock bytes. Tests reject stale or tampered bytes.

The generated lock records these exact action pins:

- `actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9` (`v6.1.0`)
- `actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9` (`v6.1.0`)
- `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1` (`v7.0.1`)
- `actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` (`v8.0.1`)
- `actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3` (`v9.0.0`)
- `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020` (`v7.0.0`)
- `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` (`v7.0.1`)

The official compiler additionally pins all generated container images by digest in the lockfile. Those generated identities are authoritative and should be reviewed from the lock header whenever the source is recompiled.

## Credentials, permissions, and cost

The lane uses only the repository-scoped `GITHUB_TOKEN` for deterministic reads, issue/PR comments, safe-output PR creation, and explicit workflow dispatch. The implementation model does not receive a direct repository write token. Safe-output handling has the narrow write authority needed to create one draft PR; the separate dispatch/persistence jobs hold issue or Actions write authority but no product-code write authority.

The existing `OPENAI_API_KEY` repository secret is required by the independent QA action and is also accepted by gh-aw for the implementation worker. gh-aw can alternatively use an existing `CODEX_API_KEY` for its own inference step, but this bootstrap requests and creates no credential. Names such as `GH_AW_CI_TRIGGER_TOKEN` may appear in the official compiler's generic manifest; this lane neither references nor requires them.

The implementation worker is capped at 1,000 AI credits and threat detection at 400 AI credits. Under gh-aw v0.86.2 credit accounting this is a combined configured inference ceiling below the assignment's `$30` maximum. Actual provider tokens, model usage, and cost telemetry remain `UNKNOWN` until an authorized run supplies reliable telemetry.

## Contract admission

An operator creates one public issue in `kw7t9rwhny-cyber/league-vector`. The issue must be created by repository owner `kw7t9rwhny-cyber` and contain exactly one marker followed by one fenced JSON object:

````text
<!-- LEAGUE_VECTOR_PRODUCT_TASK_CONTRACT_V0.1 -->

```json
{ ...one object matching task-contract.schema.json... }
```
````

Before dispatch, compute `idempotency_identity` as the SHA-256 of the canonical contract with the `idempotency_identity` field omitted. `deriveIdempotencyIdentity` in the library is the normative implementation. The contract must name exact files, not directories or globs; those files must also fit the compiled static safe profile. A contract cannot expand the 20-file, 524,288-byte, or `$30` ceilings.

The issue's creator, authority actor, authorization timestamps, expiry, repository, current `main` commit and tree, required commands, stop conditions, prohibited actions, QA threshold, exact paths, and duplicate/terminal history are all re-read before inference. Authority may be at most seven days old and a contract may live at most fourteen days. Missing, moved, broad, stale, contradictory, or unverifiable state fails closed.

Before inference, deterministic infrastructure writes and reads back one exact run claim on the work item. Any trusted prior claim, implementation record, or terminal receipt blocks a second execution. Creator verification and validation dispatch must prove they belong to that same claimed workflow run and attempt.

## Execution and evidence

Dispatch `League Vector Product Task Pipeline v0.1` on `main` with only `task_contract_issue_number`. Concurrency is one lane per contract issue and `cancel-in-progress` is false. There is no scheduler, queue, retry loop, provider router, learned router, workflow database, or generic orchestration layer.

The implementation worker may edit only its isolated checkout. Its single safe output is one draft PR from an `agent/product-task-*` branch against `main`. Safe outputs block protected files, enforce the static profile, cap the patch at 20 files and 512 KiB, do not close the issue, and expose no merge, deployment, release, branch-deletion, payment, customer, or approval operation.

Before PR creation, the immutable verifier runs, in order:

```text
npm ci
npm run validate
npx playwright install --with-deps chromium
npm run test:e2e
```

After the safe-output handler creates the draft PR, a separate deterministic job re-reads the actual bot-authored PR and dispatches exact-head validation through the existing `GITHUB_TOKEN`. Dispatch failure caused by a 401/403 produces `BLOCKED_BY_ADDITIONAL_CREDENTIAL_REQUIREMENT`; no weaker validation fallback exists.

Validation emits `deterministic-evidence.json`, including expected and observed base/head/tree/paths, patch bytes, exact commands and exit states, `UNKNOWN` test counts when counts are not reliably available, run ID, attempt, contract/run/PR bindings, timestamps, and PASS/FAIL. The result is written to both the authoritative work item and candidate PR and an evidence artifact is retained for 30 days.

Only exact deterministic PASS dispatches QA. QA re-verifies the validation workflow/run/job provenance and all immutable bindings, then admits only the expected `github-actions[bot]` dispatcher and runs as a separate read-only actor. Infrastructure, not the model, writes the same terminal QA record and execution receipt to the authoritative work item and PR. Candidate movement produces BLOCKED and prevents acceptance.

## Public/private boundary

Public issue and PR comments are the authoritative public receipt. Both validation and QA also emit a machine-readable artifact whose destination is exactly `PRIVATE RESEARCH SYSTEM` and whose `canonical_ingestion` is `NOT_AUTHORIZED`. No cross-repository credential or write is used. Private canonical ingestion remains a later, separately authorized step.

## Bootstrap limitations and activation checklist

- No real product task or QA model run was authorized or performed by this bootstrap.
- Exact-head validation dispatch wiring is compiled and deterministically tested, but live repository dispatch remains `UNVERIFIED` until a separately approved task is run.
- Separate QA wiring is installed and deterministically tested, but live model execution remains `UNVERIFIED` for the same reason.
- Repository Actions policy, `GITHUB_TOKEN` workflow-dispatch permission, and the existing `OPENAI_API_KEY` secret must be confirmed at activation time. A missing permission or secret is terminal; it does not authorize a new credential.
- Public-to-private canonical state propagation is intentionally not implemented.
- Creator verification is not fresh independent QA. Fresh independent QA is still required for this bootstrap candidate before Founder review can treat it as accepted.

Any source change requires rerunning `gh aw compile product-task-pipeline-v01 --strict --no-check-update --show-all`, `gh aw validate --strict`, recomputing both SHA-256 values in the compiler manifest, and running the focused and repository-wide verification commands. Never edit the generated lock manually.
