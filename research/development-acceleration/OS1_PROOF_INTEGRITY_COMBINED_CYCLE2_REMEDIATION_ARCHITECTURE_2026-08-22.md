# VectorOS OS.1 Proof Integrity + Combined Cycle #2 Remediation Architecture

Date: 2026-08-22 (America/Chicago)

Role: independent VectorOS security architect / adversarial integration reviewer

Scope: design only

Persistence classification: public-safe architecture. This report does not
reproduce restricted prompt substance, private credentials, secret values, or
private model output.

## Terminal determination

STATUS:

DESIGN READY

P0 BEFORE CYCLE #2:

1. Replace the duplicated/suppressed continuation topology with one
   deterministic Controller-owned lifecycle that cannot route on an
   incomplete worker run and that automatically reaches post-QA verification
   and STOP.
2. Bind Founder authorization, dispatch, admission, execution, and result
   verification to the exact private control repository commit, tree, and
   authority-critical blob manifest; dispatch the immutable commit, never
   floating private main.
3. Consume each Research or QA dispatch into exactly one admitted worker run
   and attempt before model inference; reject reruns, direct replacement
   dispatches, and alternate runs before any model call.

P1 BEFORE CYCLE #2:

1. Replace metadata-only proof checking and pre-upload terminal comments with
   candidate-artifact-first, post-completion Controller download,
   byte-recomputation, and verified-terminal persistence.
2. Apply that verifier after both Research and QA; no Research COMPLETE or QA
   PASS/FAIL/BLOCKED may be authoritative or routable before verification.
3. Stop treating the generic github-actions bot identity or self-reported run
   fields as workflow attestation. Bind every accepted candidate to
   independently fetched run, artifact, admission, parent, workflow, and
   immutable control-runtime evidence.
4. Stop placing restricted prompt/result substance in the logged command
   line. Use the pinned Action's prompt-file interface and verify absence of
   restricted markers in Actions logs.
5. Correct the authority documentation and tests: the present HMAC design
   distinguishes ordinary repository permission from Founder intent only
   while the single-Founder/admin-equivalence threat model holds. It does not
   resist a repository administrator who can replace both verifier bytes and
   the repository secret.

DEFERRABLE P2:

1. Structural Founder/repository-admin separation through an external or
   independently governed signer, protected environment, KMS, GitHub App, or
   OIDC policy.
2. Runtime enforcement of exact npm tarball integrity and installed
   platform-binary hashes for the Codex CLI and Responses API proxy.
3. Cryptographic OIDC/Sigstore artifact attestation beyond authenticated
   GitHub run/artifact association, long-term proof replication beyond
   Actions retention, and a generalized crash-recovery service.

AUTHORITY EXPANSION REQUIRED:

NO

The minimal envelope reuses existing deterministic Controller authority and
does not grant either model, the QA model job, or the public repository a new
capability. A variant that gives a QA notifier actions-write, introduces a
PAT/App token, widens repository permissions, or adds a new signing service is
outside this no-expansion envelope and would require separate explicit
authorization.

This design does not authorize implementation, installation, OS.1 execution,
Cycle #2, remediation of another branch, merge, deployment, or release.

## 1. Exact review basis

The architecture was derived from direct review of:

- private immutable review commit
  b4e4bbf64453144a6cc9ae24357a0ccf98935422, tree
  d81cea5b2f30bc8f0fd0da24e25b0f34f14443f4;
- the complete installed OS.1 workflows, runtime modules, schemas, protocol
  README, package metadata, and tests at that commit;
- the independent red-team report blob
  05d830e462b8fe8dd2a06bb13f94fcc593a27e6c;
- Cycle #1 definitive reconciliation commit
  b99283846e1b6160cf9b66d18dbe42a2fb74abe8 and report blob
  7f7889fd41cb9de61daaf30c8cf52c03e1339564;
- topology root-cause commit
  92a242340299fa355f81c1e75a2ae90e50a1b7b6 and report blob
  5c5bc8cc9c008ba8f8b629073fa24d4a7c226d19; and
