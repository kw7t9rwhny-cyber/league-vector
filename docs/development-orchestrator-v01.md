# League Vector Development Orchestrator v0.1

## Purpose

League Vector already uses GitHub as its technical source of truth. v0.1 formalizes the conventions that are working so Founder / Command Center no longer needs to copy routine prompts and status messages between specialist chats. It does not automate product strategy, model promotion, merges, deployment, purchases, licensing, legal/privacy decisions, or other Founder gates.

This PR is internal development infrastructure only. It changes no football projections, Dynasty Value math, IDP math, scoring, identity behavior, production UI, or active research branch.

## 1. Current workflow diagnosis

The organic workflow is strong in four places: isolated role-owned branches; PR comments as durable handoffs; exact-SHA QA verdicts; and explicit phrases such as `READY FOR QA`, `QA PASS`, `QA FAIL`, `WAITING ON FOUNDER`, `LIVE TEST READY`, and `MORE RESEARCH REQUIRED`.

The manual cost is routing. Founder currently acts as a message bus between owner -> QA -> remediation -> Core -> release. Status is often encoded in prose instead of one canonical machine-readable dimension. Older one-off labels also overlap (`waiting-for-qa`, `qa-required`, `not-ready-for-qa`, `high-risk`, `more-research-required`). This creates duplicated inspection and makes permanent agent inboxes difficult.

Human gates should remain for consequential product/business choices. Routine research, isolated implementation, QA, remediation, CI and release preparation can be routed from GitHub state.

## 2. Minimal state machine

v0.1 uses nine states:

- `active` — owner is researching, implementing, or remediating.
- `blocked` — an external or upstream dependency prevents useful progress.
- `ready-for-qa` — exact candidate head is frozen for independent QA.
- `qa-failed` — QA verdict is preserved; original owner remediates.
- `qa-passed` — exact head has an independent PASS.
- `ready-for-core` — QA-passed integration candidate with dependencies satisfied.
- `waiting-founder` — workflow intentionally stops for a Founder decision.
- `live-test` — deployed/release-verified enough for Founder real-browser/product verification.
- `closed` — completed, superseded, or research cycle ended with no candidate.

Canonical transitions are encoded in `config/development-orchestrator-v01.json`. Important loops are:

`active -> ready-for-qa -> qa-passed -> ready-for-core`

`active -> ready-for-qa -> qa-failed -> active -> ready-for-qa`

`qa-passed/ready-for-core -> waiting-founder -> live-test`

Research that proves no candidate may go `active -> closed` with a durable `MORE RESEARCH REQUIRED` result.

## 3. Label taxonomy

Create only the canonical labels below during Stage 1. Existing legacy labels can coexist until migration is proven.

**Type:** `type:bug`, `type:feature`, `type:research`, `type:ui`, `type:infrastructure`.

**Owner:** `owner:core`, `owner:projection`, `owner:rookie`, `owner:dynasty`, `owner:idp`, `owner:opportunity`, `owner:ui`, `owner:qa`, `owner:product`.

**Risk:** `risk:low`, `risk:medium`, `risk:high`.

**Status:** `status:active`, `status:blocked`, `status:ready-for-qa`, `status:qa-failed`, `status:qa-passed`, `status:ready-for-core`, `status:waiting-founder`, `status:live-test`, `status:closed`.

**Routing/gates:** `integration-required`, `founder-decision-required`.

**Priority:** `priority:urgent`, `priority:high`, `priority:normal`. These are scheduling priorities and are deliberately different from QA defect severities P0/P1/P2/P3.

Avoid encoding every football-specific invariant as a workflow label. Those belong in the work-item contract, tests, or domain documentation.

## 4. Work-item contract

`.github/ISSUE_TEMPLATE/work-item.md` and `.github/PULL_REQUEST_TEMPLATE.md` require enough context for another role to continue without a copied chat prompt: objective, owner, risk, status, type, priority, dependencies, exact relevant SHA/PR/artifact, production impact, validation required, Founder gate, integration requirement, and completion criteria.

The PR itself remains the durable technical thread. QA failures are appended to the same PR and remediation happens on the original owner branch unless a clean replacement branch is technically necessary.

## 5. QA inbox

Permanent QA protocol:

1. Query open work carrying `status:ready-for-qa`.
2. Verify exactly one owner and one risk label.
3. Record candidate head before testing.
4. Use risk to select depth: LOW presentation/copy/test/cache may use delta QA on narrow remediation; MEDIUM architecture/data plumbing gets fail-closed and regression coverage; HIGH valuation/model/identity/scoring gets exhaustive independent reconstruction.
5. Record exactly `QA PASS — tested head <SHA>` or `QA FAIL — tested head <SHA>` on the PR.
6. PASS routes toward `status:qa-passed`; FAIL routes toward `status:qa-failed` and the original owner.
7. Never merge merely because QA passed.

