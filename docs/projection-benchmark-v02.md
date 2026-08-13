# League Vector Projection Benchmark v0.2

Projection Benchmark v0.2 preserves `lv-projection-benchmark-v0.1` and adds a dependency-free ridge-regression challenger. It remains experimental and cannot alter production dynasty values.

## Historical evaluation

- Source: approved-with-attribution nflverse weekly player statistics.
- Seasons loaded: 2015–2024.
- Forward test folds: 2020, 2021, 2022, 2023, 2024.
- A target-season prediction may use only prior seasons.
- Rookies without prior NFL history remain outside the veteran benchmark.

## Ridge model

The first ridge challenger uses only prior information: up to three prior values of the same target statistic, prior games observed, and age entering the target season when birth date is available. The current experiment uses ridge alpha 10. This is a benchmark, not a production model.

A challenger is preferred experimentally for a target only when it lowers mean absolute error by at least 2% versus the weighted 60/30/10 baseline and beats that baseline in at least three of the five unseen folds. Otherwise League Vector retains the weighted baseline.

The CI benchmark produced 231,682 predictions from 172,567 validated player-week observations and 14,551 player-seasons. Ridge met the experimental promotion rule for 21 of 60 position/stat targets; the weighted baseline remained preferred for 39.

## Important limitations

This phase does not claim that age itself caused the ridge improvement because an explicit with-age/without-age ablation has not yet been completed. Ridge regularization has not yet been temporally tuned across a hyperparameter grid in the stable runner. Tree models are intentionally deferred until the simpler model is fully evaluated.

Whole-player fantasy-point benchmarking also remains gated. A fantasy score will not be graded until a candidate model produces every stat component required by the scoring profile. Missing components must never be treated as known zero merely to produce a total.

Current-player 2026 readiness still requires joining the current Sleeper universe to the validated historical player-seasons and separating veteran-ready, rookie-model-required, insufficient-history, unresolved-identity, and unsupported-position players.

## Production gate

All v0.2 models remain:

- experimental: true
- production_projection_eligible: false
- dynasty_value_eligible: false

No v0.2 result may change the live League Vector dynasty valuation without a later explicit production-integration phase and owner approval.
