# League Vector Model Evaluation

## Validation design

League Vector will use temporal backtesting. A model predicting season N may only use features available before season N. Final evaluation must not use random train/test splits that mix future seasons into training.

## Required baselines

Every position model must be compared against simple baselines: previous-season production, weighted multi-year production, per-game production, and usage-based baselines where the required inputs are legally available.

## Metrics

Track MAE, RMSE, rank correlation, fantasy-point error after applying a defined scoring profile, and positional ranking accuracy. Break results out by QB, RB, WR, TE, DL/EDGE, LB and DB, plus useful age/experience cohorts.

## Promotion rule

A more complex model is promoted only if it improves out-of-sample performance enough to justify the added complexity and remains explainable enough to diagnose failures.

## Reproducibility

Each evaluation run must record model version, feature version, training seasons, validation season, dataset version, scoring profile, missing-input policy and metric results.

## Claims

League Vector must not claim superiority to another projection provider unless a fair, reproducible benchmark using comparable data and prediction dates supports that claim.