- pinned openai/codex-action commit
  86365089eb2b84e0a8fb0717b304f8bdcb13b20e, including its composite
  installation steps and command construction.

The installed authority-critical runtime blobs at the review commit are the
same blobs reviewed by the red team from installed runtime commit
f7e54b3850a54756402103885d5302f44c14e03b and tree
412edac2bb03e45ae3bb5859c1617998f6be579c.

The three optional Cycle #2 design branches named in the assignment were not
remotely available when checked during drafting. This report therefore states
explicit interface requirements for those P0 designs; it does not claim to
have reconciled unpublished content.

The public report branch starts from public origin/main commit
cb8a58f70d3aa7e543da221e9592096404848c05, tree
64f80be3b2d029d903fbd904fe673d6c38d0df1d.

## 2. Why the remaining findings form one terminalization problem

The installed sequence creates an authoritative-looking result comment before
artifact upload and before the worker run is complete. Later validation checks
artifact name, expiry, and run metadata, but not the payload bytes. Research
has an early Controller wake; QA has no later automatic Controller
verification. Comment authorship is attributed only to the generic GitHub
Actions bot.

These are not four isolated patches. They are one missing state transition:
the runtime has no installed distinction between a model result candidate and
a terminal result whose producing run, proof bytes, and verifier have all been
established.

Finding-by-finding classification:

| Red-team finding | Classification | Cycle #2 treatment |
|---|---|---|
| Artifact metadata checked but payload bytes not independently verified | P1 | Required in the verified-terminal unit |
| Terminal comment can precede upload and producer completion | P1 | Required ordering/schema correction |
| QA has no later automatic verifier | P1, with a P0 topology dependency | Required Controller QA verifier and STOP |
| Generic bot identity is weaker than workflow-specific provenance | P1 | Required run/admission/artifact chain |
| Founder HMAC and repository administration are not structurally separate | P2 for structural separation; P1 for truthful threat-model correction | Defer separation only under the signed single-Founder/admin-equivalence scope |
| Restricted prompt substance appears in private Actions logs | P1 | Use prompt-file before Cycle #2 |
| Installed npm package integrity is not re-attested | P2 | Defer with an explicit non-attestation limitation |

The topology, exact-private-runtime binding, and pre-inference admission
findings retain P0 priority independently of this table.

The correction is a small state machine:

    AUTHORIZED
      -> DISPATCH CLAIMED
      -> EXACT RUN ADMITTED BEFORE INFERENCE
      -> MODEL OUTPUT CANDIDATE BUILT
      -> CANDIDATE ARTIFACT UPLOADED
      -> PRODUCER RUN COMPLETED/SUCCESS
      -> CONTROLLER DOWNLOADS AND VERIFIES BYTES
      -> VERIFIED TERMINAL RECORD PERSISTED/READ BACK
      -> RESEARCH: ROUTE QA
         QA: FOUNDER/LEAD STOP

No edge may be skipped. Wake events and issue comments are pointers to state,
not authority.

## 3. Canonical proof bytes

### 3.1 Canonical payload

The artifact's canonical payload must be one file named exactly:

    vectoros-private-terminal-candidate.json

Its bytes must be:

1. UTF-8;
2. no byte-order mark;
3. the existing recursively key-sorted canonical JSON encoding of the strict
   candidate object;
4. no insignificant whitespace inside the JSON;
5. followed by exactly one LF byte;
6. no CR byte and no second trailing LF.

The transport ZIP generated by GitHub is not canonical. ZIP metadata,
compression, entry timestamps, and server-side transport digest may vary.
The canonical object is the uncompressed single-file payload.

The downloaded artifact must contain exactly one regular file with the exact
name above. Directories, additional entries, duplicate paths, path traversal,
absolute paths, symlinks, hard links, device entries, oversized payloads,
invalid UTF-8, BOMs, and decompression-limit violations fail closed.

