# Rookie → Year-2 Development Bridge v0.1

Status: **MORE ROOKIE→YEAR-2 RESEARCH REQUIRED**

This is an isolated HIGH-risk research track. It does not modify production projections, validated Projection v0.4, Dynasty Value, UI, Core, or `main`.

## Parent / provenance

Research parent: QA-passed Rookie Projection v0.1 head `d7ddbb0cefa27feb687eedc9158af2235f286c8b`.

Frozen input snapshot: `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`.

Validated v0.4 comparator file SHA-256: `9e329e7901ecb8e925d5f5aae695dadc30195b33e67f3943177dc13087b45ab0`.

The Year-2 harness preserves the QA-passed rookie provenance discipline: source identities are audited before cohort filtering; unresolved draft metadata is not assumed to mean UDFA; only internally consistent confirmed drafted rookie rows enter this v0.1 bridge evidence.

## Chronology

Direct v0.4 player-season comparator evidence begins in 2020. Therefore the development head-to-head uses Year-2 target seasons **2020–2024 only**. Earlier paired rookie→Year-2 histories may train a fold, but each test year trains only on earlier Year-2 target seasons.

**2025 remains `retrospective_observed` only.** It cannot select feature families, thresholds, architecture, or hyperparameters.

## Features evaluated

Chronology-safe Year-1 information:

- draft pick / draft capital
- rookie total fantasy production
- per-game fantasy production
- attempts / carries / targets through opportunity totals
- opportunity per game
- fantasy points per opportunity as a simple efficiency proxy
- games and missed-games count
- late-season opportunity growth (last four rookie weeks versus earlier rookie weeks)
- rookie fantasy percentile within position/class
- age as a regularized feature only
- position-specific models
- chronology-safe rookie expected-production residual diagnostics

No generic youth or age multiplier exists.

### Team change

Team-change is **not selectable in v0.1**. The frozen weekly stats can reveal the team a player ultimately represented in Year 2, but do not prove that a transaction/team state was known at the required preseason cutoff. Using eventual Year-2 team would risk leakage. A point-in-time roster/transaction source is required before team-change can be tested safely.

## Head-to-head against validated v0.4

Best development family by position after evaluating simple regularized Year-1 feature sets:

| Pos | Direct-comparison N | Best bridge family | Fold wins | Mean MAE gain vs v0.4 | Worst fold |
|---|---:|---|---:|---:|---:|
| QB | 32 | production + draft | 2/5 | -14.23% | -61.74% |
| RB | 78 | full Year-1 | 2/5 | -5.40% | -17.23% |
| WR | 125 | production + draft | 1/5 | -15.48% | -32.39% |
| TE | 58 | production + draft | 4/5 | +4.82% | -20.66% |

The candidate gate requires at least 50 direct-comparison rows, at least +5% mean MAE improvement, a majority of fold wins, and **no losing fold**. No position passes.

TE is the only position with a modest average improvement, but the result is not material or stable enough: one fold loses by about 20.7%. QB is too small and unstable. RB and WR are clearly worse than validated v0.4 in this Year-1-only formulation.

## 2025 retrospective observation

After selecting each position's best family using pre-2025 development evidence only, the 2025 retrospective cohort is evaluated once. It does not rescue the bridge: the selected bridge family has worse MAE than validated v0.4 at QB, RB, WR, and TE in this frozen retrospective sample.

This strengthens the decision **not** to promote a Year-2 bridge from current evidence.

## Role expansion versus production conditional on role

The harness separates a role-expansion diagnostic from production conditional on role.

Research-only role expansion definition: Year-2 opportunity/game >= 1.25 × rookie opportunity/game. The threshold is a diagnostic label, never a point multiplier.

Chronological role-expansion classification has mean AUC approximately:

- QB: .896 (very small samples)
- RB: .638
- WR: .747
- TE: .655

This suggests rookie information contains some signal about *who may expand*, especially WR and possibly QB, but the signal is not strong/stable enough across positions to replace current role information. Conditional-production regressions are recorded separately and are not used as an oracle in the deployable point comparison.

## Rookie over/underperformance residual

The harness computes a chronology-safe rookie expected-production residual using only earlier rookie classes for each class. It records whether beating/missing that rookie expectation correlates with Year-2 error versus v0.4. This remains diagnostic; no residual correction is promoted because residual-correction experiments were unstable and did not produce reliable fold improvement.

## Current-opportunity limitation

The strongest limitation is role state. Year-1 box-score evidence can identify players who *look like* expansion candidates, but it cannot prove that a player entered Year 2 as a starter, backup, committee member, injured reserve/PUP player, or displaced incumbent.

Point-in-time preseason depth charts / roster / transaction evidence would directly answer the missing causal question:

`rookie evidence + known preseason Year-2 role -> role expansion probability -> production conditional on role`

rather than asking Year-1 statistics to infer the entire future depth chart.

This does **not** justify using current depth charts retrospectively. It is a documented data limitation for the separate Current Opportunity research track.

## Determinism / regression firewall

The workflow restores the immutable validated control artifact, verifies both the composite frozen input SHA and exact v0.4 comparator SHA, runs the Year-2 harness twice, requires byte-identical JSON, and enforces that 2025 is outside selection.

Validated v0.4 is consumed read-only. No established-player projection is rewritten. `production_projection_eligible=false` and `dynasty_value_eligible=false` remain mandatory.

## Decision

**MORE ROOKIE→YEAR-2 RESEARCH REQUIRED**

Current Year-1-only evidence does not materially and stably improve validated v0.4 for second-year QB/RB/WR/TE. Do not create a generic youth multiplier and do not promote a bridge to production.

Highest-value next research step: combine the QA-passed rookie evidence with true point-in-time Year-2 opportunity/role state when a provenance-safe historical depth-chart/roster source becomes available, while continuing to reserve 2025 from model selection.
