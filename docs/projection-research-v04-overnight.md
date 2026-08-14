# League Vector Projection Research v0.4 — Overnight Offensive Cycle

Status while experiments are running: **MORE RESEARCH REQUIRED**

Branch: `codex/projection-research-v04-overnight`
Base: current `main` at branch creation. Cycle-1 protocol carried forward from `63c40efdb2577bccb62477a6f27e9c465c86b802`.

No production dynasty valuation, production projection eligibility, UI, or IDP firewall behavior is changed by this research.

## Research question

How much additional unseen-season QB/RB/WR/TE predictive accuracy can League Vector obtain from its current legally approved historical data without overfitting?

## Baseline reproduction checkpoint

Retained green v0.3 artifacts reproduce the documented whole-player reference-fantasy baseline:

| Position | N | MAE | RMSE | top-12 overlap |
|---|---:|---:|---:|---:|
| QB | 410 | 61.04 | 84.76 | 10/12 |
| RB | 782 | 44.93 | 63.00 | 8/12 |
| WR | 1,128 | 40.03 | 53.01 | 9/12 |
| TE | 624 | 28.17 | 38.39 | 9/12 |

Additional historical top-N overlap: QB top-24 23/24; RB top-24 21/24 and top-36 30/36; WR top-24 21/24, top-36 33/36, top-48 43/48; TE top-24 20/24.

These v0.3 figures are reproducible but the final retrospective target-model selector is not a fully independent proof set, because the same fold collection contributes to model choice and reported selected-model history.

## Overnight validation protocol

The research runner uses nflverse 2015–2025 through the repository's existing approved ingestion path. Outer folds are 2020–2025. 2020–2024 are development/history folds and 2025 is the final untouched proof season. For target season Y, features use only player seasons before Y. Hyperparameters use Y-1 as a temporal validation season trained only on still-earlier data. Model-family choice for an outer season uses only earlier outer folds. No 2025 result may select a model later reported as a 2025 win.

Rookies with no prior NFL season remain outside the veteran benchmark; limited-history players remain separately auditable.

## Candidate families under test

- constrained historical weighting grids, including 80/15/5, 70/20/10, 60/30/10, 50/35/15, 50/30/20 and 45/35/20;
- richer Ridge;
- research-only Elastic Net coordinate descent without new dependencies;
- availability decomposition using weighted per-game production × chronologically estimated games.

Richer features are limited to lagged 1/2/3-year totals, per-game history, games, age, experience, recent trend, position-specific opportunity/efficiency and prior-team offensive volume. Future team, depth chart, routes/snaps, coaching changes and any future roster information are excluded.

## Promotion standard

A candidate must improve point error and ranking quality with position- and season-level stability, survive the untouched 2025 fold, and avoid being driven by one subgroup or season. Marginal aggregate wins with unstable folds are rejected.
