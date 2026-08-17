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
          const revision = 'stage3c-v0.1-r3';
          const claimMarker = 'STAGE3C_RESEARCH_ACTIVATION_CLAIM v0.1';
          const claimSchema = 'stage3c-activation-claim/v1';
          const actionsBot = Object.freeze({ id: 41898282, login: 'github-actions[bot]', type: 'Bot' });
          const allowedPermissions = new Set(['admin', 'maintain', 'write']);
          const eligibility = (body) => {
            if (typeof body !== 'string') return null;
            const matches = [...body.matchAll(/^Eligibility: ([^\r\n]+)$/gm)];
            if (matches.length !== 1) return null;
            return matches[0][1];
          };
          const revisionCount = (body) => typeof body === 'string'
            ? [...body.matchAll(/^Fixture revision: stage3c-v0\.1-r3$/gm)].length
            : 0;
          const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
          const trustedActionsActor = (comment) =>
            comment.user?.id === actionsBot.id &&
            comment.user?.login === actionsBot.login &&
            comment.user?.type === actionsBot.type;
          const claimFamilyLine = (line) =>
            typeof line === 'string' && /^stage3c_research_activation_claim(?:\s|$)/i.test(line.trim());
          const authorityRelevantClaimRecord = (body) =>
            typeof body === 'string' && body.split('\n').some((line) => claimFamilyLine(line));
          const parseCanonicalClaim = (body) => {
            if (typeof body !== 'string' || body.includes('\r')) return null;
            const lines = body.split('\n');
            if (lines.length !== 10 || lines[0] !== claimMarker || lines[1] !== `schema: ${claimSchema}`) return null;
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
              const match = lines[i + 2].match(patterns[i]);
              if (!match) return null;
              values.push(match[1]);
            }
            return { repository: values[0], fixtureIssue: Number(values[1]), fixtureRevision: values[2], transition: values[3], activationId: values[4], researchRunId: Number(values[5]), researchRunNumber: Number(values[6]), claimStatus: values[7] };
          };
          const isRetryableTransport = (error) => {
            const status = Number(error?.status);
            if (status === 429 || [500, 502, 503, 504].includes(status)) return true;
            const code = String(error?.code || error?.cause?.code || '');
            return ['ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPIPE'].includes(code) || /timeout|timed out|connection reset|socket hang up/i.test(String(error?.message || ''));
          };
          const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

          if (process.env.GITHUB_RUN_ATTEMPT !== '1') return deny('replayed_run');
          if (event.repository?.full_name !== process.env.EXPECTED_REPOSITORY) return deny('wrong_repository');
          if (event.issue?.number !== 53) return deny('wrong_issue');
          if (event.issue?.title !== 'AGENT SPIKE TEST — harmless two-worker handoff') return deny('wrong_title');

          // gh-aw's membership helper is advisory on transport failure. This workflow therefore
          // independently establishes positive actor authority before any authority write.
          const sender = event.sender;
          if (!sender || !Number.isInteger(sender.id) || typeof sender.login !== 'string' || sender.login.length === 0 || sender.type !== 'User') return deny('malformed_actor');
          let permissionData;
          try {
            permissionData = (await github.rest.repos.getCollaboratorPermissionLevel({ owner: context.repo.owner, repo: context.repo.repo, username: sender.login })).data;
          } catch (error) {
            return deny(`actor_authority_unavailable:${Number(error?.status) || 'transport'}`);
          }
          if (permissionData?.user?.login !== sender.login || !Number.isInteger(permissionData?.user?.id) || permissionData.user.id !== sender.id) return deny('actor_identity_mismatch');
          if (typeof permissionData?.permission !== 'string' || !allowedPermissions.has(permissionData.permission)) return deny('actor_not_authorized');

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
          const activationMaterial = JSON.stringify({ repository: process.env.EXPECTED_REPOSITORY, fixture_issue: 53, fixture_revision: revision, transition: 'DORMANT->READY', previous_body_sha256: sha256(before), current_body_sha256: sha256(after), issue_updated_at: activationUpdatedAt });
          const activationId = sha256(activationMaterial);
          if (!/^[a-f0-9]{64}$/.test(activationId)) return deny('malformed_activation_identity');

          const classifyClaims = async () => {
            let comments;
            try {
              comments = await github.paginate(github.rest.issues.listComments, { owner: context.repo.owner, repo: context.repo.repo, issue_number: 53, per_page: 100 });
            } catch (error) {
              return { state: 'UNKNOWN', reason: `claim_read_unavailable:${Number(error?.status) || 'transport'}` };
            }
            const sameActivationClaims = [];
            for (const comment of comments) {
              if (!trustedActionsActor(comment)) continue;
              if (!authorityRelevantClaimRecord(comment.body)) continue;
              const lines = comment.body.split('\n');
              const familyMarkerLines = lines.filter((line) => claimFamilyLine(line));
              if (familyMarkerLines.length !== 1) return { state: 'INVALID', reason: 'activation_claim_ambiguity:duplicate_marker' };
              if (lines[0] !== claimMarker) return { state: 'INVALID', reason: 'activation_claim_ambiguity:unsupported_marker_version' };
              if (lines[1] !== `schema: ${claimSchema}`) return { state: 'INVALID', reason: 'activation_claim_ambiguity:unsupported_schema_version' };
              const claim = parseCanonicalClaim(comment.body);
              if (!claim) return { state: 'INVALID', reason: 'activation_claim_ambiguity:malformed_canonical_claim' };
              if (claim.activationId !== activationId) continue;
              if (claim.repository !== process.env.EXPECTED_REPOSITORY || claim.fixtureIssue !== 53 || claim.fixtureRevision !== revision || claim.transition !== 'DORMANT->READY' || claim.claimStatus !== 'claimed') return { state: 'INVALID', reason: 'activation_claim_ambiguity:conflicting_same_activation_metadata' };
              sameActivationClaims.push(claim);
            }
            if (sameActivationClaims.length > 1) return { state: 'INVALID', reason: 'activation_claim_ambiguity:multiple_same_activation_claims' };
            if (sameActivationClaims.length === 0) return { state: 'NONE' };
            const claim = sameActivationClaims[0];
            if (claim.researchRunId === context.runId && claim.researchRunNumber === context.runNumber) return { state: 'CLAIMED_THIS_RUN', claim };
            return { state: 'CLAIMED_OTHER_RUN', claim };
          };

          const prewrite = await classifyClaims();
          if (prewrite.state === 'UNKNOWN' || prewrite.state === 'INVALID') return deny(prewrite.reason);
          if (prewrite.state === 'CLAIMED_OTHER_RUN') return deny('activation_already_claimed');
          if (prewrite.state === 'CLAIMED_THIS_RUN') {
            core.info(`stage3c_research_activation_reconciled:${activationId}`);
            return;
          }

          const current = (await github.rest.issues.get({ owner: context.repo.owner, repo: context.repo.repo, issue_number: 53 })).data;
          if (current.number !== 53 || current.title !== event.issue.title) return deny('current_fixture_mismatch');
          if (current.body !== after || current.updated_at !== activationUpdatedAt) return deny('stale_activation');

          const claimBody = [claimMarker, `schema: ${claimSchema}`, `repository: ${process.env.EXPECTED_REPOSITORY}`, 'fixture_issue: 53', `fixture_revision: ${revision}`, 'transition: DORMANT->READY', `activation_id: ${activationId}`, `research_run_id: ${context.runId}`, `research_run_number: ${context.runNumber}`, 'claim_status: claimed'].join('\n');
          const maxWriteAttempts = 2;
          for (let attempt = 1; attempt <= maxWriteAttempts; attempt += 1) {
            let writeError = null;
            try {
              await github.rest.issues.createComment({ owner: context.repo.owner, repo: context.repo.repo, issue_number: 53, body: claimBody });
            } catch (error) {
              writeError = error;
            }

            // Transport outcome never establishes authority. Always read back durable state,
            // including after HTTP 201, before allowing Codex progression.
            const readback = await classifyClaims();
            if (readback.state === 'CLAIMED_THIS_RUN') {
              core.info(`stage3c_research_activation_claimed_and_verified:${activationId}`);
              return;
            }
            if (readback.state === 'CLAIMED_OTHER_RUN') return deny('activation_already_claimed');
            if (readback.state === 'UNKNOWN' || readback.state === 'INVALID') return deny(readback.reason);

            if (!writeError) return deny('claim_write_success_but_readback_zero');
            if (!isRetryableTransport(writeError)) return deny(`claim_write_nonretryable:${Number(writeError?.status) || 'transport'}`);
            if (attempt === maxWriteAttempts) return deny('claim_unestablished_after_bounded_retry');
            await sleep(1000 * attempt);
          }
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

