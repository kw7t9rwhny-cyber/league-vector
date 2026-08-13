# Changelog

## v0.8 foundation — SportsDataIO evaluation

- Added a secret-safe SportsDataIO trial evaluator for player profiles, offensive projections and IDP projections.
- Added schema-only reporting that excludes API keys and raw provider data.
- Documented the Codex Cloud setup-phase workflow and free-trial limitations.

## v0.8 foundation

- Selected 1QB versus 2QB market columns from lineup structure.
- Replaced the duplicated `leaguePct` signal with distinct formula components.
- Separated structural league pressure from league-scored projection/VORP.
- Added explicit neutral and actual-league replacement benchmarks.
- Added scoring-key coverage and projection partial-failure reporting.
- Added exact player identity statuses and manual overrides.
- Added IndexedDB caching, request timeouts, concurrency limits and stale-request cancellation.
- Added traded-pick ownership without fabricated pick values.
- Added offensive team totals, starter/depth splits, positional comparisons and completeness.
- Marked IDP numeric totals unavailable instead of silently excluding them.
- Standardized interface language on v0.8 and added accessibility states.
- Added documentation, fixtures, tests, validation scripts and pull-request CI.
- Added stable-ID crosswalk precedence, stale-mapping disclosure and an offline crosswalk audit report.
- Added real-browser desktop/mobile tests with mocked one-QB, superflex, projection-outage, identity, IDP and escaping scenarios.
