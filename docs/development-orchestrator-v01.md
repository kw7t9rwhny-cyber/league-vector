# League Vector Development Orchestrator v0.1

## Purpose and safety boundary

League Vector already uses GitHub as its technical source of truth. v0.1 formalizes that into a persistent work queue so Founder / Command Center does not need to relay routine owner -> QA -> remediation -> Core messages.

This is internal development infrastructure only. It changes no football projections, Dynasty Value math, IDP math, scoring, player identity, production UI, active research branch, model promotion, merge policy, deployment policy, purchase/licensing authority, or legal/business authority.

The v0.1 GitHub Action is read-only. It does not use `pull_request_target`, does not mutate labels, does not merge, does not deploy, and does not run privileged untrusted PR code.

## 1. Workflow diagnosis

Existing conventions are worth preserving: isolated role-owned branches, PR comments as durable handoffs, exact-SHA QA verdicts, and concise statuses such as `READY FOR QA`, `QA PASS`, `QA FAIL`, `WAITING ON FOUNDER`, `LIVE TEST READY`, and `MORE RESEARCH REQUIRED`.

The recurring problem is routing. Founder has been acting as a message bus between specialized agents. v0.1 moves routing into deterministic GitHub metadata while retaining Founder control for consequential decisions.

## 2. Canonical state machine

States:

- `active` — owner is researching, implementing, or remediating.
- `blocked` — an upstream/external dependency prevents progress.
- `ready-for-qa` — exact candidate head is frozen for independent QA.
- `qa-failed` — QA verdict is preserved and work returns to the original owner.
- `qa-passed` — exact current head has explicit PASS evidence.
- `ready-for-core` — integration candidate that satisfies every Core gate.
- `waiting-founder` — intentionally stopped for a Founder decision.
- `live-test` — release/deployment path has reached real-product verification.
- `closed` — completed, superseded, or research cycle ended without a promotable candidate.

Common paths:

`active -> ready-for-qa -> qa-passed -> ready-for-core`

`active -> ready-for-qa -> qa-failed -> active -> ready-for-qa`

Founder-gated work may move into `waiting-founder`, but it cannot cross a gated boundary into `ready-for-core` or `live-test` without `founder_decision=approved`.

Research that produces no candidate may close with a durable `MORE RESEARCH REQUIRED` result.

## 3. Exact-SHA QA contract

QA approval is not a general property of a PR. It belongs to one exact tested head.

For `qa-passed`, `ready-for-core`, and `live-test`, the work item must have all of:

- `qa_verdict=pass`;
- a non-empty `qa_tested_sha`;
- a non-empty current `head_sha`;
- `qa_tested_sha === head_sha`.

A new commit invalidates prior QA automatically. Missing evidence and stale SHA both fail closed. This applies after a transition as well: changing the head after an item was already labeled `ready-for-core` makes that item invalid until the new head is reviewed.

Dependencies that rely on QA approval are also rejected when their exact-SHA evidence becomes stale.

## 4. Founder gate contract

Use `founder_decision_required=true` with a reason such as `release`, `data-license`, `production-model-promotion`, or `business-decision`.

The rule is single and consistent across transition checks, item validation, and Core eligibility:

- pending/unset Founder decision: may wait at `waiting-founder`, may not enter `ready-for-core` or `live-test`;
- `approved`: may progress if every other gate passes;
- `rejected`: progression is blocked;
- request-changes: return to an active/remediation path rather than crossing the gate.

Founder approval remains mandatory for production Dynasty Value architecture changes, first production activation of major numerical models, public launch, pricing, paid data licensing, material infrastructure spending, legal/privacy decisions, partnerships, and any release explicitly marked Founder-gated.

## 5. Research promotion firewall

Raw `type:research` work is never Core-eligible, even if `integration_required=true` is accidentally set and QA PASS is fresh.

The promotion boundary is deliberately explicit:

`research -> validated research candidate -> separate non-research integration/promotion work item -> Core`

The separate promotion work item must depend on the validated research PR/artifact. If promotion would activate a production numerical model, that integration/promotion work item must also carry the Founder `production-model-promotion` gate.

This prevents a metadata mistake from silently turning research evidence into production integration authority.

## 6. Label taxonomy

