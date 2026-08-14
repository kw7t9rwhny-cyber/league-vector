# League Vector Dynasty Valuation Research v0.2

Status: **MORE DYNASTY VALUATION RESEARCH REQUIRED**

Risk: **HIGH**

Branch: `codex/dynasty-valuation-research-v02`
Parent research head verified: `5474a81272f3ca12c7036bba25eeb9e57e6c3287`
Corrected research head before this documentation commit: `c59235ebcfac09b25045451daece631fad646852`
Frozen historical snapshot: `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`
Corrected deterministic result SHA-256: `e4cb25a134f26d0ef63f146327a1a1a45c80baa618c11faff970dc8a21dc7b28`
Workflow run: `31802920100`

## Firewall

`experimental=true`

`production_dynasty_value_eligible=false`

`idp_numeric_eligible=false`

No production valuation, Core branch, UI, projection branch, or IDP numeric behavior is modified.

## Critical correction to first v0.2 run

The first completed v0.2 implementation fit future fantasy points on all players and then multiplied Y+2+ estimates by role-survival probability. Because the point target already contained role-loss/collapse outcomes, that counted survival risk twice and could exaggerate young-player advantages.

That result was rejected before promotion.

The corrected implementation explicitly separates:

`Pr(relevant at horizon h)`

from

`E[fantasy points at horizon h | relevant]`

The conditional production Ridge is trained only on historically relevant target seasons. A separate chronological logistic model estimates relevance probability. Expected points are:

`ExpectedPoints_i,h = Pr(relevant_i,h) * E[points_i,h | relevant]`

No second survival multiplication is then applied in valuation.

Run-A and run-B of the corrected implementation are byte-identical.

## Corrected candidate

For player i and horizon h:

`ExpectedPoints_i,h = Pr(relevant_i,h) * ConditionalPoints_i,h`

League-specific expected replacement is derived from the simulated lineup environment.

`Surplus_i,h = max(0, ExpectedPoints_i,h - Replacement_position,h)`

Raw dynasty football utility:

`DynastySurplus_i(H,d) = sum[h=1..H] d^(h-1) * Surplus_i,h`

Tested:

- H = 2, 3, 4, 5
- d = 1.00, 0.90, 0.80

No explicit age multiplier exists. Age and experience influence future conditional production and relevance probability inside the historical models.

## League replacement and endogenous FLEX

The v0.2 runner removes production's fixed RB 34% / WR 50% / TE 16% FLEX shares and fixed 0.85 Superflex-QB assumption.

For each simulated horizon it:

1. fills dedicated positional starter slots by expected scoring;
2. fills FLEX with the highest remaining RB/WR/TE expected scorers;
3. fills Superflex with the highest remaining QB/RB/WR/TE expected scorers;
4. defines positional replacement from the best remaining non-selected player.

Test environments:

- 12-team 1QB standard
- 12-team Superflex
- TE premium sensitivity
- heavy TE premium + 2TE sensitivity
- 14-team three-FLEX deep league
- 10-team shallow league

## Chronology

Valuation season Y trains a horizon-h model only on historical origin rows satisfying:

`origin_season + h < Y`

Therefore every training target season occurs strictly before the valuation season.

Evaluation uses valuation seasons 2020-2024 from the frozen historical snapshot. No 2025 observations are used to choose the formula.

## Corrected historical results

Metric: mean season-level Spearman correlation between candidate value and realized discounted future surplus. The one-year projected-surplus ranking is the main architecture control.

Mean corrected results across discount settings:

| League | H=2 gain vs Y1 | H=3 | H=4 | H=5 |
|---|---:|---:|---:|---:|
| 1QB standard | +0.033 | +0.045 | +0.058 | **+0.082** |
| Superflex | +0.029 | +0.062 | +0.075 | **+0.095** |
| TE premium proxy | +0.033 | +0.045 | +0.058 | **+0.082** |
| Heavy TE premium + 2TE proxy | +0.032 | +0.048 | +0.064 | **+0.084** |
| Deep / 3 FLEX | +0.014 | +0.040 | **+0.045** | +0.044 |
| Shallow | +0.023 | +0.035 | +0.047 | **+0.058** |

Best tested specifications:

