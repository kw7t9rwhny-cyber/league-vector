# Young-Player Development / Role-Growth Model v0.1

## Scope and controls

Research-only HIGH-risk cycle. Validated Projection v0.4 (`6d931abadbcb06e910bf953d941902c7c2cd1638`) is the immutable control. The study uses the exact validated frozen snapshot SHA-256 `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`. Model selection uses 2020-2024 evidence only. 2025 is retrospective observed evidence only and cannot affect feature choice, thresholds, architecture, or selection.

Exact deterministic evidence workflow: `31825417416`. Point-model output SHA-256: `fab2d81bdb5ee47e4fc1895a5b2c2704df523a0d16200b78e8813b84afd9487a`. Two-stage-role output SHA-256: `1198fc284e8182281273018c241c6572218fbecebb5fdb5ebee0786cb26196dd`. Both analyses were executed twice from identical frozen inputs and were byte-identical.

## Research question

Can chronology-safe historical signals already available to League Vector improve year-2, year-3, and year-4 QB/RB/WR/TE projections beyond validated v0.4 without arbitrary youth multipliers or historical point-in-time depth charts?

## Confirmed v0.4 young-player bias

Pre-2025 v0.4 bias remains heterogeneous rather than a universal youth effect. Negative bias means under-projection.

| Cohort | N | Bias | MAE |
|---|---:|---:|---:|
| QB year 2 | 37 | -32.33 | 66.64 |
| QB year 3 | 35 | +24.75 | 55.85 |
| QB year 4 | 36 | +10.30 | 61.33 |
| RB year 2 | 117 | -9.61 | 47.69 |
| RB year 3 | 118 | +7.17 | 38.95 |
| RB year 4 | 110 | +13.18 | 45.39 |
| WR year 2 | 155 | -9.14 | 36.59 |
| WR year 3 | 168 | -1.71 | 37.58 |
| WR year 4 | 144 | +5.40 | 41.19 |
| TE year 2 | 76 | -4.40 | 28.24 |
| TE year 3 | 84 | -6.30 | 22.92 |
| TE year 4 | 85 | -3.07 | 29.35 |

The data therefore does not support a single age/experience correction. Year-2 RB/WR/TE are generally under-projected, while year-3/4 RB and year-4 WR are over-projected on average.

## Features tested

The point-model benchmark tested regularized direct and residual corrections around validated v0.4 using feature-family ablations:

- prior opportunity and per-game opportunity;
- prior games/availability;
- target share / WOPR where available;
- late-season opportunity level and late-vs-early season opportunity growth;
- prior fantasy points per game and efficiency per opportunity;
- two-year historical production/opportunity;
- age and year in league;
- validated draft-capital fields (`log(draft_pick)` and drafted flag);
- a combined full feature family.

No target-season team or depth-chart feature was used because the frozen historical snapshot does not contain leakage-safe point-in-time preseason team/depth information.

## Point-model result

No QB/RB/WR/TE year-2, year-3, or year-4 candidate passed the pre-2025 selection gate. The gate required at least three folds, more fold wins than losses, >1% mean MAE improvement, positive median improvement, and no fold worse than -15% MAE gain.

The best feature families were still negative when averaged across eligible subgroups. Examples: Elastic Net + growth -10.44% mean MAE gain, residual growth -10.81%, Ridge growth -11.09%, Elastic Net opportunity -11.17%, Ridge opportunity -11.63%, Ridge age/experience -12.48%, Ridge draft -12.76%, and Ridge full -13.54%. Complexity did not earn its place.

Closest contained signals also failed stability. RB year-2 Elastic Net full was nearly neutral (-0.02% mean gain, 2/4 folds won). TE year-2 Ridge growth won 2/3 folds but averaged -1.00% because the losing fold erased the small wins. No subgroup was promoted.

Because no architecture passed on 2020-2024, the locked 2025 retrospective policy remains validated v0.4 for every subgroup; 2025 was not used to rescue or reject any architecture.

## The actual error mechanism: role transitions

The strongest finding is that v0.4 error is concentrated in players whose meaningful role changes, not in youth itself.

Using position-specific opportunity thresholds (QB 300 attempts; RB 150 carries+targets; WR 75 targets; TE 50 targets), pre-2025 prior-backup -> meaningful-role players were under-projected by:

