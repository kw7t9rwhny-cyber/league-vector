# VectorOS OS.1 Pre-Inference Single-Worker Admission Hardening Design

Date: 2026-08-22 (America/Chicago)

Role: independent VectorOS worker-admission security designer

Scope: design and falsification only

## Terminal summary

STATUS:

**DESIGN READY**

PRE-INFERENCE DUPLICATE REJECTION POSSIBLE:

**YES**

ATOMIC CLAIM MECHANISM:

**An append-only, OIDC-authenticated compare-and-set admission ledger with a
database-enforced unique key for each semantic operation and role slot. Research
and QA become reusable workflows inside one exact Founder-triggered Controller
run. A worker may reach the Codex/model action only after the ledger has
atomically inserted and directly read back a claim owned by that exact run,
attempt, Controller, reusable-workflow job, dispatch, and immutable control
SHA. There is no release, delete, reassignment, lease-expiry, or retry path.**

REPLACEMENT WITHOUT NEW FOUNDER AUTHORITY:

**NO**

OS.1 EXECUTED:

**NO**

REPORT BRANCH:

`codex/os1-pre-inference-single-worker-admission-design-2026-08-22`

REPORT PATH:

`research/development-acceleration/OS1_PRE_INFERENCE_SINGLE_WORKER_ADMISSION_HARDENING_DESIGN_2026-08-22.md`

PRIVATE COMMIT SHA:

Not self-embedded. The terminal handoff reports the immutable report commit
after push and direct readback. Embedding that SHA in the committed bytes would
change the SHA.

REMOTE REF VERIFIED:

Not self-attested in pre-push bytes. The terminal handoff reports `YES` or `NO`
after resolving the exact remote ref.

DIRECT READBACK:

Not self-attested in pre-push bytes. The terminal handoff reports `PASS` or
`FAIL` after reading the report blob from the pushed commit, not from the
working tree.

## 1. Decision

The installed admission boundary is too late. It limits durable dispatch and
terminal-result progression, but it does not limit entry into the model action
to one exact worker execution. Current worker preflight accepts any run that
can present a matching durable dispatch identity while no role result exists.
The first binding of run ID, run attempt, worker actor, triggering actor,
workflow SHA, and result provenance occurs in persistence after the model job.

The hardening must make model admission a consumed, run-owned capability. The
smallest sound architecture has two parts:

1. Remove `workflow_dispatch` from Research and QA. Make both
   `workflow_call`-only reusable workflows invoked as jobs within one
   Founder-triggered Controller run. Research, deterministic Research
   finalization, QA, deterministic QA finalization, and Founder/Lead STOP then
   share one parent `GITHUB_RUN_ID` and one `GITHUB_RUN_ATTEMPT`.
2. Before either model job becomes eligible, perform a linearizable
   create-if-absent against a narrow admission ledger. The ledger accepts only
   GitHub OIDC identity from the expected repository, exact caller Controller,
   exact reusable workflow, exact authorized control SHA, and attempt `1`.
   The claim is permanently consumed whether later inference starts, fails, or
   completes.

GitHub Issue comments remain useful audit mirrors, but they must not remain the
atomic admission authority. GitHub Actions concurrency remains useful load
serialization, but it must not remain the uniqueness proof.

This design guarantees at most one entry into the pinned Research model-action
step and at most one entry into the pinned QA model-action step for one signed
semantic operation. Here, “model invocation” means one execution of the
role's pinned Codex action step. An agentic action may make multiple internal
provider turns during that one execution; limiting provider-internal turns is
a separate inference-gateway budget and is not the duplicate-worker defect
addressed here.

## 2. Scope and non-execution boundary

This assignment:

- did not modify public or private runtime;
- did not alter workflow, protocol, schema, helper, result, route, or state
  code;
- did not execute a model;
- did not run or rerun a GitHub workflow;
- did not create a worker, replacement, retry, or Cycle #2;
- did not create or rotate a secret;
- did not change a GitHub Issue, artifact, workflow registry, permission,
  branch rule, deployment, or environment;
- did not remediate any P1/P2 red-team finding except where the admission
  design necessarily specifies a compatible future boundary; and
- created only this design report on the requested non-main public report
  branch.

No runtime tests were executed because no implementation exists in this
assignment. The tests in section 13 are exact required future implementation
tests, not claimed passes.

## 3. Exact evidence bindings

### 3.1 Public report repository

- repository: `kw7t9rwhny-cyber/league-vector`;
- starting branch:
  `codex/os1-combined-install-test-invariant-remediation`;
- exact report-branch base commit:
  `784978cb4c89dbd667e74a19ad6811f15bdc1298`;
- requested report branch did not exist locally or on `origin` before this
  assignment;
- pre-existing untracked file outside this report path:
  `research/vectoros-improvement/security/FOUNDER_AUTHORIZATION_V2_SECURE_SIGNING_RESEARCH_2026-08-21.md`;
- that pre-existing file is outside scope and was not read, edited, staged, or
  committed by this assignment.

### 3.2 Installed private OS.1 runtime

The installed private runtime was read from immutable Git objects rather than
inferred from report prose:

- control repository:
  `kw7t9rwhny-cyber/league-vector-rd-private`;
- current `main` commit observed during this design:
  `460f9dc06498993b843b35da2398a6b3eb060bde`;
- installed runtime commit:
  `f7e54b3850a54756402103885d5302f44c14e03b`;
- installed runtime tree:
  `412edac2bb03e45ae3bb5859c1617998f6be579c`;
- the four OS.1 workflows were directly observed as active;
- Controller workflow ID: `339441549`;
- QA workflow ID: `339441550`;
- Research reconciler workflow ID: `339441551`;
- Research workflow ID: `339441552`.

The authority-critical Controller, Research, QA, reconciler, helper, contract,
state, route, result, schemas, protocol documentation, and current tests were
directly inspected at the installed runtime tree.

### 3.3 Red-team commit

- exact red-team commit:
  `b4e4bbf64453144a6cc9ae24357a0ccf98935422`;
