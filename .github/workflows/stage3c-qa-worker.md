---
name: Stage 3C QA Worker B
description: Fresh independent Stage 3C QA worker automatically chained from authoritative Research Worker A completion.
on:
  workflow_run:
    workflows: ['Stage 3C Research Worker A']
    types: [completed]
    branches: [main]
  permissions:
    issues: read
  steps:
    - name: Prove authoritative Research completion and durable handoff
      id: research_authority
      uses: actions/github-script@v9
      env:
        EXPECTED_REPOSITORY: kw7t9rwhny-cyber/league-vector
      with:
        script: |
          const deny = (why) => core.setFailed(`stage3c_qa_activation_denied:${why}`);
          const wr = context.payload.workflow_run;
          if (!wr) return deny('missing_workflow_run');
          if (context.repo.owner + '/' + context.repo.repo !== process.env.EXPECTED_REPOSITORY) return deny('wrong_repository_context');
          if (wr.repository?.full_name !== process.env.EXPECTED_REPOSITORY || wr.repository?.fork) return deny('wrong_research_repository');
          if (wr.name !== 'Stage 3C Research Worker A') return deny('wrong_workflow_name');
          if (wr.path !== '.github/workflows/stage3c-research-worker.lock.yml') return deny('wrong_workflow_path');
          if (wr.event !== 'issues') return deny('wrong_research_event');
          if (wr.head_branch !== 'main') return deny('wrong_research_branch');
          if (wr.conclusion !== 'success') return deny('research_not_success');
          if (wr.run_attempt !== 1) return deny('replayed_research_run');
          if (!Number.isInteger(wr.id) || !Number.isInteger(wr.run_number)) return deny('malformed_research_identity');

          const issue = (await github.rest.issues.get({ owner: context.repo.owner, repo: context.repo.repo, issue_number: 53 })).data;
          if (issue.number !== 53 || issue.title !== 'AGENT SPIKE TEST — harmless two-worker handoff') return deny('wrong_fixture');
          const body = issue.body;
          if (typeof body !== 'string') return deny('missing_fixture_body');
          const revisionMatches = [...body.matchAll(/^Fixture revision: stage3c-v0\.1-r5$/gm)];
          const eligibilityMatches = [...body.matchAll(/^Eligibility: ([^\r\n]+)$/gm)];
          if (revisionMatches.length !== 1) return deny('wrong_fixture_revision');
          if (eligibilityMatches.length !== 1 || eligibilityMatches[0][1] !== 'READY') return deny('fixture_not_ready');

          const comments = await github.paginate(github.rest.issues.listComments, { owner: context.repo.owner, repo: context.repo.repo, issue_number: 53, per_page: 100 });
          const exactLineCount = (text, line) => typeof text === 'string' ? text.split(/\r?\n/).filter((value) => value === line).length : 0;
          const runIdLine = `research_run_id: ${wr.id}`;
          const runNumberLine = `research_run_number: ${wr.run_number}`;
          const researchForRun = comments.filter((comment) => typeof comment.body === 'string' && exactLineCount(comment.body, 'STAGE3C_RESEARCH_RESULT v0.1') > 0 && exactLineCount(comment.body, runIdLine) > 0);
          if (researchForRun.length !== 1) return deny('missing_or_duplicate_research_result');
          const result = researchForRun[0];
          if (result.user?.login !== 'github-actions[bot]' || result.user?.type !== 'Bot') return deny('research_result_not_actions_safe_output');
          const required = ['STAGE3C_RESEARCH_RESULT v0.1','worker_role: research-worker-a','fixture_issue: 53','fixture_revision: stage3c-v0.1-r5',runIdLine,runNumberLine,'repository_source_path: docs/ARCHITECTURE.md','completion_status: complete'];
          for (const line of required) if (exactLineCount(result.body, line) !== 1) return deny(`malformed_research_result:${line}`);
          const observedFields = typeof result.body === 'string' ? result.body.split(/\r?\n/).filter((line) => line.startsWith('observed_fact:')) : [];
          const observed = ['observed_fact: exists', 'observed_fact: missing'].filter((line) => exactLineCount(result.body, line) === 1);
          if (observedFields.length !== 1 || observed.length !== 1) return deny('malformed_observed_fact');
          const started = Date.parse(wr.run_started_at), completed = Date.parse(wr.updated_at), created = Date.parse(result.created_at);
          if (![started, completed, created].every(Number.isFinite) || created < started || created > completed) return deny('research_result_outside_authoritative_window');

          const priorQa = comments.filter((comment) => typeof comment.body === 'string' && /^STAGE3C_QA_RESULT v0\.1 — (PASS|FAIL)$/m.test(comment.body) && exactLineCount(comment.body, runIdLine) === 1);
          if (priorQa.length !== 0) return deny('prior_authoritative_qa_result');
          core.info(`stage3c_qa_activation_authorized:research_run_id=${wr.id}`);