| League | Best H | Best discount | Spearman | Gain vs Y1 |
|---|---:|---|---:|---:|
| 1QB | 5 | 0.80 | 0.447 | +0.082 |
| Superflex | 5 | 0.80 | 0.472 | +0.095 |
| TE premium proxy | 5 | 0.80 | 0.447 | +0.082 |
| Heavy TE premium + 2TE proxy | 5 | 0.80 | 0.487 | +0.083 |
| Deep FLEX | 4 | 0.90 | 0.505 | +0.045 |
| Shallow | 5 | 0.90 | 0.405 | +0.058 |

Interpretation: after correcting survival double counting, multi-year surplus still improves ranking of realized future football utility over one-year surplus in every tested league family. That is strong evidence for the architecture, but not yet proof of a production-ready formula.

## Horizon finding

The evidence does **not** support a universal 3-year cutoff.

Five years wins in five of six simulated league environments; the deep/FLEX-heavy format peaks at four years. However the fifth year may be partly benefiting from the evaluation target itself accumulating additional future utility, so horizon selection needs an explicit marginal-information / stability study rather than choosing H=5 solely because the target is longer.

Current research interpretation:

- 2 years is too short for a dynasty system;
- 3 years is clearly better than 2 in most formats;
- 4 years is robustly useful;
- 5 years remains promising but requires stronger marginal validation.

The most defensible provisional range is **4-5 seasons**, not yet one fixed universal H.

## Discounting finding

Discount choice matters less than horizon choice in most formats. Moderate 0.80 annual weighting wins in 1QB, Superflex, TE-premium proxy and heavy-TE/2TE proxy. Mild 0.90 wins deep FLEX and shallow.

Because 0.80 vs 0.90 differences are generally much smaller than the multi-year-vs-one-year gain, there is no justification for declaring one magic discount factor production-ready.

Current defensible research range: **0.80-0.90 annual weight**, with uncertainty/marginal-horizon work still required.

## Sensitivity

Range in mean Spearman across all tested horizon/discount specifications:

- 1QB: ~0.047
- Superflex: ~0.072
- TE premium proxy: ~0.047
- heavy TE premium + 2TE proxy: ~0.046
- deep FLEX: ~0.028
- shallow: ~0.036

Superflex is the most parameter-sensitive environment. This is a warning against freezing a single formula now.

## Age / youth behavior

Equal-current-production archetype diagnostics now emerge from future conditional production + survival rather than an age bonus.

Representative expected-point paths from the corrected model show materially more future utility for young WR/RB/TE cohorts than older equal-current-production cohorts. The separation is especially large for WR and TE.

This is directionally consistent with the original youth-compression diagnosis and demonstrates that explicit youth multipliers are not mathematically necessary to create a youth premium.

However QB archetype separation is much weaker at distant horizons than intuition might suggest, so QB longevity/survival requires additional investigation before freezing the model.

## TE finding

The framework improves TE architecture because TE value is produced by expected scoring, starter demand, FLEX competition, replacement and future persistence rather than a universal TE multiplier.

The heavy-TE/2TE simulation shows large multi-year gains over one-year surplus. But the TE-premium scoring transformation in v0.2 is only a sensitivity proxy (`PPR total * TE premium factor`) rather than a scoring-preserving future receiving-stat model.

Therefore **TE-premium numeric conclusions are not promotable yet**. The valid result is architectural: 2TE/TE demand can be represented endogenously without a TE value multiplier.

## Superflex finding

Superflex produces the largest gain over one-year surplus in the corrected experiment (~+0.095 Spearman at the best specification). QB demand is allocated through actual lineup competition rather than a manual QB scarcity multiplier.

This is encouraging evidence that league-specific replacement materially improves cross-position valuation. But Superflex is also the most parameter-sensitive tested environment, so it needs dedicated regression analysis before QA.

## Market anchor

No historical point-in-time dynasty market snapshots exist in the frozen repository evidence. Current market values cannot be inserted into old seasons without future-information leakage.

Therefore v0.2 cannot validly determine whether:

- pure surplus beats a weak market prior;
- a market anchor improves stability;
- current production's market-dominated architecture predicts football utility better or worse historically.

Market anchoring remains unresolved and must not be treated as proven necessary.

## Rookie contract

Zero-history rookies remain outside this candidate. Required upstream contract:

- point estimate/distribution
- uncertainty interval/tier
- draft-capital provenance
- age
- position
- zero-history flag
- eligibility
- model version
- source snapshot