- exact tree:
  `d81cea5b2f30bc8f0fd0da24e25b0f34f14443f4`;
- parent:
  `6469da889bf2e3a9fcbfdd2939647bc693dbccc1`;
- exact report blob:
  `05d830e462b8fe8dd2a06bb13f94fcc593a27e6c`.

The report blob was directly decoded and read. Its restricted substance is not
reproduced here. This report uses only the minimum P0 facts required by the
authorized design assignment.

### 3.4 Cycle #1 direct run evidence

The run API, attempt API, jobs API, workflow registry, Issue `#1`, and its five
durable comments were directly inspected. No log replay or workflow execution
was used.

| Order | Run ID | Workflow ID / path | Actor | Attempt | Head SHA | Conclusion |
|---:|---:|---|---|---:|---|---|
| 1 | `32505101399` | `339441549` / Controller | Founder user | 1 | `460f9dc...` | success |
| 2 | `32505117594` | `339441552` / Research | GitHub Actions bot | 1 | `460f9dc...` | success |
| 3 | `32505209376` | `339441549` / Controller | GitHub Actions bot | 1 | `460f9dc...` | success |
| 4 | `32505230529` | `339441550` / QA | GitHub Actions bot | 1 | `460f9dc...` | success |

The durable record cardinality was exactly:

- one consumed semantic operation claim;
- one Research dispatch record;
- one Research terminal result;
- one QA dispatch record; and
- one QA terminal result.

The Research and QA job records each show one successful model-action step in
attempt `1`. This historical fact does not authorize another invocation and is
not treated as proof that the current pre-inference boundary is safe.

## 4. Installed behavior and P0 root cause

### 4.1 Controller dispatch

The Controller:

1. loads the private Issue and comments;
2. validates the Founder-signed work item and public target commit/tree;
3. globally scans operation claims by authorization ID and semantic operation
   identity;
4. writes a consumed operation claim;
5. validates existing results;
6. routes with `worker_runs_used = dispatches.length`;
7. writes a deterministic role dispatch record; and
8. calls the selected worker workflow at floating `ref: main`.

The operation and dispatch writes use read → POST comment → readback. That
detects ambiguity after the fact. It is not an atomic conditional insert.

### 4.2 Worker preflight

Research/QA preflight currently proves:

- the work item and Founder authorization are valid at observation time;
- the public target commit resolves to the expected tree;
- exactly one matching dispatch comment exists;
- the dispatch's role and deterministic identity match;
- no matching role result exists; and
- for QA, one completed, successful, artifact-backed Research result exists.

It does **not** prove or consume:

- current `GITHUB_RUN_ID`;
- current `GITHUB_RUN_ATTEMPT`;
- current workflow ID;
- current actor or triggering actor;
- an exact parent Controller run;
- an exact worker execution or job;
- an expected private control SHA authorized by the Founder; or
- exclusive ownership of the role slot.

### 4.3 Operation claim

The operation claim binds authorization ID, semantic operation identity, work
item ID, Issue number, creation time, and `state: consumed`. It is valuable
global semantic replay protection. It is not a worker-execution claim and does
not bind a Controller run, worker run, run attempt, role, dispatch, workflow,
ref, or private SHA.

`ensureOperationClaim()` also treats the same work item/Issue claim as
`already_present`. That is suitable for Controller wake idempotence in the
current multi-run topology, but it cannot distinguish an authorized
continuation from an unauthorized duplicate Controller run.

### 4.4 Dispatch records

The dispatch identity binds work item, semantic replay identity, role instance,
public input, and upstream result IDs. The record contains no parent Controller
run, worker owner, run attempt, workflow ID, expected private SHA, or consumed
worker-admission state. A second run presenting the same pointer can reuse the
record until a terminal role result appears.

### 4.5 Result records and run-attempt handling

Result construction requires `run_attempt === 1` and bot actor/triggering
actor. Later provenance validation checks exact run ID, attempt, worker
workflow path, private repository, `main`, workflow SHA, actors, chronology,
completion, conclusion, and artifact metadata.

Those are post-inference controls. The result is built only after the Codex
action returns. Therefore attempt `2`, a Founder-triggered direct worker, or a
replacement bot run may enter inference and only then fail persistence.

### 4.6 Actor validation

Worker preflight does not authenticate the current run actor. Actor admission
is split between `allow-bots: true` at the model action and bot-only result
construction after inference. A direct Founder worker run can therefore reach
the action and fail later. A generic bot-originated worker run is
indistinguishable from a Controller-originated worker run at preflight because
GitHub's workflow-dispatch API supplies no authenticated parent-run link.

### 4.7 Current worker budget

The signed budget is exactly `max_worker_runs: 2`. The router counts durable
dispatch records, not workflow executions, model-action entries, or attempts.
One Research plus one QA dispatch exhausts the route budget, but an out-of-band
worker execution reusing either existing dispatch does not increment that
counter before inference.

### 4.8 Semantic replay protections

The installed system correctly makes replay identity equal to the canonical
semantic operation digest and globally rejects cross-work-item reuse or mere
authorization-ID rotation. The router also refuses a second deterministic
role dispatch. These controls prevent ordinary Controller progression; they do
not make an already-written worker dispatch single-consumer.

### 4.9 Concurrency is not consumption

The worker workflows use issue/role concurrency groups with
`cancel-in-progress: false`. This prevents overlap but does not consume the
dispatch. A queued successor starts after the first workflow releases the
group and can pass the same preflight if the first failed before persistence.

GitHub also permits rerunning all jobs, failed jobs, or a specific job. A
failed-job rerun can reuse a previously successful preflight and rerun the
model job. GitHub documents that reruns retain the same `GITHUB_RUN_ID` and
increment `GITHUB_RUN_ATTEMPT`. Therefore the attempt check must exist inside
every inference-capable job immediately before the model action; a separate
preflight job is insufficient.

## 5. Exact admission invariant

Let:

