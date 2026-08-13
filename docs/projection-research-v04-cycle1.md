# League Vector Projection Research v0.4 — Cycle 1 checkpoint

## Repository state

Cycle 1 was pinned to `main` commit `89a2791e36b71bcf628784fbae24b0a5352f5d80` when successor branch `codex/projection-research-v04-cycle1` was created. `main` advanced again during the cycle, so the test bed was intentionally not changed mid-experiment.

No browser, valuation, production projection, or deployment code was modified.

## QA finding: current v0.3 model selection is not fully independent

The v0.3 fold predictions themselves are chronological. However, final `compare()` selects the winning model for each position/stat after aggregating the same historical folds later summarized by the selected-model fantasy backtest. This is model-selection optimism, not direct future-feature leakage.

Therefore a v0.4 claim must use nested walk-forward selection: for outer season Y, all features and training data are from seasons before Y, and model/hyperparameter selection is based only on folds before Y.

## Actual selection-safety evidence from preserved v0.2 artifacts

The preserved v0.2 artifact contains per-season MAE/RMSE/Spearman for weighted 60/30/10 and Ridge across 2020–2024. I reanalyzed it without using a target fold to select its own model. For each outer fold 2021–2024, Ridge was selected only when all earlier folds showed at least 2% lower mean MAE than weighted and Ridge won at least half of those earlier folds. The table below is a weighted stat-level MAE comparison across outer folds; it is a QA diagnostic, not a whole-player v0.4 result.

| Position | Selection-safe stat MAE change vs weighted | Targets improved | Targets | Interpretation |
|---|---:|---:|---:|---|
| QB | +0.05% | 2 | 9 | essentially no stable aggregate edge |
| RB | -0.05% | 3 | 7 | no stable aggregate edge |
| WR | 0.00% | 0 | 4 | no selection-safe Ridge use survived |
| TE | -1.75% | 0 | 4 | Ridge selection degraded performance |
| DL | +0.48% | 3 | 12 | weak signal only |
| LB | +0.00% | 3 | 12 | essentially neutral |
| DB | +2.98% | 6 | 12 | strongest selection-safe Ridge signal |

Positive means lower MAE than always using the weighted baseline; negative means worse.

This materially changes how the older headline `21 of 60 targets promoted` should be interpreted. The original result remains reproducible, but a model selected retrospectively on the full fold set is not equivalent to a model-selection-safe future projection process.

## Cycle 1 richer-model execution status

A richer position-specific v0.4 Ridge runner was designed around lagged fantasy production, games, history depth, age, position-specific opportunity/volume, lagged efficiency, trend, role/team continuity proxies, and interactions. The current ChatGPT execution container cannot resolve external hosts, while the GitHub connector blocks executable-code writes under its safety classifier. Existing CI artifacts retain benchmark outputs but not the raw historical observations needed to fit new features.

Because of that execution constraint, richer v0.4 Ridge and Elastic Net were NOT numerically run in this checkpoint. No v0.4 accuracy numbers are invented and no candidate is promoted.

Elastic Net also remains intentionally dependency-free from the production repository. It should be tested in an isolated research environment only after richer Ridge executes cleanly.

## Promotion status

| Model | QB | RB | WR | TE | DL | LB | DB |
|---|---|---|---|---|---|---|---|
| Rich v0.4 Ridge | KEEP TESTING | KEEP TESTING | KEEP TESTING | KEEP TESTING | KEEP TESTING | KEEP TESTING | KEEP TESTING |
| Rich v0.4 Elastic Net | KEEP TESTING | KEEP TESTING | KEEP TESTING | KEEP TESTING | KEEP TESTING | KEEP TESTING | KEEP TESTING |

`KEEP TESTING` here means there is not yet independent outer-fold evidence sufficient for PROMOTE; it does not mean the candidate beat v0.3.

## Recommendation

Do not promote a v0.4 model yet. The next executable checkpoint should run the richer Ridge feature ablation against a nested v0.3 baseline, preserve matched player-season predictions, and report MAE, RMSE, Spearman, N, season wins, and sensitivity among players with at least two prior seasons. Only then test Elastic Net if Ridge shows stable signal.