No rookie values may silently fall through to veteran multi-year math.

## Remaining validation defects / gaps

1. Realized surplus currently uses the ex-ante predicted replacement threshold as the historical utility baseline. A full future-player-pool contemporaneous replacement backtest is still required.
2. TE-premium scoring is a proxy, not a true multi-year stat-line scoring model.
3. No legal/provenance-safe historical market snapshots are available for market-anchor testing.
4. No zero-history rookie integration exists.
5. No user-facing display-value scale has been validated.
6. Full player-level current-production-vs-candidate comparison tables have not yet been frozen.
7. Position-specific horizon choice and marginal Y+5 information require further analysis.
8. Superflex sensitivity is high enough to require dedicated adversarial testing.
9. QB long-horizon archetype behavior deserves targeted inspection.

## Value scale

Raw football utility remains separate from display value. This is intentional. No arbitrary transformation has been chosen to imitate KTC, DynastyProcess or another site's number scale.

## Core contract under research

A future experimental Core consumer should receive:

- `player_id`
- `position`
- `league_context_hash`
- `valuation_model_version`
- `horizon`
- `season_weights[]`
- `survival_probability_by_horizon[]`
- `conditional_points_by_horizon[]`
- `expected_points_by_horizon[]`
- `replacement_points_by_horizon[]`
- `surplus_by_horizon[]`
- `raw_discounted_surplus`
- `display_value` plus separate scale version only after validation
- `uncertainty_metadata`
- `rookie_or_limited_history_flag`
- optional `market_anchor` only after separate leakage-safe validation
- `experimental=true`
- `production_dynasty_value_eligible=false`
- `source_snapshot_sha256`

## Answers to v0.2 questions

1. **Does multi-year surplus outperform the current conceptual architecture?** It clearly outperforms one-year projected surplus/current-production controls on realized future football utility. It has not yet been leakage-safely compared against historical point-in-time external market values, so it cannot claim empirical superiority over the complete current market-anchored production formula.
2. **What horizon is defensible?** Four to five seasons is the current evidence-supported research range. Five wins most simulations, but needs marginal-value validation before freezing.
3. **What discounting is defensible?** Annual weights around 0.80-0.90. Horizon matters more than the exact tested discount.
4. **Does explicit age adjustment remain necessary?** No evidence currently requires one. Youth/age effects emerge naturally through survival and conditional future production.
5. **Does league-specific replacement materially improve values?** Strongly promising, particularly Superflex and deeper/2TE structures, but a dedicated neutral-vs-league replacement ablation is still required to isolate its causal contribution.
6. **Does endogenous FLEX improve scarcity?** Architecturally yes and it removes arbitrary position shares. A direct fixed-share-vs-endogenous ablation remains required before claiming measured superiority.
7. **Does the approach fix youth compression?** Directionally yes for WR/RB/TE archetypes without youth multipliers. More player-level regression testing is required.
8. **Does it fix TE behavior?** It fixes the architecture; TE values can emerge from demand/replacement/persistence. True TE-premium numeric validation is not complete.
9. **How does Superflex behave?** Correct direction and strongest multi-year gain, but also greatest parameter sensitivity.
10. **Is market anchoring still useful?** Unknown. The current repository cannot answer without historical point-in-time market data.
11. **Best candidate formula?** Expected discounted 4-5 year league-specific surplus using separate relevance probability and conditional production, endogenous lineup replacement, and no explicit age/position multiplier.
12. **Weaknesses?** Long-horizon uncertainty, ex-ante replacement target, TE-premium proxy, rookies, market-anchor uncertainty, display-scale absence, Superflex sensitivity.
13. **What requires more research?** Replacement ablation, FLEX ablation, contemporaneous realized replacement, marginal Y+5 value, QB horizon, TE scoring, rookies, market anchoring and player-level regressions.
14. **Core contract?** Consume the decomposed experimental horizon-by-horizon object above; never consume a single unexplained multiplier.

## Decision

The corrected experiment provides meaningful evidence that multi-year league-specific surplus is superior to a one-season surplus architecture for predicting realized future football utility. It is **not yet sufficiently isolated or complete for HIGH-risk QA** because key causal ablations and scoring/replacement validation remain unfinished.

**MORE DYNASTY VALUATION RESEARCH REQUIRED**
