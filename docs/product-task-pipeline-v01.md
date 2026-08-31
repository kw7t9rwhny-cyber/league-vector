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
| Agentic source SHA-256 | `19fc13e6335128819a6f1edcdba6a06fdef11255eaeff7cabe8a0d996778ad85` |
| Generated lock SHA-256 | `dfa9d46d6d264a0c67c2477bf6cc0d7b3ca96596bb747b255ec157b78189b087` |
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
- `github/gh-aw-actions/setup@6aab9e5b5c91c615506061f09bedd81a23babe3c` (immutable commit for `v0.86.2`)

The official compiler additionally pins all generated container images by digest in the lockfile. Those generated identities are authoritative and should be reviewed from the lock header whenever the source is recompiled.

## Credentials, permissions, and cost

The lane uses only the repository-scoped `GITHUB_TOKEN` for deterministic reads, issue/PR comments, safe-output PR creation, and explicit workflow dispatch. The implementation model does not receive a direct repository write token. Safe-output handling has the narrow write authority needed to create one draft PR; the separate dispatch/persistence jobs hold issue or Actions write authority but no product-code write authority.

The existing `OPENAI_API_KEY` repository secret is required by the independent QA action and is also accepted by gh-aw for the implementation worker. gh-aw can alternatively use an existing `CODEX_API_KEY` for its own inference step, but this bootstrap requests and creates no credential. Names such as `GH_AW_CI_TRIGGER_TOKEN` may appear in the official compiler's generic manifest; this lane neither references nor requires them.

The v0.1 contract admits exactly a `$30` provider-cost authority; smaller or different claimed budgets are rejected because the compiled runtime cannot safely parameterize those controls. The implementation worker is capped at 1,000 AI credits and threat detection at 400 AI credits. Under gh-aw v0.86.2 credit accounting this fixed combined inference ceiling is below that admitted `$30` authority. Actual provider tokens, model usage, and cost telemetry remain `UNKNOWN` until an authorized run supplies reliable telemetry.

## Contract admission

An operator creates one public issue in `kw7t9rwhny-cyber/league-vector`. The issue must be created by repository owner `kw7t9rwhny-cyber` and contain exactly one marker followed by one fenced JSON object:

````text
<!-- LEAGUE_VECTOR_PRODUCT_TASK_CONTRACT_V0.1 -->

```json
{ ...one object matching task-contract.schema.json... }
```
````

Before dispatch, compute `idempotency_identity` as the SHA-256 of the canonical contract with the `idempotency_identity` field omitted. `deriveIdempotencyIdentity` in the library is the normative implementation. The contract must name exact files, not directories or globs; those files must also fit the compiled static safe profile. V0.1 admits only the exact enumerated prohibited-path, prohibited-action, and stop-condition controls in the schema; it rejects extra claimed controls rather than pretending to enforce them. A contract cannot expand the 20-file or 524,288-byte ceilings and must carry the exact supported `$30` provider-cost authority.

The issue's creator, authority actor, authorization timestamps, expiry, repository, current `main` commit and tree, required commands, stop conditions, prohibited actions, QA threshold, exact paths, and duplicate/terminal history are all re-read before inference. Authority may be at most seven days old and a contract may live at most fourteen days. Missing, moved, broad, stale, contradictory, or unverifiable state fails closed.

Before inference, deterministic infrastructure writes and reads back one exact run claim on the work item. Any trusted prior claim, implementation record, or terminal receipt blocks a second execution. Creator verification and validation dispatch must prove they belong to that same claimed workflow run and attempt.

## Execution and evidence

Dispatch `League Vector Product Task Pipeline v0.1` on `main` with only `task_contract_issue_number`. Concurrency is one lane per contract issue and `cancel-in-progress` is false. There is no scheduler, queue, retry loop, provider router, learned router, workflow database, or generic orchestration layer.

The implementation worker may edit only its isolated checkout. Its single safe output is one draft PR from an `agent/product-task-*` branch against `main`. Safe outputs block protected files, enforce the static profile, cap the patch at 20 files and 512 KiB, do not close the issue, and expose no merge, deployment, release, branch-deletion, payment, customer, or approval operation.

