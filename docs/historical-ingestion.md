# Historical ingestion

League Vector's first real development ingestion targets the 2022, 2023, and 2024 NFL regular seasons. It combines the nflverse `players` release, nflverse `stats_player` weekly release assets, and the documented Sleeper NFL player universe.

## Reproduction

Run:

```bash
npm run ingest:nflverse -- --seasons 2022,2023,2024 --outputDir data/reports --refresh true
```

The command downloads source files into `.cache/league-vector/historical/`, which is ignored by Git, and writes metadata/audit products into `data/reports/`. CI runs the same command on the draft pull request and uploads the reports as the `league-vector-historical-audit` workflow artifact.

The command fails if any requested season cannot be fetched or parses to zero rows. A partial set of seasons is not presented as a complete dataset.

## Identity policy

League Vector uses its own application identity while preferring GSIS IDs for football records and Sleeper IDs for fantasy-platform context. Resolution order is manual verified override, exact GSIS/stable identifier, exact existing source mapping where available, controlled name/position/team corroboration, then unresolved. Fuzzy string similarity is not evidence of identity.

Current Sleeper team data is not written over historical nflverse team data. Historical observations keep the source team's value for that season/week.

## Reports

The ingestion produces:

- `historical-ingestion-summary.json`
- `player-identity-report.json`
- `player-identity-review.json`
- `historical-data-quality.json`
- `historical-field-coverage.json`
- `historical-manifests.json`
- `generated-player-crosswalk.json`

The review queue keeps unmatched, ambiguous, and conflicting identities separate and lists controlled candidates when they exist.

## Missing values

Normalized statistics preserve distinct states for known values (including zero), null source values, unavailable fields, not-applicable fields, and source errors. Missing values are never silently converted to zero.

## Temporal integrity

The weekly player-stat release does not by itself prove the original publication timestamp of every historical row. League Vector therefore does not invent `feature_available_at`. The initial projection benchmark must use completed prior seasons only for preseason targets. Within-season modeling remains blocked until a defensible availability timestamp or conservative schedule-based availability rule is attached and tested.

## Licensing and eligibility

The nflverse `nflverse-data` repository is distributed under CC BY 4.0 and League Vector records the relevant attribution in each manifest. Dataset-level provenance is still reviewed independently; third-party datasets with different terms are not automatically approved simply because nflverse hosts or references them.

SportsDataIO free-trial records are classified as development/schema-testing data only. They are excluded from the historical ingestion, training labels, identity authority, and model evaluation.

## Data volume

Raw downloads and the full normalized development dataset are intentionally not committed to Git. Small fixtures, manifests, summaries, and reproducible code are the versioned artifacts. Production-scale storage is a later infrastructure decision.