Stage 1 canonical labels are intentionally small.

Type: `type:bug`, `type:feature`, `type:research`, `type:ui`, `type:infrastructure`.

Owner: `owner:core`, `owner:projection`, `owner:rookie`, `owner:dynasty`, `owner:idp`, `owner:opportunity`, `owner:ui`, `owner:qa`, `owner:product`.

Risk: `risk:low`, `risk:medium`, `risk:high`.

Status: `status:active`, `status:blocked`, `status:ready-for-qa`, `status:qa-failed`, `status:qa-passed`, `status:ready-for-core`, `status:waiting-founder`, `status:live-test`, `status:closed`.

Routing/gates: `integration-required`, `founder-decision-required`.

Priority: `priority:urgent`, `priority:high`, `priority:normal`. These are scheduling priorities, not QA defect severities P0/P1/P2/P3.

## 7. Work-item contract

The issue/PR templates carry objective, owner, risk, status, type, priority, dependencies, exact current head/artifact, production impact, validation requirement, QA verdict/tested SHA when applicable, Founder gate/decision, integration requirement, and completion criteria.

The PR remains the durable technical thread. QA failures stay on the same PR and route remediation to the original owner unless a clean replacement branch is technically necessary.

## 8. QA inbox

Permanent QA protocol:

1. Query open work carrying `status:ready-for-qa`.
2. Verify one owner and one risk.
3. Freeze/read the exact candidate head before testing.
4. Apply risk depth: LOW presentation/copy/test/cache; MEDIUM architecture/data plumbing; HIGH valuation/model/identity/scoring exhaustive reconstruction.
5. Record exactly `QA PASS — tested head <SHA>` or `QA FAIL — tested head <SHA>`.
6. PASS records explicit PASS evidence bound to that exact SHA. FAIL preserves the report and returns work to the owner.
7. Never merge merely because QA passed.

LOW-risk narrow remediation may use delta QA. HIGH-risk model changes remain exhaustive unless the only change is clearly metadata-only and QA explicitly narrows scope.

## 9. Core inbox

Core works only `status:ready-for-core` items that are:

- `integration_required=true`;
- non-research integration/promotion work items;
- backed by fresh exact-head QA PASS evidence;
- free of unsatisfied/stale dependencies;
- through any required Founder gate with `founder_decision=approved`.

Core may assemble an integration/release branch, run combined CI, and prepare a release candidate. Core may not infer promotion authority from research, silently promote a model, or deploy a Founder-gated release without approval.

## 10. Dependencies

A dependency names an issue/PR/work-item and required state. Missing, insufficiently advanced, or stale-QA dependencies block downstream eligibility.

External dependencies such as Sportradar historical data/licensing remain `blocked` until their actual semantic and rights gates are satisfied. A technically parseable sample does not automatically satisfy licensing or modeling eligibility.

## 11. Concurrency

Research branches are parallel by default because they do not alter production surfaces. Agents must not unknowingly own the same production surface concurrently.

- `RUN NOW`: owner matches, item is active/remediation, dependencies satisfied, no conflicting production-surface owner.
- `WAIT`: upstream integration owner currently controls the shared surface.
- `BLOCKED`: external/upstream dependency unsatisfied.
- `FOUNDER DECISION`: waiting on explicit Founder choice.

Core remains the serialization point for multi-branch production integration.

## 12. Command Center state and Founder brief

`docs/command-center-status.json` is a **non-operational schema example in v0.1**, not a manually maintained current-status file. It deliberately has `operational=false`, no trusted current main SHA, and no live queue data.

Before Stage 3 operational reliance, GitHub state must be generated deterministically from live PR/issue metadata, exact heads, verdict evidence, dependencies, and Founder gates. The generated representation should include `generated_at` and refuse to present itself as current when generation fails.

The Founder brief should be a deterministic view of the same generated state: production/main, active work, QA queue, Core queue, blocked work, Founder decisions, and live-test queue. No LLM is required for the basic brief.

## 13. Agent inboxes

- QA: `status:ready-for-qa`.
- Core: `status:ready-for-core` + `integration-required`.
- Projection: `owner:projection` + active/remediation.
- Rookie: `owner:rookie` + active/remediation.
- Dynasty: `owner:dynasty` + active/remediation.
- IDP: `owner:idp` + active/remediation.
- Opportunity: `owner:opportunity` + active/remediation/blocked.
- UI: `owner:ui` + active/remediation.
- Product: `owner:product` + active.

