# League Vector Projection Model

## Objective

Build proprietary player-stat projections from legally usable historical football data, then score those projected statistics using each Sleeper league's actual scoring settings. Projection generation stays separate from dynasty valuation.

## Pipeline

1. ingest licensed historical data
2. normalize player identity around stable IDs
3. build versioned features using only information available before the projection date
4. train transparent baseline models
5. backtest on future seasons using rolling temporal validation
6. promote more complex models only when they beat the baselines out of sample
7. emit projected football statistics plus uncertainty
8. score those statistics through the existing League Vector scoring engine
9. feed league-scored projections into replacement level, VORP and dynasty valuation

## Initial baselines

Before machine learning, evaluate previous-season production, weighted multi-year averages, per-game rates, age-adjusted baselines and usage-based baselines. These become the minimum performance bar for later models.

## Leakage rule

A training row for a target season may only use data that would have been known before that season or projection week. Random train/test splits across seasons are prohibited for final evaluation.

## Model outputs

Where practical, models predict football statistics rather than generic fantasy points. Each projection must include player ID, season/week, model version, projected stats, inputs available, inputs missing, uncertainty metadata, data version and projection timestamp.

## IDP

DL/EDGE, LB and DB are first-class model families. No defensive projection is emitted unless supported by defensible source data. Missing pressures, snaps or role data are reported rather than fabricated.

## Rookies

Rookies use a separate pathway based only on legally usable pre-NFL features such as draft capital, age, position, college production and measurements where rights are clear. Until that dataset is established, the existing rookie-floor behavior remains preferable to invented projections.

## SportsDataIO

SportsDataIO free-trial values are scrambled test data. They can validate an adapter's schema and failure handling but are prohibited as training labels or production truth.

## Promotion criteria

A model version can be considered for production only after it has a reproducible dataset manifest, no known temporal leakage, position-level backtest results, documented limitations, and a comparison against simple baselines.