The repository-writing `safe_outputs` job is ineligible unless the agent job, including its immutable post-run verifier, completed successfully. Before any credentialed checkout or handler mutation, a second immutable verifier downloads the already immutable agent artifact, requires exactly one PR request and one confirmed validation request, validates the passing creator receipt, verifies the single git bundle, proves that its head descends from the admitted starting commit, and applies the exact task-specific `allowed_files`, file-count, patch-size, branch, and commit-topology controls to the same bundle the handler will consume. The broader compiled static profile remains only an additional ceiling.

Before PR creation, the immutable verifier runs, in order:

```text
npm ci
npm run validate
npx playwright install --with-deps chromium
npm run test:e2e
```

After the safe-output handler creates the draft PR, a separate deterministic job re-reads the actual bot-authored PR and dispatches exact-head validation through the existing `GITHUB_TOKEN`. Dispatch failure caused by a 401/403 produces `BLOCKED_BY_ADDITIONAL_CREDENTIAL_REQUIREMENT`; no weaker validation fallback exists.

Validation first proves the unique trusted claim and implementation-dispatch record, derives the implementation identity from the exact implementation workflow run ID and attempt, verifies that immutable run's workflow path/head/repository provenance, and proves candidate ancestry from the admitted starting commit. It emits `deterministic-evidence.json`, including both implementation and validation run IDs/attempts, expected and observed base/head/tree/paths, patch bytes, exact commands and exit states, `UNKNOWN` test counts when counts are not reliably available, contract/run/PR bindings, timestamps, and PASS/FAIL. The result is written to both the authoritative work item and candidate PR and an evidence artifact is retained for 30 days.

Only exact deterministic PASS dispatches QA. QA re-verifies the unique implementation claim/record, both exact workflow run IDs and attempts, validation workflow/run/job provenance, candidate ancestry, and all immutable bindings, then admits only the expected `github-actions[bot]` dispatcher and runs as a separate read-only actor. Infrastructure, not the model, first writes the same terminal QA record and execution receipt to the authoritative work item and PR with `accepted: false`, creates both machine-readable files, uploads the terminal artifact, and passes a separate terminal-check job. Only then may the last job publish one `accepted: true` status to the authoritative work item as the final durable transition; there is no later workflow step. Candidate movement, a missing mirror, receipt, artifact, run binding, or successful terminal job prevents acceptance.

## Public/private boundary

Public issue and PR comments carry mirrored validation, QA, and non-acceptance receipts. The task-contract issue is the sole authoritative location for the final acceptance transition, which is intentionally single-write after every mirror and artifact succeeds. Both validation and QA also emit a machine-readable artifact whose destination is exactly `PRIVATE RESEARCH SYSTEM` and whose `canonical_ingestion` is `NOT_AUTHORIZED`. No cross-repository credential or write is used. Private canonical ingestion remains a later, separately authorized step.

## Bootstrap limitations and activation checklist

- No real product task or QA model run was authorized or performed by this bootstrap.
- Exact-head validation dispatch wiring is compiled and deterministically tested, but live repository dispatch remains `UNVERIFIED` until a separately approved task is run.
- Separate QA wiring is installed and deterministically tested, but live model execution remains `UNVERIFIED` for the same reason.
- Repository Actions policy, `GITHUB_TOKEN` workflow-dispatch permission, and the existing `OPENAI_API_KEY` secret must be confirmed at activation time. A missing permission or secret is terminal; it does not authorize a new credential.
- Public-to-private canonical state propagation is intentionally not implemented.
- Creator verification is not fresh independent QA. Fresh independent QA is still required for this bootstrap candidate before Founder review can treat it as accepted.

Any source change requires rerunning `gh aw compile product-task-pipeline-v01 --strict --no-check-update --show-all --action-mode action --action-tag 6aab9e5b5c91c615506061f09bedd81a23babe3c`, `gh aw validate --strict`, recomputing both SHA-256 values in the compiler manifest, and running the focused and repository-wide verification commands. Never edit the generated lock manually. The compiler may create a transient repository-local `.gitattributes`; this candidate does not authorize that extra path, so remove it before persistence.
