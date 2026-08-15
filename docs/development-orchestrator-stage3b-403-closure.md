# Development Orchestrator Stage 3B — First-Live-Test 403 Closure

## Scope

This is one targeted Stage 3B closure remediation. It does not add a new architecture stage, widen autonomy, retry PR #50, or perform any live mutation.

Authoritative failed live run: `31881477787`.

Target: PR #50 at `a520c717738b4e5209c2a6fbf2319e878a2e126c`.

Attempted mutation: `ADD_LABEL status:ready-for-qa`.

Observed fail-closed reason from the original audit:

`write_failed:ADD_LABEL:status:ready-for-qa:github_http_403:add_label`

Exactly one write was attempted, zero completed, no rollback was required, and `manual_review_required=true`.

## What can and cannot be proven from the historical 403

The historical adapter discarded GitHub's error body and response metadata. Therefore the exact GitHub server message that accompanied the HTTP 403 cannot be reconstructed from run `31881477787`. This remediation does not guess that message.

GitHub's REST documentation for `POST /repos/{owner}/{repo}/issues/{issue_number}/labels` states that either `Issues: write` or `Pull requests: write` is sufficient. The failed execute job reported effective `Issues: write`, so this remediation does **not** broaden permissions to `pull-requests:write` without proof.

The available repository integration cannot inspect the repository-level default Actions workflow-permission setting (`GET /actions/permissions/workflow` returns 403 to the integration), but the failed runner itself reported effective job permissions `Contents: read`, `Issues: write`, `PullRequests: read`.

## Independent live configuration finding

The repository label catalog currently does not contain the canonical label `status:ready-for-qa`. That is a separate prerequisite/configuration defect for the planned transaction. The controlled write adapter now performs a read-only repository-label preflight before `ADD_LABEL` and fails with:

`canonical_repository_label_missing:<label>`

before issuing a mutation POST when the canonical repository label does not exist.

This does not create labels. Canonical label provisioning remains an explicit repository configuration step outside the Stage 3B mutation allowlist.

## Safe GitHub error diagnostics

Failed GitHub requests now preserve only a narrow diagnostic object:

- HTTP status
- endpoint/action classification
- GitHub `message`
- GitHub `documentation_url` only when it is an `https://docs.github.com/` URL
- `x-github-request-id` when it matches the safe request-ID grammar

Tokens, Authorization headers, GitHub token-like values, credentials, and arbitrary response fields are not retained. Diagnostic text is length-bounded and credential patterns are redacted.

The diagnostic is carried through the existing Stage 3B `aborted_reason`, so the protected audit for a future independently authorized test will preserve the server-side denial reason without exposing credentials.

## Failure behavior preserved

A GitHub write denial still:

- stops immediately
- performs no automatic retry
- performs no secondary mutation
- records zero completed mutations when the first write failed
- performs no rollback when nothing completed
- reports `failed-or-partial`
- sets `manual_review_required=true`

All replay, Environment, exact-head, QA, Founder, dependency, research-firewall, label allowlist, and per-write revalidation gates remain unchanged.

## Permission delta

None.

Controlled execute remains:

- `contents: read`
- `pull-requests: read`
- `issues: write`

No broader permission is introduced by this closure remediation.

## Live retry status

No retry is authorized or performed by this candidate. PR #50 remains a diagnostic fixture only until this closure remediation receives independent HIGH-risk QA and the missing canonical repository label/configuration prerequisite is separately resolved.
