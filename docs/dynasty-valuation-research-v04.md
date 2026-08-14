# Dynasty Valuation Research v0.4 — Expected Positive Utility

Status: HIGH-RISK RESEARCH ONLY

Branch: `codex/dynasty-valuation-research-v04`

Frozen historical snapshot SHA-256:
`d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`

Deterministic v0.4 result SHA-256:
`fab359c51596e93762e437ad4795b0d8837c2f1a0fc67deb8d3e54cdca831dd1`

GitHub Actions evidence run: `31833785476`
Artifact: `league-vector-dynasty-valuation-v04-expected-utility`

## Firewalls

- `experimental=true`
- `production_dynasty_value_eligible=false`
- `idp_dynasty_value_available=false`
- no production UI changes
- no production formula changes
- no merge

## Starting defect from v0.3

The deterministic clipped-surplus primitive

`max(0, E[points] - replacement)`

collapsed most 2022 players to exactly zero. In standard 1QB, the diagnostic zero shares were approximately 95% QB, 87% RB, 95% TE, and 87% WR. This makes it unsuitable as a complete dynasty asset value even where elite-player ordering is useful.

The research therefore tested the mathematically different quantity:

`E[max(points - replacement, 0)]`.

No arbitrary minimum value, youth bonus, upside multiplier, or output cap was added.

## Corrected uncertainty construction

An earlier v0.3 expected-positive experiment was rejected because it added residuals from a conditional-on-relevance model to a survival-weighted mean. Those quantities belong to different distributions.

v0.4 instead models a relevance-state mixture:

`P(relevant) * E[max(X_relevant - R, 0)]`
`+ (1 - P(relevant)) * E[max(X_nonrelevant - R, 0)]`.

Position-specific feature contracts from v0.3 remain in force. Empirical fantasy-point and reception residuals are paired within each state. TE premium is scored inside each sampled state outcome rather than applied as a universal TE multiplier.

## Chronology and replacement

Valuation folds modeled: 2020, 2021, 2022.

Modeled horizons: H2, H3, H4 where identifiable.

H5 is explicitly unavailable from the frozen 2015–2025 history under the required chronology, state-specific training, and fully observed outcome rules. It is not treated as evidence for or against a five-year horizon.

Predicted replacement uses the expanding historical median of actual point-in-time replacement levels from seasons strictly before the valuation season. The realized validation target uses the actual target-season player pool only.

No historical depth chart/opportunity state is backfilled using hindsight.

## 2022 candidate-vs-control result

The distribution-aware model removes zero compression but does not dominate the clipped-expectation control on realized future football utility.

| League format | Distribution-aware Spearman | Clipped-expectation Spearman | Distribution zero share | Clipped zero share |
| --- | ---: | ---: | ---: | ---: |
| 1QB standard | 0.5731 | 0.6278 | 0.000 | 0.895 |
| Superflex | 0.5975 | 0.6557 | 0.000 | 0.872 |
| 2QB-like | 0.6026 | 0.6592 | 0.000 | 0.871 |
| Deep FLEX | 0.6312 | 0.6353 | 0.000 | 0.840 |
| Shallow | 0.5237 | 0.4876 | 0.000 | 0.934 |
| TE premium +0.5 | 0.5733 | 0.6275 | 0.000 | 0.895 |
| TE premium +1.0 | 0.5758 | 0.6204 | 0.000 | 0.897 |
| 2TE | 0.5967 | 0.6574 | 0.000 | 0.869 |
| 2TE +0.5 premium | 0.6001 | 0.6655 | 0.000 | 0.869 |

Interpretation: uncertainty propagation is valuable for preserving nonzero option value, but the current empirical residual construction spreads too much undifferentiated tail value across the player pool and weakens ordering in most formats. This must not be fixed by tuning residual variance or adding coefficients until rankings resemble consensus.

## Position diagnostics

In 2022 standard 1QB, distribution-aware position Spearman was approximately:

- QB: 0.486
- RB: 0.547
- WR: 0.625
- TE: 0.555

The clipped control was approximately:

- QB: 0.499
- RB: 0.563
- WR: 0.734
- TE: 0.588

In Superflex the distribution-aware QB correlation increased to about 0.607, showing that league-specific QB replacement still changes the signal in the expected direction, but the clipped QB control remained stronger at about 0.653.

