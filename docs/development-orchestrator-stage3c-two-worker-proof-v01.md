# Development Orchestrator Stage 3C — Two-Worker Autonomous Handoff Proof v0.1

## Status

Implementation candidate only. **Do not run the live agent chain before both independent HIGH-risk QA teams PASS the new exact candidate and Founder separately authorizes the proof.**

Authoritative architecture: Issue #52. Fixture: Issue #53, `AGENT SPIKE TEST — harmless two-worker handoff`. No production League Vector behavior is changed.

## Architecture

```text
GitHub Issue #53 exact activation transition
  -> Research Worker A (fresh Codex)
  -> durable STAGE3C_RESEARCH_RESULT v0.1 comment
  -> authoritative GitHub workflow_run completion
  -> deterministic Research-authority precheck
  -> QA Worker B (fresh independent Codex)
  -> durable STAGE3C_QA_RESULT v0.1 PASS|FAIL comment
```

Worker A and Worker B are separate Agentic Workflows and separate Codex executions. Worker B receives no Worker A session/thread/chain-of-thought state. Durable GitHub evidence is the only A→B handoff.

## Exact Worker A activation contract

Worker A's Codex job is gated by a deterministic gh-aw pre-activation step. It starts authoritatively only when all conditions hold:

- repository is exactly `kw7t9rwhny-cyber/league-vector`;
- issue is exactly #53 with the exact fixture title;
- `GITHUB_RUN_ATTEMPT` is exactly `1`;
- prior issue body is present and contains exactly one `Fixture revision: stage3c-v0.1-r1` and exactly one `Eligibility: DORMANT`;
- current issue body is present and contains exactly one identical fixture revision and exactly one `Eligibility: READY`;
- current body is byte-for-byte the prior body except for the single exact `Eligibility: DORMANT` → `Eligibility: READY` replacement.

READY→READY, UNKNOWN→READY, missing/malformed prior/current body, duplicate eligibility/revision markers, wrong issue/repository/title, replayed run attempts, and unrelated body edits all fail before the Codex agent job.

Worker A has fixture-specific concurrency with `cancel-in-progress: true` and a 10-minute agent timeout.

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

The executable `.lock.yml` files are audited directly, not inferred from Markdown sources. They must contain none of:

- `contents: write`
- `pull-requests: write`
- `actions: write`
- `deployments: write`
- `packages: write`
- `administration: write`
- status/check write permissions

Safe outputs explicitly disable default failure-issue, missing-tool, missing-data and noop reporting channels. The only application safe output is `add-comment`, `max: 1`, fixed to Issue `53`, with issues enabled and pull requests/discussions disabled. No PR creation, label mutation, merge, branch mutation, release, deployment, workflow dispatch or production publishing output is declared.

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

It strict-compiles both sources, strict-validates both, byte-compares regenerated locks against the committed executable locks, and audits effective generated permissions/write-handler configuration. The final validation workflow itself is `contents: read` only and invokes no Codex/OpenAI inference.

## Evidence correction

For the superseded candidate `b259f2a75c880bf31c45e6dc49f07391bdec2ee6`, the independently verified exact-head Stage 3C compile-validation workflow run was **31985315552**, not `31985315559`. The earlier handoff's `31985315559` reference was incorrect and is superseded by this correction.

## Production firewall

No Stage 3C work changes Projection, Dynasty Value, Rookie, IDP, scoring, Sleeper integration, depth-chart models, production UI, deployment or release behavior. There is no `pull_request_target`, automatic merge/deploy/release, or Founder-decision automation.

## Live proof — NOT AUTHORIZED

Issue #53 must remain `Eligibility: DORMANT` throughout implementation QA. After both independent HIGH-risk QA teams PASS the new exact candidate and Founder separately authorizes the proof, the future proof consists of one exact DORMANT→READY fixture edit followed by zero Founder/Cody action between Research and QA. Any manual prompt copy or QA dispatch is a proof failure.
