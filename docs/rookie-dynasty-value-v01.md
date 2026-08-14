# Rookie Dynasty Value / Draft Capital / Opportunity v0.1

## Status

RESEARCH ONLY. No production promotion is authorized.

This cycle is isolated from production Dynasty Value, validated Rookie Projection v0.1, validated Projection v0.4, Core integration, and production UI. The research parent is the independently QA-passed Rookie Projection v0.1 head `d7ddbb0cefa27feb687eedc9158af2235f286c8b`; its coefficients are not changed here.

## Primary question

How much future dynasty signal comes from NFL draft capital, observed NFL production, observed NFL opportunity, age, position, and eventually point-in-time preseason/depth-chart opportunity — and how quickly should NFL evidence replace draft capital as the prior?

## Evidence boundary

The canonical historical source remains frozen snapshot SHA-256 `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`.

Model-selection evidence may use only outcomes through 2024. Season 2025 is `retrospective_observed` and is emitted separately as observation-only evidence. No 2026 outcomes exist.

Draft provenance inherits Rookie v0.1 fail-closed rules:

- audit source-to-player identity before rookie filtering;
- duplicate identities fail closed;
- `draft_year`, `draft_round`, and `draft_pick` must all be internally valid;
- draft year must equal rookie season for ordinary drafted rookies;
- missing draft metadata is not UDFA;
- confirmed UDFA requires independent evidence, which the frozen player file does not provide;
- unresolved, partial, inconsistent, or supplemental-draft states are excluded from ordinary draft-capital model evidence.

## What v0.1 measures

### Draft-capital decay

For QB/RB/WR/TE, the deterministic report measures the relationship between draft capital and Year 0 through Year 4 fantasy production. It compares raw pick, `log(1+pick)`, inverse pick, round, and top-tier identification AUC. The purpose is evidence about decay, not a permanent boost.

### Production versus draft capital

The report forms descriptive high/low matrices using Day 1/2 versus Day 3 investment and within-rookie-class production bands, then measures Year+1 through Year+3 production, top-tier rates, multi-year production, and persistence. These are descriptive cohorts, not hardcoded valuation thresholds.

### Opportunity versus draft capital

Historical weekly data supports real observed opportunity after NFL games begin. The harness therefore tests:

- draft only;
- opportunity only;
- production only;
- draft + opportunity;
- draft + opportunity + production.

Observed opportunity includes games with recorded regular-season usage, attempts, carries, targets, receptions, touches, total opportunities, and per-game versions. Production adds fantasy points to date and simple efficiency/TD evidence.

This is intentionally different from historical preseason depth-chart evidence.

### Early NFL updating

The same families are compared at Week 1, Week 4, Week 8, and end of rookie season using expanding chronological folds. Targets include Year+1, Year+2, and Year+3 fantasy production. Metrics include MAE, RMSE, Spearman, pairwise ranking accuracy, top-N precision/recall, false-breakout rate, and missed-breakout rate.

The design asks whether draft-only performance loses relative value as observed NFL evidence accumulates. No fixed decay schedule is imposed in advance.

### Position-specific persistence

QB/RB/WR/TE are evaluated separately for rookie-production persistence, draft-capital persistence, future top-tier rate, and active-season persistence.

## Historical depth-chart firewall

Historical preseason starter/backup/depth/competition/injury tests are **BLOCKED** with the current frozen source because it does not contain verified original point-in-time preseason depth charts.

Blocked historical tests include:

- Round-1 player listed backup;
- Round-3 player listed starter;
- Day-3 RB behind weak competition;
- Day-2 RB behind elite incumbent;
- Round-1 WR buried behind veterans;
- late-round WR earning first-team preseason role;
- high-capital TE with low preseason role;
- lower-capital TE earning meaningful first-team role;
- competitor injury/release/trade known at the historical preseason cutoff;
- ordered competition ahead on the historical depth chart.

Current depth charts must never be inserted retrospectively.

## Prospective 2026 opportunity framework

The existing League Vector Prospective Opportunity Archive may support a separate **PROSPECTIVE / UNVALIDATED** layer for 2026 rookies. Allowed point-in-time fields include:

- archived depth position and order;
- starter/backup designation;
- snapshot-to-snapshot promotion or demotion;
- competitor injury/reserve status when captured at the time;
- veteran release/trade when captured at the time;
- chronology-safe prior-season vacated carries/targets;
- current competition structure;
- snapshot timestamp and source provenance.

No historical predictive claim may be attached to that layer yet. It should be stored as immutable snapshots so future seasons can validate whether preseason role conflicts add signal beyond draft capital.

## Proposed Rookie Dynasty Value architecture

The architecture remains conceptual rather than a frozen formula:

`Prospect Prior + Expected NFL Opportunity + Expected Production + Multi-Year Persistence + Position Scarcity/Replacement + Uncertainty`

Draft capital is the Prospect Prior, not permanent value. The research must estimate by position and evidence checkpoint how much weight remains after Week 1, Week 4, Week 8, and the end of the rookie season.

Validated Rookie Projection v0.1 may later be tested as an independent production expectation input/comparator. It is not modified here and projection coefficients are not optimized against dynasty outcomes.

Position scarcity/replacement and calibrated uncertainty remain separate validation requirements before numeric rookie dynasty values can be considered.

## Future backtest once historical opportunity data exists

A Sportradar or equivalent source must first prove original point-in-time semantics, ordered depth coverage, stable identities, historical injury/reserve state, reproducibility/retention rights, and commercial derived-model rights.

The backtest should then:

1. Freeze immutable source snapshots and hashes.
2. Use a team-specific final-preseason cutoff strictly before the first regular-season kickoff.
3. Join only information known by that cutoff.
4. Re-run draft-only, opportunity-only, combined, and combined-plus-observed-production families.
5. Preserve expanding chronology and keep 2025 as `retrospective_observed`.
6. Quantify explicit draft-capital versus depth-chart conflict cohorts by position.
7. Report point and ranking metrics, especially pairwise/top-N behavior and false/missed breakouts.
8. Require deterministic exact-head reproduction before independent HIGH-risk QA.

## Promotion firewall

This research does **not** authorize numeric production Rookie Dynasty Values, changes to production Dynasty Value, Rookie Projection v0.1, Projection v0.4, production UI, Core integration, or `main`.

The deterministic evidence artifact and this document must be updated with the measured results before the cycle receives a final status.
