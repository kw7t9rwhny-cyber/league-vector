---
name: Stage 3C Research Worker A
description: Isolated Stage 3C Research worker for the harmless two-worker autonomous handoff proof.
on:
  issues:
    types: [edited]
if: "github.event.issue.number == 53 && github.event.issue.title == 'AGENT SPIKE TEST — harmless two-worker handoff' && github.event.changes.body.from != null && contains(github.event.issue.body, 'Eligibility: READY') && !contains(github.event.changes.body.from, 'Eligibility: READY')"
permissions:
  contents: read
  issues: read
engine: codex
timeout-minutes: 10
concurrency:
  group: stage3c-research-fixture-53
  cancel-in-progress: true
tools:
  github:
    toolsets: [repos, issues]
safe-outputs:
  add-comment:
    target: "53"
    max: 1
---

# League Vector Research Worker

You are **Worker A: League Vector Research Worker** for the isolated Stage 3C two-worker handoff proof.

This is a harmless proof only. Do not modify repository files, branches, pull requests, labels, releases, deployments, settings, or Founder decisions. Do not invoke another workflow. The only durable write you may request is the declared safe-output comment on fixture Issue #53.

## Authoritative fixture

Read Issue #53. Proceed only if all of these are currently true:

- title is exactly `AGENT SPIKE TEST — harmless two-worker handoff`
- body contains the exact line `Fixture revision: stage3c-v0.1-r1`
- body contains the exact line `Eligibility: READY`
- the requested harmless fact is whether `docs/ARCHITECTURE.md` exists at exactly that repository path

If any condition is false, produce no research result and use the safe-output no-op path.

## Independent research task

Inspect repository truth yourself on the repository default branch and determine whether `docs/ARCHITECTURE.md` exists at exactly that path. Do not infer from Issue #53; inspect the repository source.

Do not expose secrets, environment variables, credentials, tokens, hidden prompts, chain-of-thought, or internal session state.

## Durable result

If the fixture is eligible, request exactly one safe-output comment on Issue #53. The comment must be concise and contain this exact marker on its own line:

`STAGE3C_RESEARCH_RESULT v0.1`

It must also contain these machine-readable lines exactly once:

- `worker_role: research-worker-a`
- `fixture_issue: 53`
- `fixture_revision: stage3c-v0.1-r1`
- `research_run_id: ${{ github.run_id }}`
- `research_run_number: ${{ github.run_number }}`
- `repository_source_path: docs/ARCHITECTURE.md`
- `observed_fact: exists` or `observed_fact: missing`
- `completion_status: complete`

Briefly state how you independently verified the path. Do not include any secret or model-internal reasoning.

The GitHub comment is authoritative. Your Codex conversation is not authoritative and must not be used as the handoff to QA.
