# League Vector Dynasty Valuation Research v0.1

Status: **MORE DYNASTY VALUATION RESEARCH REQUIRED**

Risk tier: **HIGH**

Branch: `codex/dynasty-valuation-research-v01`
Base production commit audited: `b5a3f56e7bb95810b2fd787c4f5ce0ff12c851b6`

Production firewall: this branch changes no live valuation code, no UI, no projection branches, and no IDP numeric availability. Any formula below is experimental only.

## Executive diagnosis

The current production Dynasty Value is not a multi-year dynasty model. It is a current external market value with bounded overlays for age, league structure, and one-season projected VORP.

The two observed failure families have different causes:

1. **Young players:** validated Projection Research shows real next-season under-projection in several young cohorts, but the larger Dynasty Value design issue is that age is represented only by a small piecewise multiplier rather than by expected future surplus across multiple seasons. A 22-year-old and 29-year-old with equal current market/projection inputs can differ by only a few percentage points unless their external market baseline already creates the difference.
2. **Tight ends:** the current system gives TE special treatment in several places, but not through a coherent league-specific multi-year scarcity model. TE premium alters a structural score and projection scoring, while projection adjustment uses neutral replacement rather than league replacement. TE projection error is also unusually role-persistence-sensitive. The correct response is not a universal TE boost.

## 1. Exact current production formula

For offensive player `i` at position `p`:

`B_i = external market base value`

For rookies:

`B'_i = max(B_i, rookie_floor_i)`

For veterans:

`B'_i = B_i`

Age adjustment:

`A_i = compactAgeDelta(position, market_age)`

League structural adjustment:

`L_i = clamp((structuralScore_p - 100) * rate_p, -down_p, up_p)`

Neutral projected VORP:

`V_i^N = projected_points_i - neutral_replacement_points_p`

Projection adjustment:

`P_i = clamp(0.5 * V_i^N / projected_points_i, -0.10, position_cap_p)`

where caps are:

- QB: +0.16
- RB: +0.14
- WR: +0.14
- TE: +0.20

Total overlay:

`T_i = clamp(A_i + L_i + P_i, -0.25, +0.35)`

Final production Dynasty Value:

`DV_i = round(max(0, B'_i * (1 + T_i)))`

### Important implementation fact

The system calculates both neutral and league-specific replacement:

`V_i^L = projected_points_i - league_replacement_points_p`

but **the final projection adjustment uses `V_i^N`, not `V_i^L`.** Therefore actual league-specific replacement level does not directly affect the final Dynasty Value. It is currently surfaced as information only.

## 2. Current terms and arbitrary constants

### External market baseline

Input: `value_1qb` or `value_2qb` from DynastyProcess `values-players.csv`.

Purpose: establishes most of the value scale and ordering before League Vector adjustments.

Risk: this baseline is itself a dynasty market construct and therefore already encodes age, positional scarcity, rookie expectations, and market beliefs to some unknown degree. Applying additional age/rookie/position overlays can double count factors.

### Age adjustment

Piecewise constants:

- QB: <25 +6%; 25-28 +3%; 29-31 0%; 32-34 -5%; 35+ -10%
- RB: <24 +5%; 24-26 +1%; 27-28 -6%; 29+ -13%
- WR: <24 +5%; 24-27 +2%; 28-30 -3%; 31+ -9%
- TE: <25 +4%; 25-28 +2%; 29-31 -3%; 32+ -8%

These are arbitrary step functions in production code; they do not model expected remaining productive seasons.

### League structural adjustment

Structural pressure is built from fixed constants such as:

- team pressure: +3 structural points per team above 12
- superflex: QB +28
- extra dedicated QB: +15
- extra RB/WR starter: +7
- extra TE starter: +10
- FLEX distribution: RB +4, WR +5, TE +2 structural points

Then converted to value with fixed rates and caps:

- QB rate .0024, cap +12%/-6%
- RB .0018, +8%/-6%
- WR .0020, +10%/-6%
- TE .0022, +10%/-6%

These values are heuristics rather than empirically derived surplus curves.

### Starter demand allocation

FLEX is allocated as fixed shares:

- RB 34%
- WR 50%
- TE 16%

Superflex counts as 0.85 QB.

These constants determine replacement rank but replacement is not used in final League Vector projection adjustment.

### Projection adjustment

`0.5 * neutral_VORP / projected_points`, with positional caps.

This is one-season only and uses neutral 12-team 1QB demand rather than the actual league replacement level.

### Rookie floors

Production applies two heuristic rookie floors, taking the maximum:

1. ECR-derived exponential floor with position multiplier.
2. draft-round/pick floor with QB and TE multipliers.

These floors are not the validated Projection Research rookie model and can create false precision for zero-history players.

### Global adjustment cap

All overlays are bounded to -25%/+35% regardless of player archetype, horizon, or evidence.

## 3. Reference sanity relationships

These are qualitative constraints, not optimization targets.

- Equal-projection 22-year-old WR > equal-projection 29-year-old WR in multi-year dynasty value, absent evidence the younger player is much less likely to retain a role.
- Equal-projection 24-year-old QB > equal-projection 34-year-old QB, but the gap should reflect survival/horizon rather than a generic youth bonus.
- Productive young RB should receive high near-term surplus but a shorter useful horizon than an equivalent WR/QB.
- Young ascending TE can exceed an older equal-current-output TE if multi-year role survival supports it; youth alone cannot justify a universal TE boost.
- TE premium should change both projected scoring and the replacement/surplus landscape only when the league actually awards extra TE points.
- Superflex should change QB replacement and multi-year surplus materially, not only add a structural percentage overlay.
- Deep leagues should lower replacement thresholds and increase above-replacement value more than shallow leagues.

## 4. Why young players are currently undervalued

### A. Upstream next-season projection bias: real but not safely correctable yet

Projection Research Cycle 2 found validated v0.4 under-projection for several young cohorts, including approximately:

- QB year 2: -32.3 points bias, N=37
- RB year 2: -9.6, N=117
- WR year 2: -9.1, N=155
- TE year 2: -4.4, N=76
- TE year 3: -6.3, N=84

Simple experience corrections and dedicated year-2 models were unstable and were rejected.

Therefore some young players enter Dynasty Value with a suppressed current projection, but age must not be used to blindly repair this forecast bias.

### B. Dynasty horizon is absent

The production formula contains no explicit season 2, 3, 4, or 5 value stream.

A 22-year-old WR currently receives only +5% explicit age adjustment while a 29-year-old WR receives -3%, an 8 percentage-point difference before other capped overlays. That does not represent potentially several additional seasons of starter-level surplus.

### C. Market anchoring dominates

Because final value is multiplicative around external market base, League Vector cannot substantially depart from market ordering unless the capped overlay is large. If a young player is low in the market baseline or has a weak one-season projection, the current architecture has limited ability to express a stronger league-specific multi-year thesis.

### D. Rookie behavior is heuristic

Rookies can be rescued by floors, but floors are hard-coded functions of ECR/draft capital rather than a validated probabilistic rookie projection plus uncertainty contract.

## 5. Age audit

Current production age math is:

- position-specific, which is directionally correct;
- piecewise and discontinuous;
- not tied to expected remaining starter seasons;
- applied on top of an external dynasty baseline that likely already contains age information;
- unable to distinguish NFL relevance probability, opportunity conditional on relevance, and production conditional on opportunity.

Conclusion: **age is modeled incorrectly for an internally defensible League Vector dynasty model.** The issue is not simply that every youth percentage is too small. The representation is wrong.

## 6. TE audit

### Projection layer

Projection Research found TE error is driven heavily by role persistence/instability and older-player persistence. Younger TEs are modestly under-projected; older TEs can be materially over-projected. Multiple intuitive TE-specific projection fixes failed chronological validation.

Therefore a global TE boost would compound error.

### Scoring layer

TE premium enters scoring via the actual league scoring settings when the projected stat line contains receptions. That is appropriate in concept.

### Structural layer

TE premium also adds `15 * teBonus` to `scoringPressure.TE`, but `structuralLeagueDelta` intentionally uses `structuralScore` only, excluding scoring pressure. Therefore this TE-premium scoring-pressure term affects displayed context score but **does not directly change the final league adjustment**.

### Replacement layer

The scoring-adjusted TE projections are used to compute replacement levels, so TE premium can change replacement points. However final valuation projection adjustment uses **neutral replacement**, not league replacement. Thus league-specific TE premium/scarcity is not fully propagated into final value.

### Scarcity conclusion

TE scarcity is not simply “too high” or “too low.” It is **architecturally disconnected** from the final value in the place where actual league replacement should matter. Meanwhile TE receives a larger one-season projection cap (+20%) than every other offensive position, which can exaggerate high neutral-VORP TEs independent of the user's actual TE environment.

## 7. Market baseline audit

Source in production: DynastyProcess open-data `values-players.csv`.

Production cache TTL: six hours. The upstream repository states its maintained data is updated weekly.

The local code does not document exactly how `value_1qb`/`value_2qb` were derived, nor does it decompose how much age/scarcity/rookie belief is already embedded.