In 2TE +0.5 premium, TE correlation rose to about 0.688 distribution-aware versus about 0.740 clipped. TE value therefore emerges from scoring plus starter demand plus replacement; no universal TE boost is supported.

## Horizon evidence

On the 2022 three-year realized-utility target, distribution-aware H3 ranks better than H2 across all tested league formats, e.g.:

- 1QB: H2 0.5577 -> H3 0.5731
- Superflex: H2 0.5784 -> H3 0.5975
- 2QB-like: H2 0.5842 -> H3 0.6026
- Deep FLEX: H2 0.6212 -> H3 0.6312
- Shallow: H2 0.4887 -> H3 0.5237

These are not sufficient to choose H3 over H4 because each horizon must ultimately be compared against a common realized utility target on the same eligible folds. Prior corrected v0.3 evidence found little incremental rank information beyond H2–H3 and inconsistent H4 benefit. v0.4 does not overturn that conclusion yet.

## Discounting

At the short identifiable horizons, previous corrected v0.3 work found 0.80/0.90/1.00 weighting produced nearly identical rank ordering. v0.4 retains those weights only for sensitivity. No discount coefficient is promoted as a magic number.

## Youth

Expected-positive utility prevents young below-replacement players from being mechanically forced to zero. Matched-Y1 projection diagnostics show nonzero separation between some young and older cohorts, especially higher-current-utility QB/RB/WR bands.

However, many low/mid bands still have realized median future surplus of zero for both groups. The present uncertainty model therefore cannot be claimed to have solved youth valuation. A stronger solution likely requires calibrated player-specific predictive distributions rather than applying a common empirical residual distribution within position/relevance state.

## TE premium and starter demand

TE premium is scored from receptions inside each outcome distribution. 2TE and premium formats increase TE expected positive surplus naturally through both scoring and replacement demand. No TE multiplier is used.

The current model still loses TE rank signal versus the clipped control, so this is architecture evidence, not a frozen TE candidate.

## FLEX and Superflex

Prior v0.3 ablation found endogenous FLEX generally failed to improve over the simpler production-equivalent fixed FLEX allocation. v0.4 therefore keeps fixed FLEX as the control rather than adding complexity without evidence.

Superflex/2QB league-specific replacement continues to increase QB economic value naturally. No QB multiplier is required.

## Market anchor

Market weight remains exactly `0.0` in this research cycle.

The repository still lacks leakage-safe historical point-in-time dynasty market snapshots. Therefore a formal historical comparison of pure football-derived value versus weak market prior versus market-centered architecture cannot be run without leakage. Current market values must not be retroactively used as if they existed in old valuation seasons.

This means an external dynasty market baseline is **not mathematically required** to construct League Vector value, but its possible incremental stability/information value remains unproven rather than disproven.

## Current best interpretation

Two candidate primitives each capture useful but incomplete information:

1. `max(E[points]-R, 0)` preserves stronger ordering but destroys value resolution for most of the player pool.
2. `E[max(points-R, 0)]` preserves option/upside value but currently weakens ordering because the predictive distribution is not sufficiently player-specific/calibrated.

The next defensible research question is not an arbitrary blend coefficient. It is whether a calibrated distribution model can predict both central future utility and probability/magnitude of beating replacement without assigning generic residual option value to every player.

Potential approaches for a future cycle include leakage-safe quantile/distributional models, calibrated probability-of-beating-replacement targets, or direct expected-positive-surplus models. Any approach must remain position-specific, chronological, and league-specific.

## Unresolved before QA

- common-target H2/H3/H4 comparison under the corrected expected-utility construction
- player-specific uncertainty calibration
- probability-of-beating-replacement calibration by position/horizon
- youth cohort validation after uncertainty calibration
- QB long-horizon calibration without runaway summed value
- RB shorter-horizon validation
- TE persistence/age calibration
- shallow-league regression behavior
- stable display/trade-value scale separate from raw football utility
- leakage-safe historical market snapshots if market-anchor ablation is ever to be tested
- QA-approved rookie projection/distribution contract

## Decision

The v0.4 expected-positive utility experiment is a useful negative/partial result, not a frozen candidate. It fixes zero compression but sacrifices too much realized-utility ordering to justify HIGH-risk QA.

MORE DYNASTY VALUATION RESEARCH REQUIRED
