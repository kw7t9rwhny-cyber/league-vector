# League Vector Projection Research v0.4 — Cycle 1 checkpoint

Cycle 1 established that v0.3 fold predictions are chronological, but final retrospective model selection uses the same fold collection later summarized as historical selected-model performance. This is model-selection optimism rather than direct feature leakage.

For v0.4, model selection must be nested: outer season Y uses only seasons before Y, and model/hyperparameter selection uses only folds before Y.

A selection-safe reanalysis of preserved v0.2 artifacts found weighted stat-level MAE change versus always-weighted of QB +0.05%, RB -0.05%, WR 0.00%, TE -1.75%, DL +0.48%, LB +0.00%, DB +2.98%. These were diagnostics, not whole-player v0.4 results.

Richer v0.4 Ridge and Elastic Net were not executed in Cycle 1 because raw player-season observations were not retained in artifacts. No v0.4 model was promoted.

Original Cycle 1 checkpoint: `codex/projection-research-v04-cycle1` at `63c40efdb2577bccb62477a6f27e9c465c86b802`.

Status: **MORE RESEARCH REQUIRED**
