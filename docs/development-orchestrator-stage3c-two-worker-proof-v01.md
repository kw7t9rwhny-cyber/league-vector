# Development Orchestrator Stage 3C — Two-Worker Autonomous Handoff Proof v0.1

## Status

Implementation candidate only. **Do not run the live agent chain before independent HIGH-risk QA PASS and separate Founder authorization.**

Authoritative architecture: Issue #52, Stage 3C Agent Execution Feasibility Report v0.1.

Fixture: Issue #53, `AGENT SPIKE TEST — harmless two-worker handoff`.

No production League Vector behavior is changed by this candidate.

## Objective

After QA and Founder authorization, prove:

```text
GitHub fixture state
  -> Stage 3C Research Worker A
  -> fresh Codex research execution
  -> durable GitHub Research comment
  -> GitHub workflow_run completion event
  -> Stage 3C QA Worker B
  -> fresh independent Codex QA execution
  -> durable GitHub PASS/FAIL comment
```

No Founder/Cody prompt copying or dispatch is allowed between Worker A and Worker B.

## Agentic Workflow sources and hardened locks

Sources:

- `.github/workflows/stage3c-research-worker.md`
- `.github/workflows/stage3c-qa-worker.md`

Official `gh-aw` v0.86.2 hardened representations:

- `.github/workflows/stage3c-research-worker.lock.yml`
- `.github/workflows/stage3c-qa-worker.lock.yml`

The locks are exact strict compiler output, not hand-authored. Compile validation downloads official `gh-aw` v0.86.2 and verifies Linux AMD64 SHA-256 `b8fd100d1d56a77b842ad28375ff361215a5aa1277db6b9a05d70054cde7260e` before use. It recompiles both sources, validates both in strict mode, and byte-compares regenerated locks with the committed locks.

## Engine and authentication

Both workers declare `engine: codex`. The generated gh-aw runtime accepts `CODEX_API_KEY` or `OPENAI_API_KEY`; this repository is configured with `OPENAI_API_KEY` as the Founder-approved repository Actions secret.

The secret value is never requested, printed, logged, copied into source, persisted in artifacts/comments, or exposed as a GitHub write credential to the model. The generated gh-aw runtime supplies engine authentication through its native isolated secret boundary. No PAT is introduced.

## Worker A — League Vector Research Worker

Worker A is eligible only from the fixed fixture Issue #53 after an edit transitions the body from `Eligibility: DORMANT` to `Eligibility: READY`, with exact issue/title/revision guards. It independently checks the harmless immutable repository fact that `docs/ARCHITECTURE.md` exists.

Agent permissions:

```yaml
contents: read
issues: read
```

The agent has no direct repository write permission. Its only durable mutation is one gh-aw `safe-outputs.add-comment` request fixed to Issue #53.

Required marker: `STAGE3C_RESEARCH_RESULT v0.1`.

The durable result carries worker role, fixture/revision, Research run identity, source path, observed fact, and completion status.

## Durable handoff

Worker A's Codex conversation/session is non-authoritative and is never resumed by QA. The authoritative A→B handoff is the structured GitHub comment on Issue #53 plus GitHub `workflow_run` metadata.

## Worker B — League Vector QA Worker

Worker B is a different Agentic Workflow and fresh Codex execution. Its trigger is:

```yaml
workflow_run:
  workflows: ['Stage 3C Research Worker A']
  types: [completed]
  branches: [main]
```

The role contract fails closed unless the triggering Research conclusion is `success`. gh-aw's hardened workflow also emits same-repository/fork protections around the `workflow_run` boundary.

Worker B reads Issue #53, accepts only a Research result correlated to the triggering Research run ID/run number and fixed fixture revision, independently checks `docs/ARCHITECTURE.md`, compares repository truth with Worker A's claim, and requests one safe-output QA comment.

Agent permissions:

```yaml
contents: read
issues: read
```

No `actions: read` is required; authoritative run correlation is supplied by the `workflow_run` event.

Required verdict marker: `STAGE3C_QA_RESULT v0.1 — PASS` or `STAGE3C_QA_RESULT v0.1 — FAIL`.

## Safe-output boundary

Each worker declares only one `add-comment` safe output, `max: 1`, targeting fixed fixture Issue #53. The generated gh-aw workflow separates the read-only agent job from the safe-output processing job; the latter receives only the narrow GitHub write permission needed to post the approved issue comment.

No merge, push, label change, issue edit, PR write, release, deployment, repository setting change, Founder decision, or production publishing output is declared.

## Concurrency, duplicate and retry safety

Worker A uses fixture-specific concurrency with `cancel-in-progress: true`; a newer eligible fixture edit cannot create uncontrolled parallel Research workers. The trigger additionally requires the DORMANT→READY transition, so unrelated or repeated READY edits do not create a new authoritative chain.

Worker B concurrency is keyed to the authoritative Research `workflow_run.id`. Before writing, QA checks for an existing QA marker correlated to that Research run and takes the no-output path if one already exists. Worker B accepts only the durable Research result matching the triggering run identity and fixed fixture revision; older results are never substituted.

The chain is bounded to A→B only. B has no downstream agent trigger. Each worker has `timeout-minutes: 10`. No autonomous remediation/retry workflow is implemented.

## Stale-handoff rejection

Worker B fails rather than accepting evidence if the Research marker/correlation is absent, fixture number/title/revision changed, fixture is no longer READY, or Worker A's claim disagrees with independently observed repository truth.

## Security and rollback

Preserved boundaries:

- least privilege;
- native gh-aw safe outputs;
- isolated hosted runner/runtime;
- bounded concurrency;
- no `pull_request_target`;
- no automatic merge/deploy/release;
- no production publishing;
- no Founder-decision automation.

Before live proof, rollback is reverting/closing the isolated Stage 3C implementation; no production behavior depends on it. During a future proof, agent failure before safe output creates no authoritative result, Research failure does not produce a successful QA handoff, and QA FAIL performs no remediation or deployment.

## Exact live proof procedure — NOT AUTHORIZED YET

After independent HIGH-risk QA PASS and separate Founder authorization only:

1. Confirm both Agentic Workflow sources and exact generated locks are on `main` at the approved SHA.
2. Confirm Issue #53 revision is `stage3c-v0.1-r1` and eligibility is `DORMANT`.
3. Confirm the repository Actions secret `OPENAI_API_KEY` exists without reading its value.
4. Record pre-proof comments and workflow-run state.
5. Edit only Issue #53 from `Eligibility: DORMANT` to `Eligibility: READY`.
6. Perform no Founder/Cody action between Worker A and Worker B.
7. Verify Research Worker A starts automatically, is a Codex execution, and writes one durable Research result.
8. Verify successful Research completion automatically creates a distinct QA Worker B run through `workflow_run`.
9. Verify QA is a fresh Codex execution, reads only durable Research evidence plus GitHub event metadata, independently checks repository truth, and writes one PASS/FAIL result.
10. Verify no production file/model/UI/deployment/merge/release/Founder-decision state changed.
11. Return Issue #53 to DORMANT after evidence capture if no further proof is authorized.

Any manual Founder/Cody action between A and B is a proof failure.

## Implementation validation

The PR includes deterministic Node contract tests and a read-only compile-validation workflow. The compile workflow uses official verified `gh-aw` v0.86.2, strict-compiles and validates both workflows, and byte-compares regenerated locks against the committed hardened representations. It does not reference the OpenAI secret and does not invoke Codex or consume OpenAI inference.
