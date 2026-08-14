# TE Specialization / Ranking Research v0.1

Status: **MORE TE RESEARCH REQUIRED — NOT PRODUCTION**

This is an isolated HIGH-risk Projection Research track. Validated Projection v0.4 remains the immutable control. No production projection, Dynasty Value, Core, UI, IDP, or `main` behavior is modified.

## Primary result

The tested TE-specific point-model families do **not** improve validated Projection v0.4. Across the four evaluable pre-2025 expanding-window folds (2021–2024), every full-cohort challenger went 0-for-4 on MAE fold wins. No point candidate clears the research gate.

The useful signal is uncertainty/role metadata rather than a replacement point model: TE24 role-survival probability is stable enough to justify further isolated research, while direct breakout/collapse classification remains too sparse or poorly thresholded for promotion.

Final disposition: **MORE TE RESEARCH REQUIRED**.

## Frozen control and chronology

- validated Projection v0.4 control head: `6d931abadbcb06e910bf953d941902c7c2cd1638`
- frozen historical snapshot SHA-256: `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`
- immutable v0.4 player-season comparator SHA-256: `9e329e7901ecb8e925d5f5aae695dadc30195b33e67f3943177dc13087b45ab0`
- architecture/model selection: pre-2025 only
- 2025: `retrospective_observed` only
- validation: expanding-window chronological folds

The deterministic workflow executes the full research twice and requires byte-identical canonical JSON before publishing evidence. 2025 never tunes features, thresholds, archetype definitions, hyperparameters, or ranking gates.

## Data/identity audit

- TE player-seasons in frozen source: 1,396
- TE rows paired to the v0.4 comparator: 587
- complete internally consistent draft rows: 418
- draft metadata unavailable: 169
- inconsistent draft rows: 0
- duplicate player-seasons: 0
- unresolved player identities: 0
- two-season history available: 452 paired rows

The frozen weekly schema does **not** contain a defensible team identifier needed to reconstruct team pass volume or target share. Those fields are therefore marked unavailable and are not inferred. Red-zone usage, historical snap/depth role, and starter status are also unavailable and are not reverse-engineered from fantasy points.

True zero remains zero. Missing/unavailable data is not converted to zero.

## Features actually tested

Chronology-safe prior-season inputs:

- targets and targets/game
- receptions
- receiving yards
- receiving TDs
- fantasy production and fantasy production/game as control context
- late-season targets/game
- late-season target growth
- yards per target
- catch rate
- games and missed games
- age where available
- experience where rookie season is valid
- prior-year fantasy rank
- two-season-ago fantasy production in the multi-year challenger

Draft pick is tested only in a separate matched-cohort diagnostic where draft metadata is complete and internally consistent. It is never imputed into the main TE model.

## Model results versus validated v0.4

All figures below use only pre-2025 selection folds. Negative MAE gain means worse than v0.4.

| Challenger | MAE fold wins | Mean MAE gain | Worst fold | Mean fantasy-relevant MAE gain | Mean Spearman delta | Mean top-12 delta | Mean top-24 delta |
|---|---:|---:|---:|---:|---:|---:|---:|
| `ridge_generic` | 0/4 | -9.64% | -17.23% | -15.21% | -0.0360 | +0.0208 | -0.0208 |
| `ridge_role` | 0/4 | -11.79% | -21.34% | -15.82% | -0.0614 | ~0.0000 | -0.0313 |
| `ridge_role_light` | 0/4 | -11.05% | -18.73% | -15.01% | -0.0489 | +0.0208 | -0.0313 |
| `ridge_role_multiyear` | 0/4 | -10.33% | -21.95% | -12.69% | -0.0513 | +0.0417 | -0.0208 |
| `empirical_archetype` | 0/4 | -11.80% | -20.01% | -15.64% | -0.0554 | ~0.0000 | -0.0521 |

The empirical archetype model learns per-fold KMeans clusters from receiving-role features and assigns no subjective names. Because it worsens both point and fantasy-relevant error, empirical archetypes are **not justified for promotion** in v0.1.

## Matched draft-capital diagnostic

Draft-capital testing uses only complete, internally consistent draft metadata and evaluates v0.4 on the exact same rows. It is diagnostic-only and cannot become the production candidate.

Fold MAE gains versus matched v0.4 were:

- 2021: -12.57% (n=64)
- 2022: -14.70% (n=66)
- 2023: -2.95% (n=71)
- 2024: -1.67% (n=75)
- mean: **-7.97%**

Draft capital does not rescue this TE point architecture.

## Early-career TE diagnostics

The TE role model also fails to justify an early-career specialization:

- Year 1 → Year 2: n=64, mean MAE gain **-17.14%**
- Year 2 → Year 3: n=58, mean MAE gain **-14.63%**
- Year 3 → Year 4: n=57, mean MAE gain **-19.31%**

Year 1 → Year 2 wins only the 2024 fold (+7.70%) and loses the other three, including -35.18% and -30.62% folds. No youth multiplier or early-career point adjustment is supported.

This does not invalidate the earlier Rookie→Year-2 finding that TE was the closest position to its bridge gate; it shows that the present TE role-feature model does not turn that signal into a stable point model.

## Uncertainty diagnostics

### Role-survival probability

A separate logistic TE24 relevance model is diagnostic-only and never multiplies projected points. Pre-2025 fold AUC/Brier:

- 2021: AUC 0.8973, Brier 0.1152
- 2022: AUC 0.8906, Brier 0.0965
- 2023: AUC 0.8996, Brier 0.1028
- 2024: AUC 0.8991, Brier 0.1114

This is the strongest repeatable TE-specific result in v0.1 and warrants further uncertainty-metadata research.

### Breakout and collapse probability

Breakout is defined as prior rank outside TE24 followed by an actual TE12 season. Collapse is defined as prior TE12 followed by an actual finish outside TE24. These are not starter/depth-chart labels.

Breakouts are rare: fold positives are 2, 0, 4, and 4. AUC can be high in some folds (0.847, unavailable with zero positives, 0.679, 0.928), but the fixed 0.5 classifier identifies none of the actual breakouts and therefore has 100% miss rate whenever positives occur. Collapse cohorts are even smaller (11–12 test rows in evaluable folds), with only 1, 1, and 3 positives after the first insufficient fold, and the fixed classifier also identifies none.

Conclusion: the probabilities may contain ranking information, but breakout/collapse classification is **not promotion-ready** and should not modify points.

### Prediction intervals

A chronology-safe one-season split-conformal diagnostic at nominal 80% coverage produced:

- 2022: observed coverage 89.9%, mean width 104.6 points
- 2023: observed coverage 77.9%, mean width 83.1 points
- 2024: observed coverage 78.9%, mean width 97.9 points

Coverage is plausible but the intervals are wide, reinforcing that TE uncertainty is substantial. Intervals remain metadata/research-only.

## Failure cases

The evidence package stores the five largest `ridge_role` error deteriorations versus v0.4 in every evaluable fold. The failures include both severe over-projection of low-output TEs and large under-projection of productive TEs. In several 2021–2022 examples the TE role model adds 40–70+ fantasy points of absolute error versus v0.4; one 2022 case adds nearly 70 points. This is inconsistent with a stable replacement point model.

## 2025 retrospective observation

2025 is inspected only after the pre-2025 disposition is fixed. On 106 paired TEs:

- `ridge_role` MAE: 27.03 vs v0.4 26.69
- RMSE: 37.17 vs 37.14
- Spearman: 0.7896 vs 0.7939
- top-12 overlap: 0.333 vs 0.333
- top-24 overlap: 0.792 vs 0.708
- fantasy-relevant MAE: 45.99 vs 44.82

The retrospective year does not overturn the pre-2025 rejection and was not used to tune anything.

## Candidate gate

A full-cohort challenger can become `READY FOR QA — HIGH RISK` only with:

- at least three evaluable chronological folds
- majority MAE fold wins versus validated v0.4
- either at least 3% mean MAE improvement or at least +0.04 mean Spearman improvement
- no MAE fold worse than -12%
- mean fantasy-relevant MAE gain no worse than -5%
- mean top-12 overlap delta no worse than -0.08
- mean top-24 overlap delta no worse than -0.08

No challenger passes.

## Deterministic evidence contract

The branch workflow:

1. restores the exact frozen v0.4 evidence artifact;
2. verifies the frozen input and comparator SHA-256 values;
3. installs pinned research dependencies;
4. runs the complete TE research twice;
5. requires byte-identical JSON output;
6. records the canonical result SHA-256 from the actual generated file;
7. enforces chronology, disposition, identity, and firewall assertions;
8. uploads the complete evidence package.

## Firewalls

- `experimental=true`
- `production_projection_eligible=false`
- `dynasty_value_eligible=false`
- no production changes
- no Core changes
- no UI changes
- no `main` changes
- no Dynasty Value changes
- no IDP changes

## Final disposition

**MORE TE RESEARCH REQUIRED**

Validated Projection v0.4 remains the TE point-projection control. The next justified TE research direction is richer chronology-safe role data—especially team context, target share, red-zone usage, snaps/routes, and role continuity—rather than another arbitrary receiving-stat boost.