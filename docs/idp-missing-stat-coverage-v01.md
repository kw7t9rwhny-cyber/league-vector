# IDP Missing-Stat Projection Coverage v0.1

## Scope and controls

Research-only HIGH-risk cycle based on validated PR #30 head `5550c83380432abce3ae0e68cc9d2daa0e720ea2`. PR #30's fail-closed scoring contract is immutable. No zero-fill, production scoring change, Dynasty Value, UI, Core, or main change is authorized.

Frozen input snapshot SHA-256: `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`. Model development uses 2020-2024 only. 2025 remains retrospective observed evidence only. Deterministic workflow `31830876463` ran the research twice from identical inputs and produced byte-identical output SHA-256 `8152cd3bcc2118a9b7d4fa8f9469e994ab9105e956afccb6d206917446ea4f53`.

The frozen weekly nflverse player-stat files contain player-level `def_sack_yards`, `def_interception_yards`, `def_punt_blocks`, `def_pat_blocks`, `def_fg_blocks`, `fumble_recovery_tds`, `fumble_recovery_yards_opp`, and `special_teams_tds`. Separate player-level special-teams forced-fumble and special-teams fumble-recovery fields are not present.

## Sleeper semantics used

Sleeper's documented scoring menu separates Special Teams Player from Special Teams Defense and lists IDP sack, blocked punt/PAT/FG, interception-return yards, fumble-return yards and pass defended as individual-player categories. The validated PR #30 contract freezes the ten internal league keys and weights. `bonus_sack_2p` is treated as a qualifying 2+ sack game bonus and `idp_pass_def_3p` as a qualifying 3+ passes-defended game bonus; these are modeled as discrete qualifying-game events, never by thresholding a fractional expected season total.

## Readiness matrix

| Key | Weight | Classification | Historical field/event | Pre-2025 evidence | Research decision |
|---|---:|---|---|---|---|
| `bonus_sack_2p` | 2 | **C — PROJECTABLE WITH A NEW VALIDATED MODEL** | weekly `def_sacks >= 2` qualifying game | unified chronological logistic Brier 0.0711 vs position-rate 0.0873; improved all 5 folds. Expected-count MAE 0.2569 vs naive season-threshold 0.2629. | **candidate for HIGH-risk QA** as expected qualifying-game count/probability; never threshold fractional sacks |
| `fum_rec_td` | 6 | **E — TOO SPARSE / TOO UNSTABLE TO PROJECT** | `fumble_recovery_tds` | positive player-season rate roughly 1.5-2.2% in development folds; prior/player features show negligible persistence | keep unsupported |
| `idp_blk_kick` | 3 | **E — TOO SPARSE / TOO UNSTABLE TO PROJECT** | `def_punt_blocks + def_pat_blocks + def_fg_blocks` | positive player-season rate ~6.4% DL, ~2% LB/DB; historical persistence weak and event-rate baseline is essentially as good as player modeling | keep unsupported |
| `idp_fum_ret_yd` | 0.1 | **E — TOO SPARSE / TOO UNSTABLE TO PROJECT** | `fumble_recovery_yards_opp` | zero has lower MAE than prior/count-rate/Ridge at DL/LB/DB; Ridge only modestly improves RMSE | keep unsupported; do not infer yards from recoveries |
| `idp_int_ret_yd` | 0.1 | **G — MORE RESEARCH REQUIRED** | `def_interception_yards` | data volume is meaningful for DB, but tested player-history/count-rate/Ridge models do not beat zero on MAE; Ridge improves DB RMSE/rank but is not enough for promotion | test a future model driven by validated projected INT probability/count rather than raw lag only |
| `idp_pass_def_3p` | 2 | **C — PROJECTABLE WITH A NEW VALIDATED MODEL** | weekly `def_pass_defended >= 3` qualifying game | unified chronological logistic Brier 0.0456 vs position-rate 0.0506, improved all 5 folds; expected-count MAE 0.1447 vs naive threshold 0.3208 | **candidate for HIGH-risk QA** as expected qualifying-game count/probability |
| `idp_sack_yd` | 0.1 | **B — PROJECTABLE NOW FROM EXISTING HISTORICAL DATA** | `def_sack_yards` | DL Ridge MAE 12.90 vs zero 16.56; LB 10.11 vs 12.23, stable across all five folds. DB zero wins MAE because median is zero, but Ridge improves RMSE 4.93 vs 5.54, produces useful rank correlation ~0.29, and removes the large negative zero bias. | **candidate for HIGH-risk QA** using position-aware direct/shrunk sack-yard expectation; no zero fallback |
| `st_ff` | 1 | **D — DATA SOURCE MISSING** | no separate player-level special-teams FF field in frozen weekly input | unavailable | keep unsupported; play-by-play derivation would require a separate identity/semantics audit |
| `st_fum_rec` | 1 | **D — DATA SOURCE MISSING** | no separate player-level special-teams fumble-recovery field in frozen weekly input | unavailable | keep unsupported |
| `st_td` | 6 | **E — TOO SPARSE / TOO UNSTABLE TO PROJECT** | `special_teams_tds` | only 55 IDP-position special-teams TDs in 2015-2024 frozen weekly data; pre-2025 player-season event rates ~0% DL, 0.5% LB, 0.9% DB | keep unsupported |

No category is classified A. None of these ten can be obtained exactly from the existing season-level projected IDP stat line without either a new projected statistic or a probability model for a discrete bonus.

## Threshold-bonus result

