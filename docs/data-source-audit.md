# League Vector Data Source Audit

Status: initial legal/technical audit for proprietary projection-model development.

This document is an engineering record, not legal advice. A source being publicly reachable is not enough for production use. League Vector should only promote a source into a production dependency when the license or terms clearly support the intended use.

## Recommended foundation

### 1. nflverse play-by-play / player stats

**Use status:** APPROVED FOR DEVELOPMENT; production use subject to preserving required attribution and source-specific license notes.

The nflverse `nflverse-pbp` repository publishes play-by-play and player-stat data through `nflverse-data`. The repository is marked CC BY 4.0. nflfastR documentation states play-by-play coverage reaches back to 1999. Current nflverse releases include recent seasons.

Useful fields include passing, rushing, receiving, touchdowns, sacks, interceptions, EPA, success-rate-related play data, CPOE-related fields, red-zone/goal-line context, air-yards-related fields, and stable GSIS identifiers where present.

**Attribution:** required under CC BY 4.0.

**Commercial use:** CC BY 4.0 generally permits commercial use and adaptation with attribution. However, individual nflverse datasets can have different provenance and licenses; data-file-level documentation must be checked before ingestion.

**Derived-data storage/model training:** acceptable for CC BY 4.0-covered datasets with required attribution. Do not assume this conclusion applies to datasets carrying a different source license.

### 2. nflverse players / identity tables

**Use status:** APPROVED FOR DEVELOPMENT WITH PROVENANCE CHECKS.

The nflverse players project maintains a cross-source player identity table centered on GSIS IDs and exposes mappings to several other identifiers. This is valuable for the League Vector crosswalk.

The package code is MIT-licensed, but the project combines identifiers sourced from multiple places. League Vector should persist only the identifiers needed for reconciliation and retain source/provenance metadata.

### 3. nflverse rosters

**Use status:** APPROVED FOR DEVELOPMENT WITH DATASET-LEVEL LICENSE CHECKS.

The roster project publishes rosters, depth charts, and practice/injury-related data into nflverse-data. The project code is MIT-licensed. Because underlying data may originate from third parties, the license of each consumed release must be checked rather than treating the package's code license as the data license.

### 4. Sleeper documented API

**Use status:** APPROVED FOR LEAGUE CONTEXT / IDENTITY; do not treat it as our projection source.

Sleeper documents a free, read-only API exposing users, leagues, drafts, rosters, transactions and player metadata. No API token is required. Sleeper asks clients to remain under roughly 1,000 calls/minute and says the full NFL player endpoint need not be called more than once per day. Trending-data use requires attribution to Sleeper.

League Vector should use Sleeper for league configuration, scoring settings, roster state and Sleeper IDs. It should not use Sleeper's undocumented projection endpoint as a production dependency.

### 5. nflreadpy / nflreadr

**Use status:** TOOLING ONLY.

These are convenience clients for nflverse data. Their package licenses do not override the licenses of the underlying datasets. They are useful ingestion tools but are not themselves the legal basis for reuse.

### 6. nfl-data-py

**Use status:** TOOLING ONLY / LEGACY.

Useful as a Python client and reference implementation. Data returned by its functions can have dataset-specific terms. League Vector should key legal decisions to the underlying nflverse release rather than the client library.

### 7. FTN participation data distributed through nflverse

**Use status:** CONDITIONAL.

Recent participation data distributed through nflverse is documented as CC BY-SA 4.0 and requires credit to FTN Data via nflverse. Share-alike obligations require care if League Vector redistributes modified versions of that dataset.

Using it as an internal feature source may be possible, but before production use we should review whether any exported derived dataset would trigger share-alike obligations.

**Classification:** LEGAL REVIEW REQUIRED before production redistribution.

### 8. NFL Big Data Bowl datasets

**Use status:** RESEARCH ONLY UNTIL COMPETITION/DATA TERMS ARE VERIFIED FOR THE SPECIFIC YEAR.

The datasets are excellent research material for tracking-derived football features, but Kaggle competition terms and NFL-provided data-use conditions can vary by year. Do not infer commercial rights from public availability.

**Classification:** LEGAL REVIEW REQUIRED.

### 9. NFL Next Gen Stats or data obtained by scraping NFL pages

**Use status:** DO NOT INTEGRATE by scraping.

League Vector should not scrape NFL, ESPN, Pro Football Reference, PFF, or other sites merely because data is visible. Any such feed requires explicit terms or a license permitting our intended commercial use.

### 10. SportsDataIO free trial

**Use status:** INTEGRATION TESTING ONLY.

SportsDataIO trial values are scrambled. They must be tagged internally as test data and must never be used as projection-model training truth or production player projections. SportsDataIO remains an optional adapter.

## Recommended long-term stack

1. **League configuration / roster state:** Sleeper documented API.
2. **Primary historical play-by-play and player-stat foundation:** CC BY 4.0-covered nflverse releases.
3. **Identity:** GSIS-centered internal crosswalk seeded from legally usable nflverse identity releases plus Sleeper IDs.
4. **Participation/snaps:** prefer clearly licensed nflverse releases; isolate CC BY-SA data so obligations are traceable.
5. **IDP:** derive defensible tackle/sack/turnover and role features from licensed play-by-play/player-stat datasets first; do not fabricate pressure/snap features when unavailable.
6. **Commercial vendors:** optional adapters only.

## Required provenance rule

Every imported dataset must carry:

- source name
- source URL/release identifier
- retrieval timestamp
- season/week range
- license identifier
- attribution text
- raw-data version/hash where practical
- transformation version
- whether redistribution is allowed
- whether commercial use is allowed or requires review

If any of these are unknown, ingestion may run in a research sandbox but the source cannot be promoted to the production model.
