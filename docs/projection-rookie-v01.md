# League Vector Rookie Projection Research v0.1

Status: research-only. Validated veteran v0.4 remains unchanged. `experimental=true`, `production_projection_eligible=false`, `dynasty_value_eligible=false`.

## Evidence discipline

Branch: `codex/projection-rookie-v01`. Parent research state: Cycle 2 head `7ee8dbabea1188f1b9413cfaf0a17b3b6164006b`. Exact input is the validated frozen nflverse snapshot with composite SHA-256 `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`. Model selection uses chronological rookie cohorts 2018–2024 only. 2025 is retrospective observed and is not used to tune this checkpoint. Workflow run `31799096514` restored the frozen snapshot, verified its hash, executed the benchmark twice, and required byte-identical outputs.

## Data inventory and identity

Available approved inputs in the frozen player/stat files are position, rookie season, birth date/rookie age, draft round, overall draft pick, NFL identity, team/stat outcomes. No proprietary rookie rankings, college production, recruiting rankings, combine/athletic testing, or paid projections are used.

The rookie frame contains 1,096 QB/RB/WR/TE rookie player-seasons across the full frozen history. There are zero missing player IDs and zero duplicate player-season identities. Draft pick is unavailable for 370 rows, primarily undrafted players; this is represented explicitly with a drafted indicator rather than treated as a normal pick. Rookie age is complete in the evaluated frame.

Development sample 2018–2024: QB N=62, RB N=217, WR N=289, TE N=126.

## Reproduction of Cycle 2 claim and expanded transform benchmark

Every leading draft-capital model beat the position-only historical rookie mean in all seven chronological development cohorts at all four positions.

| Position | Leading simple architecture | Folds won | Mean MAE | Mean RMSE | Mean Spearman | Mean MAE gain vs position prior | Worst fold gain |
|---|---|---:|---:|---:|---:|---:|---:|
| QB | linear log(overall pick) | 7/7 | 52.17 | 65.73 | .664 | +38.36% | +17.93% |
| RB | linear log(pick) + age | 7/7 | 37.16 | 49.92 | .573 | +32.79% | +15.42% |
| WR | linear log(pick) + age | 7/7 | 36.14 | 50.77 | .698 | +30.74% | +22.25% |
| TE | Ridge log(pick) + age | 7/7 | 22.65 | 33.35 | .640 | +28.61% | +10.59% |

This reproduces and slightly strengthens Cycle 2's conclusion. Log draft pick is generally preferable to raw linear pick, inverse pick, or coarse round-only priors. Round buckets remain useful as a transparent baseline but do not beat the best pick-based models consistently.

QB's percentage improvement is large but the cohort is only 62 players, with 7–11 players per fold. QB therefore remains a higher-uncertainty research position despite the 7/7 result. RB/WR have substantially stronger sample support. TE is smaller than RB/WR but its result is stable across all seven folds.

## Age

Age adds a modest incremental MAE improvement for RB and WR and is selected in the leading TE Ridge architecture. It materially reduces QB rank quality in the tested family, so the QB recommendation excludes age. The incremental age effect is much smaller than the draft-capital effect; draft capital is the dominant signal.

Because model families were explored in this cycle, these are development conclusions, not independent future proof. 2026 actual outcomes should be reserved as a genuinely prospective evaluation when available.

## Uncertainty

Rookie uncertainty is materially wider than veteran confidence should imply. The current rolling empirical 80% intervals around the selected rookie families achieved approximate mean development coverage/width:

- QB: 75.1% coverage, ~154.5 fantasy-point full width
- RB: 80.6%, ~117.6 points
- WR: 76.3%, ~96.9 points
- TE: 71.7%, ~59.3 points

RB is close to nominal calibration; QB/WR/TE under-cover. Therefore the point models are more mature than the interval model. No position may claim a calibrated 80% production interval yet. A future uncertainty cycle should use rolling out-of-fold residual calibration rather than training residuals and should test calibration by draft tier.

## Meaningful-role probability

A simple draft-capital/age logistic model shows useful ranking signal for fantasy relevance, with mean chronological AUC approximately QB .830, RB .833, WR .873, TE .904. This is promising as a separate probability/risk output, but the relevance thresholds are research definitions and are not production contracts.

## Outliers and failure modes

Draft capital does not eliminate first-round busts, injuries, depth-chart surprises, or late-round/undrafted breakouts. QB fold MAE ranges from ~28.8 to ~78.6 despite winning every fold versus the position prior. RB's 2022 rank correlation falls to ~.31. These failures argue strongly for wide uncertainty and against deterministic rookie confidence.

No arbitrary caps are introduced.

## Rookie-to-year-2 transition

This checkpoint does not promote a transition model. Cycle 2 showed direct second-year models are unstable. The correct next experiment is a dedicated paired-cohort model comparing validated v0.4 one-season evidence against chronological blends of the pre-NFL rookie prior and year-1 NFL evidence. Blend weights must be selected on pre-2025 cohorts only. Until that work succeeds, Core should preserve the rookie model metadata/prior and transition conservatively rather than abruptly trusting an unstable one-season model.

## Data that could materially improve the model later

Likely high-value additions are college production/opportunity, receiving/rushing market share, early-declare/experience context, athletic testing, and richer team/depth-chart opportunity information. None should be acquired or used until exact provenance, commercial rights, redistribution obligations, and historical availability are approved by Founder/legal review. This checkpoint makes no claim that those sources are necessary for a useful first rookie model.

## Position readiness

- RB: strongest combination of sample size, 7/7 fold stability, and large MAE gain. Candidate is appropriate for HIGH-risk independent QA of an experimental research output.
- WR: strongest rank quality plus large stable MAE gain; appropriate for HIGH-risk independent QA.
- TE: stable 7/7 gain and reasonable rank signal, but smaller sample and currently under-calibrated uncertainty. Point candidate can be QA'd; uncertainty is not ready.
- QB: draft capital clearly beats the position prior, but N=62 is small and fold errors are volatile. Keep research-only pending additional prospective evidence; do not promote merely because the percentage gain is large.

## Core contract if later approved

A future experimental rookie object should contain: `point_projection`, `model_family`, `rookie_model=true`, `history_depth=0`, `draft_capital_source`, `input_snapshot_sha256`, `low_estimate`, `high_estimate`, `interval_nominal`, `interval_calibrated`, `uncertainty_tier`, `meaningful_role_probability` only if separately validated, `projection_eligibility`, and explicit confidence/limitation notes. Missing draft capital must remain explicit. Nothing in this contract should automatically alter Dynasty Value.

## Readiness decision

The zero-history point-projection signal is strong enough for independent HIGH-risk QA for RB and WR, and for TE point estimates with an uncertainty caveat. QB remains research-only because sample size/variance are materially weaker. The uncertainty layer and rookie-to-year-2 bridge require more research before any product integration decision.