### 3.2 Candidate and verified-record schemas

A schema bump is required. Existing v2 terminal-result comments must remain
historical evidence and must not be silently interpreted as v3 verified
terminal state.

The candidate envelope should contain:

- a candidate schema version and evidence_state equal to candidate;
- work-item, replay, role, role-instance, input, upstream, and dispatch
  identities;
- exact admitted producer run ID and attempt;
- exact private control repository, commit, tree, workflow path, workflow
  SHA, and authority-critical manifest digest;
- actor login, immutable actor ID, type, triggering-actor fields, event, and
  head ref obtained for comparison;
- the pinned model/action/runtime configuration already present in v2;
- the bounded model substance;
- result ID and canonical digest.

The verified terminal record should contain:

- the exact candidate object;
- artifact ID, exact name, producing run ID, creation/expiry data, payload
  byte count, and payload SHA-256;
- the exact dispatch and pre-inference admission claim identities;
- the independently observed producer-run attestation;
- Controller verifier workflow path, immutable control SHA/tree, verifier run
  ID/attempt, exact verifier job identity, job conclusion, and verification
  time;
- evidence_state equal to verified;
- the terminal disposition derived from, not independently supplied beside,
  the candidate substance; and
- a digest over the entire verified record with only its own digest field
  omitted.

Only the verified-record marker and schema are eligible for routing. Candidate
objects, upload metadata, legacy terminal comments, and raw model status words
are not terminal authority.

### 3.3 Digest computation

The deterministic worker-side candidate builder computes:

- result_id from the immutable operation, role, admission, execution, model,
  input, and upstream identities;
- canonical_digest as SHA-256 over canonical candidate JSON with only
  canonical_digest omitted; and
- the local proof file bytes as canonical(candidate) plus one LF.

It does not put a hash of the final file inside the bytes being hashed; that
would be self-referential.

After the exact producer run is completed/success, the deterministic
Controller:

1. downloads the artifact by the exact API-returned artifact ID associated
   with the admitted run;
2. enforces the single-entry archive rules;
3. reads a raw Buffer, not a shell variable;
4. parses and strictly validates the candidate;
5. reconstructs canonical(candidate) plus one LF;
6. requires raw Buffer equality;
7. independently recomputes result_id and canonical_digest;
8. computes payload_sha256 over the complete file bytes, including the single
   LF; and
9. persists those independently observed values in the verified record.

The GitHub-provided archive digest is useful corroboration but is not a
substitute for payload extraction and comparison.

## 4. Persistence ordering and authoritative state

### 4.1 Required order

The worker must not write an authoritative terminal comment.

The order is:

1. deterministic candidate construction;
2. local byte validation;
3. artifact upload;
4. worker terminal guard and run completion;
5. Controller observation of completed/success on the exact admitted run;
6. Controller artifact download and byte verification;
7. verified-terminal write;
8. direct readback and exact-one validation;
9. only then, routing or STOP.

The comment is a durable verified-record cache and locator. Installed readers
must still validate its referenced producer run, successful verifier job, and
proof evidence. Generic comment authorship is never the trust root.

### 4.2 What is authoritative before proof verification

Before proof verification, only these control facts can be authoritative:

- the Founder-authorized work item under the separately remediated exact
  private-runtime binding;
- the single-use operation claim;
- the deterministic dispatch claim; and
- the pre-inference exact-run admission claim.

There is no authoritative Research COMPLETE, QA PASS, QA FAIL, QA BLOCKED, or
terminal result. The Controller may report pending, waiting, or
infrastructure-blocked, but may not route from model substance.

### 4.3 Partial-failure outcomes

If result construction succeeds but upload fails:

- no verified terminal record exists;
- the producer run must conclude non-success;
- the Controller records or outputs an infrastructure verification failure
  and STOP/BLOCKED;
- Research cannot dispatch QA; and
- QA cannot be interpreted as PASS.

