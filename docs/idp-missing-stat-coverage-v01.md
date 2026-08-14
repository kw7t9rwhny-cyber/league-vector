# IDP Missing-Stat Projection Coverage v0.1

## Scope and controls

Research-only HIGH-risk cycle based on validated PR #30 head `5550c83380432abce3ae0e68cc9d2daa0e720ea2`. PR #30's fail-closed scoring contract is immutable. No zero-fill, production scoring change, Dynasty Value, UI, Core, or main change is authorized.

Frozen input snapshot SHA-256: `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`. Model development uses 2020-2024 only. 2025 remains retrospective observed evidence only. Hardened deterministic workflow `31831681111` established byte-identical result SHA-256 `13896f3d6bb0c6ed0d05b2fb5fc76f45760748251f6135ef0e4d291568f823c5`. The same analysis reran successfully on candidate-contract head `b43fe701c3ca1f07e67b75efdfc91310bea1cfc8` in workflow `31831920153`, again executing two identical runs from the frozen input.

The hardened source audit verifies that every required nflverse field used by this study is present and numeric in the frozen 2015-2025 weekly files. True numeric zero is recorded separately from unavailable/non-numeric state. If any required source value is unavailable the runner fails closed instead of coercing it to zero.

## Sleeper semantics

Sleeper's documented scoring menu separates IDP, Special Teams Player, Special Teams Defense, Team Defense and Miscellaneous scoring. The validated PR #30 scoring contract freezes the ten live player-level keys and weights. This research interprets `bonus_sack_2p` as the qualifying 2+ sack-game bonus and `idp_pass_def_3p` as the qualifying 3+ passes-defended-game bonus; they are discrete event bonuses and cannot be obtained by thresholding a fractional expected season total.

## Readiness matrix

| Key | Weight | Classification | Historical input | Pre-2025 result | Decision |
|---|---:|---|---|---|---|
| `bonus_sack_2p` | 2 | **G — MORE RESEARCH REQUIRED** | weekly `def_sacks >= 2` event | logistic Brier 0.0711 vs position-rate 0.0873, better in all 5 folds; however expected event-count MAE 0.2569 is worse than zero 0.1571 | probability signal is real, but not ready to add expected fantasy points |
| `fum_rec_td` | 6 | **E — TOO SPARSE / TOO UNSTABLE TO PROJECT** | `fumble_recovery_tds` | roughly 1-3% player-season event rate; prior-event prediction does not produce stable improvement | keep unsupported |
| `idp_blk_kick` | 3 | **E — TOO SPARSE / TOO UNSTABLE TO PROJECT** | `def_punt_blocks + def_pat_blocks + def_fg_blocks` | ~6% DL and ~2% LB/DB positive seasons; personalized history does not beat simple rates stably | keep unsupported |
| `idp_fum_ret_yd` | 0.1 | **E — TOO SPARSE / TOO UNSTABLE TO PROJECT** | `fumble_recovery_yards_opp` | zero has lower MAE than prior/count-rate/Ridge for DL/LB/DB | keep unsupported; never infer yards from recoveries |
| `idp_int_ret_yd` | 0.1 | **G — MORE RESEARCH REQUIRED** | `def_interception_yards` | meaningful DB/LB data and stable yards/INT rates, but tested player-history/count-rate/Ridge models do not beat zero MAE | future model should be driven by independently validated projected INT count/probability |
| `idp_pass_def_3p` | 2 | **G — MORE RESEARCH REQUIRED** | weekly `def_pass_defended >= 3` event | logistic Brier 0.0456 vs position-rate 0.0506, better all 5 folds; expected event-count MAE 0.1447 is worse than zero 0.0662 | probability signal is real, but not ready to add expected fantasy points |
| `idp_sack_yd` | 0.1 | **C — PROJECTABLE WITH A NEW VALIDATED MODEL** | `def_sack_yards` | all-position Ridge MAE ~8.06 vs zero ~9.49 and RMSE ~12.23 vs ~17.75; DL/LB improve strongly and sack-yards-per-sack is highly stable | **only current HIGH-risk QA candidate** |
| `st_ff` | 1 | **D — DATA SOURCE MISSING** | no separate special-teams-player FF field in frozen weekly schema | unavailable | keep unsupported |
| `st_fum_rec` | 1 | **D — DATA SOURCE MISSING** | no separate special-teams-player recovery field in frozen weekly schema | unavailable | keep unsupported |
| `st_td` | 6 | **E — TOO SPARSE / TOO UNSTABLE TO PROJECT** | `special_teams_tds` | only 55 IDP-position special-teams TDs in 2015-2024; player persistence is weak | keep unsupported |

No category is A. No missing event may be zero-filled merely to clear scoring coverage.