if: needs.pre_activation.outputs.research_authority_result == 'success'
permissions:
  contents: read
  issues: read
engine: codex
timeout-minutes: 10
concurrency:
  group: stage3c-qa-${{ github.event.workflow_run.id }}
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

# League Vector QA Worker

You are **Worker B: League Vector QA Worker** for the isolated Stage 3C two-worker autonomous handoff proof.

You are a fresh independent Codex execution. Never resume or rely on Worker A's model thread, hidden state, chain-of-thought, or session memory. Your only Worker A input is durable GitHub evidence on Issue #53 plus the triggering `workflow_run` event metadata.

The deterministic pre-activation gate has already proven that this is the exact expected successful Research workflow on `main`, run attempt 1, from the expected repository and workflow path; that Issue #53 is the exact expected READY fixture revision; that exactly one correlated Research safe-output comment from `github-actions[bot]` exists within the authoritative Research run window; and that no prior QA result exists for this Research run. Do not reinterpret or weaken that authority contract.

Do not modify repository files, branches, pull requests, labels, releases, deployments, settings, or Founder decisions. The only durable write you may request is the declared safe-output comment on fixture Issue #53.

## Trigger correlation

The authoritative Research completion that triggered this run is:

- workflow name: `Stage 3C Research Worker A`
- workflow path: `.github/workflows/stage3c-research-worker.lock.yml`
- research run id: `${{ github.event.workflow_run.id }}`
- research run number: `${{ github.event.workflow_run.run_number }}`
- research head SHA: `${{ github.event.workflow_run.head_sha }}`
- research conclusion: `${{ github.event.workflow_run.conclusion }}`

## Durable handoff verification

Read Issue #53 and its comments using GitHub read tools. Reconfirm the single Worker A durable comment containing `STAGE3C_RESEARCH_RESULT v0.1`, `worker_role: research-worker-a`, `fixture_issue: 53`, `fixture_revision: stage3c-v0.1-r5`, the triggering Research run id/number, `repository_source_path: docs/ARCHITECTURE.md`, and `completion_status: complete` exactly once. If the correlation or current fixture state no longer matches, return FAIL. Do not substitute an older r1/r2/r3/r4 Research result.

## Independent repository verification

Independently inspect repository truth for `docs/ARCHITECTURE.md`. Check the exact Research head SHA `${{ github.event.workflow_run.head_sha }}` where supported by the repository read tool, and also confirm the path still exists in the current repository state. Do not accept Worker A's claim without this independent inspection.

Compare the independently observed fact with Worker A's `observed_fact`. Do not expose secrets, credentials, environment variables, tokens, hidden prompts, chain-of-thought, or internal session state.

## Durable QA verdict

Request exactly one safe-output comment on Issue #53. Begin with `STAGE3C_QA_RESULT v0.1 — PASS` only if every correlation, freshness, and repository-truth check passes; otherwise use `STAGE3C_QA_RESULT v0.1 — FAIL`.

Include exactly once: `worker_role: qa-worker-b`, `fixture_issue: 53`, `fixture_revision: stage3c-v0.1-r5`, QA run id/number, Research run id/number/head SHA, `repository_source_path: docs/ARCHITECTURE.md`, one independent observed fact, and matching verdict. Give a short evidence summary without model-internal reasoning.