Any legacy v2 comment already written under the old order is quarantined as
unverified historical evidence. Its presence cannot satisfy the new
verified-terminal parser or routing predicate.

If upload succeeds but the producer run later fails or is cancelled, the
artifact is an orphaned candidate and is ineligible.

If artifact verification succeeds but verified-record persistence is
ambiguous, the existing write/readback discipline applies: re-read, require
exactly one byte-equivalent record, and do not route until durability is
established.

The verified-record write must be the last authority-bearing step of a
dedicated Controller verifier job. Installed readers reject the record unless
that exact job is completed/success. A later Controller routing job may consume
it only through an explicit successful job dependency and fresh validation.
This prevents a comment written before a failing checkout/action post-step
from becoming terminal authority.

If the artifact expires before verification, verification is BLOCKED. A name,
digest string, or historical comment cannot substitute for missing bytes.

### 4.4 Preventing false COMPLETE/PASS

The following are mandatory:

- a candidate marker that does not contain the authoritative terminal marker;
- a schema-level evidence_state distinction;
- no legacy v2 record accepted as v3;
- no routing on a raw status word;
- no human-facing summary headed COMPLETE or PASS until the validator has
  established the full authority predicate;
- a distinct infrastructure failure/STOP record rather than manufacturing a
  Research BLOCKED or QA result that the model did not produce; and
- exact-one semantics for candidate artifact, admitted run, verified record,
  and role instance.

## 5. Automatic Research and QA verification

The topology design must provide a Controller-owned automatic verifier after
each exact worker. For the minimal no-expansion envelope, one long-lived
Controller workflow owns a bounded multi-job sequence:

1. dispatch and obtain the exact Research admission;
2. wait for and verify Research in a dedicated verifier job;
3. route only from that successful job and dispatch QA;
4. obtain the exact QA admission;
5. wait for and verify QA in a second dedicated verifier job; and
6. emit STOP from a job that depends on successful QA verification.

Each wait job must have a timeout derived from the worker maximum plus a small
fixed margin. The Controller's global concurrency lane is held for this one
bounded cycle; that is acceptable for Cycle #2 and is disclosed as a scaling
limitation.

The required behavior is:

- the Controller workflow that dispatches an exact worker remains responsible
  for observing the admitted child run through a strict, bounded completion
  poll;
- it verifies only that exact run ID/attempt and never searches for a
  convenient replacement;
- it downloads and verifies the artifact only after completed/success;
- after a verified Research COMPLETE it may create the one QA dispatch;
- after any verified QA disposition it emits the deterministic
  Founder/Lead STOP decision and dispatches nothing; and
- timeout, failure, cancellation, missing admission, missing artifact, or
  proof mismatch produces STOP/BLOCKED and no new worker.

Workers do not wake the Controller in this envelope. The installed direct
Research wake and the standalone workflow_run Reconciler are both removed.
QA receives no actions-write permission and no routing authority.

The topology owner may instead propose a separate deterministic QA notifier,
but granting that workflow actions-write is a permission expansion and is not
part of this envelope. Do not install both mechanisms.

The dead workflow_run Reconciler must not be retained as a claimed recovery
path. Do not add a PAT or GitHub App merely to force that event edge. A future
crash-recovery plane may be designed separately; Cycle #2 must not claim one
exists.

## 6. Producing workflow and bot provenance

### 6.1 Actor identity is not attestation

Login github-actions[bot], immutable bot ID 41898282, type Bot, a run ID, an
artifact name, and a parent ID are identifiers. When copied into a comment by
the same generic bot, they are assertions, not proof that the named workflow
created that comment or artifact.

Actor ID plus self-reported run ID plus self-reported artifact plus parent is
therefore not sufficient.

### 6.2 Minimum Cycle #2 attestation

Under the explicitly trusted GitHub control-plane threat model, the minimum
acceptable producer proof is an independently reconstructed chain:

1. the Founder-signed work item binds the exact private control commit, tree,
   workflow paths, and authority manifest;
