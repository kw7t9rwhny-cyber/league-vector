# League Vector Rookie Projection Research v0.1

Status: research-only HIGH-risk checkpoint. Validated veteran v0.4 remains unchanged. `experimental=true`, `production_projection_eligible=false`, `dynasty_value_eligible=false`. 2025 remains `retrospective_observed` only.

## QA provenance remediation

PR #18 failed HIGH-risk QA at `99bcf3162e0708af0b761d4b983592c5327b9691` because the old runner audited identity after rookie filtering and treated missing `draft_pick` operationally as undrafted without proving that state. This remediation changes data validation/cohort eligibility only; it does not change the candidate model family, hyperparameters, scoring target, or selection objective to preserve results.

Exact frozen input remains composite SHA-256 `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`.

## Source → player identity contract

Identity is audited before any rookie-season filtering. The frozen source contains 6,596 QB/RB/WR/TE player-seasons and 1,897 unique source player IDs. The source-to-`players.csv` join is `many_to_one player_id -> gsis_id` and now fails closed on any unmatched offensive row because an unmatched row could otherwise hide a rookie whose `rookie_season` metadata is unavailable.

Frozen-input result:
- source rows with missing player ID: 0
- duplicate source player-seasons: 0
- duplicate `players.csv` GSIS identities: 0
- missing `players.csv` GSIS identities: 0
- unmatched offensive source rows: 0

## Draft-state contract

The old assumption `missing draft_pick => undrafted` is removed.

Each row is classified before modeling:
- `CONFIRMED_DRAFTED`: draft year, round, and overall pick are all present and pass integrity checks.
- `UNRESOLVED_MISSING`: draft year, round, and overall pick are all absent.
- inconsistent states: partial metadata, non-integer/out-of-range values, draft-year/rookie-season mismatch, duplicate ordinary overall pick, or impossible ordinary round/pick ordering.
- supplemental selections encoded by this source as later-round `pick=1` are detected separately and are not silently treated as ordinary overall draft picks.

The frozen `players.csv` contains no independent explicit UDFA marker. Therefore **zero rows are labeled confirmed undrafted** in v0.1. All-missing draft metadata stays unresolved and is excluded from model evidence. This is deliberately conservative: v0.1 would rather lose sample size than convert unknown provenance into a false UDFA label.

Raw QB/RB/WR/TE rookie frame: 1,096 player-seasons. It contains 726 complete ordinary drafted rows and 370 all-missing/unresolved rows. In the 2018–2024 development window, 228 unresolved rows are excluded. No unresolved draft metadata reaches fitting or evaluation.

Draft integrity checks also enforce:
- `draft_year == rookie_season` for every eligible row
- integer round/pick fields
- round in 1–7 and overall pick in 1–300
- no duplicate ordinary overall picks within draft year
- monotonically increasing ordinary pick ranges across rounds
- no duplicate eligible player-season identities

## Corrected development cohorts

After the fail-closed provenance gate, 2018–2024 model-eligible sample sizes are:

| Position | Corrected N |
|---|---:|
| QB | 54 |
| RB | 132 |
| WR | 194 |
| TE | 86 |

These replace the prior N=62/217/289/126 claims, which included unresolved all-missing draft metadata as operational UDFAs.

## Regenerated point-model evidence

All metrics below were regenerated from the corrected cohorts using the same frozen inputs and the same candidate model architecture/search family as before. These remain post-selection development results, not nested independent validation.

| Position | Leading development architecture | Folds won | Mean MAE | Mean RMSE | Mean Spearman | Mean MAE gain vs position prior | Worst fold gain |
|---|---|---:|---:|---:|---:|---:|---:|
| RB | linear log(overall pick) | 7/7 | 43.78 | 54.69 | .584 | +32.94% | +5.56% |
| WR | linear log(overall pick) | 7/7 | 45.54 | 59.43 | .657 | +23.94% | +6.21% |
| TE | Ridge raw overall pick | 7/7 | 31.27 | 42.05 | .474 | +14.42% | +0.74% |
| QB | linear log(overall pick) | 6/6 evaluable | 55.15 | 70.52 | .643 | +37.63% | +26.31% |

The draft-capital signal survives corrected provenance strongly for RB and materially for WR. TE remains positive in every evaluable development fold but is weaker and more volatile than the prior report. QB remains too small for promotion; after the stricter gate, only six folds meet the runner's minimum training/test size requirements.

Every reported fold win is reconstructed directly in the output with season, test N, train N, candidate MAE, prior MAE, gain percentage, and boolean win status. The workflow fails if the reconstructed fold-win count differs from the ranking summary.

## Chronology and determinism

Development/model-selection cohorts are exactly 2018–2024. 2025 is stored only as `retrospective_observed`; the workflow asserts no fold result has season >= 2025. The validated frozen snapshot is restored by artifact and its composite hash is checked before execution.

The runner executes twice and `cmp` requires byte-identical JSON. CI additionally fails unless identity audit, draft-integrity audit, corrected position sample sizes, claim reconstruction, 2025 isolation, and both production firewalls pass.

## Uncertainty, QB, and year-2 boundaries

QA's contained P2 findings remain intentionally unresolved by this data-integrity remediation:
- model-family ranking is development/post-selection evidence, not nested family-selection validation;
- `interval_calibrated=false`; v0.1 still uses in-sample training residuals as a proxy and requires chronological out-of-fold calibration before any uncertainty promotion;
- QB remains research-only because the cohort is small;
- TE remains smaller/more volatile than RB/WR;
- rookie-to-year-2 transition remains not evaluated and cannot replace/blend validated veteran v0.4 without a separate paired chronological study.

No validation threshold was weakened to preserve the previous improvement claim.

## Production firewall

Nothing in this branch modifies production projection behavior, Dynasty Value, UI, Core, IDP valuation, scoring, or `main`. This remains an experimental research checkpoint only. A QA pass means safe for Founder/Core experimental review, not production promotion.

## Readiness

A new exact branch head may be marked `READY FOR QA — HIGH RISK` only after the branch workflow passes the frozen-snapshot, deterministic reproduction, identity, draft-integrity, sample-size, fold-claim, chronology, and firewall gates.
