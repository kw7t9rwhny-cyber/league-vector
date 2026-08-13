# Player identity

League Vector uses a persistent internal player ID and prefers GSIS/NFL IDs for football identity. Sleeper ID remains the primary fantasy-platform identifier.

## Resolution hierarchy

1. Explicit manually verified mapping.
2. Exact GSIS ID.
3. Exact stable source crosswalk.
4. Controlled fallback using normalized name plus position and team corroboration.
5. Unresolved.

Name normalization is only a candidate-generation helper. It does not prove that two records represent the same player. Multiple plausible candidates remain ambiguous.

## Supported identifiers

The normalized player record can retain GSIS, Sleeper, nflverse/smart, SportsDataIO, ESPN, Sportradar, PFR, PFF, OTC and other source IDs when legitimately available. Missing IDs are allowed and never fabricated.

## Manual overrides

Manual overrides are separate from automated crosswalk output and take precedence. Persisted mappings should include resolution method, verification status, update timestamp and optional notes.

## Position identity

Source defensive position is preserved alongside the canonical DL/LB/DB group and an optional role hint. This avoids losing EDGE/interior/corner/safety distinctions. OLB alone is insufficient evidence to label a player EDGE.

## Reporting

Crosswalk builds report exact stable-ID matches, manual resolutions, verified fallbacks, unmatched players, ambiguous candidates and conflicts. Unresolved players are never silently discarded.