Stage 2 may automate label mutation after validating the verdict syntax and exact head. v0.1 intentionally does not mutate labels automatically.

## 6. Remediation routing

`qa-failed` preserves the QA report and owner. The original owner reads the PR verdict, fixes only the blockers, produces a new exact SHA, and returns the same work item to `ready-for-qa`. HIGH risk returns to exhaustive QA unless QA explicitly determines a non-model metadata-only delta is sufficient. LOW risk can use delta QA when the failure class is narrow.

Founder does not need to copy the QA report to the owner because the PR is the handoff layer.

## 7. Core inbox

Core works only candidates that are:

- `status:ready-for-core`;
- marked `integration-required`;
- backed by fresh exact-SHA QA PASS;
- free of unsatisfied dependencies;
- not blocked by a Founder gate.

Core may assemble a fresh integration/release branch, selectively integrate approved artifacts, run combined CI, and prepare a release candidate. Core may not silently promote a model, merge/deploy a Founder-gated release, or reinterpret research evidence.

## 8. Founder gates

Use `status:waiting-founder` plus `founder-decision-required`. Gate reasons are: `release`, `data-license`, `production-model-promotion`, or `business-decision`.

Founder approval remains mandatory for production Dynasty Value architecture changes, first production activation of major numerical models, public launch, pricing, paid data licensing, material infrastructure spending, legal/privacy decisions, partnerships, and any release explicitly marked Founder-gated.

Founder requests should be short:

**DECISION REQUIRED — RELEASE**

Approve deployment of <candidate>. Evidence: exact QA PASS, CI PASS, production impact, known limitations. Options: APPROVE / REJECT / REQUEST CHANGES.

Do not dump logs unless Founder asks or a decision depends on them.

## 9. Dependencies

Each dependency names an issue/PR/work-item identifier and the state required. Downstream Core eligibility fails closed when a dependency is missing, not sufficiently advanced, or has stale QA. External dependencies such as Sportradar are represented by `status:blocked` and a concise blocker reason.

A schema-normalizing data sample does not automatically satisfy a licensing/modeling dependency; the work item must define the actual completion gate.

## 10. Exact-SHA safety

QA PASS belongs to `qa_tested_sha`. The current PR `head_sha` must equal it. Any new commit makes the prior approval stale. Core/release eligibility must fail closed until re-review appropriate to risk. This is encoded and tested in `scripts/development-orchestrator-v01.js`.

## 11. Concurrency

Research branches are parallel by default because they do not modify production surfaces. Two agents should not concurrently own the same production surface unless one is explicitly read-only.

Queue interpretation:

- **RUN NOW:** owner matches, status is active/remediation, dependencies satisfied, no conflicting production-surface owner.
- **WAIT:** eligible later but another owner controls an upstream integration surface.
- **BLOCKED:** external/upstream dependency unsatisfied.
- **FOUNDER DECISION:** `status:waiting-founder`.

Core is the serialization point for multi-branch production integration.

## 12. Machine-readable Command Center status and Founder brief

`docs/command-center-status.json` defines the stable output shape: production/main SHA, active work, research candidates, QA queue, Core queue, blocked work, Founder decisions, and live-test queue.

Stage 3 should generate this file deterministically from GitHub issue/PR metadata and exact heads. The Founder brief should be a rendered view of the same data, not a separately maintained document. No LLM is required for the basic brief; deterministic metadata is preferable.

Recommended brief:

- PRODUCTION — health and main SHA.
- ACTIVE — highest-priority owner work.
- QA — ready/failing items.
- CORE — integration-ready items.
- BLOCKED — dependency and owner.
- NEEDS CODY — only Founder gates.
- LIVE TEST — items requiring real-product verification.

## 13. Agent inbox architecture

Permanent protocols should query GitHub rather than wait for copied prompts:

- QA: `status:ready-for-qa`.
- Core: `status:ready-for-core` + `integration-required`.
- Projection: `owner:projection` + active/remediation.
- Rookie: `owner:rookie` + active/remediation.
- Dynasty: `owner:dynasty` + active/remediation.
- IDP: `owner:idp` + active/remediation.
- Opportunity: `owner:opportunity` + active/remediation/blocked.
- UI: `owner:ui` + active/remediation.
- Product: `owner:product` + active.

Agents work the highest-priority eligible item, preserve unrelated branches, and record durable checkpoints on GitHub.

## 14. Safe automation

`.github/workflows/development-orchestrator-v01.yml` is deliberately read-only. It runs deterministic state-contract tests and rejects contradictory multiple status/owner/risk labels. It does not use `pull_request_target`, privileged tokens, label writes, merges, deployment, or secrets.

