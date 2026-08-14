# League Vector Projection Research v0.4 — Overnight Offensive Cycle

Status: **EXPERIMENTAL V0.4 CANDIDATE READY FOR INDEPENDENT QA**

Branch: `codex/projection-research-v04-overnight`
Candidate-tested head: `9e579fa7fbec95c24f075d93fe401978f789a5bc`
Draft PR: #16
Cycle-1 protocol carried forward from `63c40efdb2577bccb62477a6f27e9c465c86b802`.

No production dynasty valuation, production projection eligibility, production UI, or IDP firewall behavior is changed. The candidate remains `experimental=true`, `production_projection_eligible=false`, and `dynasty_value_eligible=false`.

## Executive conclusion

A genuinely better offensive projection system exists in the current legally approved historical data, but the edge is position-specific and should remain experimental.

The winning design is deliberately simpler than the broad overnight search: QB falls back to the transparent 60/30/10 historical baseline; RB uses age + opportunity/efficiency Ridge ensembles; WR uses age + opportunity/efficiency Ridge ensembles; TE uses age-only Ridge ensembles. Target-specific ensembles are permitted only when earlier chronological folds clear a >=0.5% mean MAE gain and majority-fold-win gate; otherwise the target falls back to baseline.

The final 2025 season was never used to select the reported candidate.

## 1. Baseline reproduction

The retained v0.3 benchmark reproduced deterministically. Documented whole-player reference-fantasy history remains:

| Position | N | MAE | RMSE | top-12 overlap |
|---|---:|---:|---:|---:|
| QB | 410 | 61.04 | 84.76 | 10/12 |
| RB | 782 | 44.93 | 63.00 | 8/12 |
| WR | 1,128 | 40.03 | 53.01 | 9/12 |
| TE | 624 | 28.17 | 38.39 | 9/12 |

The published v0.3 selector is reproducible but retrospectively selects over the same fold collection later summarized. To avoid overstating v0.4, this cycle also rebuilt a **selection-safe v0.3 comparator** that only uses earlier outer folds for target-model choice.

## 2. Validation protocol

Data: nflverse 2015–2025 through the repository's existing approved ingestion path.
Outer folds: 2020–2025.
Development/model-selection folds: 2020–2024.
Final untouched proof season: 2025.

For target season Y, every player/team feature is from seasons before Y. Hyperparameters use earlier chronological data only. Candidate-family choice for an outer fold uses only earlier outer folds. Future depth charts, future roster/team information, coaching changes not known at projection time, licensed data, and current-year hindsight are excluded.

Rookies with zero prior NFL seasons remain outside this veteran/limited-history model family.

## 3. Experiments run

- fixed historical-weight reproduction;
- constrained lag grids: 80/15/5, 70/20/10, 60/30/10, 50/35/15, 50/30/20, 45/35/20;
- position-mean and opportunity-conditioned shrinkage;
- history-only Ridge;
- age-aware Ridge;
- opportunity/efficiency Ridge;
- age + opportunity Ridge;
- naive trend/full-feature Ridge;
- Elastic Net;
- simple baseline/Ridge and baseline/Elastic ensembles;
- availability/per-game decomposition;
- target-specific model selection;
- player-season residual audit;
- age, opportunity and trend ablations;
- selection-safe reconstruction of v0.3;
- limited-history and age subgroup checks;
- Spearman and top-N ranking checks;
- paired player-season bootstrap on final-holdout MAE differences.

## 4. Final untouched 2025 result vs fixed 60/30/10 baseline

| Pos | N | Baseline MAE | v0.4 MAE | MAE gain | Baseline RMSE | v0.4 RMSE | RMSE gain | Spearman change |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| QB | 67 | 62.216 | 62.216 | 0.0% | 85.265 | 85.265 | 0.0% | +0.0000 |
| RB | 121 | 45.007 | 42.714 | **5.09%** | 64.092 | 61.932 | **3.37%** | **+0.0281** |
| WR | 191 | 40.671 | 35.961 | **11.58%** | 58.241 | 51.021 | **12.40%** | **+0.0327** |
| TE | 114 | 27.576 | 26.217 | **4.93%** | 38.722 | 36.688 | **5.25%** | +0.0021 |

The QB research family was rejected and the candidate intentionally preserves the baseline there.

## 5. Final untouched 2025 result vs selection-safe v0.3

| Pos | v0.3 MAE | v0.4 MAE | MAE gain | RMSE gain | Spearman change |
|---|---:|---:|---:|---:|---:|
| QB | 62.919 | 62.216 | **1.12%** | 0.64% | +0.0060 |
| RB | 43.876 | 42.714 | **2.65%** | 1.25% | +0.0164 |
| WR | 38.686 | 35.961 | **7.04%** | **7.00%** | +0.0168 |
| TE | 26.420 | 26.217 | **0.77%** | 0.91% | +0.0061 |

