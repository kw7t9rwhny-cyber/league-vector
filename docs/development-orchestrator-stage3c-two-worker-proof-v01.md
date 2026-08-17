# Development Orchestrator Stage 3C — Two-Worker Autonomous Handoff Proof v0.1

## Status

Implementation candidate only. **Independent HIGH-risk QA PASS is required from both QA teams on the new exact candidate, followed by separate Founder authorization, before any live agent chain.**

Authoritative architecture: Issue #52. Fixture: Issue #53, `AGENT SPIKE TEST — harmless two-worker handoff`. No production League Vector behavior is changed.

## Architecture

```text
GitHub Issue #53 exact activation transition
  -> deterministic durable activation claim
  -> Research Worker A (fresh Codex)
  -> durable STAGE3C_RESEARCH_RESULT v0.1 comment
  -> authoritative GitHub workflow_run completion
  -> deterministic Research-authority precheck
  -> QA Worker B (fresh independent Codex)
  -> durable STAGE3C_QA_RESULT v0.1 PASS|FAIL comment
```

Worker A and Worker B are separate Agentic Workflows and separate Codex executions. Worker B receives no Worker A session/thread/chain-of-thought state. Durable GitHub evidence is the only A→B handoff.

## Exact Worker A activation contract and durable idempotency

Worker A's Codex job is gated by a deterministic gh-aw pre-activation step. It starts authoritatively only when all conditions hold:

- repository is exactly `kw7t9rwhny-cyber/league-vector`;
- issue is exactly #53 with the exact fixture title;
- `GITHUB_RUN_ATTEMPT` is exactly `1`;
- prior issue body is present and contains exactly one `Fixture revision: stage3c-v0.1-r1` and exactly one `Eligibility: DORMANT`;
- current issue body is present and contains exactly one identical fixture revision and exactly one `Eligibility: READY`;
- current body is byte-for-byte the prior body except for the single exact `Eligibility: DORMANT` → `Eligibility: READY` replacement;
- the event issue edit timestamp is well formed and still matches live Issue #53 state;
- durable activation-claim evidence is unambiguous and resolves to zero prior claims for this activation.

The activation identity is SHA-256 over a canonical record containing the exact repository, Issue #53, fixture revision, `DORMANT->READY` transition, SHA-256 of the prior body, SHA-256 of the current body, and the authoritative issue edit timestamp. A duplicate delivery of the same historical transition therefore has the same activation identity. A future explicitly authorized fixture revision has a distinct namespace/identity.

### Canonical activation-claim schema

The one accepted claim representation is exactly nine LF-delimited lines, in this exact order, with no extra lines, duplicate fields, carriage returns, alternate whitespace, or prose:

```text
STAGE3C_RESEARCH_ACTIVATION_CLAIM v0.1
repository: kw7t9rwhny-cyber/league-vector
fixture_issue: 53
fixture_revision: stage3c-v0.1-r1
transition: DORMANT->READY
activation_id: <64 lowercase hex>
research_run_id: <positive integer>
research_run_number: <positive integer>
claim_status: claimed
```

The authority-bearing source identity is the stable GitHub Actions bot identity: numeric user id `41898282`, exact login `github-actions[bot]`, and type `Bot`. A username string, `Bot` type, or marker text alone is never authority. User-authored spoofed prose and merely bot-looking identities are ignored and cannot authorize or establish a claim.

Trusted GitHub-Actions-authored claim evidence is parsed strictly. An exact canonical marker from that trusted source with a malformed/truncated schema, duplicate marker, invalid hash, malformed run correlation, noncanonical whitespace, or conflicting same-activation repository/fixture/revision/transition/status is an ambiguity and fails closed before Codex. The parser never picks first/last/newest/oldest evidence and never silently repairs or deletes contradictory records.

For the current activation identity:

- zero valid prior claims and no ambiguous trusted claim evidence → the pre-activation step may create the first canonical claim;
- exactly one valid prior same-activation claim → replay is blocked before Codex;
- more than one valid same-activation claim → ambiguity, fail closed before Codex;
- any malformed/conflicting trusted same-claim evidence → ambiguity, fail closed before Codex;
- a valid canonical claim for a different activation identity or future different fixture revision has no authority over the current activation.

Before Codex starts, the deterministic pre-activation job writes the canonical claim directly to fixed Issue #53. This writer is not the Codex model and its write permission is restricted to the pre-activation GitHub Actions job. Research workflow concurrency is fixture-specific with `cancel-in-progress: false`. The fixed concurrency group serializes Research workflow executions so two duplicate starts cannot execute their pre-activation claim transactions concurrently: the first running execution either establishes durable claim state or fails; a later execution re-reads that durable state before its Codex gate can become reachable. No claim state is auto-recovered.

READY→READY, UNKNOWN→READY, missing/malformed prior/current body, duplicate eligibility/revision markers, wrong issue/repository/title, same-run reruns, duplicate event delivery, sequential replay after the first Research run, stale events, unrelated body edits, malformed trusted claims, conflicting claims, duplicate same-activation claims, duplicate markers, and noncanonical claim records all fail before the Codex agent job. Worker A has a 10-minute agent timeout.

## Exact Worker B authority contract