## Why sack yards pass the research gate

Sack yards are the largest of the currently missing Founder-weight categories by average historical contribution and have a stable physical rate. Across 2015-2024, yards per sack remain tightly centered around roughly 6.3-7.0 for DL/LB and similarly stable in aggregate. The tested Ridge uses only chronology-safe prior sacks, prior sack yards, prior games and prior tackle volume.

Across 2020-2024, the all-position Ridge reduces sack-yard MAE from approximately 9.49 (zero) to 8.06 and RMSE from 17.75 to 12.23. DL improves from roughly 16.56 zero MAE to 12.90 Ridge MAE; LB improves from roughly 12.23 to 10.11. DB is the explicit caveat: zero wins DB MAE because most DB player-seasons contain no sacks, while Ridge improves DB RMSE and provides nonzero ranking signal. This tradeoff must be independently reviewed rather than hidden.

At the Founder weight of 0.1 points per sack yard, historical mean contribution is about 1.53 points per DL season, 1.04 per LB season and 0.17 per DB season. The category is not a large ranking driver, but its underlying statistic is sufficiently predictable to justify a category-specific experimental model.

## Threshold bonuses are not ready

The first version of this cycle correctly rejected naive thresholding of fractional sack/PD projections, but it compared expected-count models only against naive threshold rules. The hardened rerun adds the required zero baseline.

For `bonus_sack_2p`, the probability model is genuinely better calibrated: Brier improves from 0.0873 to 0.0711 across development folds. But season event-count MAE is 0.2569 versus 0.1571 for zero. For `idp_pass_def_3p`, Brier improves from 0.0506 to 0.0456, yet event-count MAE is 0.1447 versus 0.0662 for zero.

These probability signals may eventually be useful for uncertainty or a better count distribution, but they do not currently demonstrate that adding expected fantasy points improves the point projection. They therefore remain unsupported under PR #30.

## Return-yard findings

Interception-return yards are historically available and material for DBs. DB return-yards-per-interception is stable around roughly 11-15 yards, with thousands of interceptions in the sample. However the tested player-level season models lose MAE to zero because interception occurrence dominates the problem. This should be revisited only by conditioning on an independently validated projected interception count/distribution.

Fumble-return yards are both less frequent and less stable. Zero wins MAE at every IDP position. The existence of the field is not enough to claim predictability.

## Rare-event findings

Fumble-recovery TDs, blocked kicks and special-teams TDs are legitimate player events, but simple player-history persistence is too weak to justify individual expected scoring. `st_ff` and `st_fum_rec` are not separately represented in the frozen weekly player-stat schema and must remain explicit data-source gaps.

## Founder-like scoring impact

Across 2015-2024 player-seasons, average historical contributions for the eight observable unsupported categories are approximately ordered as:

1. `idp_sack_yd` ~0.84 points/player-season
2. `idp_int_ret_yd` ~0.55
3. `bonus_sack_2p` ~0.27
4. `idp_pass_def_3p` ~0.15
5. `fum_rec_td` ~0.14
6. `idp_fum_ret_yd` ~0.14
7. `idp_blk_kick` ~0.12
8. `st_td` ~0.03

`st_ff` and `st_fum_rec` cannot be estimated safely from this schema.

Observed supported-only versus supported-plus-all-eight-observable scoring preserves >0.999 average rank correlation by position, with average top-24 overlap approximately 22.0 DB, 23.1 DL and 23.3 LB. The missing categories therefore modestly perturb ranking rather than dominate it. That does not authorize ignoring nonzero league settings; unsupported keys must still block exact scoring.

## Coverage consequence

If `idp_sack_yd` alone later survives HIGH-risk QA and Core experimental integration, player-relevant active-key coverage would move from 12/22 (54.5%) to 13/22 (59.1%). The Founder-like league would remain fail-closed because nine meaningful player keys would still lack approved projections.

## Frozen candidate contract

The only v0.1 candidate is `idp_sack_yd`:

- model family: position-aware Ridge expectation;
- target: season individual defensive sack yards;
- chronology: for season Y, train/features use only seasons < Y;
- features: prior sacks, prior sack yards, prior games, prior solo-tackle volume;
- nonnegative output sanitation only after model prediction;
- no zero fallback for missing source state;
- source snapshot SHA-256 and model version required on every artifact;
- 2025 remains retrospective observed evidence only;
- `experimental=true`;
- `production_projection_eligible=false`;
- `idp_dynasty_value_available=false`;
- `dynasty_value=null`.

PR #30's completeness gate is unchanged. Even if QA passes sack yards, the remaining unsupported keys still block exact Founder-like ranking.

## Readiness

`idp_sack_yd` is ready for independent HIGH-risk QA as a contained research candidate. The other nine categories are not.