- `O` be the Founder-signed semantic operation identity;
- `R` be `research-1` or `qa-1`;
- `E` be a concrete GitHub job execution;
- `EnterModel(E)` mean control begins the pinned Codex action step, regardless
  of whether the provider later succeeds; and
- `Claim(O,R)` be the immutable admission-ledger row for that role slot.

The safety invariant is:

```text
count({ E | EnterModel(E) and E.operation = O and E.role = research-1 }) <= 1
count({ E | EnterModel(E) and E.operation = O and E.role = qa-1 }) <= 1
```

`EnterModel(E)` is permitted if and only if all of the following are true at
the immediate pre-action guard:

1. The work item validates exactly and its Founder authorization is valid.
2. The signed semantic payload binds the exact private control repository,
   repository ID, control commit, control tree, Controller workflow ID/path,
   expected ref, Research reusable-workflow path/SHA, QA
   reusable-workflow path/SHA, public target commit/tree, model/action pins,
   and a two-slot budget.
3. `E` is in the one top-level Controller run that atomically owns `O`.
4. The top-level event is `workflow_dispatch`, the Controller workflow ID/path
   is exact, the run ref and head SHA equal signed expectations, and the
   initial actor is the exact Founder login and immutable ID.
5. `GITHUB_RUN_ATTEMPT` is exactly `1`.
6. The current reusable-workflow job identity is exact: repository, workflow
   file path, workflow ref, workflow SHA, logical job ID, and check-run ID.
7. One canonical dispatch/slot authorization exists for `O,R`, is owned by the
   same Controller run, and has the correct upstream result set.
8. The ledger has atomically inserted exactly one consumed claim at key
   `H(O,R)` and direct readback proves that `E`, not merely the semantic role,
   owns it.
9. The claim receipt digest passed from the admission job matches the canonical
   durable claim, current run ID, attempt, job workflow, dispatch ID, and
   worker ID.
10. No terminal result or prior inference-start observation conflicts with the
    claim.
11. For QA only, the one Research claim belongs to the same Controller owner
    and its result is completed, successful, byte-proven, and `COMPLETE`.

If any condition is missing, stale, malformed, ambiguous, contradictory, or
unavailable, the model step is skipped because its default success condition
is false and the workflow terminates non-green.

The liveness rule is intentionally subordinate:

```text
A valid race may choose one owner; it may never choose two.
A consumed owner that later fails is never released or reassigned.
```

## 6. Required execution bindings

| Candidate binding | Decision | Exact use |
|---|---|---|
| Workflow ID | **Bind** | Bind the top-level Controller numeric workflow ID. For reusable workers, additionally bind job workflow path/ref/SHA; the top-level run's `workflow_id` alone identifies only the caller. |
| `GITHUB_RUN_ID` | **Bind** | Becomes the operation owner and parent Controller run. It is shared by called reusable workers and never changes on rerun. |
| `GITHUB_RUN_ATTEMPT` | **Bind and require `1`** | Store in operation and slot claims; test again in the inference job immediately before the action. |
| Dispatch ID | **Bind** | Introduce `dispatch_id` distinct from semantic `dispatch_identity`; bind one Controller-owned slot authorization to one role and parent run. |
| Worker ID | **Bind** | Derive from operation, role, Controller run, attempt, reusable-workflow path/SHA, logical job ID, and check-run ID. |
| Semantic operation ID | **Bind** | Remains the global replay/budget key and is part of every claim and result. |
| Parent Controller run | **Bind** | Research and QA run inside it. Any worker whose top-level run differs is ineligible. |
| Expected workflow/ref/SHA | **Bind** | Founder-signed control identity must include exact Controller and reusable-workflow bytes. Branch labels are descriptive, not authority. |

Recommended identities:

```text
operation_claim_key = SHA256(canonical({
  semantic_operation_id,
  kind: "controller-owner"
}))

slot_claim_key = SHA256(canonical({
  semantic_operation_id,
  role_instance_id
}))

dispatch_id = SHA256(canonical({
  semantic_operation_id,
  role_instance_id,
  parent_controller_run_id,
  parent_controller_run_attempt: 1,
  expected_job_workflow_path,
  expected_job_workflow_sha,
  input_identity,
  upstream_result_ids
}))

worker_id = SHA256(canonical({
  semantic_operation_id,
  role_instance_id,
  github_run_id,
  github_run_attempt: 1,
  github_job,
  job_check_run_id,
  job_workflow_repository,
  job_workflow_file_path,
  job_workflow_sha
}))
```

## 7. Exact durable claim structure

The authoritative role-slot claim is canonical JSON with exact keys:

```json
{
  "schema_version": "lv-vectoros-private-execution-slot-claim/v1",
  "claim_id": "sha256-of-canonical-claim-with-empty-claim-id",
  "claim_key": "sha256-of-semantic-operation-and-role-instance",
  "semantic_operation_id": "64-hex",
  "founder_authorization_id": "64-hex",
  "work_item_id": "bounded-string",
  "issue_number": 1,
  "role": "research-or-qa",
  "role_instance_id": "research-1-or-qa-1",
  "dispatch_id": "64-hex",
  "dispatch_identity": "64-hex",
  "worker_id": "64-hex",
  "operation_owner_claim_id": "64-hex",
  "parent_controller": {
    "repository": "kw7t9rwhny-cyber/league-vector-rd-private",
    "repository_id": "exact-numeric-id",
    "workflow_id": "exact-numeric-id",
    "workflow_path": ".github/workflows/vectoros-private-os1-controller-v01.yml",
    "workflow_ref": "exact-ref",
    "workflow_sha": "authorized-40-hex",
    "run_id": "decimal-string",
    "run_attempt": 1,
    "event": "workflow_dispatch",
    "actor_login": "kw7t9rwhny-cyber",
    "actor_id": 316007980,
    "triggering_actor_login": "kw7t9rwhny-cyber",
    "triggering_actor_id": 316007980
  },
  "worker_execution": {
    "github_run_id": "same-as-parent-controller-run-id",
    "github_run_attempt": 1,
    "github_job": "exact-logical-job-id",
    "job_check_run_id": "decimal-string",
    "job_workflow_repository": "kw7t9rwhny-cyber/league-vector-rd-private",
    "job_workflow_file_path": "exact-research-or-qa-reusable-workflow-path",
    "job_workflow_ref": "exact-ref",
    "job_workflow_sha": "authorized-40-hex"
  },
  "control_identity": {
    "commit_sha": "authorized-40-hex",
    "tree_sha": "authorized-40-hex",
    "authority_manifest_digest": "64-hex"
  },
  "input_identity": {
    "repository": "kw7t9rwhny-cyber/league-vector",
    "commit_sha": "40-hex",
    "tree_sha": "40-hex"
  },
  "upstream_result_ids": [],
  "oidc": {
    "issuer": "https://token.actions.githubusercontent.com",
    "audience": "vectoros-os1-admission-v1",
    "subject": "exact-allowed-subject",
    "jwt_jti_digest": "64-hex",
    "issued_at": "date-time",
    "expires_at": "date-time"
  },
  "claimed_at": "server-date-time",
  "state": "consumed"
}
```

