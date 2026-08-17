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
          const claimMarker = 'STAGE3C_RESEARCH_ACTIVATION_CLAIM v0.1';
          const actionsBot = Object.freeze({ id: 41898282, login: 'github-actions[bot]', type: 'Bot' });
          const eligibility = (body) => {
            if (typeof body !== 'string') return null;
            const matches = [...body.matchAll(/^Eligibility: ([^\r\n]+)$/gm)];
            if (matches.length !== 1) return null;
            return matches[0][1];
          };
          const revisionCount = (body) => typeof body === 'string'
            ? [...body.matchAll(/^Fixture revision: stage3c-v0\.1-r1$/gm)].length
            : 0;
          const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
          const trustedActionsActor = (comment) =>
            comment.user?.id === actionsBot.id &&
            comment.user?.login === actionsBot.login &&
            comment.user?.type === actionsBot.type;
          const parseCanonicalClaim = (body) => {
            if (typeof body !== 'string' || body.includes('\r')) return null;
            const lines = body.split('\n');
            if (lines.length !== 9 || lines[0] !== claimMarker) return null;
            const patterns = [
              /^repository: ([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/,
              /^fixture_issue: ([1-9][0-9]*)$/,
              /^fixture_revision: (stage3c-v0\.1-r[1-9][0-9]*)$/,
              /^transition: (DORMANT->READY)$/,
              /^activation_id: ([a-f0-9]{64})$/,
              /^research_run_id: ([1-9][0-9]*)$/,
              /^research_run_number: ([1-9][0-9]*)$/,
              /^claim_status: (claimed)$/,
            ];
            const values = [];
            for (let i = 0; i < patterns.length; i += 1) {
              const match = lines[i + 1].match(patterns[i]);
              if (!match) return null;
              values.push(match[1]);
            }
            return {
              repository: values[0],
              fixtureIssue: Number(values[1]),
              fixtureRevision: values[2],
              transition: values[3],
              activationId: values[4],
              researchRunId: Number(values[5]),
              researchRunNumber: Number(values[6]),
              claimStatus: values[7],
            };
          };

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
          const sameActivationClaims = [];
          for (const comment of comments) {
            if (!trustedActionsActor(comment)) continue;
            if (typeof comment.body !== 'string') continue;
            const markerLineCount = comment.body.split('\n').filter((line) => line === claimMarker).length;
            if (markerLineCount === 0) continue;
            if (markerLineCount !== 1) return deny('activation_claim_ambiguity:duplicate_marker');
            const claim = parseCanonicalClaim(comment.body);
            if (!claim) return deny('activation_claim_ambiguity:malformed_canonical_claim');
            if (claim.activationId !== activationId) continue;
            if (
              claim.repository !== process.env.EXPECTED_REPOSITORY ||
              claim.fixtureIssue !== 53 ||
              claim.fixtureRevision !== revision ||
              claim.transition !== 'DORMANT->READY' ||
              claim.claimStatus !== 'claimed'
            ) return deny('activation_claim_ambiguity:conflicting_same_activation_metadata');
            sameActivationClaims.push(claim);
          }
          if (sameActivationClaims.length > 1) return deny('activation_claim_ambiguity:multiple_same_activation_claims');
          if (sameActivationClaims.length === 1) return deny('activation_already_claimed');

          const current = (await github.rest.issues.get({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: 53,
          })).data;
          if (current.number !== 53 || current.title !== event.issue.title) return deny('current_fixture_mismatch');
          if (current.body !== after || current.updated_at !== activationUpdatedAt) return deny('stale_activation');

          const claimBody = [
            claimMarker,
            `repository: ${process.env.EXPECTED_REPOSITORY}`,
            'fixture_issue: 53',
            `fixture_revision: ${revision}`,
            'transition: DORMANT->READY',
            `activation_id: ${activationId}`,
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

For this isolated proof, the durable activation identity is SHA-256 over the fixed repository, Issue #53, fixture revision, exact DORMANT→READY transition, hashes of the authoritative previous/current bodies, and the issue edit timestamp. Research runs are serialized by one fixed concurrency group with `cancel-in-progress: false`; therefore only one pre-activation claim transaction can run at a time. The canonical claim is an exact nine-line record written directly by the pre-activation GitHub Actions step before Codex. Only the stable GitHub Actions bot identity (`id: 41898282`, exact login and Bot type) is treated as a trusted claim source. Ordinary user-authored or merely bot-looking prose cannot become authority. Any trusted canonical-claim marker with malformed schema, duplicate markers, conflicting same-activation metadata, or multiple same-activation claims fails closed before Codex. Exactly one valid prior same-activation claim blocks replay. A valid claim for a different activation identity is stale/non-authoritative for the current activation. No ambiguous durable claim state is auto-repaired or winner-selected.

The GitHub Research-result comment is authoritative for QA. Your Codex conversation is not authoritative and must not be used as the handoff to QA.