Therefore **double counting is plausible and currently unquantified**:

- market dynasty value already reflects age -> League Vector adds age adjustment;
- market value already reflects position scarcity -> League Vector adds structural positional adjustment;
- market rookie value/ECR already reflects draft capital and prospect sentiment -> League Vector may apply an additional rookie floor.

Before market anchoring remains in a candidate formula, its role must be explicit: prior/anchor, not an unexplained ground truth.

## 8. Replacement and starter-demand audit

The repository does calculate league-specific demand from roster configuration, but with fixed FLEX shares and a fixed 0.85 QB share for superflex.

Replacement level is the projected score of the player at the estimated demand rank by position.

Problems:

1. Final projection adjustment uses neutral replacement, so league-specific replacement does not actually drive final Dynasty Value.
2. FLEX shares are arbitrary constants rather than endogenous lineup competition based on projected cross-position scoring/surplus.
3. Bench depth is not used in replacement logic.
4. TE premium can alter scoring/replacement, but that altered league replacement is not used by final projection adjustment.
5. Cross-position comparison still primarily inherits the external market scale.

## 9. Proposed experimental architecture

The most defensible direction is a transparent expected discounted multi-year surplus framework:

`Surplus_i(H) = sum[t=1..H] w_t * Pr(relevant_i,t) * max(0, E[points_i,t | relevant] - Replacement_p,t)`

where:

- `H` is tested, not assumed;
- `w_t` declines with future-season uncertainty;
- relevance/survival is separate from conditional opportunity/production;
- replacement is league-specific and season-specific;
- scoring comes from actual league scoring;
- starter demand is derived from roster configuration and flex competition;
- rookies use a validated rookie contract or explicit fallback;
- uncertainty is displayed separately unless research proves a value adjustment.

### Market-anchored candidate

Until a fully internal dynasty target is validated, a safer experimental bridge is:

`CandidateValue_i = Scale( alpha * normalized_market_anchor_i + (1-alpha) * normalized_multi_year_surplus_i )`

`alpha` must be estimated through historical validation/sensitivity, not selected to make rankings look familiar.

This is preferable to multiplying market value by more age/scarcity coefficients because it separates the two information sources.

## 10. Dynasty horizon research

Do not promote a fixed horizon yet.

Test at minimum H = 2, 3, 4, 5 seasons.

Working hypothesis for validation: **3-4 seasons** is the most promising range because it is long enough to express youth/longevity and short enough to avoid a model being dominated by speculative distant seasons. This is not yet a production recommendation.

Future weights should be evaluated through target predictiveness and ranking stability. Candidate grids should include mild, moderate, and aggressive discounting rather than one magic discount rate.

## 11. Role survival and uncertainty

Projection Research found role-survival/collapse risk is chronologically predictable but multiplying it directly into next-season point projection worsened MAE.

For dynasty research this signal is conceptually better placed in future seasons 2+ because those seasons explicitly depend on continued NFL relevance.

Experimental decomposition:

`Pr(relevant in t) * E[opportunity | relevant,t] * E[efficiency | opportunity,relevant,t]`

Do not use collapse risk as a punitive point-value multiplier without validating multi-year realized surplus.

Uncertainty should remain separate display metadata initially. High uncertainty is not synonymous with low dynasty value.

## 12. Rookie contract

No unvalidated rookie model may silently become production dynasty math.

Required future contract:

- point estimate or distribution for rookie season production;
- uncertainty interval/tier;
- draft capital provenance;
- age;
- position;
- explicit zero-history status;
- multi-year survival/opportunity assumptions;
- fallback state when model unavailable.

Projection Research found draft capital strongly predictive across 2018-2024 development cohorts, but rookie confidence remains materially wider than veteran confidence.

Until independently approved, dynasty valuation should fail closed to a clearly labeled fallback rather than invent precision.

## 13. Historical validation design

There is no single observed true dynasty value. Candidate evaluation must therefore use multiple targets.

Primary football-realization targets:

- discounted future fantasy surplus over contemporaneous league-neutral or league-simulated replacement;
- number of future starter-caliber seasons;
- role survival / meaningful-opportunity seasons;
- realized multi-year fantasy points conditional on position and league scoring.

Secondary market targets, only where licensing/provenance allows:

- future market-value persistence;
- ability to preserve value versus age/role cohorts.

Required methodology:

- chronological walk-forward only;
- no future age/role/market leakage;
- position and experience stratification;
- 1QB and superflex simulation;
- TE-premium and non-premium simulation;
- shallow/deep starter configurations;
- rookie and limited-history reporting separated;
- sensitivity to horizon, discount, replacement, and anchor weight;
- untouched holdout period for final selection.