2. the Controller dispatch claim binds the work item, operation, role,
   upstream, exact target, exact control identity, and parent Controller run;
3. the pre-inference P0 admission claim binds that dispatch to one child run
   ID and attempt before the model step;
4. authenticated GitHub run data proves repository, repository ID, event,
   workflow path, head SHA/ref, run ID, attempt, immutable actor IDs/types,
   triggering actor, chronology, and completed/success;
5. authenticated artifact data proves the exact artifact ID is attached to
   that admitted run;
6. downloaded candidate bytes reproduce every bound identity and digest; and
7. the Controller's verified record binds all of the above and is accepted
   only after the exact verifier job itself is completed/success.

This is workflow-specific evidence because another workflow cannot attach an
artifact to the admitted producer run, and a forged comment cannot bypass
fresh run/artifact/byte validation. Comment author identity remains a filter,
not the authority source.

For dispatch records, the pre-inference admission design must provide the
non-self-reported dispatch-to-child-run binding. If it does not, this report's
provenance requirement is unsatisfied and Cycle #2 remains blocked.

### 6.3 Stronger later attestation

A GitHub artifact attestation with an OIDC subject bound to the exact
repository, workflow file, ref/SHA, and run, or a signature from a
workflow-scoped external key, would provide stronger cryptographic provenance.
It is desirable later but is not required for the minimal Cycle #2 envelope
when authenticated GitHub run/artifact association is an explicit trust
anchor.

A repository HMAC secret available under the same administrative boundary is
not workflow-specific attestation and must not be described as such.

## 7. Founder authority versus repository administration

### 7.1 Honest classification

The current design has identity and intent checks, but not structural
Founder/admin separation.

The symmetric Founder HMAC key is an ordinary secret in the same repository
whose main bytes define the verifier. There is no protected environment or
independently administered signing service in the reviewed state. An
administrator capable of replacing the secret and executable verifier can
become both signer and verifier.

The current sole collaborator being the Founder reduces the present actor set.
It does not create a structural boundary.

### 7.2 Required before Cycle #2

Stronger structural separation is not required before Cycle #2 only under this
explicit scope:

- one Founder account is also the sole repository administrator and secret
  custodian;
- resistance to compromise or malice of that combined principal is outside
  the Cycle #2 threat model;
- exact private runtime binding and immutable dispatch close movement by
  ordinary workflow drift, not Founder/admin compromise;
- no non-Founder administrator, secret manager, or equivalent principal is
  added; and
- all reports and UI language retain admin-equivalence as a known limitation.

The signed work-item schema should include a constant authority-model
identifier equivalent to single-founder-admin-equivalence/v1 so that the
limitation is part of the authorized operation, not an unstated assumption.

Tests may still prove that ordinary write/maintain/admin labels do not satisfy
the exact Founder login/ID checks under an uncompromised key. They must not
generalize that result into a claim that repository administration cannot
forge Founder authority.

If the actor set expands or the threat model must resist repository
administration, structural separation becomes P0 before any later cycle.

### 7.3 Later structural options

Legitimate stronger designs include:

- asymmetric Founder signatures produced outside the repository, with only a
  pinned public verification key in runtime;
- a protected environment whose approver/custodian is independent of
  repository administration;
- an external KMS or GitHub App with an OIDC policy binding exact workflow and
  immutable runtime identity; or
- dual custody with independent installation and signing principals.

No such separation exists today, and this report does not invent or authorize
it.

## 8. Restricted prompt substance in Actions logs

The pinned Action accepts both inline prompt and prompt-file. The installed
OS.1 workflow uses the inline prompt. The Action's composite shell passes that
value as a command-line argument, and its command runner logs the constructed
command. This accounts for the observed restricted prompt/result substance in
private Actions logs.

The minimal correction is:

1. materialize the prompt through deterministic code into a file under the
   runner temporary directory with mode 0600;
2. never use shell echo, command substitution, tracing, or an argument
   containing the prompt;
