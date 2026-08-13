# Normalized football data architecture

League Vector separates provider-specific records from normalized football concepts used by future projections and valuation.

## Identity

`league_vector_player_id` is the application identity. GSIS is preferred when available; Sleeper ID remains the primary fantasy-platform identifier. Resolution order is manual verified mapping, exact GSIS/source ID, then a controlled name + position + team fallback. Ambiguous candidates remain unresolved.

## Source precedence

- nflverse/GSIS: historical football identity and performance when the specific dataset is approved in the licensing matrix.
- Sleeper: fantasy player identity, rosters, league settings and scoring context.
- League Vector: normalized identity, derived features, projections and valuations.
- SportsDataIO trial: schema testing only; never training or production projection truth.

## Observations

Normalized observations preserve season, week, historical team, source position, normalized position group, stat cells, provenance, transformation version and timing metadata. Source-specific column names stop at the adapter boundary.

## Missing values

League Vector distinguishes known zero, null, unavailable, not applicable and source error. Missing information must not silently become zero.

## Positions

Canonical groups are QB, RB, WR, TE, DL, LB and DB. Source positions and role hints remain available so IDP distinctions are not destroyed. OLB is not automatically assumed to be EDGE.

## Provenance

Dataset manifests use `APPROVED_COMMERCIAL`, `APPROVED_WITH_ATTRIBUTION`, `LEGAL_REVIEW_REQUIRED`, `DEVELOPMENT_ONLY`, or `PROHIBITED`. Legal-review, development-only and prohibited datasets cannot become training eligible through a caller flag.

## Storage and time integrity

Bulk historical downloads belong in the gitignored local cache, not the GitHub Pages repository. Future model rows must expose when features became available so rolling historical backtests can prevent future-data leakage.
