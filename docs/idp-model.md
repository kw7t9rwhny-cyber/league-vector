# League Vector IDP Projection Model

IDP is a first-class modeling target, not a cosmetic extension of offensive projections.

## Position families

Maintain separate conceptual models for DL/EDGE, LB and DB. Position mapping must be explicit and versioned because source classifications can differ.

## Candidate inputs

Use only legally usable data. Candidate features include tackles, assisted tackles, tackles for loss, sacks, QB hits, interceptions, passes defended, forced fumbles, fumble recoveries, defensive touchdowns, participation/snaps where licensed, team context, age and role indicators.

Pressure data, snap counts, role labels or alignment data must not be invented when unavailable.

## Modeling approach

Start with per-game and multi-year weighted baselines. Measure persistence and predictive value of each feature by position family. Add role/participation features only when they improve future-season performance in temporal backtests.

## Availability behavior

If the legal data foundation cannot support a statistic required by a league scoring rule, the model must report incomplete IDP scoring coverage. Team totals must not silently omit unavailable IDP values while presenting themselves as complete.

## Uncertainty

IDP roles can change rapidly. Projection output should eventually include calibrated or clearly labeled uncertainty and identify missing role/participation inputs.

---

# IDP Projection Research v0.1 checkpoint — 2026-08-13

Research branch: `codex/idp-projection-research-v01`, created from `main` at `51ee6fbcb692c1770c1d9b1d32223566b897296a`.

No production UI, deployment behavior, browser valuation logic, or numeric IDP dynasty value is changed by this checkpoint.

## Data and validation

The retained League Vector benchmark artifacts use nflverse weekly player statistics through the existing approved ingestion pipeline. v0.3 covers 2015-2025 with walk-forward evaluation folds 2020-2025. The frozen v0.2 diagnostic covers 2015-2024 with unseen folds 2020-2024. Target season Y uses only seasons before Y. SportsDataIO trial data is excluded.

Current licensing documentation classifies covered nflverse player-stat releases as CC BY 4.0 / approved with attribution and provenance verification. FTN participation data through nflverse may be usable subject to CC BY-SA obligations but requires legal review before redistribution. Pressures/alignment/role data are not assumed when unavailable.

## Whole-player v0.3 reference-IDP backtest

| Position | N | MAE | RMSE |
| --- | ---: | ---: | ---: |
| DL | 1,472 | 22.40 | 30.95 |
| LB | 1,378 | 31.52 | 43.53 |
| DB | 1,412 | 27.09 | 34.31 |

These are reference-scoring fantasy-point errors, not dynasty values and not a claim of accuracy for every Sleeper league.

## Frozen v0.2 Ridge diagnostic

The frozen v0.2 artifact retains per-season/per-stat/model metrics. Averaged across the 12 IDP stat targets and five unseen folds:

| Position | Baseline mean MAE | Ridge mean MAE | Baseline RMSE | Ridge RMSE | Baseline mean Spearman | Ridge mean Spearman | Ridge promoted targets |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| DL | 1.957 | 1.915 | 2.778 | 2.592 | 0.363 | 0.382 | 5/12 |
| LB | 3.124 | 3.108 | 4.632 | 4.332 | 0.410 | 0.421 | 2/12 |
| DB | 2.873 | 2.766 | 3.914 | 3.571 | 0.334 | 0.350 | 7/12 |

These MAE/RMSE values are diagnostic averages across heterogeneous counting-stat targets, not whole-player fantasy-point errors.

### Season-level Ridge MAE change vs weighted baseline

Positive means lower Ridge MAE. Values average target-level percentage changes.

| Position | 2020 | 2021 | 2022 | 2023 | 2024 |
| --- | ---: | ---: | ---: | ---: | ---: |
| DL | +3.35% | +2.78% | -4.77% | +1.22% | -1.69% |
| LB | -0.29% | -3.59% | -2.72% | -4.47% | -2.77% |
| DB | +0.87% | +2.64% | +4.34% | +3.33% | -6.33%* |

`*` DB 2024 is skewed by low-frequency targets: median target improvement is +6.42%, and Ridge beats baseline on 9/12 targets. Rare-event stats must not drive whole-position promotion by themselves.

## Current best evidence by position

DL: modest Ridge signal, but not stable enough across unseen seasons to replace the transparent baseline wholesale. v0.3 selects age-aware Ridge for 5/12 DL targets, shrinkage for one rare-event target, and weighted history for 6/12.

LB: weighted history remains the strongest default. v0.3 keeps the weighted model for 10/12 targets. Ridge improves some components, especially assisted tackles and forced fumbles, but broad LB season-level performance is unstable.

DB: strongest Ridge evidence of the three defensive groups. v0.3 selects age-aware Ridge for 6/12 DB targets, including solo tackles, assisted tackles, total tackles, passes defended and forced fumbles. This remains experimental rather than production-ready.

## Age signal

Age-aware Ridge has lower historical MAE than age-free Ridge for 10/12 DL targets, 8/12 LB targets, and 11/12 DB targets in v0.3. This supports separate DL/LB/DB age-curve research but does not justify publishing dynasty age multipliers yet.

A defensible dynasty age study must separate role-survival/opportunity loss from per-game performance decline and condition on prior production. One shared defensive decay curve should not be used.

## Scoring-key coverage

The current normalized historical projection vocabulary supports total/solo/assisted tackles, tackles for loss, sacks, QB hits, interceptions, passes defended, forced fumbles, fumble recoveries, defensive touchdowns and safeties. Current Sleeper aliases for those categories can therefore be transformed into league-specific projected fantasy points when the stat projection itself is available.

Participation/snaps are only partially available because the identified FTN/nflverse source is not yet part of the production-approved normalized feature set and has redistribution obligations. Pressures, detailed alignment and role labels are unavailable in the current approved benchmark pipeline. Unsupported active IDP keys must remain explicit and must never be converted to zero merely to improve coverage.

## Replacement level and scarcity proposal

For a real league: project defensive stats, apply the league's scoring, estimate starter demand from team count plus dedicated DL/LB/DB and IDP-flex slots, set replacement level at the league-specific rosterable/starter boundary, then compute seasonal value over replacement. Positional scarcity should emerge from demand and replacement depth rather than from an additional arbitrary position premium.

## Offense-versus-IDP normalization proposal

The preferred cross-position bridge is multi-year league-scored surplus over replacement. Both an offensive player and an IDP player should be expressed as expected league-specific fantasy points above the replacement player generated by that league's roster/scoring rules, integrated over a position-appropriate dynasty horizon and discounted for uncertainty. Percentiles are useful for display but should not be the valuation backbone because they ignore replacement depth and starter demand.

## Uncertainty

Current whole-player error remains material, especially at LB. v0.3 has empirical stat-level residual bands but does not yet claim calibrated whole-player predictive intervals. Role changes, injuries, snap share and rare-event splash plays remain important failure modes.

## Licensing / data gaps

- FTN participation/snaps via nflverse: legal review before production redistribution/packaging.
- Pressure/alignment/role data: no production-approved source selected.
- Optional IDP market anchor: no legally vetted source selected.
- Exact nflverse release provenance and attribution should be pinned before production promotion.

## Readiness

Experimental product use: DL/LB/DB projected counting stats under the existing v0.3 experimental gate; supported league-scoring transformation; scoring/lineup context with unsupported keys surfaced.

Not ready for production dynasty valuation: final defensive age curves, calibrated player-level uncertainty, final replacement/scarcity calibration, cross-position multi-year surplus calibration, optional market anchoring, or any final numeric IDP dynasty value.

**MORE RESEARCH REQUIRED**