3. pass only prompt-file to the pinned Action;
4. ensure the prompt file is outside the public target checkout and excluded
   from artifact upload;
5. delete it in an always-run cleanup step; and
6. test the rendered command/log fixture for absence of canary objective and
   Research-result markers.

The prompt still necessarily reaches the selected model provider, and private
Actions metadata still reveals bounded workflow/run information. This
correction prevents avoidable duplication of full substance in the command
log; it is not a claim of zero logging anywhere.

This is P1 before Cycle #2 because the confidentiality is explicitly
restricted-R&D, the leak is already demonstrated, and the pinned Action
already supports the narrow fix.

## 9. npm package integrity

The pinned Action installs:

- @openai/codex at the supplied version; and
- @openai/codex-responses-api-proxy at the same version

through live global npm installs. OS.1 records version 0.149.0 but does not
verify the fetched tarball integrity or the installed platform binary before
model invocation.

This remains a real supply-chain limitation. It is classified P2 for the
single bounded Cycle #2 envelope because the Action commit and version are
fixed and prior installation evidence recorded registry integrity, while a
correct in-action pre-execution verifier requires a reviewed Action change or
equivalent wrapper. Version identity is not represented as byte integrity.

Later hardening should:

1. Founder-bind expected SRI values for both npm packages and the exact
   platform package/binary manifest;
2. download exact tarballs;
3. verify SRI before installation;
4. install only from the verified local tarballs;
5. hash the installed CLI/proxy/platform binary before execution; and
6. bind expected and observed values into model identity and the verified
   terminal record.

If registry compromise, version mutability, or a digest mismatch is observed,
this item immediately becomes P0. The runtime must not claim npm byte
attestation while it remains deferred.

## 10. Interaction with the three independently designed P0 areas

### 10.1 Topology and terminal STOP design

Required interface:

- exactly one Controller-owned multi-job lifecycle;
- strict bounded polling of the exact admitted child;
- post-Research verification before QA;
- post-QA verification before STOP;
- no reliance on the suppressed workflow_run edge;
- no worker wake or dual wake paths; and
- no model or QA routing authority.

Proof verification should be a Controller transition inside that topology,
not a second competing router.

### 10.2 Exact private runtime / Founder binding design

Required interface:

- work-item authority binds private repository, commit, tree, workflow paths,
  runtime/helper/schema blobs, action pins, and a manifest digest;
- semantic operation and Founder signature cover that control identity;
- every workflow dispatch uses the exact commit SHA rather than main;
- every producer and verifier run must report that exact head SHA and tree;
- candidate/verified schema versions and artifact-verifier implementation
  blobs are included in the manifest; and
- any mismatch is detected before inference or routing.

Artifact verification cannot compensate for a floating verifier. The verifier
bytes themselves must be Founder-bound.

### 10.3 Pre-inference single-worker admission design

Required interface:

- one dispatch claim maps to one exact Research or QA run ID, attempt 1;
- the claim is consumed before the model action;
- the current run proves it owns the claim;
- direct workflow dispatch, rerun attempt 2, replacement run, and conflicting
  ownership fail before model inference;
- the admission binds parent Controller, role, work item, operation, target,
  private runtime, workflow, and upstream result; and
- artifact verification accepts only the admitted run.

Artifact correctness is downstream of admission. Correct bytes from an
unadmitted replacement run are still unauthorized.

### 10.4 Integration rule

The three P0 implementations and this P1 terminalization design must be
reviewed as one state machine before installation. Passing their tests in
isolation is insufficient. No layer may recreate floating main, generic-bot
trust, a second wake path, post-inference admission, or routing on a candidate.

## 11. Minimal Cycle #2 remediation envelope

### 11.1 Required changes

1. Adopt the three P0 designs with the interfaces above.
2. Introduce candidate and verified-terminal schemas and distinct durable
   markers.
3. Make worker deterministic persistence build and upload a candidate only;
   remove worker terminal-result comment authority.