For QA, `upstream_result_ids` contains exactly the one authoritative Research
result ID. For Research it is empty.

The operation-owner claim uses the same control/run identity but key
`H(O,"controller-owner")`. It has uniqueness constraints on semantic operation
ID, Founder authorization ID, and Controller run ID. A Controller retry may
read the old claim but may not treat it as success because its attempt is not
`1`. A different Controller run may never adopt it.

Database constraints are part of the invariant, not an implementation detail:

```text
PRIMARY KEY (claim_key)
UNIQUE (semantic_operation_id, role_instance_id)
UNIQUE (founder_authorization_id, role_instance_id)
UNIQUE (dispatch_id)
UNIQUE (worker_id)
UNIQUE (jwt_jti_digest)
CHECK (state = 'consumed')
CHECK (parent_controller_run_attempt = 1)
CHECK (worker_run_attempt = 1)
```

The service exposes only:

- `POST /v1/claims` — validate OIDC and atomically insert;
- `GET /v1/claims/{claim_key}` — exact owner readback; and
- an append-only outcome endpoint that cannot alter or release the claim.

There is no update-owner, delete, release, lease, expiry-reopen, retry,
replacement, or force endpoint. Server time supplies `claimed_at`. The service
has no OpenAI key, no GitHub write token, no Actions-dispatch authority, and no
repository mutation authority.

If the insert response is lost, only the same run/attempt/job identity may read
back its exact claim and proceed. A different execution receives conflict. If
readback is unavailable or ambiguous, inference does not start and the slot is
treated as burned if the insert may have committed.

Issue comments may mirror the ledger claim for human audit, but comment
presence, absence, author, or ordering must never grant admission.

## 8. Can GitHub durable state supply the atomicity?

**Not with the currently available, appropriately narrow primitives.**

Evaluation:

- Issue comments: append-only in normal use, but no conditional
  create-if-absent or uniqueness constraint. Read → write → readback detects a
  collision; it does not linearize competing writers.
- Artifacts: scoped to a workflow run, expiring, and not a global unique-key
  store.
- Actions concurrency: server-enforced mutual exclusion is valuable, but it is
  scheduler state, not immutable ownership. It queues a successor that may
  reuse a dispatch after the predecessor releases the group. Pending runs may
  also be replaced, and ordering is not an authority guarantee.
- Actions cache: evictable and scope-dependent; not an authority ledger.
- Environments/deployments: approval and serialization primitives, not a
  compare-and-set record binding the exact worker execution.
- Git refs: `create ref` can supply an atomic create-if-absent race winner, but
  using it would grant deterministic admission `contents: write`, a capability
  that can mutate more than the claim namespace. The ref can later be deleted
  or moved under the current private-repository governance constraints. That
  is not the narrow, irreversible admission authority required here.

Therefore the narrowest sound mechanism is a purpose-specific admission
ledger with one transactional insert, GitHub OIDC authentication, exact claim
allowlists, immutable rows, and no other authority. GitHub remains the source
of signed execution identity; it is not asked to emulate a database uniqueness
constraint through comments.

GitHub workflow-level concurrency should still be retained with one global
operation group and `cancel-in-progress: false`. It reduces collision load.
The CAS ledger remains dispositive if concurrency ordering, queuing, or a
second caller behaves unexpectedly.

## 9. Exact validation sequence

### 9.1 Controller operation admission

1. First executable step requires `GITHUB_RUN_ATTEMPT == 1`.
2. Require exact private repository name and immutable repository ID.
3. Fetch current run attempt and require:
   `workflow_dispatch`, exact Controller workflow ID/path, exact ref, exact
   authorized head SHA, attempt `1`, exact Founder actor login/ID/type, and
   exact triggering actor login/ID/type.
4. Read the Issue and comments; parse only the exact work-item marker.
5. Validate exact Founder identity and signature, authorization time, work-item
   schema, semantic operation identity, two-slot budget, and no implicit
   replacement.
6. Validate signed `control_identity`: private commit, tree, authority manifest,
   Controller workflow, Research/QA reusable workflows, actions, model/runtime
   pins, and expected ref.
7. Resolve the private commit/tree and public target commit/tree independently.
8. Reject any conflicting existing GitHub mirror record; mirror records never
   create authority.
9. Obtain a GitHub OIDC token with audience
   `vectoros-os1-admission-v1` in a deterministic job that has no model secret.
10. Atomically claim `H(O,"controller-owner")` in the ledger.
11. Directly read the canonical claim and compare every byte/field to the
    expected request and current run.
12. Write an audit mirror only after claim readback. An ambiguous mirror write
    does not revoke the ledger claim and does not authorize a different run.
13. Create deterministic Research dispatch/slot authorization bound to the
    owner run; do not call a worker dispatch API.

### 9.2 Research admission

