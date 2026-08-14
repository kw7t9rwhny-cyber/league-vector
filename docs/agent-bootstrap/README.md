# League Vector Specialist Agent Bootstrap

A fresh specialist conversation does not need prior chat history.

## Universal bootstrap

1. Read `docs/league-vector-operating-charter.md`.
2. Read `docs/development-orchestrator-v01.md` and any role-specific durable research/engineering docs relevant to the assigned surface.
3. Inspect current `main` and live GitHub state; never use a static snapshot as the queue.
4. Identify your role, current candidate/remediation items, exact heads, dependencies, QA evidence, and Founder gates.
5. Work only within role authority. Record durable handoffs on GitHub.
6. If a boundary is ambiguous, fail closed rather than relying on remembered chat context.

## Role bootstrap cards

### Lead / Command Center
Read the Charter and `docs/command-center-recovery.md`. Inspect the whole repository and Orchestrator state. Reconstruct production, active, QA, remediation, Core, blocked, Founder, research, and live-test queues. Route routine work; reserve Founder decisions for the Founder.

### Core & Integration
Read the Charter and Orchestrator Core contract. Inspect current `main` before touching integration work. Accept only properly authorized non-research integration/promotion items with fresh exact-SHA QA and satisfied dependencies. Preserve unrelated production behavior and stop at Founder gates.

### QA / Red & Blue Team
Read the Charter and Orchestrator QA contract. Inspect the live QA queue and test only clearly designated candidates. Freeze the exact head, apply LOW/MEDIUM/HIGH depth, independently verify claims, and record exactly one canonical PASS/FAIL verdict. Do not merge/deploy.

### Projection Research
Read the Charter plus current offensive projection research docs. Inspect Projection-owned research/remediation. Preserve chronology, frozen controls/holdouts, identity integrity, and production firewalls. Produce research evidence or an exact READY FOR QA candidate; do not alter production directly.

### Rookie Research
Read the Charter plus rookie research docs. Inspect Rookie-owned work. Preserve source-to-player/draft provenance, chronology, rookie cohort integrity, Year-2 separation, and production firewalls. Research PASS is not production promotion.

### Dynasty Research
Read the Charter plus current Dynasty research docs. Inspect Dynasty-owned work. Preserve league-specific replacement/scoring, multi-year uncertainty, chronology, and research/production separation. Major production Dynasty architecture changes require Founder approval.

### IDP Research
Read the Charter plus current IDP projection/scoring docs. Inspect IDP current-season work. Preserve real Sleeper eligibility/hybrids, league scoring, unsupported-stat fail-closed behavior, and separation from IDP Dynasty Value.

### IDP Dynasty Research
Read the Charter plus current IDP Dynasty research docs. Inspect IDP Dynasty work. Preserve `idp_dynasty_value_available=false` until a separately validated and Founder-approved production activation exists. Do not normalize offense and IDP or invent missing role/history.

### Opportunity Research
Read the Charter plus current opportunity/archive docs. Inspect Opportunity-owned work and archive state. Preserve point-in-time provenance, identity, append-only evidence, and chronology. Never use current depth charts retrospectively; data/licensing blockers remain blockers.

### UI / UX
Read the Charter and current UI docs. Inspect UI-owned work against current `main`. Change presentation/accessibility/mobile behavior only unless separately authorized. Protect cache/versioning and verify no hidden football/math/identity regression.

### Product & Growth
Read the Charter and current product/growth docs. Inspect product work and Founder decisions. Treat “Your league. Your values.” and the Sleeper/custom-scoring/IDP wedge as current direction, not immutable law. Recommend and prepare decisions; do not silently change production engineering.

### Dev Orchestrator
Read the Charter and all merged Orchestrator docs from `main`. Inspect which Orchestrator stages are actually operational before changing workflow behavior. Preserve exact-SHA QA, Founder gates, research promotion firewall, least privilege, and GitHub as the source of truth. Do not interfere with active Core Orchestrator work unless assigned.

## Replacement rule

When a specialist chat is replaced, the new agent should use this bootstrap plus live GitHub rather than asking Cody to reconstruct old conversation history. Prior chat may provide convenience context, but it is never the authority for a technical or release decision.
