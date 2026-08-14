# IDP Missing-Stat Coverage Research v0.2

Status: **RESEARCH CHECKPOINT — NO NEW SCORING CANDIDATE**.

This cycle starts from QA-approved missing-stat research head `fe936d37f346e3e8b027e33964e272dd34b04e9b`. The approved `idp_sack_yd` DL/LB candidate is an immutable control and is not changed here. DB remains unsupported for sack yards.

Frozen historical input SHA-256: `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`. Architecture/model selection uses 2020–2024 only. 2025 remains `retrospective_observed` and is not used for tuning.

## Readiness matrix

| Category | Result | Source availability | Main v0.2 finding |
| --- | --- | --- | --- |
| `idp_int_ret_yd` | UNSUPPORTED — ZERO BASELINE WINS | `def_interceptions`, `def_interception_yards` | Occurrence/count + conditional-yards, hurdle, rate and direct Ridge models all lose scoring MAE to zero for DL/LB/DB. |
| `bonus_sack_2p` | UNSUPPORTED — ZERO BASELINE WINS | weekly `def_sacks >= 2` | Poisson, negative-binomial and hurdle expected counts do not beat zero fantasy-point MAE for any position family. |
| `idp_pass_def_3p` | UNSUPPORTED — ZERO BASELINE WINS | weekly `def_pass_defended >= 3` | Discrete count variants retain rank/probability signal but do not beat zero scoring MAE. |
| `fum_rec_td` | UNSUPPORTED — ZERO BASELINE WINS | `fumble_recovery_tds` | Event is sparse and all tested nonzero expected-count outputs lose to zero scoring MAE. |
| `idp_fum_ret_yd` | UNSUPPORTED — ZERO BASELINE WINS | `fumble_recovery_opp`, `fumble_recovery_yards_opp` | Direct Ridge/count-rate/prior models lose to zero scoring MAE in DL/LB/DB. |
| `idp_blk_kick` | UNSUPPORTED — ZERO BASELINE WINS | `def_punt_blocks`, `def_pat_blocks`, `def_fg_blocks` | Position dependence exists, especially DL, but predictive scoring MAE still loses to zero. |
| `st_td` | UNSUPPORTED — ZERO BASELINE WINS | `special_teams_tds` | Extremely sparse; zero remains dominant. |
| `st_ff` | UNSUPPORTED — DATA BLOCKED | no separate player-level field | Do not proxy from defensive forced fumbles. |
| `st_fum_rec` | UNSUPPORTED — DATA BLOCKED | no separate player-level field | Do not proxy from defensive fumble recoveries. |

## Development prevalence

Pre-2025 player-season samples are 2,963 DL, 2,908 LB and 3,880 DB. Positive player-season rates:

- interception-return yards: DL 3.17%, LB 14.61%, DB 32.09%;
- 2+ sack-game bonus events: DL 17.75%, LB 11.97%, DB 0.67%;
- 3+ pass-defended-game bonus events: DL 0.64%, LB 1.65%, DB 13.69%;
- fumble-recovery TD: DL 2.16%, LB 2.54%, DB 2.11%;
- fumble-return yards: DL 5.33%, LB 8.08%, DB 7.45%;
- blocked kick: DL 6.21%, LB 2.34%, DB 2.04%;
- special-teams TD: DL 0.07%, LB 0.48%, DB 0.95%.

These prevalence differences reinforce position-specific modeling, but prevalence alone does not justify a scoring output.

## Interception-return-yard architecture

v0.2 explicitly separates interception opportunity from conditional return yards. Tested chronological architectures include direct regularized return-yard regression, prior interceptions multiplied by historical conditional yards per interception, Poisson expected interception count multiplied by conditional return-yard rate, and a hurdle occurrence model multiplied by conditional return-yard expectation.

The best tested nonzero scoring MAE still loses to zero in every position family and wins **0/5 folds** against zero. Mean fantasy-point MAE under the Founder-like `0.1` yards weight is approximately:

- DB: zero 1.0767 vs best nonzero Ridge 1.4233;
- LB: zero 0.3542 vs best nonzero Ridge 0.5536;
- DL: zero 0.0454 vs best nonzero Ridge 0.0884.

Therefore v0.2 does not authorize projecting positive interception-return yards merely because a statistical model emits a positive expectation.

## Threshold-event count architecture

For `bonus_sack_2p` and `idp_pass_def_3p`, v0.2 tests position-specific Poisson, fixed-dispersion negative-binomial, hurdle occurrence/positive-count, prior-count and position-mean outputs. Probability/rank signal is retained as research context only. Readiness is governed by actual expected scoring contribution MAE.

For 2+ sack games, zero fantasy-point MAE remains better than the best nonzero output for DL, LB and DB, with the best nonzero model winning 0/5 folds in each position. The same 0/5 result holds for 3+ PD games.

No threshold scoring output is authorized.

## Rare-event evidence

`fum_rec_td`, `idp_fum_ret_yd`, `idp_blk_kick`, and `st_td` have real historical player-level fields, but the zero baseline remains stronger on scoring-output MAE in every DL/LB/DB gate tested. This cycle does not force a sparse model into support simply because a source field exists.

`st_ff` and `st_fum_rec` remain data-blocked because the frozen weekly schema does not contain separate player-level special-teams forced-fumble or fumble-recovery fields. Defensive fields are not accepted as proxies.

## Missing-state contract

Numeric `0` is a valid observed value. Missing, null, unavailable, and non-numeric states are distinct from zero. Required source fields are audited before annualization/modeling. Any unavailable required value fails closed; no preprocessing path may coerce it to zero.

## Global scoring gate and firewalls

No v0.2 result broadens global scoring support. `idp_sack_yd` remains only partial-position support for DL/LB because DB is unavailable. Founder-like full scoring remains fail-closed and not rankable whenever any meaningful required player-level category is unavailable.

Permanent firewalls remain `experimental=true`, `production_projection_eligible=false`, `idp_dynasty_value_available=false`, `dynasty_value=null`, combined offense+IDP Dynasty rankings unavailable. No Core, UI, production, deployment or `main` activation is authorized.

## Determinism

The v0.2 workflow restores two clean copies of the same frozen input, runs the complete analysis independently with pinned dependencies/single-threaded numeric settings, requires byte-identical canonical JSON, hashes the exact canonical artifact, and uploads the result plus an ephemeral workflow manifest. The QA-approved v0.1 sack-yard research files are not modified by this cycle.