4. Add Controller artifact download, strict archive validation, raw-byte
   equality, digest recomputation, run verification, verified-record
   persistence, and direct readback.
5. Run the same verification path for Research and QA.
6. Make one Controller multi-job workflow remain responsible through bounded
   Research completion/verification, QA completion/verification, and STOP;
   remove both worker wake and standalone Reconciler paths.
7. Treat issue comments as state locators/caches; validate all authority from
   exact signed state plus authenticated run/artifact evidence.
8. Bind every new schema/helper/workflow blob into the exact private-runtime
   manifest and Founder authorization.
9. Use prompt-file with restrictive temporary-file handling.
10. Correct authority claims to disclose single-Founder/admin equivalence.

### 11.2 Optional changes

- OIDC/Sigstore artifact attestations;
- external signer or KMS;
- exact npm tarball and installed-binary attestation;
- long-term private proof storage beyond Actions artifact retention;
- generalized scheduled/queued crash recovery;
- multi-instance Controller scaling; and
- Project Cells generalization.

These options must not be pulled into the minimal Cycle #2 candidate unless
separately justified and authorized.

### 11.3 Excluded changes

- no public-repository mutation authority;
- no model write, persistence, dispatch, or routing authority;
- no PAT/App token merely to revive workflow_run;
- no second Research or QA worker;
- no retry/replacement path;
- no automatic remediation after QA;
- no merge, deployment, or release authority; and
- no representation of this design as Cycle #2 authorization.

## 12. Required tests

### 12.1 Canonical bytes and archive falsification

1. Exact canonical JSON plus one LF passes.
2. Key reordering, spaces, CRLF, missing LF, double LF, BOM, invalid UTF-8,
   truncation, mutation, and wrong digest fail.
3. Empty, duplicate, expired, wrong-run, wrong-name, and same-name/wrong-byte
   artifacts fail.
4. Extra ZIP entries, duplicate paths, traversal, absolute path, symlink,
   hard-link, oversized, and decompression-bomb fixtures fail.
5. Shell-variable newline normalization is never used.

### 12.2 Ordering and partial failure

1. Upload failure produces no verified terminal and no QA.
2. Upload success followed by producer failure produces no verified terminal.
3. Candidate artifact without completed/success producer is ineligible.
4. Verified-record write ambiguity never routes.
5. Exactly one idempotent retry of Controller persistence yields one record,
   not duplicate authority.
6. A verifier job that is not completed/success makes its record ineligible.

### 12.3 Research/QA closure

1. Research COMPLETE cannot dispatch QA before byte verification.
2. Research BLOCKED is terminal only after verification and dispatches no QA.
3. QA PASS, FAIL, and BLOCKED each require the same verification and all route
   to STOP.
4. No run follows verified QA without new Founder authority.
5. Early completion observation, timeout, cancellation, failure, and missing
   artifact all fail closed.

### 12.4 Provenance and admission

1. Mutate every repository, repository ID, workflow path, workflow SHA,
   private tree/manifest, event, run ID, attempt, actor ID/type, triggering
   actor, parent, dispatch, admission, role, target, and upstream field.
2. Forge a perfect-looking generic-bot comment without the admitted
   run/artifact association; it must not count.
3. Attach correct-looking bytes to a different run; it must not count.
4. Use correct bytes from attempt 2, a direct dispatch, replacement worker, or
   unadmitted run; each must fail before inference or verification.
5. Two concurrent claims admit at most one exact worker.

### 12.5 Topology integration

1. Production helper fixture: exact child moves from queued/in-progress to
   completed/success within the bound.
2. Timeout or non-success creates STOP/BLOCKED and no replacement.
3. One Controller owns the transition; no workflow_run fallback is required.
4. The Controller multi-job workflow automatically verifies QA and reaches
   STOP without worker actions-write.
5. No dual notification creates a second Controller authority path.

### 12.6 Confidentiality

1. Prompt and QA upstream-result canaries do not occur in the rendered shell
   command or captured Actions-log fixture.
