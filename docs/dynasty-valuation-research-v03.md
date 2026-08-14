# League Vector Dynasty Valuation Research v0.3

Status: **MORE DYNASTY VALUATION RESEARCH REQUIRED**

Risk: **HIGH**

Branch: `codex/dynasty-valuation-research-v03`

Frozen historical snapshot SHA-256: `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`

## Firewalls

- `experimental=true`
- `production_dynasty_value_eligible=false`
- `idp_dynasty_value_available=false`
- no production, main, UI, or IDP numeric activation

## Objective

Primary validation target remains realized future football utility, not consensus dynasty rankings.

Long-term family:

`expected discounted multi-year league-specific surplus over replacement`

No historical depth-chart/opportunity state is backfilled with hindsight. Missing point-in-time opportunity remains an explicit limitation.

## Chronology contract

- exact calendar Y+h targets;
- absent player in an observed future season = zero production, not survivor-conditioned missingness;
- training target season must be strictly before valuation season;
- scored horizon must be completely observed;
- realized replacement comes only from the actual target-season pool;
- future replacement forecasts use only information available before valuation.

## Projection contract

Generic cross-position future regressions were rejected after catastrophic hybrid-player extrapolation. The current research contract uses position-specific football features:

- QB: passing/rushing role;
- RB: rushing/receiving role;
- WR: receiving role;
- TE: receiving role.

This removed the catastrophic extrapolation without arbitrary output caps. The contract remains research-only.

## Replacement result

Projecting only the valuation-season cohort forward was rejected because replacement collapsed as the cohort aged and omitted future NFL entrants.

The strongest chronology-safe replacement forecast tested so far is an expanding historical median of actual league-specific replacement levels available strictly before valuation. Earlier ablation reduced replacement MAE from roughly 59 points under cohort decay to roughly 10.6 points with near-zero mean bias. League-specific replacement remains materially important in Superflex/2QB and 2TE-like structures.

## Horizon result

A true five-year candidate is not identifiable from the frozen 2015-2025 window: the earliest fully observed five-year valuation lacks adequate leakage-safe Y+5 training history. H5 is therefore data-blocked, not failed.

After correcting replacement and projection extrapolation, H2 and H3 carry nearly all identifiable rank signal; H4 is inconsistent and often adds little. QB longevity does not justify blindly summing more distant seasons. RB is short-horizon. WR occasionally retains H3 information. TE generally does not justify a universal longer horizon.

The evidence therefore favors a short effective horizon, with survival/uncertainty carrying age and persistence rather than a hard-coded position multiplier.

## Discounting

At the currently identifiable short horizons, 0.80, 0.90 and 1.00 annual weights have produced extremely similar rank ordering. Discounting changes magnitude more than ordering. It remains an economic/value-scale parameter rather than a ranking optimization target.

## FLEX, Superflex and TE premium

Endogenous FLEX has not consistently earned its complexity over the production-equivalent fixed demand control and is not promoted.

Superflex/2QB scarcity remains a real league-specific replacement effect rather than an arbitrary QB multiplier.

TE premium is scored from actual TE receptions. 2TE demand changes replacement directly. No universal TE boost is supported.

## Market anchor

The pure football model is mathematically self-contained. External dynasty market values are not structurally required.

No leakage-safe point-in-time historical market series exists in the frozen repository evidence, so a historical market-anchor ablation cannot be executed honestly. Current market values are not backfilled into old seasons. Candidate market-anchor weight remains 0. The incremental value of a future provenance-approved market prior is untested rather than assumed.

## New cycle: youth and zero-compression diagnostic

Commit `f69bb994b6221356a696bee3a60b2d69e829e8e6` reran the previously committed youth/zero-compression diagnostic deterministically on the frozen snapshot. GitHub Actions run `31832594144` completed successfully and uploaded artifact `league-vector-dynasty-valuation-v03-position-diagnostics`.

The diagnostic explicitly tests:

- zero share by position and league format;
- young versus older players within matched Y+1 projection quintiles;
- H2 versus H3 raw-surplus increments;
- league-format deltas versus standard 1QB.

Interpretation rule was pre-registered: if `max(0, E[points]-replacement)` collapses most legitimate assets to zero, raw clipped expected surplus is insufficient as a complete dynasty asset value and must not be repaired with an arbitrary minimum value.

## New cycle: uncertainty propagation / expected positive surplus

A new isolated research harness tests the distinction between:

`max(0, E[Points] - Replacement)`

and

`E[max(0, Points - Replacement)]`.

The second quantity can preserve football-derived option value for uncertain players whose mean projection is below replacement but whose outcome distribution has a meaningful above-replacement tail.

Implementation rules:

- chronology-safe empirical residual distributions are estimated only from pre-valuation training observations;
- position-specific projection features are preserved;
- replacement uses the expanding historical median league-specific forecast;
- no arbitrary value floor;
- no consensus-ranking optimization;
- no market anchor;
- compare H2/H3/H4 and 0.80/0.90/1.00 sensitivity;
- compare directly against clipped expectation.

The first run failed closed because the harness referenced a nonexistent replacement helper. That defect was corrected rather than bypassed. Exact corrected research head: `8f18dddde867c15927eae49efdcef0d4b37b0529`. Its deterministic workflow is the current evidence gate.

## Explicit limitations

- No historical point-in-time depth charts/opportunity state; do not reconstruct with hindsight.
- H5 not identifiable with current history.
- No leakage-safe historical dynasty market snapshots.
- Rookie/zero-history model-derived value remains dependent on a separately QA-approved rookie projection contract.
- Empirical residual uncertainty is a first distributional approximation; it is not yet a fully calibrated player-specific predictive distribution.
- Production value scale remains unfrozen.

## QA gate

Do not mark READY FOR QA until a single exact head contains deterministic evidence that:

1. position-specific future production is outlier-safe without arbitrary caps;
2. league-specific replacement is chronology-safe and calibrated;
3. uncertainty propagation improves or preserves realized-utility validity without creating indiscriminate option value;
4. youth differentiation is football-derived and survives matched-projection controls;
5. H2/H3/H4 and discount sensitivity are stable enough to freeze;
6. Superflex/2QB, starter count and TE-premium behavior are football-plausible;
7. player-level failure cases are documented;
8. the exact formula and Core contract are frozen;
9. all production and IDP firewalls remain false.

## Current decision

The research has materially narrowed the architecture: short-horizon, league-specific, position-specific and pure-football-derived. The next unresolved primitive is distribution-aware positive surplus. It is not yet justified to freeze v0.3 for independent HIGH-risk QA.

**MORE DYNASTY VALUATION RESEARCH REQUIRED**