Agents pull the highest-priority eligible item and write durable checkpoints back to GitHub.

## 14. Automation and security

`.github/workflows/development-orchestrator-v01.yml` remains read-only with `contents: read`, `pull-requests: read`, and `issues: read`.

v0.1 validates the deterministic contract and contradictory status/owner/risk metadata only. It does not mutate labels.

Safe later candidates include stale-QA detection, dependency validation, deterministic queue generation, Founder brief generation, template validation, and mechanically provable label transitions. Those later writes must remain auditable and reversible.

Never automate production merge/deploy without the required authorization, purchases/licensing, model promotion, legal/privacy/business decisions, or privileged execution of untrusted PR code.

## 15. Current-work snapshot used only for design validation

The table below is a dated observation used to validate the proposed model. It is **not an operational queue** and must not be treated as current after this document is committed. Live GitHub metadata supersedes it immediately.

Observed on 2026-08-14 during PR #29 remediation:

| Work | Proposed owner | Risk | Snapshot state | Note |
| --- | --- | --- | --- | --- |
| IDP activation hotfix / PR #24 | core | medium | live-test | merged production hotfix; real-browser lifecycle verification remains the product acceptance surface |
| Mobile disclosure UI / PR #25 | ui | low | qa-failed | exact tested head `40a0e425...` failed integration safety because it predates PR #24; requires current-main rebase |
| Rookie Projection research / PR #18 | rookie | high | qa-passed research | QA PASS at `d7ddbb0...`; experimental review only, raw research is not Core-eligible |
| Young-Player Projection / PR #26 | projection | high | closed | no point model passed; next useful work depends on point-in-time role information |
| IDP Dynasty research / PR #27 | idp | high | active | numeric production IDP Dynasty Value remains disabled |
| Current Opportunity / PR #19 | opportunity | high | blocked | historical model selection awaits defensible historical point-in-time depth data/licensing |
| Prospective Opportunity Archive / PR #28 | opportunity | medium | qa-passed infrastructure research | QA PASS at `e71f5e1...`; requires a separate integration work item; regular-season cadence P2 remains before September operation |
| Experimental current-season IDP research / PR #22 | idp | high | closed/consumed | approved research content was selectively integrated through a separate release path; research PR is not a second integration route |

This snapshot intentionally demonstrates why Stage 3 must generate status from GitHub rather than keeping a hand-edited “current” document.

## 16. Permanent role protocol additions

Founder / Command Center: inspect generated status first; set product direction and make Founder decisions; do not relay routine QA/Core reports.

Core: inspect the Core inbox; reject stale QA, raw research, blocked dependencies, and unapproved Founder gates; integrate only exact approved scope.

QA: inspect the QA inbox; test exact head at risk-appropriate depth; record one exact verdict; do not merge.

Projection/Rookie/Dynasty/IDP Research: work isolated research/remediation; preserve chronology and production firewalls; mark exact candidate ready for QA only when evidence meets its contract. Research PASS alone is not production promotion.

UI: do not alter football math; provide cache/mobile regression evidence and exact production-impact statement.

Product: make recommendations and create concise Founder decision work items when a business gate is reached; do not change production autonomously.

## 17. Rollout

Stage 1 — canonical labels/templates on new or actively touched work only.

Stage 2 — QA/Core inboxes read directly from GitHub while label writes remain human/agent-driven and auditable.

Stage 3 — deterministic generated Command Center status and Founder brief; compare against manual summaries before reliance.

Stage 4 — safe, mechanically provable transitions plus stale-SHA/dependency checks.

Stage 5 — more autonomous role routing after the contract has operating history.

Each stage remains reversible.

## 18. Expected coordination reduction

Once Stage 2 is used consistently, the repeated owner-finished -> Founder -> QA -> Founder -> Core loop should largely disappear. A reasonable target remains roughly 60–80% fewer manual coordination messages for ordinary research/QA/remediation/integration work, while Founder interactions concentrate on product direction, exceptions, real-browser acceptance, model promotion, licensing, and release/business gates.