The deterministic pre-activation gate has already proven positive actor authority, the exact authoritative Issue #53 body transition `Eligibility: DORMANT` → `Eligibility: READY`, on the expected repository, on run attempt 1, with no other body change. It also reconciled exactly one durable deterministic activation claim for this exact event/run identity before Codex was allowed to start. Do not reinterpret or weaken that contract.

This is a harmless proof only. Do not modify repository files, branches, pull requests, labels, releases, deployments, settings, or Founder decisions. Do not invoke another workflow. The only durable write you may request is the declared safe-output comment on fixture Issue #53.

## Authoritative fixture

Read Issue #53. Proceed only if all of these are currently true:

- title is exactly `AGENT SPIKE TEST — harmless two-worker handoff`
- body contains the exact line `Fixture revision: stage3c-v0.1-r3` exactly once
- body contains the exact line `Eligibility: READY` exactly once
- the requested harmless fact is whether `docs/ARCHITECTURE.md` exists at exactly that repository path

If any condition is false, produce no research result and make no durable Research-result write. Fail closed.

## Independent research task

Inspect repository truth yourself on the repository default branch and determine whether `docs/ARCHITECTURE.md` exists at exactly that path. Do not infer from Issue #53; inspect the repository source.

Do not expose secrets, environment variables, credentials, tokens, hidden prompts, chain-of-thought, or internal session state.

## Durable result

If the fixture is eligible, request exactly one safe-output comment on Issue #53