Across the 493 common 2025 player-seasons: selection-safe v0.3 MAE = **40.417**, v0.4 MAE = **38.933** (**3.67% improvement**); RMSE = **58.731 -> 57.002** (**2.94% improvement**); pooled Spearman = **0.7653 -> 0.7773**.

Paired player-season bootstrap of the v0.3-minus-v0.4 absolute-error advantage: mean **+1.483 points**, 95% interval approximately **+0.856 to +2.113**. WR is individually persuasive: **+2.724 points**, 95% interval approximately **+1.486 to +3.969**. QB/RB/TE individual intervals cross zero, so their separate gains must not be called statistically proven.

## 6. Fold-by-fold stability

Against selection-safe v0.3, v0.4 improves MAE in every non-initial evaluated fold (2021–2025) for QB, RB, WR and TE. 2020 is a deliberate baseline/tie because no earlier outer fold exists for candidate selection.

Against fixed 60/30/10, the final simplified candidate is strongest for WR: 2021 +2.57%, 2022 +2.14%, 2023 +4.37%, 2024 +6.93%, 2025 +11.58%. RB improves in 2021–2025, with 2024 only +0.35%. TE has one contained development loss in 2021 (-1.61%) followed by four straight wins: +2.12%, +3.52%, +5.14%, +4.93%. QB remains unchanged by design.

This is not a one-season aggregate win.

## 7. Ranking accuracy

2025 Spearman improves versus fixed baseline for RB (+0.0281) and WR (+0.0327), is essentially flat-positive for TE (+0.0021), and is unchanged for QB.

Top-N overlap is mixed rather than uniformly better: RB top-36 improves 28/36 -> 29/36; WR top-48 improves 35/48 -> 36/48; TE top-24 declines 19/24 -> 17/24; elite top-12 overlap is unchanged in the final fold. Therefore v0.4 is not being promoted on ranking metrics alone, and TE ranking remains an explicit QA/research concern.

## 8. Error analysis / young-player findings

The fixed baseline shows systematic age bias relevant to tomorrow's dynasty-value audit:

- young WRs (<=24) are under-projected by about **4.4 fantasy points** on average;
- young TEs are under-projected by about **8.9 points**;
- WRs age 30+ are over-projected by about **41.8 points**;
- TEs age 30+ are over-projected by about **18.7 points**;
- veteran WR over-projection appears in all six outer folds;
- young TE under-projection appears in five of six folds.

The ablation confirms this is partly a projection-model issue, not merely downstream dynasty valuation. WR age features improve Ridge MAE in all five evaluated post-initial folds (mean ~3.55%). TE age features also improve all five (mean ~1.32%).

The final candidate reduces WR veteran bias materially (all-fold v0.3 ~+39.2 -> v0.4 ~+28.5) and improves 2025 young-WR MAE ~5.1%. Young TE improves modestly, not enough to declare that problem solved.

## 9. Opportunity / role findings

The baseline systematically over-projects high-prior-opportunity players and under-projects low-opportunity players, consistent with excessive role persistence/regression calibration.

RB opportunity/efficiency features are the clearest RB ablation: improvement in all five evaluated folds, mean ~2.19%; age + opportunity improves all five, mean ~2.59%. WR opportunity alone is weak, but age dominates and opportunity can add limited incremental value. TE opportunity does not earn a place over age-only features.

## 10. Availability findings

Broad `per-game production x predicted games` decomposition did not show enough stable incremental benefit to survive candidate simplification. Past availability remains useful context, but this cycle found no defensible basis for pretending exact future injury/games-played prediction is reliably accurate. No precise injury forecasting was added.

## 11. Rookie / limited-history findings

Rookies with zero NFL history remain explicitly unsupported by this candidate and still require a separate rookie model/data decision.

Limited-history behavior is not fully solved. Across all folds, v0.4 improves established-history RB/WR/TE most clearly. Two-year history is mixed. One-year WR remains slightly worse in aggregate MAE despite improved bias; one-year TE improves. On the 2025 holdout, young RB and young WR improve, but samples are small enough that subgroup claims remain directional.

This candidate must keep its existing conservative fallback for limited-history players and must not be presented as solving rookie projections.

## 12. Biggest failed / rejected ideas

- **Richer QB Ridge:** rejected; broad richer models worsened QB and no stable incremental feature family emerged.
- **Elastic Net:** added little unique value; raw regularized linear models produced unsafe tiny-volume extrapolation on rare TE rushing targets. It is excluded from the final candidate.
- **Naive trend features:** rejected. RB trend was negative on average; TE trend was strongly harmful (0/5 folds improved, including a ~17.8% failure in 2021); WR trend reduced final-holdout benefit versus simpler age-led variants.
- **Weight optimization alone:** effectively a dead end. Alternate lag weights offer tiny/inconsistent changes and do not explain the main edge.
- **Broad availability decomposition:** no stable unique benefit sufficient for candidate inclusion.
- **Unconstrained model complexity:** rejected in favor of simple target-level ensembles plus fallback.

