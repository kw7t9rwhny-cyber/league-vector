# League Vector IDP Research Cycle 2

Status: **MORE RESEARCH REQUIRED**

Branch: `codex/idp-projection-research-v02`
Parent research checkpoint: `8b1373443126c7312d7ca7b1b7e0b2752af93f68`
Audited production base: `51ee6fbcb692c1770c1d9b1d32223566b897296a`
Core contract reviewed: PR #11, `codex/idp-valuation-foundation-v01` at `781b766257dd46e24ebf9d52f80db15bce9c377c`

No production UI, production valuation math, or main branch files were modified.

## Evidence sources

Cycle 2 reuses the retained green Projection System v0.3 and frozen v0.2 benchmark artifacts. v0.3 covers nflverse 2015–2025 with forward folds 2020–2025 and preserves DL/LB/DB projections as experimental and dynasty-ineligible.

The sensitivity runner consumes only the v0.3 `projection_ready` 2026 artifact and the documented League Vector reference scoring. It does not train a new model and it does not turn experimental projection points into production values.

## 1. Position-specific age evidence

The available v0.3 age ablation supports position-specific age modeling but does not yet provide a defensible fitted dynasty aging curve.

| Position | targets preferring age-aware Ridge | targets | conclusion |
|---|---:|---:|---|
| DL | 10 | 12 | age carries predictive signal, heterogeneous by stat |
| LB | 8 | 12 | weaker signal; role/opportunity likely dominates many outcomes |
| DB | 11 | 12 | strongest age-feature persistence |

The absolute mean MAE deltas cannot be pooled into one age multiplier because the 12 targets have incompatible units and rare-event scales. The next age study must operate at player-season level and decompose: (a) probability of remaining fantasy-relevant / retaining role, (b) games/opportunity, and (c) per-game production conditional on playing.

**Research decision:** no production or experimental dynasty age multipliers approved yet.

## 2. Replacement-level methodology

Cycle 2 tested a deterministic league-scored replacement framework on the 2026 projection-ready pool.

### Starter allocation

1. Allocate dedicated DL/LB/DB slots to the highest projected league-scored players at each canonical position.
2. Allocate shared IDP_FLEX slots exactly once to the highest-scoring remaining eligible defenders across all IDP positions.
3. Do not count IDP_FLEX once for every position.
4. Position replacement is the next available player after this optimal starter allocation.

### Alternative boundaries

- `starter`: next available player after starter/flex allocation.
- `rosterable_1_5x`: projected point level at 1.5 times the actual starter count for that position.
- `rosterable_2x`: level at 2.0 times starter count.
- `blended`: mean of starter and 1.5x rosterable levels.

Three representative IDP configurations were tested:

- shallow 12: 1 DL / 1 LB / 1 DB / 1 IDP_FLEX per team.
- balanced 12: 2 DL / 2 LB / 2 DB / 2 IDP_FLEX per team.
- deep 14: 2 DL / 3 LB / 2 DB / 2 IDP_FLEX per team.

### Deep-14 replacement points under League Vector reference IDP scoring

| Method | DL | LB | DB |
|---|---:|---:|---:|
| starter | 91.5 | 92.4 | 88.3 |
| 1.5x rosterable | 75.4 | 74.3 | 81.9 |
| 2.0x rosterable | 67.8 | 56.2 | 76.3 |
| blended | 83.5 | 83.4 | 85.1 |

The exact point levels are configuration/scoring dependent and are not universal constants.

### Ranking sensitivity

For the deep-14 configuration, compared with starter-boundary surplus ranking:

| Method | top-24 overlap | top-50 overlap |
|---|---:|---:|
| starter | 24/24 | 50/50 |
| 1.5x rosterable | 23/24 | 47/50 |
| 2.0x rosterable | 23/24 | 45/50 |
| blended | 23/24 | 48/50 |

Within-position ordering does not change when every player at one position is measured against the same replacement constant. Replacement sensitivity primarily changes cross-position ranking and surplus magnitude.

**Research preference:** `blended` is the best current candidate for further testing because it is more robust than 2.0x roster depth without treating the last starter as the only economically relevant replacement definition. It is not yet research-approved for Core.

## 3. Hybrid / multi-position eligibility

Current v0.3 projection records expose one normalized modeling position only. That is insufficient to validate real DL/LB or DB/LB eligibility behavior.

Proposed deterministic contract:

- **Model position:** one canonical historical modeling group (DL, LB, DB), assigned from the versioned source-position mapping. This determines the projection model and age curve. Never train the same player as two observations in the same player-season merely because a fantasy platform grants dual eligibility.
- **Lineup eligibility:** preserve the full platform eligibility set separately, e.g. `["DL","LB"]`.
- **Starter allocation:** each player may occupy at most one lineup slot. Shared/hybrid allocation must be solved as a single assignment problem, not independent position sorts that can double-count the player.
- **Replacement/VORP:** compute the player's opportunity cost against the best valid slot assignment. A dual-eligible player's surplus is the incremental optimized team/pool surplus created by allowing that player into one valid slot, not the maximum of two separately double-counted VORPs.
- **Tie breaking:** stable player ID, then canonical modeling position; no subjective EDGE premium.

**Research blocker:** the current retained projection artifact does not include complete multi-position eligibility, so this algorithm has not yet been tested on the real hybrid population.

## 4. Whole-player uncertainty

Historical v0.3 whole-player reference-scoring errors:

| Position | N | MAE | RMSE | median AE | RMSE/MAE |
|---|---:|---:|---:|---:|---:|
| DL | 1,472 | 22.40 | 30.95 | 16.08 | 1.38 |
| LB | 1,378 | 31.52 | 43.53 | 22.36 | 1.38 |
| DB | 1,412 | 27.09 | 34.31 | 22.19 | 1.27 |

