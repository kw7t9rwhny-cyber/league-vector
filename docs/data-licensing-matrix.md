# League Vector Data Licensing Matrix

This file tracks the license status of data sources considered for the proprietary projection system. It is intentionally conservative.

| Source | Intended use | License / terms | Commercial model use | Attribution | Status |
|---|---|---|---|---|---|
| nflverse play-by-play and player stats | historical stats, features, labels | CC BY 4.0 for covered releases | generally permitted with attribution | required | approved for development; verify release provenance |
| nflverse player identity data | GSIS-centered crosswalk | package code MIT; component data provenance varies | depends on component provenance | preserve source metadata | approved with provenance checks |
| nflverse rosters | roster/position context | package code MIT; underlying data provenance can vary | depends on consumed dataset | preserve source metadata | approved with dataset checks |
| FTN participation data via nflverse | snaps/participation | CC BY-SA 4.0 as documented by nflverse | commercial use generally allowed subject to license | FTN Data via nflverse | legal review before redistribution |
| Sleeper documented API | league settings, rosters, Sleeper IDs | free read-only documented API; operational limits apply | approved for application integration based on current docs | attribution required for trending data | approved for league context |
| Sleeper undocumented projections | development fallback | undocumented and unstable | not approved as production dependency | n/a | development only |
| SportsDataIO free trial | adapter testing | vendor trial; values scrambled | not approved as production truth | per vendor terms | test only |
| NFL Big Data Bowl datasets | research | year-specific competition/data terms | unknown until exact terms reviewed | per competition terms | legal review required |

## Production promotion gate

Before a dataset is enabled for production training or inference, record the exact dataset/release, stable source location, license/terms version, attribution text, commercial-use status, redistribution status, source-data version, and the owner responsible for rechecking changes.

If any of those items are unknown, the source may remain research-only but cannot silently become a production dependency.