Safe later automation after rollout evidence:

- canonical label transitions from validated structured verdicts;
- stale-QA detection when PR head changes;
- dependency checks;
- queue/status JSON generation;
- Founder brief generation;
- PR template/metadata validation.

Never automate production merge/deploy without the required authorization, purchases/licensing, model promotion, legal/privacy/business decisions, or privileged execution of untrusted PR code.

## 15. Current work migration test

This is a mapping only; v0.1 does not mutate active PRs.

| Current work | Proposed owner | Risk | Proposed state | Dependency / note |
| --- | --- | --- | --- | --- |
| IDP activation hotfix / PR #24 | core | medium | live-test | merged to main at `838f000...`; verify real iPhone/Safari lifecycle |
| Mobile disclosure UI / PR #25 | ui | low | ready-for-qa | exact head `40a0e425...` |
| Rookie Projection remediation / PR #18 | rookie | high | ready-for-qa | exact remediated head `d7ddbb0...`; experimental review only if PASS |
| Young-Player Projection / PR #26 | projection | high | closed | no point model passed; next work depends on point-in-time role data |
| IDP Dynasty research / PR #27 | idp | high | active | numeric dynasty value remains disabled; historical role/experience blockers |
| Current Opportunity / PR #19 | opportunity | high | blocked | historical model selection awaits defensible point-in-time depth data/licensing |
| Prospective Opportunity Archive / PR #28 | opportunity | medium | active | first real 2026 capture must prove archive contract before QA |
| Experimental current-season IDP research / PR #22 | idp | high | closed/consumed | exact candidate was selectively integrated through the approved release path; research PR should not become a second integration path |

The repository also contains older open research/integration PRs whose useful content has been superseded or selectively integrated. Stage 1 migration should classify them explicitly rather than letting old open PRs masquerade as active queue items.

## 16. Permanent protocol additions

### Founder / Command Center
Inspect generated status first. Create/clarify work items and Founder decisions; do not relay routine QA/Core messages. Founder approves gated releases/model promotions/licensing/business decisions.

### Core
Inspect `status:ready-for-core`. Reject stale QA or blocked dependencies. Integrate only exact approved scope onto a fresh branch, run combined CI, and stop at Founder gates.

### QA
Inspect `status:ready-for-qa`. Test exact head at risk-appropriate depth. Record one exact verdict on the PR. Do not merge. Failed work routes to original owner.

### Projection Research
Inspect owner inbox. Work isolated research/remediation. Preserve chronology and production firewalls. Mark exact candidate `ready-for-qa` only when evidence meets its contract; otherwise close/checkpoint as more research required.

### Dynasty Research
Same inbox behavior; numeric production promotion requires explicit Founder gate and QA. Research outputs never silently become production values.

### IDP Research
Same inbox behavior; preserve current eligibility/hybrid/scoring firewalls and explicit dynasty-value availability state.

### UI
Inspect owner inbox. Do not alter football math. Mark exact presentation candidate ready for QA with cache/mobile validation and production-impact statement.

### Product
Inspect owner inbox. Maintain commercialization/product decisions as recommendations; create Founder decision work items when a business gate is reached rather than changing production autonomously.

## 17. Rollout

**Stage 1 — labels + templates.** Add canonical taxonomy and begin using it only on new/actively touched work. Reversible by removing labels/templates.

**Stage 2 — QA/Core inboxes.** Permanent QA/Core chats read their queues directly. Keep label mutation human/agent-driven and auditable.

**Stage 3 — Founder brief.** Deterministically generate `docs/command-center-status.json` and a brief from GitHub state. Compare against manual Command Center summaries before relying on it.

**Stage 4 — safe transitions.** Automate only mechanically provable transitions and stale-SHA/dependency checks. Every write is auditable and reversible.

**Stage 5 — autonomous routing.** Permanent role agents pull highest-priority eligible work. Founder remains the gate for consequential decisions and release classes.

## 18. Expected coordination reduction

Once Stage 2 is in daily use, the repeated owner-finished -> Founder -> QA prompt -> Founder -> Core prompt loop should largely disappear. A reasonable target is roughly 60–80% fewer manual coordination messages for ordinary research/QA/remediation/integration work. The remaining Founder interactions should concentrate on product direction, exceptions, real-browser acceptance, and explicit gates.

## 19. v0.1 boundaries

v0.1 intentionally stops short of automatic label writes and status generation because the repository currently has mixed legacy labels and prose-only handoffs. First prove the canonical contract on this infrastructure PR, then migrate active work deliberately. This keeps rollout reversible and prevents an automation layer from misclassifying live engineering work.