The gap between MAE and RMSE shows material tail error, especially DL/LB. Current stat-level empirical p50/p80/p90 residual bands are calibrated by construction on the retrospective selected model, but they do not preserve cross-stat covariance, so summing them into a whole-player interval would make an unsupported calibration claim.

Historical top-N whole-player overlap under reference scoring is encouraging but imperfect:

- DL: top 12 = 10/12; top 24 = 19/24.
- LB: top 12 = 10/12; top 24 = 15/24.
- DB: top 12 = 10/12; top 24 = 18/24.

**Research decision:** whole-player uncertainty is adequate as a display/risk signal, not yet as a calibrated dynasty-value discount.

## 5. Multi-year surplus methodology

Candidate quantity:

`multi_year_surplus = Σ_t discount_t × E[max(0, league_scored_points_t - replacement_t)]`

with no arbitrary positional premium.

Required inputs by future season:

- league-scored player projection,
- league-specific replacement level,
- position-specific role survival / opportunity curve,
- conditional per-game aging effect,
- availability uncertainty,
- scoring coverage status.

Cycle 2 intentionally does **not** assign production decay factors because the explicit DL/LB/DB survival/aging curves are not yet estimated. One-year surplus can be tested; multi-year dynasty surplus cannot yet be called calibrated.

## 6. Offense vs IDP normalization

Using the same one-year projected-points-minus-replacement unit for offense and IDP works without a hand-tuned defensive multiplier.

Representative balanced-12 starter replacement levels under the v0.3 reference scoring profiles were approximately:

QB 138.7, RB 149.9, WR 141.3, TE 138.2, DL 102.2, LB 106.4, DB 92.8.

In that configuration an elite DL such as Myles Garrett had about 122 projected one-year points above DL replacement, placing him naturally among strong offensive surplus players. In the deeper 14-team IDP configuration his one-year surplus rose to about 133 as replacement fell.

This demonstrates the *conceptual bridge*: scoring and roster demand determine the common surplus unit. It does not validate a 0–10,000 dynasty scale.

### Critical eligibility contamination finding

The current 2026 projection-ready universe contains obviously retired players, including Luke Kuechly and Tom Brady. Kuechly appears as a high projected LB because his old history remains model-eligible. Therefore any combined surplus ranking generated directly from this pool is research-only and cannot be product-facing until current-player eligibility/retirement filtering is independently enforced.

## 7. Scoring/data limitations

Common IDP projection support remains strong for solo/assisted tackles, TFL, sacks, QB hits, interceptions, passes defended, forced fumbles, fumble recoveries, defensive touchdowns and safeties.

Limitations remain:

- unsupported Sleeper keys must stay explicit and must not be converted to zero;
- pressures are present in the normalization schema but are not part of the validated v0.3 required IDP projection line;
- defensive snaps/snap share are schema candidates, not yet validated production training features;
- current 2026 pool requires an independent active/retired eligibility gate;
- retained v0.3 projection records do not expose complete fantasy multi-position eligibility.

## 8. Licensing gaps

nflverse covered stats remain the approved historical basis subject to release provenance and attribution. FTN participation/snap data via nflverse remains legal-review-required before redistribution/production dependency. Any new role/alignment/pressure source requires exact license and commercial-use review before promotion.

## 9. Position readiness

### DL — NOT READY

Strengths: respectable historical whole-player accuracy, 10/12 age-aware target preference, useful Ridge signal, top-24 overlap 19/24.

Blockers: explicit role-survival curve missing; hybrid EDGE/DL/LB eligibility untested; whole-player uncertainty not calibrated for discounting; current eligible pool contamination.

### LB — NOT READY

Strengths: top-12 overlap 10/12 and transparent weighted history remains robust.

Blockers: highest whole-player MAE/RMSE of IDP groups; top-24 overlap only 15/24; role/opportunity instability is not explicitly modeled; age evidence weaker than DL/DB; current eligible pool contamination.

### DB — NOT READY, CLOSEST MODELING CASE

Strengths: strongest Ridge/age evidence (11/12 age preference), top-24 overlap 18/24, lower RMSE/MAE tail ratio than DL/LB.

Blockers: same age-survival, hybrid, uncertainty, and player-pool gates remain.

## 10. Core integration requirements

Core PR #11 should remain closed to numeric dynasty values until Research supplies all of:

1. a versioned `replacement_methodology` with league scoring, dedicated slots, shared flex allocation, eligibility rules, and sensitivity metadata;
2. a player contract containing canonical model position **and** complete lineup eligibility array;
3. a versioned position-specific age/survival model with training/validation seasons, sample size and uncertainty;
4. whole-player uncertainty with independently measured interval coverage, or an explicit display-only classification;
5. a current-player eligibility gate that rejects retired/inactive stale-history records;
6. a multi-year surplus contract with horizon/discount assumptions and sensitivity;
7. a scoring coverage contract that carries supported, unsupported and missing keys;
8. a combined offense/IDP normalization contract defined in projected surplus units, with no arbitrary positional multiplier;
9. retrospective plus unseen-season ranking stability tests before `research_approved=true` is allowed.

## Final decision

The surplus-over-replacement framework is **conceptually defensible** and replacement sensitivity is manageable under conservative definitions. The evidence is not sufficient to expose experimental dynasty rankings yet because the age/survival component, multi-position assignment, whole-player uncertainty calibration and current-player eligibility gate remain unresolved.

**MORE RESEARCH REQUIRED**