1. Controller calls the Research reusable workflow as a job in the same run.
2. Research admission requires `GITHUB_RUN_ATTEMPT == 1` before all other work.
3. Require `github.run_id` equals the operation owner's Controller run.
4. Validate top-level `github.workflow_ref`/`workflow_sha` and current
   `job.workflow_repository`, `job.workflow_file_path`, `job.workflow_ref`,
   `job.workflow_sha`, logical job ID, and check-run ID.
5. Re-read work item, operation owner, dispatch authorization, public target,
   and absence of any Research result.
6. Obtain OIDC in the admission job; require exact caller and exact Research
   reusable-workflow claims.
7. Atomically insert `H(O,"research-1")` with `state: consumed`.
8. Directly read back the claim and output only its digest and exact owner
   fields to the model job.
9. In the model job, immediately before the Codex action, run a credential-free
   guard that again requires attempt `1`, exact run ID, exact job workflow
   identity, exact authorized SHA, and exact claim receipt/worker ID.
10. Only a successful guard permits the default-conditioned action step.

### 9.3 Research finalization and QA eligibility

1. Prepare deterministic result bytes bound to the Research slot claim and
   exact job execution.
2. Upload the proof artifact.
3. In a later deterministic finalizer, download the artifact bytes, compare
   them byte-for-byte, recompute the canonical digest, validate the job/run
   provenance, and only then write the authoritative Research result.
4. A failed upload/finalizer leaves no authoritative `COMPLETE` result.
5. QA slot authorization is created only for one validated Research
   `COMPLETE` result owned by the same Controller operation claim.

### 9.4 QA admission

Repeat the Research sequence using `H(O,"qa-1")`, the exact QA reusable
workflow identity, and exactly one upstream Research result. QA cannot run in a
different top-level run and cannot claim before Research finalization.

### 9.5 Terminalization

After QA finalization, a deterministic job in the same Controller run validates
both slot claims, both exact job executions, both result/artifact bytes, and
the QA disposition. It writes a durable Founder/Lead STOP observation. It has
no worker-dispatch or model authority.

An external completion observer may record failure stage if the Controller run
ends before its finalizer. It may not dispatch, rerun, release, or replace.

## 10. Race analysis

### 10.1 Two valid Controller runs

Both may be Founder-triggered, attempt `1`, and byte-identical. The operation
claim insert has one unique key. One transaction commits; one receives a
uniqueness conflict. The loser has no role-claim receipt and no model job can
become eligible. Ordering does not matter.

### 10.2 Two Research or QA admission jobs

Both target the same `slot_claim_key`. Before the insert, each must also match
the operation owner's Controller run. At most one can be a valid owner. If two
jobs somehow exist inside that same run, the database unique key chooses one.
The loser terminates before the action. Exactly one valid claimant wins the
race; zero win if all claimants are invalid.

### 10.3 Claim committed, response lost

The same exact owner reads back the immutable row. Matching readback permits
continuation within the same run/attempt/job. A different worker, a later
attempt, or an ambiguous owner cannot convert the claim into success.

### 10.4 Crash before slot claim

No model can start because the model job needs a claim receipt. The operation
owner may already be consumed. A different Controller may not adopt it.

### 10.5 Crash after slot claim and before model

The slot remains consumed. No model invocation occurred, but no replacement is
implicitly authorized. This is the deliberate fail-closed tradeoff required by
zero-retry policy.

### 10.6 Crash during or after model

The claim was already consumed, so no other execution can enter. Result and
artifact failures affect terminal evidence, not slot availability.

## 11. Required attack outcomes

| Attack / condition | Required pre-inference outcome |
|---|---|
| Run attempt `2` | Immediate local guard and OIDC ledger policy reject; no action step. |
| Manual rerun of all jobs | Same run ID, attempt `2`; Controller admission rejects. |
| Rerun failed jobs | Even if successful needs outputs are reused, the model-job-local attempt guard rejects. |
| Rerun one model job | Attempt increments; local guard rejects before action. |
| Duplicate Controller `workflow_dispatch` | Operation-owner CAS chooses one run; all others stop. |
| Duplicate worker `workflow_dispatch` | Impossible because workers have no `workflow_dispatch` trigger. |
| Second Research dispatch/call | Wrong caller/owner or consumed `research-1` key; reject. |
| Second QA dispatch/call | Wrong caller/owner or consumed `qa-1` key; reject. |
| Replacement worker after failure | Consumed slot is never released; reject. |
| Direct worker invocation by Founder | No direct trigger; unauthorized caller workflow fails caller/run binding. |
| Direct worker invocation by bot | No direct trigger; bot cannot match Founder-owned Controller and reusable-workflow binding. |
| Stale dispatch | Parent run, control SHA, dispatch ID, or operation owner differs; reject. |
| Wrong parent Controller | `github.run_id`, top-level workflow metadata, and owner claim mismatch; reject. |
| Wrong workflow | `job.workflow_*`, referenced workflow, or signed manifest mismatch; reject. |
| Wrong private SHA/tree | Signed control identity and current run/job SHA checks fail; reject. |
| Wrong public target SHA/tree | Work-item and target commit/tree validation fail; reject. |
| Concurrent duplicates | Unique insert commits once; exactly one valid claimant obtains the receipt. |
| Existing terminal result | Slot is already consumed and result conflicts with new admission; reject. |
| Ledger unavailable or ambiguous | Fail closed; do not infer. |

## 12. Failure semantics after one worker is admitted

The claim is a fuse, not a lease. It is consumed before inference and never
reopened.

