---
name: Stage 3C Research Worker A
description: Isolated Stage 3C Research worker for the harmless two-worker autonomous handoff proof.
on:
  issues:
    types: [edited]
  steps:
    - name: Prove exact authoritative DORMANT to READY fixture transition
      id: exact_transition
      env:
        EXPECTED_REPOSITORY: kw7t9rwhny-cyber/league-vector
      run: |
        node <<'NODE'
        const fs = require('node:fs');
        const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
        const fail = (why) => { console.error(`stage3c_research_activation_denied:${why}`); process.exit(1); };
        const eligibility = (body) => {
          if (typeof body !== 'string') return null;
          const matches = [...body.matchAll(/^Eligibility: ([^\r\n]+)$/gm)];
          if (matches.length !== 1) return null;
          return matches[0][1];
        };
        const revisionCount = (body) => typeof body === 'string'
          ? [...body.matchAll(/^Fixture revision: stage3c-v0\.1-r1$/gm)].length
          : 0;
        if (process.env.GITHUB_RUN_ATTEMPT !== '1') fail('replayed_run');
        if (event.repository?.full_name !== process.env.EXPECTED_REPOSITORY) fail('wrong_repository');
        if (event.issue?.number !== 53) fail('wrong_issue');
        if (event.issue?.title !== 'AGENT SPIKE TEST — harmless two-worker handoff') fail('wrong_title');
        const before = event.changes?.body?.from;
        const after = event.issue?.body;
        if (typeof before !== 'string') fail('missing_previous_body');
        if (typeof after !== 'string') fail('missing_current_body');
        if (revisionCount(before) !== 1 || revisionCount(after) !== 1) fail('invalid_fixture_revision');
        if (eligibility(before) !== 'DORMANT') fail('previous_not_dormant');
        if (eligibility(after) !== 'READY') fail('current_not_ready');
        const expectedAfter = before.replace(/^Eligibility: DORMANT$/m, 'Eligibility: READY');
        if (after !== expectedAfter) fail('body_changed_beyond_authorized_transition');
        console.log('stage3c_research_activation_authorized');
        NODE
if: needs.pre_activation.outputs.exact_transition_result == 'success'
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
    issues: true
    pull-requests: false
    discussions: false
---

# League Vector Research Worker

You are **Worker A: League Vector Research Worker** for the isolated Stage 3C two-worker handoff proof.

The deterministic pre-activation gate has already proven the exact authoritative Issue #53 body transition `Eligibility: DORMANT` → `Eligibility: READY`, on the expected repository, on run attempt 1, with no other body change. Do not reinterpret or weaken that contract.

This is a harmless proof only. Do not modify repository files, branches, pull requests, labels, releases, deployments, settings, or Founder decisions. Do not invoke another workflow. The only durable write you may request is the declared safe-output comment on fixture Issue #53.

## Authoritative fixture

Read Issue #53. Proceed only if all of these are currently true:

- title is exactly `AGENT SPIKE TEST — harmless two-worker handoff`
- body contains the exact line `Fixture revision: stage3c-v0.1-r1` exactly once
- body contains the exact line `Eligibility: READY` exactly once
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