## 13. Shrinkage findings

Opportunity-conditioned shrinkage is directionally useful, especially for RB/TE, and substantially better than simple position-mean shrinkage on several targets. However, the final Ridge-ensemble candidate still beats the best shrinkage-only classical system on 2025: RB 42.714 vs 44.488 MAE; WR 35.961 vs 39.193; TE 26.217 vs 26.666. Shrinkage should remain a future calibration/ablation path rather than replace the current candidate.

## 14. Overfitting controls

- strict chronological walk-forward folds;
- final 2025 holdout untouched by candidate selection;
- selection-safe v0.3 comparator reconstructed for fair comparison;
- target-level selection uses earlier folds only;
- minimum 0.5% mean MAE gain + majority prior-fold wins before candidate activation;
- explicit fallback to transparent baseline;
- feature ablations before inclusion;
- failed seasons retained;
- no future team/depth-chart information;
- no paid/licensed data;
- no arbitrary fantasy-output constants added to manufacture wins;
- simpler candidate selected over higher-complexity alternatives despite those alternatives sometimes winning isolated targets.

## 15. External benchmark architecture

A future external-projection benchmark should ingest a frozen preseason snapshot with source/version/timestamp/license metadata, map identities before the season, score every source through the same league-neutral reference scoring and identical eligible-player population, and evaluate only after the target season. Candidate selection must not use the same final season later advertised as proof.

Useful external sources may include established commercial or public projection providers, but any paid dataset, redistribution right, scraping/terms question, or licensing requirement is a Founder decision. Nothing was purchased or scraped in this cycle.

## 16. Candidate configuration

Final candidate flags:

```text
experimental = true
production_projection_eligible = false
dynasty_value_eligible = false
```

2025 target policy selected from development history only:

- QB: all targets baseline;
- RB: 50%/75% Ridge ensembles by target;
- WR: 50%/75% Ridge ensembles by target;
- TE: 50% Ridge ensembles for targets/receptions/receiving yards/receiving TD; rare rushing targets baseline.

No production valuation behavior changes.

## 17. Checkpoints

Important durable checkpoints in this cycle include:

- `db226dd38a4abcfbef88d3ae87ec0c609c8d5155` — reproduced baseline / protocol checkpoint;
- `6f905b1b729ec5e19022f689dd99fa7ad6cb65c6` + `be961b05e457293d6377431b2e1fe67a9a9be250` — Ridge-first benchmark + workflow;
- `7debcaeb3ee080804fdd43ecdc04e7595bcee402` + `3a9d62c102ef68afb828c589a2e6fbcebf8c4873` — residual audit;
- `f026d98aa26b6a9ed7a04504ebff3915f836f49f` — model-family benchmark;
- `f6b60bba86b4235e72670ee7291eedcd15644124` — feature-ablation workflow;
- `386b72ba9bcc1827cf6db5f282ef7962d4b0654b` — corrected and completed classical weighting/shrinkage benchmark;
- `c1052b47a1ba96cc9a618a7cd1e527a7e9b04748` — selection-safe v0.3 comparator workflow;
- `bf626b26a587dac5a651f032c518591188d5f875` + `9e579fa7fbec95c24f075d93fe401978f789a5bc` — simplified final candidate + successful candidate workflow.

## 18. Readiness decisions

**Does v0.4 materially beat v0.3?** Yes, at the experimental research level. The pooled untouched-2025 improvement versus selection-safe v0.3 is 3.67% MAE / 2.94% RMSE with improved pooled rank correlation and a positive paired-bootstrap interval. WR is the strongest independently persuasive position.

**Ready for experimental product review / independent QA?** Yes. The candidate has enough chronological evidence and enough simplification to justify adversarial QA.

**Ready for production promotion?** No. Production remains blocked by independent QA, limited-history/rookie behavior, TE top-N ranking regression, the relatively small individual TE/QB/RB confidence margins, candidate implementation review, and a separate Founder decision on whether/when experimental projections should affect any product surface.

## 19. Exact next research priorities

1. Independent QA of candidate head `9e579fa7fbec95c24f075d93fe401978f789a5bc`, including leakage review, deterministic rerun, target-selection reconstruction, rare-stat/outlier checks and identity completeness.
2. Focused WR confirmation/ablation because it carries most of the proven edge.
3. TE ranking work: preserve point-error gains without the 2025 top-24 overlap regression.
4. Limited-history and year-1-to-year-2 model research; do not fold rookies into veteran models.
5. Better availability-risk calibration only if it can beat the current no-injury-precision stance chronologically.
6. Explore calibrated opportunity-conditioned shrinkage as a complement to—not replacement for—the current ensembles.
7. Prepare a frozen-source external preseason projection benchmark after Founder resolves any licensing/data-source choices.
8. Only after QA and additional confirmation, produce a formal experimental-product candidate; do not alter dynasty valuation automatically.

EXPERIMENTAL V0.4 CANDIDATE READY FOR INDEPENDENT QA
