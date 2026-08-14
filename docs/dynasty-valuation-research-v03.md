# League Vector Dynasty Valuation Research v0.3

Status: **MORE DYNASTY VALUATION RESEARCH REQUIRED**

Risk: **HIGH**

Branch: `codex/dynasty-valuation-research-v03`

Parent v0.2 head verified: `e52580110db630ef5bec4266a3fd9a2a3da76426`

Frozen historical snapshot SHA-256: `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`

## Firewall

- `experimental=true`
- `production_dynasty_value_eligible=false`
- `idp_numeric_eligible=false`

No production Dynasty Value, Core branch, UI behavior, projection-production behavior, or IDP numeric activation is changed by this research.

## Research objective

Test whether League Vector can replace the current `external market value × heuristic overlays` architecture with a football-derived value based on expected discounted multi-year league-specific surplus over replacement.

The working family is:

`DV_raw(i) = Σ_t d^(t-1) × max(0, E[ScoredPoints(i,t)] - ForecastLeagueReplacement(position,t))`

with future production represented as:

`E[ScoredPoints(i,t)] = P(relevant_i,t) × E[ScoredPoints(i,t) | relevant_i,t]`

when the conditional-survival contract is used.

There is no explicit age, QB, RB, WR, TE, youth, Superflex, or TE-premium multiplier in the candidate formula. Age/experience may affect future production and survival models, while league scarcity is intended to emerge from scoring, starter demand and replacement.

## Chronology corrections completed in v0.3

The original multi-horizon research used row shifts that could mean “next observed player season” rather than exact calendar Y+h. v0.3 corrects this:

- target Y+h means exact calendar season Y+h;
- if a player is absent from a fully observed future season, future production is zero rather than survivor-conditioned missing;
- Y-1 history means exact calendar Y-1;
- training target calendar season must be strictly earlier than the valuation season;
- a requested evaluation horizon must be completely observed before it is scored.

These changes explicitly preserve retirement, role collapse and league-exit cases instead of removing them from the direct target.

## True realized replacement

Historical realized target utility now derives replacement only from the actual player pool that existed in each target season. No later/future-season pool is used to define the target-season replacement level.

TE premium is scored from receptions rather than a blanket TE points proxy:

- standard PPR: normal reception scoring;
- +0.5 TE premium: add `0.5 × TE receptions`;
- +1.0 TE premium: add `1.0 × TE receptions`.

This lets TE value emerge from actual premium scoring plus starter demand/replacement rather than a TE multiplier.

## Fixed FLEX versus endogenous FLEX

The fixed-control implementation was corrected to match production semantics:

- FLEX demand: RB 34%, WR 50%, TE 16%;
- Superflex control: 0.85 QB contribution;
- no invented Superflex spill allocation.

On the exact-calendar v0.3 grid, endogenous FLEX did not consistently earn its complexity. At the H4/mild/direct comparison it was worse than fixed allocation in most tested environments, including standard 1QB, Superflex, 2QB-like demand, deep FLEX, 2TE and 2TE+premium. Heavy +1.0 TE premium was an exception.

Therefore the focused candidate currently uses the simpler fixed-demand control. Endogenous FLEX is not being promoted merely because it appears theoretically elegant.

## League-specific versus neutral replacement

The corrected exact-calendar grid continued to show meaningful league-specific replacement signal. At the H4/mild/direct/endogenous isolation, league-specific replacement improved mean Spearman versus neutral replacement by approximately:

- Superflex: +0.030
- 2QB-like demand: +0.032
- 2TE: +0.025
- 2TE + premium: +0.018
- deep FLEX: +0.011
- shallow: +0.007

Standard 1QB and TE-premium-only formats were unchanged because their structural starter demand matched the neutral positional setup apart from scoring.

This supports keeping actual league replacement in the research architecture.

## Survival / conditional production

After fixing the v0.2 survival double-count, v0.3 compares:

1. direct unconditional future production including zero exit/collapse; and
2. `P(relevant) × E(points | relevant)`.

On the exact-calendar grid, the conditional-survival decomposition improved the tested H4/mild/league/endogenous specification across all league families. The focused candidate therefore tests the conditional-survival contract, but this remains experimental until its later holdout survives.

## Horizon result and H5 limitation

The exact common-target comparison changed the prior horizon interpretation.

Against the same realized four-year utility target, H3 was generally as good as or better than H4 in the tested direct/endogenous family. Positionally, adding year four produced only a small RB improvement while usually reducing WR/TE rank correlation; QB ordering was essentially unchanged in that comparison.

A true five-year candidate **cannot be frozen from the current 2015–2025 snapshot**. For a fully observed five-year target beginning with valuation year 2020, a leakage-safe direct Y+5 model would need training base seasons whose Y+5 target is strictly before 2020. With data beginning in 2015, there is no adequate pre-2020 Y+5 training history. Identical H4/H5 outputs in the first exact artifact are therefore a lack-of-identifiability warning, not evidence that Y+5 has zero marginal value.

The focused v0.3 candidate currently tests H=3. H4 remains a sensitivity/position-specific research comparison. H5 remains data-blocked until a longer point-in-time historical window exists.

## Critical replacement-forecast blocker discovered after the exact grid

The exact-grid predictor replacement used only the valuation-season cohort projected forward. That means future entrants were absent from the predicted replacement pool even though future NFL player pools continually replenish through rookies and other entrants.

This caused predicted replacement to decay unrealistically with horizon. Player-level decompositions showed examples such as predicted WR replacement falling approximately 125 → 103 → 83 → 74 while realized target replacement remained approximately 156 → 161 → 161 → 139.