Naive thresholding is structurally wrong because Sleeper awards the bonus on discrete qualifying games/events. A player projected for 1.8 sacks cannot be treated as having either certainly earned or certainly missed a 2+ sack-game bonus. The candidate therefore predicts the expected number/probability of qualifying games from chronology-safe history and position.

For the 2+ sack-game event, Brier improved from 0.0873 to 0.0711 on average across 2020-2024 and improved in every fold. For the 3+ PD-game event, Brier improved from 0.0506 to 0.0456 in every fold. Expected-count modeling also materially outperformed naive thresholding for the PD bonus (0.1447 vs 0.3208 MAE).

The already-observed 2025 season is consistent but is not selection evidence: sack-bonus Brier 0.0673 vs 0.0821 position-rate baseline; PD-bonus Brier 0.0480 vs 0.0527. No architecture was changed based on these 2025 numbers.

## Sack-yard result

Sack yards are the most important missing category by historical Founder-weight contribution. Historical mean contribution across all IDP player-seasons is about 0.84 fantasy points per player-season, but is concentrated in DL/LB: ~1.53 DL, ~1.04 LB and ~0.17 DB.

Sack-yard-per-sack is positionally stable around roughly 6.6-6.9 yards per sack over the frozen sample. Direct Ridge using prior sacks, sack yards, games and tackle/opportunity history beats zero MAE in every 2020-2024 DL fold and every LB fold. For DB, the zero median forecast wins MAE because most DB seasons have zero sacks, but it is badly negatively biased; Ridge improves RMSE and ranking. This supports expected-value modeling, not a zero substitute.

Retrospective 2025 remains directionally consistent: DL Ridge sack-yard MAE 12.61 vs zero 15.08; LB 10.60 vs 12.56; DB Ridge MAE 2.70 vs zero 1.96 but RMSE 4.61 vs zero 5.31. No tuning used 2025.

## Continuous-return-yard findings

Interception-return yards are real and material for DBs: 3,279 DB interceptions and 42,275 DB return yards appear in the frozen 2015-2024 sample. However raw lag/count-rate/Ridge models do not beat zero on MAE because most individual player-seasons still have no interception return. Ridge does improve DB RMSE (21.51 vs 24.96) and rank correlation (~0.33), so the category remains worth research, but it does not clear the current promotion bar.

Fumble-return yards are much sparser. Zero wins MAE at DL/LB/DB; no tested expected-yard architecture clears promotion. The field exists, but existence is not predictability.

## Rare-event findings

Fumble-recovery TDs, blocked kicks and special-teams TDs are legitimate individual player events, but player-level persistence is weak. Historical event-rate/position priors perform approximately as well as more personalized history. Adding a tiny expected value to every player would technically be nonzero, but the cycle rejects that as insufficient evidence for a player-level projection feature.

Special-teams player FF and fumble recovery are not separately available in the frozen weekly player-stat schema. They must remain explicit data-source gaps; they cannot be inferred from defensive FF/recovery fields without play-level role attribution.

## Founder-like scoring impact

Historical average missing-category contribution under the frozen Founder weights, across all IDP player-seasons, is approximately:

1. `idp_sack_yd`: 0.843 points/player-season
2. `idp_int_ret_yd`: 0.551
3. `bonus_sack_2p`: 0.273
4. `idp_pass_def_3p`: 0.154
5. `fum_rec_td`: 0.142
6. `idp_fum_ret_yd`: 0.137
7. `idp_blk_kick`: 0.115
8. `st_td`: 0.034

`st_ff` and `st_fum_rec` cannot be estimated from this frozen schema without unsafe inference.

The three candidate categories (`idp_sack_yd`, `bonus_sack_2p`, `idp_pass_def_3p`) add on average about 2.08 historical points to DL, 1.43 to LB and 0.53 to DB under Founder weights. They modestly change ordering rather than rewrite it: historical supported-score vs supported+candidate rank correlation remains >0.9997 by position and average top-24 overlap remains ~98%.

That small aggregate rank movement does not make the categories dispensable. A nonzero active scoring category must either be modeled or remain an explicit blocker.

## Coverage after candidate categories

If the three passing categories later survive independent QA and Core experimental integration, individual-player key coverage would move from 12/22 (54.5%) to 15/22 (68.2%) by active-key count.

The Founder-like league would **still not be fully rankable** under the PR #30 contract because seven meaningful nonzero player categories would remain unsupported. The fail-closed gate must therefore remain intact.

## Core contract if QA later passes candidates

Core may eventually consume only the specific passed research outputs:

- `expected_2plus_sack_bonus_games` / probability metadata;
- `expected_3plus_pass_def_bonus_games` / probability metadata;
- `projected_sack_yards` with model version, position family, uncertainty and source snapshot hash.

Every output must carry `data_as_of`, model version, source snapshot SHA-256, supported position semantics, and uncertainty/provenance. No threshold may be applied directly to fractional projected sacks/PD. No missing category may be defaulted to zero.

Firewalls remain unchanged:

- `idp_dynasty_value_available=false`
- `dynasty_value=null`
- combined offense+IDP Dynasty rankings unavailable
- `production_projection_eligible=false`

## Readiness

Specific research candidates exist for `bonus_sack_2p`, `idp_pass_def_3p`, and `idp_sack_yd`. The other seven categories remain unsupported for the reasons above. These candidates do not make the full Founder scoring shape rankable and do not weaken PR #30's fail-closed completeness gate.