| Failure point | Durable interpretation | Automatic replacement? | Downstream |
|---|---|---:|---|
| Before inference | `FAILED_PRE_INFERENCE` observation; slot remains consumed | No | Stop operation; QA ineligible if Research |
| During inference | `FAILED_DURING_INFERENCE`; invocation budget consumed | No | Stop operation; no terminal success inferred |
| Inference complete, persistence fails | `INFERENCE_COMPLETE_PERSISTENCE_FAILED`; slot consumed; output not authoritative | No | Stop; no QA from unpersisted Research |
| Artifact upload fails | `INFERENCE_COMPLETE_ARTIFACT_FAILED`; no authoritative terminal result | No | Stop; proof absence is not success |
| Artifact uploads, final byte verification fails | `PROOF_VERIFICATION_FAILED`; no authoritative terminal result | No | Stop |
| Authoritative Research returns `BLOCKED` | Valid terminal Research result; slot consumed | No | QA not dispatched/called |
| Authoritative Research `COMPLETE` | Research slot consumed and final | No | Exactly one QA may claim |
| Authoritative QA PASS/FAIL/BLOCKED | QA slot consumed and final | No | Founder/Lead STOP |

If GitHub cancellation prevents the in-run finalizer, the completion observer
may append the best evidence-grounded failure observation. Missing stage
evidence remains `UNKNOWN_AFTER_CLAIM`, never success and never permission to
replace.

Any replacement must be a new explicit Founder-authorized operation. The old
claim stays consumed. Merely rotating `authorization_id`, changing work-item
ID, rerunning the old run, or redispatching the old role remains semantic
replay and is rejected.

If replacement is ever permitted, a future signed schema must explicitly add:

- `operation_kind: replacement`;
- `supersedes_operation_id`;
- `replaces_claim_id`;
- `replacement_role`;
- exact failure evidence being superseded; and
- a new semantic operation digest covering those fields and all exact control
  identities.

No such schema or authority exists today.

## 13. Required tests

### 13.1 Admission-ledger unit and integration tests

1. Two concurrent inserts for `H(O,"research-1")`: exactly one `201`, one
   conflict, one durable row.
2. Repeat for `qa-1`.
3. Ten concurrent duplicates: one durable row and one owner.
4. Lost response after commit: exact owner readback succeeds; different owner
   fails.
5. Duplicate semantic operation with a rotated authorization ID: reject.
6. Duplicate authorization ID with changed work-item ID: reject.
7. Attempt `2`: reject before insert.
8. Wrong OIDC issuer, audience, subject, repository, repository ID, caller
   workflow, reusable workflow, ref, SHA, actor ID, run ID, attempt, expired
   token, and reused `jti`: each reject.
9. No update/delete/release API exists; attempted method/path rejects.
10. Database restart preserves consumed claims.
11. Backup/restore preserves uniqueness and claim bytes.

### 13.2 Controller/workflow tests

1. Research and QA expose `workflow_call` only; no `workflow_dispatch`,
   `workflow_run`, `repository_dispatch`, `schedule`, `push`, or PR trigger.
2. Only Controller exposes `workflow_dispatch`.
3. Controller calls exact local reusable workflows from the same authorized
   commit.
4. Top-level Controller uses one global concurrency group; concurrency is not
   accepted as the claim proof in code.
5. No worker-dispatch API call remains in helper or workflows.
6. Research cannot call QA; only Controller DAG can make QA eligible.
7. Model jobs retain only public target `contents: read`, no OIDC, Issues,
   Actions write, repository credential, or private checkout.
8. OIDC exists only on deterministic admission jobs; no OpenAI key exists
   there.
9. Model action exists exactly once per reusable workflow.
10. A required local guard step immediately precedes the model action.
11. Mutation tests detect removing/moving the guard, changing its condition,
    adding `continue-on-error`, adding `if: always()`, duplicating the model
    action, or adding a second inference action.

### 13.3 Exact requested scenario tests

For each case, execute the workflow/helper only against mocks or a non-model
test harness. Substitute a sentinel action that fails the test if reached.

1. `GITHUB_RUN_ATTEMPT=2`.
2. Full manual rerun fixture.
3. Failed-jobs rerun where admission succeeded in attempt `1` and the model job
   is selected in attempt `2`.
4. Specific model-job rerun.
5. Duplicate Controller workflow dispatch.
6. Attempted direct Research dispatch by Founder.
7. Attempted direct QA dispatch by Founder.
8. Attempted worker call from wrong Founder workflow.
9. Attempted worker call from a bot workflow.
10. Second Research call.
11. Second QA call.
12. Replacement Research after pre-inference failure.
13. Replacement Research after during-inference failure.
14. Replacement QA after failure.
15. Stale dispatch ID.
16. Wrong parent Controller run ID.
17. Wrong Controller workflow ID/path.
18. Wrong reusable workflow path/ref/SHA.
19. Wrong private control commit/tree/manifest.
20. Wrong public target commit/tree.
21. Two, ten, and one hundred concurrent valid duplicate claimants: exactly
    one sentinel owner becomes eligible and all others terminate before the
    sentinel action.

### 13.4 Failure-stage tests

1. Fail after slot claim but before model: claim remains consumed and no
   replacement becomes eligible.
2. Sentinel reports model start then fails: stage is during inference; claim
   remains consumed.
3. Sentinel succeeds, result preparation fails: no authoritative result.
4. Result preparation succeeds, artifact upload fails: no authoritative
   result and no QA.
5. Artifact bytes mismatch: finalizer rejects.
6. Finalizer succeeds: exactly one terminal result bound to the claim.
7. In-run finalizer is canceled: completion observer records failure/unknown
   only and never dispatches.

### 13.5 Provenance/schema tests

1. Every claim field mutation invalidates `claim_id`.
2. Every owner/run/job/workflow/SHA/dispatch/upstream mutation rejects.
3. Result v3 requires operation-owner claim ID, slot claim ID, dispatch ID,
   worker ID, parent Controller run, check-run ID, and reusable-workflow
   identity.
4. Research and QA results in the same parent run remain distinct by role slot
   and job execution.
5. Artifact validation downloads and compares exact canonical bytes.
6. GitHub bot-authored mirror comments without a valid ledger claim grant no
   authority.

No test may use the real OpenAI key, the pinned Codex action, a live model, the
consumed Cycle #1 work item, or production workflow dispatch.

## 14. Required code, schema, and workflow changes

All paths below are in the private control repository. This section is a future
implementation inventory, not authorization to modify them.

### Workflows