That behavior can mechanically inflate the long-horizon value of surviving/young players and cannot be accepted as a production candidate.

The current focused candidate therefore tests an entrant-aware historical replacement forecast:

1. calculate leakage-safe Y+1 replacement from the valuation-season cohort predictions;
2. estimate historical replacement ratios `R(base+h) / R(base+1)` using only seasons whose compared replacement seasons are strictly before the valuation year;
3. anchor future replacement to Y+1 predicted replacement using the median historical ratio;
4. require at least two historical ratio observations or fail closed for that horizon/valuation year.

The old cohort-decay replacement remains an explicit ablation, not the candidate.

## Focused candidate under test

Current pre-registered focused specification:

- horizon: 3 seasons;
- annual discount: 0.80 (`moderate`); 
- future production: survival × conditional-on-relevance production;
- replacement: actual league-specific structure;
- future replacement forecast: historical entrant-aware replacement ratios anchored to leakage-safe Y+1 replacement;
- FLEX/Superflex control: production-equivalent fixed allocation;
- TE premium: reception-stat scoring;
- explicit age multiplier: none;
- external market anchor weight: 0;
- raw canonical score: discounted multi-year surplus points.

The focused harness includes a latest fully observed 2022→2025 chronological holdout and one-at-a-time ablations for replacement replenishment, neutral replacement, endogenous FLEX, direct production, and discounting.

## Young-player interpretation

Earlier exact-calendar evidence shows materially higher long-horizon survival for younger WR/RB/TE cohorts and lower survival for older cohorts. That is evidence for allowing youth to emerge through remaining future utility rather than adding an explicit youth multiplier.

However, because cohort-only predicted replacement decayed too aggressively, earlier magnitudes of the youth-value increase are not considered frozen evidence. The entrant-aware replacement holdout must determine how much youth compression is genuinely resolved after replacement is corrected.

## TE interpretation

The research does not support a universal TE boost.

TE value is expected to emerge from:

- exact TE reception scoring;
- 1TE versus 2TE demand;
- league-specific replacement;
- multi-year survival/production.

The corrected exact-calendar grid showed substantially stronger TE rank prediction in 2TE environments than standard 1TE environments, but the focused entrant-aware replacement run must be inspected before candidate promotion.

## Market anchor

The pure football-derived candidate is mathematically self-contained and therefore **does not require an external dynasty market baseline in order to produce a Dynasty Value**.

No leakage-safe point-in-time historical dynasty market snapshots are present in the frozen repository evidence. Current market values cannot be backfilled into historical valuation seasons without future-information leakage.

Therefore:

- market anchor weight in the focused candidate = 0;
- the external market baseline is not considered structurally necessary;
- its incremental predictive/stability value remains untested, not assumed to be zero;
- market anchoring may only return as a separately validated optional prior if a provenance-approved point-in-time historical series becomes available.

This prevents the inability to backtest market history from forcing League Vector to keep a market-centered architecture by default.

## Value scale

The canonical research quantity remains raw discounted surplus points. A diagnostic `0–10000` mapping may be shown as:

`10000 × player_raw_surplus / max_raw_surplus_in_same_league_snapshot`

but this normalization is **not frozen for production**, because it is sensitive to the top player in the league snapshot. Display scale must remain separate from the football-utility formula and must not drive model selection.

## Rookie contract

Zero-history rookies remain fail-closed for model-derived multi-year Dynasty Value until an independently QA-approved rookie projection contract exists.

Required upstream fields include:

- player_id
- position
- age
- zero_history flag
- approved projection point estimate/distribution
- projection uncertainty
- draft-capital provenance
- model version
- source snapshot
- QA status

No unvalidated rookie projection is promoted by this branch.

## Current blockers before READY FOR QA

The branch must not be marked READY FOR QA until all of the following are true:

1. entrant-aware future replacement completes deterministically on the frozen snapshot;
2. the 2022→2025 holdout shows whether replenished replacement improves or at least preserves predictive utility versus cohort-decay replacement;
3. league-specific replacement survives the later holdout, particularly Superflex/2QB and 2TE;
4. conditional-survival remains defensible versus direct unconditional production;
5. discount sensitivity remains contained;
6. 3-year versus identifiable 4-year behavior is documented without pretending H5 is validated;
7. QB/Superflex does not produce runaway longevity values;
8. TE premium/2TE behavior remains monotonic and football-plausible without a TE multiplier;
9. young-player uplift remains after replacement replenishment;
10. deterministic player-level evidence is frozen;
11. exact formula and Core contract are frozen;
12. independent HIGH-risk QA has a single exact head to test.

## Core contract under research

A future experimental Core consumer should receive at least:

- `player_id`
- `position`
- `league_context_hash`
- `valuation_model_version`
- `horizon`
- `season_weights[]`
- `future_survival_probabilities[]`
- `future_conditional_point_estimates[]`
- `future_expected_scored_points[]`
- `replacement_forecast_by_season[]`
- `replacement_forecast_provenance`
- `surplus_by_season[]`
- `raw_discounted_surplus`
- `display_value` plus separate display-scale version only after validation
- `uncertainty_metadata`
- `rookie_or_limited_history_flag`
- `market_anchor` and `market_anchor_weight` only if separately validated
- `experimental=true`
- `production_dynasty_value_eligible=false`
- `source_snapshot_sha256`

## Current decision

The multi-year league-specific surplus architecture remains promising, and the corrected research increasingly favors a simpler three-year football-derived candidate rather than market value plus heuristic overlays. But the future replacement pool must be replenishment-aware before any candidate can be frozen.

**MORE DYNASTY VALUATION RESEARCH REQUIRED**