The `workflow_run` event is only the outer trigger. A deterministic pre-activation step must additionally prove all Research authority before QA's Codex job starts:

- expected repository and non-fork Research repository;
- exact workflow name `Stage 3C Research Worker A`;
- exact workflow path `.github/workflows/stage3c-research-worker.lock.yml`;
- Research event `issues`, branch `main`, conclusion `success`, run attempt `1`;
- well-formed authoritative Research run ID and run number;
- exact Issue #53/title, revision `stage3c-v0.1-r1`, and current READY state;
- exactly one durable `STAGE3C_RESEARCH_RESULT v0.1` comment correlated to that Research run ID;
- comment author is `github-actions[bot]`/Bot;
- required marker, worker role, fixture/revision, run ID/run number, source path and completion status appear exactly once;
- observed fact is exactly one of `exists` or `missing`;
- Research comment creation timestamp falls within the triggering Research run's authoritative start/completion window;
- no prior QA marker exists for the same Research-run correlation.

Failed/cancelled/skipped/timed-out Research, wrong workflow/path/branch/repository/fixture/revision, fake/manual markers, stale/different-run markers, duplicate/conflicting markers, out-of-window results, replayed Research attempts, and duplicate QA authority all fail before the QA Codex job.

QA concurrency is keyed to the authoritative Research run ID with `cancel-in-progress: false`; there is no downstream B→C autonomous trigger. QA timeout is 10 minutes.

## Agent permissions and effective generated-lock security

Both model-facing agent jobs are limited to:

```yaml
contents: read
issues: read
```

The generated Codex GitHub MCP is explicitly read-only (`GITHUB_READ_ONLY=1`). No model-facing job has a GitHub write permission.

Worker A's deterministic pre-activation job alone requires `issues: write` to create the fixed Issue #53 activation claim before Codex starts. This credential is held by the GitHub Actions pre-activation step, never exposed to the Codex agent. The executable lock audit requires the pre-activation block to contain the exact activation-claim marker, stable GitHub Actions bot id, strict parser/ambiguity denials, `issue_number: 53`, and `createComment`, and forbids content/PR/actions writes there. Worker B's pre-activation remains `issues: read` only.

The executable `.lock.yml` files are audited directly, not inferred from Markdown sources. They must contain none of:

- `contents: write`
- `pull-requests: write`
- `actions: write`
- `deployments: write`
- `packages: write`
- `administration: write`
- status/check write permissions

Safe outputs explicitly disable default failure-issue, missing-tool, missing-data and noop reporting channels. Mandatory framework `report_incomplete` remains non-authoritative and is configured with `create-issue: false`. The only application safe output is `add-comment`, `max: 1`, fixed to Issue `53`, with issues enabled and pull requests/discussions disabled. No PR creation, label mutation, merge, branch mutation, release, deployment, workflow dispatch or production publishing output is declared.

The write-capable safe-output handler is separate from the read-only Codex agent job.

## Engine and secret boundary

Both workers use `engine: codex`. The Founder-approved `OPENAI_API_KEY` remains a repository Actions secret. Its value is never requested, retrieved, printed, logged, committed, included in prompts/comments/artifacts, or used as a GitHub credential. The generated runtime references the secret name only through native gh-aw/Codex engine authentication. No PAT is introduced.

## Hardened workflow generation

Sources:

- `.github/workflows/stage3c-research-worker.md`
- `.github/workflows/stage3c-qa-worker.md`

Executable compiler output:

- `.github/workflows/stage3c-research-worker.lock.yml`
- `.github/workflows/stage3c-qa-worker.lock.yml`

The locks are exact output from official `gh-aw` v0.86.2 strict compilation and are never hand-edited. Validation downloads the official Linux AMD64 binary and verifies SHA-256:

`b8fd100d1d56a77b842ad28375ff361215a5aa1277db6b9a05d70054cde7260e`

Strict source validation is followed by deterministic strict compilation with the gh-aw runtime repository fixed to `github/gh-aw-actions` and exact runtime commit `6aab9e5b5c91c615506061f09bedd81a23babe3c`. Validation byte-compares regenerated locks against the committed executable locks and audits effective generated permissions/write-handler configuration. The final validation workflow itself is `contents: read` only and invokes no Codex/OpenAI inference.

## Evidence correction

For the superseded candidate `b259f2a75c880bf31c45e6dc49f07391bdec2ee6`, the independently verified exact-head Stage 3C compile-validation workflow run was **31985315552**, not `31985315559`. The earlier handoff's `31985315559` reference was incorrect and is superseded by this correction.

## Production firewall

No Stage 3C work changes Projection, Dynasty Value, Rookie, IDP, scoring, Sleeper integration, depth-chart models, production UI, deployment or release behavior. There is no `pull_request_target`, automatic merge/deploy/release, or Founder-decision automation.

## Live proof — NOT AUTHORIZED

Issue #53 must remain `Eligibility: DORMANT` throughout implementation QA. After both Independent HIGH-risk QA PASS verdicts on the new exact candidate and Founder separately authorizes the proof, the future proof consists of one exact DORMANT→READY fixture edit followed by zero Founder/Cody action between Research and QA. Any manual prompt copy or QA dispatch is a proof failure.