## 14. Sensitivity priorities

Parameters most likely to move rankings materially:

1. market-anchor weight `alpha`;
2. future-season horizon H;
3. future-season discount weights;
4. survival/relevance assumptions by position/experience;
5. replacement definition and flex demand;
6. how future projections regress toward positional/age-role priors.

Parameters that should not be tuned cosmetically:

- arbitrary youth multipliers;
- universal TE boosts;
- hand-picked position multipliers;
- player-specific exceptions;
- hard-coded values designed to reproduce known public rankings.

## 15. Regression safety matrix

Any candidate must explicitly test:

- elite QB retention in 1QB;
- elite QB amplification in superflex driven by replacement, not a manual QB multiplier;
- RB scarcity and shorter survival horizon;
- WR ordering across ages 21-31;
- TE premium vs no premium;
- young TE vs veteran TE with matched current projection;
- shallow vs deep leagues;
- multiple FLEX formats;
- rookies and second-year players;
- production identity matching;
- no numeric IDP activation.

## 16. Candidate comparison plan

Candidate A — Production control:

`market * (1 + age + structural + neutral_one_year_projection)`

Candidate B — Pure multi-year surplus:

`Scale(sum discounted expected league-specific surplus)`

Candidate C — Market-anchored multi-year surplus:

`Scale(alpha * market + (1-alpha) * multi-year surplus)`

Candidate D — Same as C with experimental season-2+ survival probability.

Do not create more candidates until these answer the central architecture question.

Expected initial preference for testing: **Candidate C**, because it can preserve useful market information while allowing League Vector's league-specific multi-year football model to contribute independently. It is not READY FOR QA until historical validation and deterministic reference outputs exist.

## 17. Core integration contract if a candidate later passes research

Core should receive an isolated experimental API, never an overwrite of `calculateValuation`.

Required contract fields:

- `dynasty_value_candidate: "experimental"`
- `production_dynasty_value_eligible: false`
- current production value
- market anchor and weight
- horizon
- per-season expected points
- per-season relevance probability if used
- per-season replacement level
- per-season surplus
- discount weights
- total discounted surplus
- uncertainty metadata
- fallback reason for rookie/limited-history players
- deterministic explanation components

No production UI activation until independent HIGH-risk QA and Founder approval.

## 18. Answers to the final questions

1. **Why are younger players currently undervalued?** Some are under-projected upstream, but the larger issue is that the dynasty formula has no explicit multi-year horizon. Youth is only a small piecewise overlay around a market anchor.
2. **How much comes from projection bias vs Dynasty Value math?** Projection bias is measurable in specific young cohorts, but its direct share of the displayed valuation gap is player-dependent. The structural dynasty-math deficiency is universal: future seasons are absent. A numeric decomposition requires deterministic player snapshots and historical valuation backtests not yet present.
3. **Why are TEs currently misvalued?** TE projection role instability, heuristic age treatment, a larger neutral-VORP cap, and incomplete propagation of actual league TE replacement/scoring context.
4. **Is TE scarcity wrong?** The key issue is not a single wrong TE scarcity number. League-specific TE replacement is computed but not used by final projection adjustment, while other TE-specific heuristics remain.
5. **Is age modeled incorrectly?** Yes. It is a hard-coded step multiplier rather than remaining expected productive surplus/survival.
6. **Is market information double-counted?** Plausibly yes, and the degree is unmeasured. The market baseline already represents dynasty beliefs while League Vector adds age, scarcity, and rookie overlays.
7. **Should League Vector move toward multi-year surplus over replacement?** Yes as the primary research direction.
8. **What dynasty horizon appears most defensible?** 3-4 years is the leading hypothesis for testing, but no horizon has earned promotion yet.
9. **What parameters matter most?** market-anchor weight, horizon, discounting, survival assumptions, replacement/flex demand, and future projection regression.
10. **Which candidate best fixes the issues without breaking existing values?** Candidate C, market-anchored multi-year league-specific surplus, is the best architecture to test first because it separates market information from football-derived surplus instead of stacking multipliers.
11. **What requires more research?** Historical multi-year target construction, survival curves, future-season projection regression, flex-demand estimation, market-anchor decomposition, rookie contract, and sensitivity/holdout validation.
12. **What should NEVER be solved with arbitrary multipliers?** Youth, TE value, superflex QB value, positional scarcity, rookie value, uncertainty, and player-specific ranking disagreements.

## Final status

**MORE DYNASTY VALUATION RESEARCH REQUIRED**