| Transition | N | Mean v0.4 bias | MAE |
|---|---:|---:|---:|
| QB backup -> role | 6 | -153.5 | 153.5 |
| RB backup -> role | 22 | -105.8 | 105.8 |
| WR backup -> role | 24 | -85.1 | 85.6 |
| TE backup -> role | 13 | -68.7 | 68.7 |

The reverse error is also large. Prior-role -> backup players were over-projected by +110.3 QB (N=8), +67.3 RB (N=22), +81.4 WR (N=23), and +42.3 TE (N=7).

Stable backup -> backup populations are much easier: MAE is approximately 34.7 QB, 27.7 RB, 29.0 WR, and 17.0 TE. This strongly suggests that the missing predictive state is next-season role/opportunity, not a generic youth adjustment.

## Role survival and role expansion

A historical-only role classifier remains useful. Adding growth/draft/age/efficiency features is position-dependent rather than universally better.

For the narrower prior-backup -> meaningful-role expansion problem, mean pre-2025 AUC was:

| Position | Historical-only AUC | Rich AUC | Assessment |
|---|---:|---:|---|
| QB | .825 | .905 | promising but only 21 evaluated prior-backup cases across two folds |
| RB | .730 | .834 | meaningful improvement |
| WR | .838 | .830 | no improvement |
| TE | .881 | .799 | worse |

The enriched signal therefore appears useful for RB role expansion and possibly QB, but it does not generalize across positions.

## Two-stage role model

The cycle explicitly separated P(meaningful role) from production conditional on role. A role classifier was combined with separate Ridge production models for meaningful-role and low-role states.

That architecture did not beat v0.4 stably. Examples:

- RB year 2: historical two-stage -2.97% mean MAE gain; rich -6.00%.
- RB year 3: rich -4.71% despite one +18.86% fold.
- WR year 2: historical -9.64%; rich -12.42%.
- TE year 2: historical -4.64%; rich -5.61%.
- WR year 4 was close to neutral but still negative (-0.94% rich, 2/4 folds won).
- QB year-2 rich two-stage averaged +6.90%, but only two valid folds existed, which is below the evidence minimum and therefore not promotable.

Role probability is thus more defensible today as an uncertainty/risk signal than as a point-projection multiplier.

## Feature ablation conclusion

Opportunity, growth, draft capital, age/experience, and the combined feature family were all tested separately. No family produced a stable point-projection edge across experience/position subgroups. Late-season opportunity growth was the least-bad family in aggregate but still materially worse than v0.4 overall. This rejects an easy historical-only role-growth correction.

The result also explains why the earlier simple experience-bias correction failed: the average bias mixes true role promotions, true role losses, and stable-role players. Correcting all young players in the same direction amplifies errors for the large stable-role population.

## Established-veteran safety

Any hypothetical candidate in this study was scoped only to target-season experience 1-3. Established veterans were left exactly on validated v0.4. Therefore this cycle did not trade veteran performance for young-player improvement.

## What is still missing

The current historical feature set cannot reliably distinguish the small but high-error group that will gain or lose a role. Historical point-in-time preseason information remains the most plausible missing input: ordered depth chart, starter designation, current team/competition, injuries/PUP/IR, transactions, and vacated opportunity. Current Opportunity / Depth Chart Research v0.1 is separately documenting that data requirement.

This cycle quantifies the expected value of solving it: role flips are a small subset of players but create very large point errors, especially RB/WR year-2/3 cohorts.

## Core contract

No new point model should be integrated. Core should continue using validated v0.4 for year-2/3/4 veterans. If future opportunity research becomes validated, the appropriate additive contract is not a youth multiplier; it should expose explicit fields such as role-survival probability, role-expansion probability, expected opportunity, opportunity delta, source timestamp/quality, and uncertainty. Those fields must remain experimental until historical point-in-time validation succeeds.

Rookie Projection Research remains separate and should not be modified by this work.

## Readiness

No young-player point-projection candidate materially and stably beats validated v0.4. The evidence instead strengthens the hypothesis that current role/opportunity information is required to solve the largest young-player misses.

**MORE YOUNG-PLAYER PROJECTION RESEARCH REQUIRED**
