# League Vector Projection Research v0.4 Cycle 2

Status: **MORE PROJECTION RESEARCH REQUIRED**

Branch: `codex/projection-research-v04-cycle2`
PR: #17
Validated control: `6d931abadbcb06e910bf953d941902c7c2cd1638` (PR #16)

This cycle does not modify production projection behavior, Dynasty Value math, UI, IDP valuation, or Core branches. Validated v0.4 is treated as immutable control. All new model-selection evidence is pre-2025; 2025 remains `retrospective_observed` only.

Canonical frozen input snapshot SHA-256:
`d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`

## Executive conclusion

Cycle 2 found useful new evidence but **did not find a stable v0.4.1 replacement for validated v0.4 veteran projections**.

The most important positive findings are:

1. NFL draft capital is strongly predictive for zero-history rookies and materially beats a position-only historical rookie prior across every 2018-2024 development cohort tested.
2. Whole-player empirical uncertainty can be calibrated approximately to nominal 80% coverage, but the intervals are wide and player-type dependent.
3. Role-survival probability is chronologically predictable, but converting that probability into a two-stage point forecast makes point accuracy worse. The signal appears more useful for uncertainty/confidence than for direct point adjustment.
4. Validated v0.4 still systematically under-projects several young groups, especially first-year-history RB/WR and year-2/year-3 TE, but simple experience corrections and dedicated second-year models are too unstable to promote.

The most important negative result is that **multiple intuitive TE fixes failed**. Direct whole-player Ridge, target-specific opportunity/experience Ridge, simple role-growth features, explicit second-year handling and two-stage role-survival point models all fail to beat validated v0.4 stably on pre-2025 folds.

Therefore the recommended architecture remains:

- QB veteran: validated v0.4 transparent baseline policy;
- RB veteran: validated v0.4;
- WR veteran: validated v0.4;
- TE veteran: validated v0.4 with ranking caveat;
- rookies: continue research on a separate draft-capital prior/model;
- limited history: keep conservative v0.4 fallback; no dedicated replacement yet;
- uncertainty: continue toward an experimental display/risk contract.

## TE root-cause findings

Validated v0.4 TE error is not explained by one missing age curve.

Pre-2025 age buckets show younger TEs are mildly under-projected while older TEs are materially over-projected:

| Age | N | Bias (pred-actual) | MAE |
|---|---:|---:|---:|
| <=23 | 31 | -2.42 | 31.30 |
| 24-25 | 139 | -4.34 | 26.76 |
| 26-27 | 141 | +0.98 | 26.10 |
| 28-29 | 99 | -1.77 | 29.66 |
| 30-31 | 60 | **+15.99** | 34.86 |
| 32+ | 40 | **+8.37** | 30.70 |

Experience shows a related but non-identical pattern:

- year-2 TE: N=76, bias -4.40;
- year-3 TE: N=84, bias -6.30;
- year-4 TE: N=85, bias -3.07;
- year-5/6 TE: N=117, bias +3.66;
- year-7+ TE: N=148, bias +8.62.

Opportunity stability is an even larger error driver. Prior-target quartile MAE rises from ~13.3 in the lowest quartile to ~44.7 in the highest quartile. Sharp target-role changes in either direction produce ~38-point MAE, versus ~18.9 for flat prior roles. One-year production spikes/collapses are similarly difficult.

Interpretation: **TE error is dominated by role persistence/instability plus veteran persistence, not just TD randomness or one generic age effect.**

## TE specialized model tests

Direct whole-player Ridge families all lost to validated v0.4 on average across 2020-2024. The best tested family, age + experience + opportunity, won only 2/5 folds and averaged roughly -1.8% MAE improvement (i.e. a regression).

Target-specific receiving models also failed. The strongest tested role-growth target family won only 2/5 folds and averaged about -2.1% MAE versus validated v0.4. Opportunity + age + experience averaged about -2.6% and also won 2/5.

A dedicated second-year TE model was directionally interesting: 4/5 fold wins and median improvement ~+4%, but one fold regressed ~33%, leaving mean performance slightly worse than control. It is rejected for promotion because one catastrophic fold dominates the apparent benefit.

**Best TE candidate: validated v0.4 remains the control and recommended architecture.** No Cycle 2 TE challenger clears the promotion gate.

The already-known 2025 top-24 regression remains retrospective evidence only and was not optimized against.

## Rookie data and draft capital

The frozen nflverse player directory contains:

- `rookie_season`;
- `draft_year`;
- `draft_round`;
- `draft_pick`;
- birth date / age;
- position and team identity fields.

This is enough to build a conservative rookie prior without college production or proprietary dynasty rankings.

Current licensing posture is research-safe but still requires production provenance discipline: covered nflverse stats are CC BY 4.0 with attribution; nflverse player identity/component provenance varies and must be preserved/verified before production dependency. No paid data, scraped dynasty rankings, college production, athletic testing, or proprietary projections were added.

## Rookie backtest

Chronological rookie cohorts used earlier rookie classes to predict season Y. Development evidence uses 2018-2024; 2025 is retrospective only.

Development cohort totals are approximately:

- QB: 62 rookie seasons;
- RB: 217;
- WR: 289;
- TE: 126.

Against a simple prior-cohort position mean, draft-capital Ridge won **every development fold** for every position.

| Pos | Best simple draft model | Mean MAE | Mean RMSE | Mean Spearman | Mean MAE gain vs cohort mean |
|---|---|---:|---:|---:|---:|
| QB | draft Ridge | 56.21 | 69.13 | 0.664 | ~33.7% |
| RB | draft + age Ridge | 37.66 | 50.41 | 0.583 | ~31.9% |
| WR | draft + age Ridge | 36.50 | 51.24 | 0.699 | ~30.0% |
| TE | draft + age Ridge | 22.65 | 33.35 | 0.643 | ~28.6% |

A nonlinear round-bucket model also beat the cohort mean in every fold, confirming that the signal is not dependent on one Ridge specification. It usually trails the continuous draft-capital model slightly on MAE.

Draft age adds only modest incremental value and is not uniformly necessary. Draft capital is the dominant approved pre-NFL signal in the current repository data.

### Rookie readiness

This is strong enough to justify **continued experimental rookie-model development**, but not yet a general product candidate. QB has only ~62 development rookie seasons and year-to-year samples are very small. RB/WR have the best sample depth. TE draft capital is surprisingly informative but TE remains inherently volatile.

No rookie model should claim veteran-level confidence.

## Rookie uncertainty

Rolling empirical 80% intervals around the draft-capital rookie model produced approximate development coverage:

- QB: ~81%, mean full width ~174 fantasy points;
- RB: ~78%, width ~112;
- WR: ~76%, width ~100;
- TE: ~84%, width ~84.

The widths are large, which is a feature rather than a bug: rookie point estimates contain much more uncertainty than a polished single number suggests.

A future rookie output should expose a wide range/confidence tier rather than imply exact precision.

## Limited-history and young-player findings

Validated v0.4 remains uneven by history depth. Pre-2025 point-bias evidence by NFL experience:

- QB year 2: -32.3 points average bias (under-projection; N=37);
- RB year 2: -9.6 (N=117);
- WR year 2: -9.1 (N=155);
- TE year 2: -4.4 (N=76);
- TE year 3: -6.3 (N=84).

That confirms an upstream projection issue for some young populations. However, simply applying experience-group bias corrections fails overall: QB/RB/TE regress, and only WR is directionally positive (~+1.6% mean MAE with 3/4 wins).

Dedicated second-year Ridge models are also not ready:

- QB: 1/5 wins, ~-23.8% mean MAE change;
- RB: 2/5, ~-6.6%;
- WR: 1/5, ~-9.7%;
- TE: 4/5 but ~-1.2% mean because of one ~-32.8% collapse.

**Conclusion:** young-player under-projection is real, but the tempting simple corrections overfit or destabilize other folds. Keep the problem visible for Dynasty Value audit, but do not alter Dynasty Value or veteran projections from these results.

## Role survival

A conservative meaningful-role definition was pre-specified by position from historical opportunity (QB attempts; RB carries+targets; WR/TE targets).

Chronological logistic role-survival models beat a simple prior-role persistence baseline on Brier score in all five evaluated folds at every position:

| Pos | Fold wins | Mean Brier gain | Mean AUC |
|---|---:|---:|---:|
| QB | 5/5 | ~18.0% | 0.861 |
| RB | 5/5 | ~21.5% | 0.872 |
| WR | 5/5 | ~24.6% | 0.911 |
| TE | 5/5 | ~18.6% | 0.898 |

This is one of the strongest new signals in Cycle 2.

However, a two-stage expected-point model (`P(role) * role production + P(no role) * low-role production`) loses MAE versus validated v0.4 overall at every position. Therefore **role-survival probability should be researched as uncertainty/risk metadata, not automatically multiplied into point projections.**

## Availability

Simple `expected games x expected fantasy points per game` is not a general improvement:

- QB: ~-2.5% mean MAE, only 2/5 wins;
- RB: ~+1.2%, 3/5 wins;
- WR: ~-0.4%, 3/5;
- TE: ~-2.1%, 1/5.

No exact-injury or exact-games forecast is justified. Past availability can inform uncertainty, but the direct season-total v0.4 architecture remains better overall.

## Whole-player uncertainty

Rolling empirical absolute-residual intervals around validated v0.4 can get close to nominal 80% coverage:

| Position | Position-only coverage | History-conditioned coverage | Typical full width |
|---|---:|---:|---:|
| QB | 78.6% | 80.8% | ~199-211 |
| RB | 81.8% | 82.6% | ~162-165 |
| WR | 80.6% | 79.0% | ~132-135 |
| TE | 84.4% | 85.9% | ~97 |

History conditioning is not universally superior. For example, one-year RB coverage is only ~64% with a ~104-point width, while 3+ year RB coverage is ~87% at ~182 points. This shows that a single position-wide confidence number is inadequate.

**Readiness:** whole-player uncertainty is promising for experimental display/risk tiers, but it is not calibrated tightly enough to mathematically discount Dynasty Value yet.

## Breakout and collapse predictability

Definitions were set before classifier testing:

- breakout = next-season fantasy-point increase >=50;
- collapse = decrease <=-50.

Breakout prediction is weak:

- QB AUC ~0.585;
- RB ~0.578;
- WR ~0.616;
- TE ~0.554.

Do not build a flashy breakout model from this evidence.

Collapse risk is much more predictable:

- QB AUC ~0.807;
- RB ~0.854;
- WR ~0.814;
- TE ~0.881.

This supports collapse/role-loss risk as an **uncertainty feature**, not as a deterministic point penalty.

## Outliers

The worst 10% of validated-v0.4 player-season misses account for roughly 30-33% of total absolute error at every position:

- QB ~32.1%;
- RB ~33.3%;
- WR ~30.1%;
- TE ~32.1%.

Maximum pre-2025 absolute misses exceed 300 points for QB/RB and 260 for WR. This strongly favors range-of-outcome modeling over aggressive hard caps.

Huber/Ridge residual-correction layers do not solve the problem consistently. Small QB/WR gains are offset by instability, while RB/TE regress. Universal robust correction is rejected.

## Rejected model families / ideas

Cycle 2 explicitly rejects automatic promotion of:

- direct whole-player TE Ridge;
- target-specific TE opportunity/experience Ridge;
- TE role-growth Ridge;
- generic second-year models;
- experience-group bias correction;
- exact-games x per-game decomposition;
- two-stage role-survival point forecasts;
- universal Huber/Ridge residual correction;
- breakout classifier as a product projection model.

These are durable negative results, not discarded experiments.

## Recommended position policy after Cycle 2

| Population | Recommendation |
|---|---|
| QB veteran | keep validated v0.4 control |
| RB veteran | keep validated v0.4 control |
| WR veteran | keep validated v0.4 control |
| TE veteran | keep validated v0.4 control; ranking/role uncertainty remains caveat |
| zero-history RB/WR rookie | draft-capital prior is promising enough for next experimental candidate cycle |
| zero-history QB rookie | continue research; sample is small |
| zero-history TE rookie | continue research; draft signal exists but uncertainty is high |
| one/two-year players | no separate replacement yet; retain conservative fallback |
| uncertainty | continue toward whole-player empirical interval + risk tier contract |

## Implications for the separate Dynasty Value audit

Projection Research can now say with evidence:

1. Some young-player undervaluation may originate upstream. Validated v0.4 under-projects first-year-history RB/WR and year-2/year-3 TEs on average.
2. The correct response is **not** to blindly add a young-player Dynasty Value multiplier. Simple experience corrections do not improve projection accuracy consistently.
3. Veteran TE over-projection is concentrated in older/high-opportunity/unstable-role groups, so TE Dynasty Value errors may partly reflect projection persistence rather than only scarcity math.
4. Rookie point forecasts should carry substantially wider uncertainty than veteran forecasts. Any Dynasty Value treatment that consumes them later must preserve that uncertainty.
5. Collapse/role-loss risk is much more predictable than breakouts and could eventually inform confidence, but is not ready as a direct Dynasty Value penalty.

## Product/Core contract research

If these findings are later integrated experimentally, Core should receive a projection object capable of carrying:

```text
point_projection
low_estimate
high_estimate
interval_nominal_coverage
uncertainty_tier
model_family
history_depth
rookie_flag
limited_history_flag
role_survival_probability   # experimental metadata only
projection_eligibility
confidence_notes
source_snapshot_sha256
model_version
```

`role_survival_probability` and intervals must not automatically alter production Dynasty Value without a separate validated valuation study.

## Data / licensing gaps

No paid or proprietary data was required for this cycle. Draft capital/rookie year/age are present in the frozen nflverse player directory. Before production use, exact player-directory component provenance and attribution must be pinned according to the existing licensing matrix.

Potential future rookie improvements such as college production, athletic testing, routes/snaps, or external prospect grades require a separate legally approved data-source decision. Nothing was scraped or purchased here.

## Reproducibility

Durable machine-readable checkpoints:

- `data/research/projection-v04-cycle2-checkpoint1.json`
- `data/research/projection-v04-cycle2-checkpoint2.json`
- `data/research/projection-v04-cycle2-checkpoint3.json`

Reproducible runner:

- `scripts/projection-v04-cycle2-analysis.py`
- `.github/workflows/projection-v04-cycle2.yml`

The workflow consumes the exact frozen validated-v0.4 artifact rather than refreshed upstream nflverse data, verifies the canonical snapshot and control output hash, runs Cycle 2 twice, and requires byte-identical output. This was necessary because nflverse upstream history changed after the validated v0.4 snapshot; Cycle 2 correctly fails closed rather than silently changing the control dataset.

## Readiness decision

**Does a v0.4.1 veteran candidate beat validated v0.4?** No. None of the TE/limited-history/role/availability/outlier challengers clears the stability gate.

**Is a rookie research framework promising?** Yes. Draft capital is a large, stable improvement over a naive rookie cohort mean, especially with RB/WR sample sizes. It deserves a separate candidate cycle with additional baseline definitions, uncertainty calibration and deterministic QA.

**Is whole-player uncertainty promising?** Yes, for experimental display/risk metadata. Not yet for valuation discounting.

**Production promotion?** No. All flags remain `experimental=true`, `production_projection_eligible=false`, `dynasty_value_eligible=false`.

## Exact next priorities

1. Build a dedicated rookie v0.1 candidate using draft capital with RB/WR first, including nonlinear baseline comparison, uncertainty and current 2026 rookie identity/eligibility checks.
2. Calibrate whole-player uncertainty with conditional/group-aware or conformal methods, especially one-year RB/WR and rookies.
3. Research role-survival probability as a risk tier/interval-width input rather than as point-value multiplication.
4. Continue TE role-stability research only if legally approved snaps/routes/participation data becomes available; current stat-only feature families are exhausted enough to reject more ad-hoc complexity.
5. Preserve 2026 actual outcomes as the next genuinely future evaluation opportunity once the season is complete; pre-register any candidate before using those outcomes.

**MORE PROJECTION RESEARCH REQUIRED**
