# Architecture

## Public v0.8 frontend

`index.html` and `styles.css` define the static GitHub Pages interface. `app.js` coordinates analysis and rendering. `data-sources-v08.js` owns browser requests, timeouts, concurrency and IndexedDB caching. `core-v08.js` contains deterministic calculations that run in both the browser and Node tests.

## Valuation contract

For a matched offensive player:

```text
adjusted baseline = max(market baseline, applicable rookie floor)
total adjustment = clamp(age + league structure + projection, -25%, +35%)
final value = max(0, round(adjusted baseline × (1 + total adjustment)))
```

- **Market baseline:** `value_1qb` for one-QB lineups; `value_2qb` for superflex/two-QB lineups.
- **Age:** compact position-specific dynasty curve.
- **League structure:** team and lineup scarcity only. It excludes scoring bonuses.
- **Projection:** league-scored projected performance above a neutral 12-team/1QB replacement benchmark.
- **League VORP:** displayed against actual league replacement, but not added again to value.
- **Rookie floor:** ECR or NFL draft-capital floor when the player has zero experience.
- **Confidence:** a same-source market/ECR agreement heuristic; informational only.
- **Trades:** local completed-trade count; informational only.

Separating structural pressure from league-scored projection prevents the same scoring rule from being applied as both a direct league multiplier and a projection multiplier. Actual league VORP remains visible without becoming a second scarcity adjustment.

## Identity contract

1. Explicit Sleeper-ID override.
2. Exact normalized name and position.
3. Team verification if multiple exact-name candidates exist.
4. Ambiguous or unmatched status; never fuzzy match silently.

The current DynastyProcess feed does not include Sleeper IDs. A future private service should maintain Sleeper → GSIS/FantasyPros/provider identifiers and preserve Sleeper position eligibility.

## Future private API boundary

The public app should eventually request a versioned response from a private API such as:

```text
POST /v1/analyze-league
GET  /v1/data-status
GET  /v1/player-crosswalk/:sleeperId
```

The private service should own provider credentials, cached Sleeper player data, crosswalks, projection adapters, IDP projections, rate limiting, scoring audits and proprietary Top Dog Engine calculations. The frontend should receive component values and provenance, not model internals.

No hosting provider, paid service or private repository is selected in v0.8.
