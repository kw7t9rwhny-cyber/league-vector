# Architecture

## Public v0.8 frontend

`index.html` and `styles.css` define the static GitHub Pages interface. `app.js` coordinates analysis and rendering. `data-sources-v08.js` owns browser requests, timeouts, concurrency and IndexedDB caching. `core-v08.js` contains deterministic calculations that run in both the browser and Node tests.

## Valuation contract

For a matched offensive player:

```text
adjusted baseline = max(market baseline, applicable rookie floor)
total adjustment = clamp(age + league structure, -25%, +35%)
final value = max(0, round(adjusted baseline × (1 + total adjustment)))
```

- **Market baseline:** `value_1qb` for one-QB lineups; `value_2qb` for superflex/two-QB lineups.
- **Age:** compact position-specific dynasty curve.
- **League structure:** team and lineup scarcity only. It excludes scoring bonuses.
- **Projection policy:** `CONTEXT_ONLY_NOT_IN_VALUATION`. Legacy weekly and experimental projection data are excluded from player values, team totals, sorting and ranking.
- **Rookie floor:** ECR or NFL draft-capital floor when the player has zero experience.
- **Confidence:** a same-source market/ECR agreement heuristic; informational only.
- **Trades:** local completed-trade count; informational only.

The paid-beta formula is therefore:

```text
total adjustment = clamp(age + league structure, -25%, +35%)
final value = max(0, round(adjusted baseline × (1 + total adjustment)))
```

The runtime state is `PAID_VALUE_ELIGIBLE` only under this projection-exclusion contract. The legacy weekly adapter is not requested during paid-value analysis, so incomplete, stale, malformed, timed-out, cached or mixed-version projection responses cannot enter a paid value. No missing projection is represented as numeric zero and no coverage is fabricated. The machine-readable contract is `docs/paid-data-eligibility-contract-v01.json`.

## Identity contract

1. Explicit Sleeper-ID manual override for a reviewed exception.
2. Verified Sleeper → stable provider-ID crosswalk.
3. Exact normalized name and position.
4. Team verification if multiple exact-name candidates exist.
5. Ambiguous or unmatched status; never fuzzy match silently.

The current DynastyProcess feed does not include Sleeper IDs. The public crosswalk is intentionally empty until mappings are verified; `scripts/audit-crosswalk.js` reports coverage and unresolved records from pinned input files without mutating the crosswalk. A future private service should maintain Sleeper → GSIS/FantasyPros/provider identifiers and preserve Sleeper position eligibility.

## Browser validation

Playwright serves the static frontend and intercepts all external data calls with deterministic fixtures. Desktop and mobile Chromium projects verify success and partial-data flows without depending on live Sleeper or DynastyProcess availability. GitHub Actions installs Chromium and runs these checks after the pure calculation suite.

## Future private API boundary

The public app should eventually request a versioned response from a private API such as:

```text
POST /v1/analyze-league
GET  /v1/data-status
GET  /v1/player-crosswalk/:sleeperId
```

The private service should own provider credentials, cached Sleeper player data, crosswalks, projection adapters, IDP projections, rate limiting, scoring audits and proprietary Top Dog Engine calculations. The frontend should receive component values and provenance, not model internals.

No hosting provider, paid service or private repository is selected in v0.8.