- `.github/workflows/vectoros-private-os1-controller-v01.yml`
  - remain the sole direct trigger;
  - bind exact Founder and control identity;
  - claim one operation owner;
  - call Research and QA reusable workflows in one run;
  - remove worker workflow dispatch authority;
  - run deterministic final STOP.
- `.github/workflows/vectoros-private-os1-research-v01.yml`
  - replace `workflow_dispatch` with `workflow_call`;
  - add deterministic slot-admission job with OIDC;
  - retain a credential-free inline attempt/receipt guard immediately before
    the single model action;
  - split proof upload from authoritative final result persistence.
- `.github/workflows/vectoros-private-os1-qa-v01.yml`
  - same changes as Research;
  - require exact Research finalized result and same operation owner.
- `.github/workflows/vectoros-private-os1-reconcile-v01.yml`
  - stop waking Controller or dispatching workflows;
  - observe completion/failure only;
  - append a failure/STOP observation without release/retry authority.

### Runtime

- `vectoros/runtime/private-os1-contract-v01.js`
  - introduce signed `control_identity` and exact worker-job identities;
  - update semantic operation payload and digest;
  - define claim/dispatch/worker identities.
- `vectoros/runtime/private-os1-github-helper-v01.js`
  - remove direct worker dispatch and wake paths;
  - add exact Controller and reusable-job validation;
  - add admission-ledger client, readback, and local guard receipt production;
  - separate prepared proof from authoritative final persistence.
- `vectoros/runtime/private-os1-result-v01.js`
  - bind results to operation/slot claims, same parent run, and exact job/check
    run;
  - validate referenced reusable workflow metadata;
  - validate artifact bytes before eligibility.
- `vectoros/runtime/private-os1-route-v01.js`
  - route within one Controller DAG;
  - count consumed role-slot claims, not dispatch comments;
  - provide no retry/replacement action.
- `vectoros/runtime/private-os1-state-v01.js`
  - introduce non-authoritative claim mirrors, dispatch v2, result v3, and
    failure observations;
  - stop treating generic bot comment identity as admission authority.
- `vectoros/runtime/private-os1-protocol-v01.js`
  - export the revised exact contract only.
- add a narrowly scoped admission-ledger client module; keep the transactional
  service in its separately authorized deployment boundary.

### Schemas and documentation

- `vectoros/protocol/work-item.schema.json` → new version with exact private
  control identity and explicit replacement semantics absent by default;
- `vectoros/protocol/terminal-result.schema.json` → new version with claim and
  job provenance;
- add `execution-slot-claim.schema.json`, `dispatch.schema.json`, and
  `failure-observation.schema.json`;
- update `vectoros/protocol/README.md` with the pre-inference invariant,
  failure fuse, CAS authority, and no-replacement rule.

### Tests

- update:
  - `vectoros/tests/private-os1-helper.test.js`;
  - `vectoros/tests/private-os1-protocol.test.js`;
  - `vectoros/tests/private-os1-workflows.test.js`;
- add dedicated admission-ledger and rerun/duplicate race tests implementing
  section 13.

### Permissions

- Controller deterministic admission: private contents read, Issues read,
  Actions read, OIDC `id-token: write`; no model secret.
- Reusable admission jobs: the same narrow read/OIDC permissions; no model
  secret and no repository write.
- Model jobs: public target read only, non-persistent checkout, read-only Codex
  profile, no GitHub mutation token, no OIDC permission.
- Finalizers: only the minimum private Issues/Actions read or write needed for
  verified results; no model secret and no dispatch permission.
- Completion observer: observation persistence only; no Actions write.

## 15. Design tradeoffs and residual boundaries

1. This is fail-closed, not availability-maximizing. A claim followed by an
   infrastructure failure burns the slot even when no inference occurred.
2. The CAS service becomes a small security-critical dependency. Its code,
   schema, deployment identity, database durability, OIDC policy, and backup
   semantics require independent security QA before installation.
3. The service does not receive Founder signing authority, model credentials,
   GitHub write authority, or dispatch authority. It proves uniqueness only.
4. Removing direct worker dispatch is required. Keeping separate worker runs
   would preserve a causal gap because GitHub's workflow-dispatch response does
   not provide an authenticated parent-child run relationship.
5. Exact control-SHA binding is required. Without it, a correct claim could
   authorize changed executable admission code.
6. This design does not itself remediate every red-team P1/P2 item. Byte-proof
   finalization and final STOP are included only because failure semantics and
   QA eligibility would otherwise remain ambiguous.

## 16. Exact later implementation prompt

The following prompt is a proposed future Founder assignment. It is inert
unless separately issued with exact authority. Its fail-closed base identity
is the currently observed private `main`; if that ref has moved, stop rather
than rebasing or guessing.

