# IDP Dynasty Value Model v0.1 — Research Contract

Status: **RESEARCH ONLY**

Permanent firewall: `idp_dynasty_value_available=false`.

This cycle does not modify the production current-season IDP ranking path and does not expose numeric IDP Dynasty Values.

## Research target

The conceptual target is position-specific expected multi-year fantasy surplus over league replacement:

`sum_h survival(h) * [expected league-scored production(h) - league replacement(h)]`, with any horizon and discount function frozen only after defense-specific chronological validation.

No offensive horizon, survival curve, replacement constant, age multiplier, or discount rate is inherited by assumption.

## Evidence currently available without historical depth charts

The approved historical pipeline can support player-season production, player-season age, experience where rookie year is known, year-over-year and multi-year production persistence, statistical participation persistence, production-percentile relevance persistence, and empirical production volatility by DL/LB/DB.

It cannot support true historical starter/reserve status, depth order, backup-to-starter transitions, starter-to-backup transitions, role survival, or snap-based opportunity because the current normalized source provides no defensible historical defensive-snap/depth authority.

Tackles, fantasy points, observed stat weeks, and production percentiles are never renamed as role or opportunity.

## Position families

The first research layer remains DL / LB / DB. Finer splits such as EDGE, interior DL, off-ball LB, CB, and S may be studied only after stable point-in-time role identity and adequate sample size are demonstrated. Current Sleeper hybrid eligibility must not be projected backward into historical seasons.

## Persistence and survival

For each DL/LB/DB population the research runner measures 1-, 2-, and 3-year persistence using Pearson and Spearman correlation of total reference-scoring points and points per observed week.

Fantasy relevance survival is measured as a sensitivity analysis using within-position, within-season production percentiles (p50 and p75). This answers whether a historically productive player remains similarly productive next season. It is not a starter-role survival probability.

## Age and experience

Age is historical player-season age at the established September 1 cutoff. Experience is `season - rookie_year + 1` where rookie year is known. Curves separately report production, participation proxy, conditional year-over-year change, and volatility.

## Uncertainty

Uncertainty is position-specific and currently represents empirical year-over-year production volatility. Role-transition uncertainty remains missing until a licensed/defensible opportunity source is integrated.

## Replacement / league sensitivity

Replacement research varies league size and starter counts against historical single-position pools. Current validated hybrid-aware constrained assignment remains conceptually available for future league-specific integration, but retrospective hybrid effects are blocked unless point-in-time eligibility is available.

IDP FLEX and current hybrid position effects therefore remain current-state architecture, not historical causal evidence.

## Scoring sensitivity

Historical stat lines must be re-scored under the target league's Sleeper rules before persistence/surplus coefficients are applied. A reference scoring system may be used for research comparison only; coefficients are not assumed portable across tackle-heavy and big-play-heavy leagues.

## Multi-year surplus architecture

Required inputs:

- current-season league-scored projection;
- defense-specific multi-year production forecast;
- position-specific fantasy-relevance survival;
- league-specific replacement by season;
- uncertainty distribution;
- separately validated horizon and discount function.

Explicitly prohibited substitutions:

- tackles as snaps;
- fantasy points as starter status;
- current depth chart as historical depth chart;
- current hybrid eligibility as historical eligibility;
- offensive survival/horizon/discount defaults.

## Future opportunity-data adapter

A future Sportradar or other approved point-in-time source should map into:

`player_id`, `season`, `week_or_snapshot_date`, `team`, `position_eligibility`, `depth_position_or_role`, `starter_flag_or_depth_order`, `defensive_snaps_if_licensed`, `source_timestamp`, and `source_provenance`.

The join key must be stable player identity plus point-in-time season/week. Historical state can never be overwritten by current state.

## Readiness rules

A multi-year projection may advance before a production Dynasty Value if chronological tests show stable predictive lift without requiring role data. Dynasty surplus additionally requires validated future replacement and survival. Production Dynasty Value remains blocked until multi-year surplus, uncertainty, horizon/discounting, identity, and role/opportunity limitations have independently passed QA.

No offense-vs-IDP normalization or combined rankings are part of this cycle.
