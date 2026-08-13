# League Vector Projection Research v0.4

This branch is research-only. It must not modify the production/browser UI, production dynasty values, or merge into an integration branch without explicit owner approval.

## Base state

Research v0.4 branches from commit `77559cf438123de35e63e7e60dab3378b64e5a7b` (`codex/idp-scoring-identity-fixes-v01`), the current open PR #4 head at the start of this cycle. That state contains the v0.3 historical projection system, identity hardening, IDP scoring-context work, and the existing 2015-2025 nflverse historical pipeline.

## Objective

Measure whether additional leakage-safe statistical models can materially outperform the current v0.3 projection system on unseen seasons, by position and target statistic, without increasing complexity unless the gain is stable and reproducible.

## Validation protocol

- Historical source: only the repository's approved nflverse historical pipeline.
- Outer folds: chronological target seasons 2020-2025 where data are available.
- For outer fold Y, model fitting may use only seasons `< Y`.
- Hyperparameter tuning for outer fold Y must itself use only information `< Y`; the preferred default is an inner validation season of `Y-1` with training restricted to seasons `< Y-1`.
- No model may use target-season statistics, later seasons, current-season outcomes, or retrospective model-selection results from future outer folds.
- Rookies remain outside veteran-model evaluation unless a separately documented rookie model is created.
- SportsDataIO trial/proprietary data remains excluded from training and evaluation truth.

## Baselines

Two comparisons are required:

1. Frozen transparent weighted historical baseline (`weighted_603010`).
2. A strict walk-forward representation of the v0.3 model family. For each outer fold, the v0.3 candidate used as the comparison must be selected from evidence available before that fold rather than from all 2020-2025 evaluation folds at once.

This distinction matters because the published v0.3 retrospective selector evaluates candidate performance across the complete historical evaluation window. v0.4 will not use future fold results to decide the model for an earlier fold.

## Candidate feature families

All features must be computed from seasons before the target season.

- prior target totals (up to three seasons)
- prior target per-game rate
- prior games / availability
- multi-year trend and regression-to-mean signals
- age entering the target season when birth date is available
- NFL history length / experience proxy
- same-player related opportunity statistics (position-specific)
- same-player related efficiency statistics when denominators are known
- prior team continuity / role-stability proxy
- prior-team environment aggregates when they can be computed entirely from prior-season records

No feature is promoted merely because it sounds predictive. Every feature family requires temporal ablation evidence.

## Models to test

- v0.3 walk-forward baseline
- richer-feature Ridge
- Elastic Net with temporally tuned regularization
- tree/boosting models only after linear-model evidence is complete and only if the environment can support a reproducible dependency or a small auditable implementation
- ensembles only when they improve unseen-season performance over the strongest component model

## Metrics

Every candidate must report at minimum:

- MAE
- RMSE
- Spearman rank correlation
- sample size
- results by position
- results by target statistic
- results by outer season
- number of outer folds won versus the comparison baseline
- uncertainty/calibration diagnostics when probabilistic ranges are evaluated

## Promotion rule

A challenger is not promoted based on aggregate MAE alone. The default research gate is:

- at least 2% lower pooled MAE than the strict v0.3 walk-forward baseline for the evaluated target,
- lower MAE in at least half of eligible unseen outer folds,
- no obvious catastrophic RMSE degradation,
- adequate sample size,
- no leakage or licensing concern,
- and a plausible, documented reason for the edge.

Borderline results remain research-only.

## Cycle 0 findings

The existing repository already has a strong base for this work: v0.2 added Ridge, and v0.3 added temporal alpha tuning, age/no-age ablation, rare-event shrinkage, complete-stat-line fantasy backtests, and empirical residual bands. Therefore v0.4 should focus on feature quality and stricter nested selection rather than adding complexity for its own sake.

A methodological limitation identified before coding is that the published v0.3 final retrospective selector summarizes candidate performance across all 2020-2025 outer folds. That is appropriate for choosing a final post-backtest model, but it cannot be reused as the model selector inside earlier historical folds without leaking later evaluation information. v0.4 will construct a fold-local walk-forward v0.3 comparator.

## Production gate

All v0.4 artifacts are experimental and must retain:

- `production_projection_eligible: false`
- `dynasty_value_eligible: false`

No production/browser integration is part of this branch.
