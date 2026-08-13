# League Vector IDP Projection Model

IDP is a first-class modeling target, not a cosmetic extension of offensive projections.

## Position families

Maintain separate conceptual models for DL/EDGE, LB and DB. Position mapping must be explicit and versioned because source classifications can differ.

## Candidate inputs

Use only legally usable data. Candidate features include tackles, assisted tackles, tackles for loss, sacks, QB hits, interceptions, passes defended, forced fumbles, fumble recoveries, defensive touchdowns, participation/snaps where licensed, team context, age and role indicators.

Pressure data, snap counts, role labels or alignment data must not be invented when unavailable.

## Modeling approach

Start with per-game and multi-year weighted baselines. Measure persistence and predictive value of each feature by position family. Add role/participation features only when they improve future-season performance in temporal backtests.

## Availability behavior

If the legal data foundation cannot support a statistic required by a league scoring rule, the model must report incomplete IDP scoring coverage. Team totals must not silently omit unavailable IDP values while presenting themselves as complete.

## Uncertainty

IDP roles can change rapidly. Projection output should eventually include calibrated or clearly labeled uncertainty and identify missing role/participation inputs.