```text
CHAT / AGENT NAME:

VectorOS OS.1 Pre-Inference Single-Worker Admission Hardening Implementation

Rename this chat exactly:

VectorOS OS.1 Pre-Inference Single-Worker Admission Hardening Implementation

Founder-authorized VectorOS security implementation engineer.

IMPLEMENTATION + DETERMINISTIC TESTS ONLY.

Do NOT execute Codex or any model.
Do NOT run, rerun, or dispatch any GitHub Actions workflow.
Do NOT use the consumed Cycle #1 work item.
Do NOT create Cycle #2.
Do NOT merge, deploy, install, release, or enable the design.
Do NOT create or rotate credentials.
Do NOT silently replace any worker.

Private repository:
kw7t9rwhny-cyber/league-vector-rd-private

Required immutable base:
460f9dc06498993b843b35da2398a6b3eb060bde

Installed runtime ancestor:
f7e54b3850a54756402103885d5302f44c14e03b

Required design source:
kw7t9rwhny-cyber/league-vector report commit [FOUNDER MUST INSERT THE
IMMUTABLE REPORT COMMIT SHA FROM THE DESIGN HANDOFF], path
research/development-acceleration/OS1_PRE_INFERENCE_SINGLE_WORKER_ADMISSION_HARDENING_DESIGN_2026-08-22.md

Exact implementation branch:
codex/os1-pre-inference-single-worker-admission-hardening-implementation-2026-08-22

Before modifying anything, verify repository, visibility, base ref, exact base
SHA/tree, clean worktree, workflow registry identities, and the design report
bytes by immutable commit. If any identity differs, report BLOCKED and stop.

Implement the design exactly:

1. Make Research and QA workflow_call-only reusable workflows invoked within
   one Founder-triggered Controller run. Remove worker workflow_dispatch and
   all Controller/reconciler worker-dispatch/wake paths.
2. Add signed exact private control identity to the work-item semantic payload:
   repository/repository ID, commit, tree, authority manifest, Controller
   workflow ID/path/ref/SHA, Research and QA reusable-workflow paths/SHAs, and
   model/action/runtime pins.
3. Implement the append-only OIDC-authenticated admission-ledger client and its
   exact v1 claim schema. Do not emulate atomicity with Issue comments,
   artifacts, Actions cache, concurrency, or Git refs. The ledger contract must
   use a database unique key H(semantic_operation_id, role_instance_id), exact
   owner readback, immutable consumed state, and no release/delete/reassignment
   path.
4. Claim one operation owner and exactly one research-1 and qa-1 slot. Bind
   workflow ID, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT=1, dispatch ID, worker ID,
   semantic operation ID, parent Controller, exact job.workflow_* identity,
   expected ref/SHA, target identity, and upstream result.
5. Place a credential-free attempt/owner/receipt guard inside each model job
   immediately before its single pinned Codex action. It must still reject a
   rerun-failed-jobs attempt when the admission job is not rerun.
6. Keep OIDC and admission permissions out of model jobs. Keep OpenAI/model
   credentials out of admission and finalizer jobs. Do not widen public or
   model write authority.
7. Split proof preparation/upload from authoritative terminal persistence.
   Finalize only after downloading and byte-verifying the exact artifact.
8. Make the completion observer record failure/STOP only. It may not dispatch,
   rerun, release, remediate, or replace.
9. Preserve semantic replay rejection. A consumed slot remains consumed after
   pre-inference, during-inference, persistence, artifact, cancellation, or
   unknown failure. A new authorization ID alone does not create replacement
   authority.
10. Update exact schemas, protocol docs, runtime modules, and tests identified
    in section 14 of the design.

Required deterministic tests (no real model and no live workflow):

- run attempt 2;
- manual full rerun;
- rerun failed jobs with reused successful admission outputs;
- rerun one model job;
- duplicate Controller workflow_dispatch;
- attempted worker workflow_dispatch;
- second Research and second QA;
- replacement after each failure stage;
- Founder direct worker call;
- bot direct worker call;
- stale dispatch;
- wrong parent Controller;
- wrong workflow ID/path/ref/SHA;
- wrong private commit/tree/manifest;
- wrong public target;
- 2/10/100 concurrent duplicate claimants, proving exactly one ledger winner
  and zero loser entries into a sentinel model action;
- claim response loss/readback;
- database restart persistence;
- no release/delete/update API;
- result/artifact byte verification and failure-stage behavior;
- negative mutation tests for guard removal/relocation/bypass and second model
  action insertion.

Run the narrowest tests first, then the complete private OS.1 deterministic
test suite. Never pass a real OPENAI_API_KEY and never invoke the pinned Codex
action. Treat the admission ledger service deployment, credential/OIDC policy
installation, workflow installation, live test, and independent QA as separate
Founder-authorized tasks.

Modify only the exact OS.1 workflow/runtime/protocol/schema/test paths required
by the design. Do not remediate unrelated red-team findings, change public
runtime, or modify Cycle #1 durable state.

Commit and push the exact implementation branch. Verify the remote ref and
perform direct immutable readback. Do not create or merge a pull request unless
separately authorized.

Report:

STATUS: IMPLEMENTATION READY / BLOCKED
PRE-INFERENCE DUPLICATE REJECTION IMPLEMENTED: YES / NO
REAL MODEL EXECUTED: NO
WORKFLOW EXECUTED OR RERUN: NO
CYCLE #2 CREATED: NO
REPLACEMENT AUTHORITY ADDED: NO
EXACT BASE SHA: ...
IMPLEMENTATION COMMIT SHA: ...
REMOTE REF VERIFIED: YES / NO
DIRECT READBACK: PASS / FAIL
TESTS: exact commands and exact outcomes
```

## 17. GitHub semantics references

The GitHub platform conclusions in this design use current primary
documentation:

- [Re-running workflows and jobs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
  documents full, failed-job, and specific-job reruns; preservation of the
  original run's privileges/SHA/ref; and new attempts.
- [Contexts reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)
  defines `github.run_id`, `github.run_attempt`, `github.workflow_ref`,
  `github.workflow_sha`, and the reusable-workflow-specific `job.workflow_*`
  identity fields.
- [Reusing workflow configurations](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations)
  defines called-workflow caller context, permissions monotonicity, outputs,
  and rerun behavior.
- [Using OpenID Connect with reusable workflows](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows)
  documents caller claims and `job_workflow_ref` binding for called workflows.
- [Control workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
  documents repository-scoped mutual exclusion, pending-run behavior, and the
  absence of an authority ordering guarantee.

## 18. Final design disposition

The P0 is resolvable without granting model workers repository mutation or
dispatch authority. The key is to stop treating a semantic dispatch comment as
a reusable bearer pointer and instead make role admission an immutable claim
owned by one exact execution before the model action.

The required maximums are:

```text
Research model-action entries per signed semantic operation: 0 or 1
QA model-action entries per signed semantic operation:       0 or 1
Implicit retries/replacements after a consumed claim:        0
```

Any unavailable proof, failed claim, stale identity, wrong caller, wrong
attempt, wrong private SHA, race loser, partial failure, or ambiguous state
terminates before inference or leaves the already-consumed slot closed.

STOP. This design creates no implementation, remediation, execution,
replacement, merge, deployment, installation, release, or Cycle #2 authority.
