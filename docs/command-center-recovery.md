# League Vector — New Command Center Recovery Procedure

Use this procedure when the Founder / Command Center conversation is unavailable or a new Lead agent begins with zero prior context.

Read `docs/league-vector-operating-charter.md` first. That document defines permanent authority and safety rules. This procedure reconstructs live state.

## Recovery sequence

1. Confirm repository `kw7t9rwhny-cyber/league-vector` and default branch.
2. Read the Operating Charter and `docs/development-orchestrator-v01.md` from current `main`.
3. Inspect current `main` HEAD and recent commits/merged PRs. Establish what is actually production/integrated rather than inferring from old branches.
4. Inspect **all open PRs**, including drafts. Read each relevant PR body, latest comments/reviews, head SHA, base, mergeability, and workflow/check state.
5. For every candidate, record the current exact head SHA.
6. Find the latest canonical QA verdicts. A verdict is meaningful only when it uses the canonical PASS/FAIL form and is bound to an exact tested SHA.
7. Compare each `qa_tested_sha` with the current candidate head. Head movement after PASS makes approval stale.
8. Identify the QA queue: clearly designated current-head candidates awaiting independent QA.
9. Identify remediation: current-head QA FAILs and their original owners/blockers.
10. Identify Core-eligible work: separate non-research integration/promotion items with fresh exact-head QA, satisfied dependencies, valid integration/promotion metadata, and any required Founder approval.
11. Identify Founder-gated work and summarize each decision as evidence + options, not raw logs.
12. Identify research-only work. Never treat raw research as Core-eligible merely because results are promising or QA passed.
13. Inspect the Development Orchestrator state. Use only stages already merged/authorized on `main`; do not assume an open Orchestrator PR is operational.
14. Inspect prospective archive state/workflows where relevant. Distinguish immutable evidence capture from model authorization.
15. Reconstruct role queues: Lead, Core, QA, Projection, Rookie, Dynasty, IDP, IDP Dynasty, Opportunity, UI, Product, Dev Orchestrator.
16. Produce a Founder status report covering: production/main; active work; QA queue; remediation; Core queue; blocked work; Founder decisions; research checkpoints; live-test/release verification; and the highest-value next actions.

## Fail-closed recovery rules

- GitHub is authoritative; chat memory is not.
- Never trust a stale static status document over live GitHub.
- Do not assume an open PR is active; inspect its latest state/evidence.
- Do not assume a merged-looking branch is production; verify `main` ancestry/merge history.
- Do not treat CI success as QA PASS.
- Do not transfer QA PASS across SHAs.
- Do not infer Founder approval from prior technical work.
- Do not promote raw research.
- If metadata is contradictory or incomplete at a gated boundary, classify it as blocked/needs reconstruction rather than guessing.

## Founder recovery report format

Keep the first recovery report concise and decision-oriented:

**PRODUCTION** — current main SHA and health evidence.

**RUNNING NOW** — meaningful active work by owner.

**QA** — candidates ready for QA and failed candidates needing remediation.

**CORE** — integration candidates that are actually eligible.

**BLOCKED** — external/upstream dependencies and what would unblock them.

**NEEDS FOUNDER** — only explicit decisions, with APPROVE / REJECT / REQUEST CHANGES where appropriate.

**RESEARCH** — material validated findings and research-only blockers, clearly separated from production authorization.

**NEXT** — the highest-priority safe actions that can proceed without Founder intervention.

If an operational Development Orchestrator queue/Founder brief exists, use it as an index and independently verify boundary-sensitive decisions against the exact GitHub evidence.
