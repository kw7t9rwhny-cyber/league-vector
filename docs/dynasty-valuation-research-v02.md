# League Vector Dynasty Valuation Research v0.2

Status: **MORE DYNASTY VALUATION RESEARCH REQUIRED**

Risk: **HIGH**

Branch: `codex/dynasty-valuation-research-v02`
Parent research head verified: `5474a81272f3ca12c7036bba25eeb9e57e6c3287`
Frozen historical snapshot required: `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`

## Firewall

`experimental=true`

`production_dynasty_value_eligible=false`

`idp_numeric_eligible=false`

No production valuation, Core branch, UI, projection branch, or IDP numeric behavior is modified.

## Research candidate

The v0.2 runner evaluates expected discounted multi-year surplus over league-specific replacement. Future-season point models are chronological and position-specific. Age and experience enter future production/survival estimation rather than a final explicit age multiplier. Role-survival probability is applied only to horizons 2+, because Projection Research Cycle 2 showed that multiplying survival into next-season point forecasts worsens point MAE.

Candidate raw football utility:

`S_i = sum[t=1..H] d^(t-1) * survival_i,t * max(0, projected_points_i,t - replacement_p,t)`

For t=1, survival multiplier is fixed at 1.

The research grid tests H = 2, 3, 4, 5 and annual discount factors 1.00, 0.90, 0.80.

## League replacement / FLEX

The v0.2 runner does not use production's fixed RB 34% / WR 50% / TE 16% FLEX allocation or 0.85 Superflex-QB assumption.

For each simulated season it:

1. fills dedicated positional starter slots from projected scoring;
2. allocates FLEX slots endogenously to the highest remaining RB/WR/TE scorers;
3. allocates Superflex slots endogenously to the highest remaining QB/RB/WR/TE scorers;
4. defines positional replacement from the best non-selected player at each position.

Configurations include 1QB standard, Superflex, TE premium, heavy TE premium + 2TE, deep/multi-FLEX, and shallow leagues.

## Chronological design

Valuation season Y may train a horizon-h model only on rows where the target season Y_train+h is strictly earlier than Y. Evaluation seasons are 2020-2024 using the previously frozen nflverse snapshot. This prevents future-season target leakage.

Future production uses current production/opportunity, age, experience and prior-history features. Survival is a separate chronological logistic relevance model by position.

## Validation target

Historical market price is not treated as truth. Primary v0.2 target is realized future multi-year fantasy surplus in simulated league environments. Candidate ranking is compared against realized future surplus using season-level Spearman correlation. One-year projected surplus and current points are controls.

This directly tests whether a multi-year valuation score predicts future football utility better than a one-season/current-production architecture.

## Market anchor

A historical market-anchor experiment is **not validly executable from the current frozen repository evidence** because historical point-in-time market snapshots are not present. Current market values cannot be backfilled into old seasons without leakage.

Therefore v0.2 must not claim that pure surplus beats or loses to a market-anchored candidate. A future market-anchor study requires legally/provenance-approved point-in-time historical snapshots.

## TE premium limitation

The frozen multi-horizon target is total PPR fantasy points, not future stat-line projections. The runner includes a TE-premium sensitivity proxy only to test scarcity direction. Those TE-premium numeric results are not eligible for promotion. A promotable TE-premium valuation requires future receiving-stat distributions or a scoring-preserving multi-year projection contract.

## Rookie contract

Zero-history rookies remain outside the veteran/limited-history multi-year model. Required upstream contract remains: point projection/distribution, uncertainty, draft-capital provenance, age, position, zero-history flag, eligibility, model version, and source snapshot. No fake rookie certainty is created here.

## Value scale

Raw surplus is intentionally kept separate from display value. A monotonic user-facing scale must not be selected until the raw football-utility score survives validation. This prevents cosmetic tuning to consensus sites.

## Deterministic regression expectations

Before output inspection, the following qualitative expectations are fixed:

- equal Y+1 projection young QB > aging QB when empirical future survival/production supports it;
- equal Y+1 projection young WR > older WR through future surplus, not an age bonus;
- RB effective horizon should generally be shorter than QB/WR if historical survival supports it;
- TE value should rise from 2TE/TE-premium scarcity only through scoring/replacement/lineup demand;
- Superflex should materially lower QB replacement and increase QB surplus without a QB multiplier;
- deeper and FLEX-heavy leagues should change replacement endogenously;
- no numeric IDP output may appear.

## Current execution state

The first two workflow attempts failed before model execution because the newly authored snapshot-verification YAML used an invalid folded heredoc form. This was a research-infrastructure defect, not a model result. It was corrected in commit `1569de802ff8b5531d3daaa8eb7576191c9e91f2`; the corrected run successfully restored and verified the exact frozen snapshot before dependency installation/model execution.

No candidate is READY FOR QA until the corrected run completes, deterministic run-a/run-b outputs are byte-identical, sensitivity is inspected, and the evidence is committed/frozen.

## Core contract under research

If a future candidate passes, Core should consume an experimental valuation object with at least:

- `player_id`
- `position`
- `league_context_hash`
- `horizon`
- `season_weights`
- `future_point_estimates[]`
- `future_survival_probabilities[]`
- `replacement_points_by_season[]`
- `surplus_by_season[]`
- `raw_discounted_surplus`
- `display_value` (separate mapping/version)
- `uncertainty_metadata`
- `rookie_or_limited_history_flag`
- `market_anchor` and `market_anchor_weight` only if separately validated
- `experimental=true`
- `production_dynasty_value_eligible=false`
- `source_snapshot_sha256`
- `model_version`

## Decision

The architecture is sufficiently specified to test, but the empirical v0.2 run is not yet frozen and inspected. It would be unsafe to mark READY FOR QA before those results exist.

**MORE DYNASTY VALUATION RESEARCH REQUIRED**
