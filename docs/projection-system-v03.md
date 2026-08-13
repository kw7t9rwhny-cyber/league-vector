# League Vector Projection System v0.3

Projection System v0.3 generates the first frontend-ready **experimental** 2026 veteran projections. It does not alter production dynasty values.

## Historical evaluation

- Historical source window: 2015–2025 nflverse weekly player statistics.
- Forward evaluation folds: 2020–2025.
- Validated observations: 191,089.
- Player-seasons: 16,035.
- Historical candidate predictions: 249,586.
- Complete reference-fantasy backtests: 7,206 player-seasons.
- Leakage rule: target season Y can use only seasons before Y.

The model selector retained the transparent weighted 60/30/10 baseline for 39 position/stat targets, selected age-aware ridge for 22, selected ridge without age for 4, and selected rare-event shrinkage for 1. Every selection remains experimental.

## Age ablation and ridge tuning

Ridge regularization is selected from a temporal grid using only information before the target season. Age-aware and age-free ridge candidates are evaluated separately. Across the 66 evaluated position/stat targets, the age-aware candidate had lower historical MAE for 46 and the age-free candidate for 20. This does not imply that age is causal; it is an out-of-sample predictive comparison.

## Complete stat lines

The v0.3 completeness contract includes rushing components for WR and TE rather than treating absent fantasy components as automatically complete. For nflverse player-stat counting fields used by this pipeline, source blanks that represent no recorded counting event are normalized to known zero in the v0.3 benchmark adapter; advanced rate/efficiency fields are not blanket-filled this way.

Reference whole-player fantasy backtest MAE:

| Position | N | MAE |
| --- | ---: | ---: |
| QB | 410 | 61.04 |
| RB | 782 | 44.93 |
| WR | 1,128 | 40.03 |
| TE | 624 | 28.17 |
| DL | 1,472 | 22.40 |
| LB | 1,378 | 31.52 |
| DB | 1,412 | 27.09 |

These reference scores use League Vector's documented benchmark scoring profiles, not a claim of accuracy for every Sleeper league.

## 2026 experimental readiness

Among current active Sleeper players in supported position groups, the broad-universe audit classified:

- `projection_ready`: 3,127
- `rookie_model_required`: 696
- `insufficient_history`: 1,308
- `identity_unresolved`: 2,139
- `missing_required_inputs`: 3

Projection-ready counts by normalized position are QB 165, RB 380, WR 540, TE 289, DL 595, LB 540, and DB 618.

The generated projection records include stable identifiers, current Sleeper metadata, projected football statistics, selected model per statistic, historical seasons used, empirical stat-level uncertainty, heuristic confidence, missing-input warnings, and an explicit experimental/production gate.

## Important limitations

- Rookies are not forced through veteran models; they remain `rookie_model_required`.
- Current-player identity remains incomplete across the broad Sleeper universe. Unresolved identities are not guessed.
- Tree-based models were investigated architecturally but not added in this phase because doing so would add complexity/dependencies before the tuned ridge/age/shrinkage system demonstrated a need for them. A later challenger must beat the currently selected model for each target, not merely an older baseline.
- Full player-level probabilistic intervals are not claimed. v0.3 exposes empirical stat-level residual bands and labels confidence as heuristic.
- League-specific Sleeper scoring must report unsupported scoring keys rather than treating them as zero.
- SportsDataIO trial data remains excluded from training, evaluation truth, and 2026 production projections.

## Production gate

All generated 2026 projections remain:

- `experimental: true`
- `production_projection_eligible: false`
- `dynasty_value_eligible: false`

The next phase is frontend integration behind an explicit experimental presentation. No production dynasty value should change until a later owner-approved promotion step.