2. Only the prompt-file path is logged.
3. The prompt file is mode 0600, outside the target checkout and proof
   artifact, and removed during success and failure cleanup.

### 12.7 Permission and regression

1. Model jobs remain contents-read only, credential-free for the public
   target, read-only permission profile, and drop-sudo.
2. QA receives no actions-write, routing, or issue persistence authority in
   the minimal envelope.
3. Public API calls remain GET-only.
4. Existing semantic replay, two-worker budget, duplicate result, exact
   target, pinning, and ambiguous-write tests remain green.
5. Legacy v2 records cannot satisfy v3 routing.

## 13. Independent QA requirements

Independent QA must be performed by an agent that did not implement the
candidate and must:

- review the exact immutable candidate commit/tree and complete
  authority-critical blob manifest;
- reconcile the four designs as one transition system;
- inspect actual workflow permissions job by job;
- run all deterministic and mutation tests;
- independently construct malformed archives and forged bot records;
- prove no model call is reachable before exact-run admission;
- prove no QA route is reachable before verified Research;
- prove every verified QA disposition reaches STOP;
- inspect the pinned Action command path and a no-model log fixture for prompt
  leakage;
- verify the npm limitation is disclosed rather than falsely passed;
- report exact commands, counts, failures, and immutable evidence; and
- issue no remediation, installation, execution, or Cycle #2 authority.

A self-review by the implementation agent is not independent QA.

## 14. Installation and readback requirements

After separately authorized implementation and independent QA:

1. install only the exact QA-approved private candidate commit;
2. re-resolve remote candidate commit, tree, parent, and all
   authority-critical blobs immediately before installation;
3. install through the existing controlled private process, not by editing
   main ad hoc;
4. read private main back by immutable commit SHA;
5. verify exact tree and blob equality with the approved manifest;
6. verify workflow registry paths/states and exact pinned action commits;
7. verify job-level permissions, absence of the dead Reconciler, absence of
   inline prompt transport, schema-version boundaries, and exact-SHA
   dispatch;
8. run the complete installed deterministic suite from installed bytes;
9. perform a no-model proof-download/readback fixture sufficient to establish
   the installed artifact validator and log boundary;
10. persist installation evidence privately and directly read it back; and
11. only after those gates, prepare a new exact Founder-signed Cycle #2 work
    item for separate authorization.

Installation success does not authorize Cycle #2.

## 15. Explicit residual risks

Even after the minimal envelope:

- the combined Founder/admin principal can replace repository secrets and
  verifier bytes; this is explicitly outside the scoped threat model;
- authenticated GitHub run/artifact APIs remain a trusted control plane;
- a forged generic-bot comment can still cause noise or fail-closed denial,
  though it cannot create verified terminal authority;
- Actions artifacts expire, so fresh raw-byte verification is retention
  bounded unless later replicated;
- live npm installs remain version-pinned but not byte-attested;
- prompt content still reaches the selected model provider;
- a Controller/transport crash can strand progress; no replacement worker or
  generalized recovery authority is implied;
- global Controller serialization remains a scaling/liveness constraint; and
- this design is specific to bounded OS.1 and does not establish a general
  Project Cells architecture.

These residuals are limitations, not PASS claims.

## 16. Final boundary

The proposed minimal envelope makes terminal authority a derived predicate
over exact Founder-bound runtime, pre-inference admission, completed producer
run, downloaded canonical bytes, authenticated artifact association,
Controller verification, durable readback, and post-QA STOP.

It does not require a larger orchestration platform, a new model role, a PAT,
public mutation, or structural Founder/admin separation for the explicitly
scoped single-Founder Cycle #2 threat model.

DESIGN READY — IMPLEMENTATION, INDEPENDENT QA, CONTROLLED INSTALLATION,
IMMUTABLE READBACK, AND NEW FOUNDER AUTHORIZATION REMAIN REQUIRED BEFORE ANY
CYCLE #2 OPERATION.
