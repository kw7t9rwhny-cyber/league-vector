---
name: Stage 3C Research Worker A
description: Isolated Stage 3C Research worker for the harmless two-worker autonomous handoff proof.
on:
  issues:
    types: [edited]
  permissions:
    issues: write
  steps:
    - name: Prove exact authoritative DORMANT to READY transition and claim activation once
      id: exact_transition
      uses: actions/github-script@v9
      env:
        EXPECTED_REPOSITORY: kw7t9rwhny-cyber/league-vector
      with:
        script: |
          const crypto = require('node:crypto');
          const deny = (why) => core.setFailed(`stage3c_research_activation_denied:${why}`);
          const event = context.payload;
          const revision = 'stage3c-v0.1-r1';
          const eligibility = (body) => {
            if (typeof body !== 'string') return null;
            const matches = [...body.matchAll(/^Eligibility: ([^\r\n]+)$/gm)];
            if (matches.length !== 1) return null;
            return matches[0][1];
          };
          const revisionCount = (body) => typeof body === 'string'
            ? [...body.matchAll(/^Fixture revision: stage3c-v0\.1-r1$/gm)].length
            : 0;
          const exactLineCount = (text, line) => typeof text === 'string'
            ? text.split(/\r?\n/).filter((value) => value === line).length
            : 0;
          const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

          if (process.env.GITHUB_RUN_ATTEMPT !== '1') return deny('replayed_run');
          if (event.repository?.full_name !== process.env.EXPECTED_REPOSITORY) return deny('wrong_repository');
          if (event.issue?.number !== 53) return deny('wrong_issue');
          if (event.issue?.title !== 'AGENT SPIKE TEST — harmless two-worker handoff') return deny('wrong_title');
          const before = event.changes?.body?.from;
          const after = event.issue?.body;
          if (typeof before !== 'string') return deny('missing_previous_body');
          if (typeof after !== 'string') return deny('missing_current_body');
          if (revisionCount(before) !== 1 || revisionCount(after) !== 1) return deny('invalid_fixture_revision');
          if (eligibility(before) !== 'DORMANT') return deny('previous_not_dormant');
          if (eligibility(after) !== 'READY') return deny('current_not_ready');
          const expectedAfter = before.replace(/^Eligibility: DORMANT$/m, 'Eligibility: READY');
          if (after !== expectedAfter) return deny('body_changed_beyond_authorized_transition');

          const activationUpdatedAt = event.issue?.updated_at;
          if (typeof activationUpdatedAt !== 'string' || !Number.isFinite(Date.parse(activationUpdatedAt))) return deny('malformed_activation_identity');
          const activationMaterial = JSON.stringify({
            repository: process.env.EXPECTED_REPOSITORY,
            fixture_issue: 53,
            fixture_revision: revision,
            transition: 'DORMANT->READY',
            previous_body_sha256: sha256(before),
            current_body_sha256: sha256(after),
            issue_updated_at: activationUpdatedAt,
          });
          const activationId = sha256(activationMaterial);
          if (!/^[a-f0-9]{64}$/.test(activationId)) return deny('malformed_activation_identity');

          const comments = await github.paginate(github.rest.issues.listComments, {
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: 53,
            per_page: 100,
          });
          const activationIdLine = `activation_id: ${activationId}`;
          const priorClaims = comments.filter((comment) =>
            comment.user?.login === 'github-actions[bot]' &&
            comment.user?.type === 'Bot' &&
            exactLineCount(comment.body, 'STAGE3C_RESEARCH_ACTIVATION_CLAIM v0.1') === 1 &&
            exactLineCount(comment.body, activationIdLine) === 1 &&
            exactLineCount(comment.body, 'fixture_issue: 53') === 1 &&
            exactLineCount(comment.body, `fixture_revision: ${revision}`) === 1 &&
            exactLineCount(comment.body, 'transition: DORMANT->READY') === 1 &&
            exactLineCount(comment.body, 'claim_status: claimed') === 1
          );
          if (priorClaims.length !== 0) return deny('activation_already_claimed');

          const current = (await github.rest.issues.get({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: 53,
          })).data;
          if (current.number !== 53 || current.title !== event.issue.title) return deny('current_fixture_mismatch');
          if (current.body !== after || current.updated_at !== activationUpdatedAt) return deny('stale_activation');

          const claimBody = [
            'STAGE3C_RESEARCH_ACTIVATION_CLAIM v0.1',
            activationIdLine,
            'fixture_issue: 53',
            `fixture_revision: ${revision}`,
            'transition: DORMANT->READY',
            `research_run_id: ${context.runId}`,
            `research_run_number: ${context.runNumber}`,
            'claim_status: claimed',
          ].join('\n');
          await github.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: 53,
            body: claimBody,
          });
          core.info(`stage3c_research_activation_claimed:${activationId}`);
if: needs.pre_activation.outputs.exact_transition_result == 'success'
permissions:
  contents: read
  issues: read
engine: codex
timeout-minutes: 10
concurrency:
  group: stage3c-research-fixture-53
  cancel-in-progress: false
tools:
  github:
    toolsets: [repos, issues]
safe-outputs:
  report-failure-as-issue: false
  report-incomplete:
    create-issue: false
  missing-tool: false
  missing-data: false
  noop: false
  add-comment:
    target: "53"
    max: 1
    issues: true
    pull-requests: false
    discussions: false
---

# League Vector Research Worker

You are **Worker A: League Vector Research Worker** for the isolated Stage 3C two-worker handoff proof.

The deterministic pre-activation gate has already proven the exact authoritative Issue #53 body transition `Eligibility: DORMANT` → `Eligibility: READY`, on the expected repository, on run attempt 1, with no other body change. It also created the one durable deterministic activation claim for this exact event identity before Codex was allowed to start. Do not reinterpret or weaken that contract.

This is a harmless proof only. Do not modify repository files, branches, pull requests, labels, releases, deployments, settings, or Founder decisions. Do not invoke another workflow. The only durable write you may request is the declared safe-output comment on fixture Issue #53.

## Authoritative fixture

Read Issue #53. Proceed only if all of these are currently true:

- title is exactly `AGENT SPIKE TEST — harmless two-worker handoff`
- body contains the exact line `Fixture revision: stage3c-v0.1-r1` exactly once
- body contains the exact line `Eligibility: READY` exactly once
- the requested harmless fact is whether `docs/ARCHITECTURE.md` exists at exactly that repository path

If any condition is false, produce no research result and make no durable Research-result write. Fail closed.

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

For this isolated proof, the durable activation identity is SHA-256 over the fixed repository, Issue #53, fixture revision, exact DORMANT→READY transition, hashes of the authoritative previous/current bodies, and the issue edit timestamp. Research runs are serialized. The first authorized delivery creates one GitHub Actions activation-claim comment before Codex starts; any later workflow run for the same activation sees that durable claim and fails closed. The claim is the sole replay-idempotency record for this bounded proof. A genuinely new future authorized fixture revision has a distinct activation identity and requires an explicit source/test revision before eligibility.

The GitHub Research-result comment is authoritative for QA. Your Codex conversation is not authoritative and must not be used as the handoff to QA.
