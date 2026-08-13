# League Vector IDP Projection Model

IDP is a first-class modeling target, not a cosmetic extension of offensive projections.

## Position families

Maintain separate conceptual models for DL/EDGE, LB and DB. Position mapping must be explicit and versioned because source classifications can differ.

## Candidate inputs

Use only legally usable data. Candidate features include tackles, assisted tackles, tackles for loss, sacks, QB hits, interceptions, passes defended, forced fumbles, fumble recoveries, defensive touchdowns, participation/snaps where licensed, team context, age and role indicators.

Pressure data, snap counts, role labels or alignment data must not be invented when unavailable.

## Modeling approach

Start with per-game and multi-year weighted baselines. Measure persistence and predictive value of each feature by position family. Add role/participation features only when they improve future-season performance in temporal backtests.

## Structural pressure versus scoring environment

League Vector deliberately separates lineup demand from IDP scoring context.

- **Structural pressure** measures how strongly the league lineup architecture demands DL, LB or DB. Dedicated slots are counted directly and a generic IDP flex is shared across the eligible defensive groups rather than counted once for every group.
- **IDP scoring environment** measures how the league's active IDP scoring rules reward the different historical production shapes of DL, LB and DB.
- **Replacement level / VORP** remains a separate player-value concept. It is not included in the IDP scoring-environment index.

Equal structural scores are therefore valid when DL/LB/DB lineup demand is symmetrical. The scoring-environment component can still differ because linebackers accumulate a different tackle profile, defensive linemen a different sack/TFL/QB-hit profile, and defensive backs a different interception/pass-defense profile.

## Historical IDP scoring profile v0.1

The v0.1 scoring-context profile is derived from League Vector's approved normalized historical player-season data. It uses player-seasons with at least eight observed games and summarizes each canonical defensive statistic as a 10% trimmed mean of per-game production for DL, LB and DB separately. Mean, median and sample size are retained for sensitivity review.

The live league stat profile is scored under the league's supported active Sleeper IDP rules and compared with the versioned **LV-IDP-BALANCED-v0.1** reference:

- solo tackle: 1.5
- assisted tackle: 0.75
- tackle for loss: 2
- sack: 4
- QB hit: 1
- interception: 6
- pass defended: 1.5
- forced fumble: 3
- fumble recovery: 3
- defensive touchdown: 6
- safety: 4

The reference is a stable analytical baseline, not a claim that these are universal or ideal IDP settings.

`scoring_environment_index = 100 × league-scored historical profile / reference-scored historical profile`

An informational overall IDP league-context number can be displayed as:

`structural_pressure × scoring_environment_index / 100`

This number is context only. It does not create an IDP dynasty market value and does not feed the offensive dynasty valuation pipeline.

## Coverage

Only active scoring keys that can be mapped to normalized, training-eligible IDP statistics are included. Unsupported active keys are reported and the scoring-environment result is labeled partial when appropriate. Missing fields are never converted to zero merely to improve coverage.

Legacy projection coverage and League Vector v0.3 projection coverage are separate systems and must be labeled separately.

## Availability behavior

If the legal data foundation cannot support a statistic required by a league scoring rule, the model must report incomplete IDP scoring coverage. Team totals must not silently omit unavailable IDP values while presenting themselves as complete.

IDP dynasty numeric value remains unavailable until League Vector has a defensible market/value foundation. Experimental production projections and scoring context do not remove that restriction.

## Uncertainty

IDP roles can change rapidly. Projection output should eventually include calibrated or clearly labeled uncertainty and identify missing role/participation inputs.