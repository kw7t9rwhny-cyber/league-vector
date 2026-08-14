# League Vector Prospective NFL Opportunity Archive v0.1

Status: **INFRASTRUCTURE CANDIDATE — MEDIUM RISK**

Current normalized schema: `lv-prospective-opportunity-archive-v1.1`.

This archive is research infrastructure only. It does not change production projections, Dynasty Value, UI, Core behavior, IDP production behavior, or `main`.

## Principle

League Vector preserves what it knew **when it knew it**. A later source correction creates a new observation. Historical observations and content objects are never silently rewritten. Current information is never backfilled into an earlier date.

## Initial approved sources

### nflverse depth charts — primary prospective source
- release: `nflverse/nflverse-data`, tag `depth_charts`
- 2025+ source structure contains timestamped appended depth-chart states and ordered `pos_rank`
- source provenance in current nflreadr releases: source changed to ESPN for the 2025+ date-based depth-chart implementation
- nflverse-data repository license: CC BY 4.0; upstream provenance and commercial-use implications remain recorded rather than silently assumed
- captured evidence: team, player/provider identity, GSIS when supplied, name, provider position group/slot, ordered depth, starter representation, provider status, source timestamp, and all provider-native columns for the selected point-in-time state

### nflverse weekly rosters — independent roster-state evidence
- release: `nflverse/nflverse-data`, tag `weekly_rosters`
- source described by nflverse as NFL Shield v2 roster data
- captured evidence: team, roster status, position, depth-chart-position label, practice-squad indicator when represented by status, provider/GSIS/Sleeper IDs when supplied, current source week, and provider-native columns
- roster state is not overwritten by the depth-chart feed; the two evidence streams remain independent

### Not yet archived
- nflverse injuries currently does not provide a fresh 2026 preseason point-in-time feed suitable for this archive as of the initial implementation; stale data is not promoted as current evidence
- a complete signings/releases/suspensions/transaction event feed has not yet been approved; team changes may be derived only between frozen states and must not be misrepresented as a known transaction timestamp
- free-agent/teamless state is not inferred from absence alone
- Sportradar is not used until Founder receives acceptable access/licensing terms
- proprietary or scraping-restricted sites are not used

## Storage model

The archive separates **content** from **observation**.

Content-addressed raw-normalized evidence:

`data/opportunity-archive/objects/<feed>/<sha-prefix>/<sha256>.json.gz`

Observation proving what League Vector retrieved at time T:

`data/opportunity-archive/observations/<season>/<season_type>/<UTC timestamp>/<feed>.json`

Quality report:

`.../<feed>.quality.json`

Derived evidence, when a previous frozen state exists:

`data/opportunity-archive/derived/<season>/<UTC timestamp>/...json.gz`

Global append-only manifest:

`data/opportunity-archive/manifest.jsonl`

A no-change run creates a new timestamped observation referencing the existing content hash/object. It does **not** duplicate the content object. This preserves point-in-time observation evidence while limiting Git growth.

## Snapshot identifier

Canonical concept:

`<season>/<season_type>/<YYYY-MM-DDTHHMMSSZ>/<feed>/<provider>`

Example:

`2026/PRE/2026-08-14T180000Z/depth_chart/nflverse`

The retrieval timestamp is UTC. `effective_cutoff_timestamp` is the retrieval timestamp for prospective evidence unless a source supplies a separately validated earlier effective timestamp.

## Provenance fields

Every observation records:
- provider
- source dataset/feed
- source URL
- release/API metadata endpoint
- retrieval timestamp UTC
- source timestamp/week when supplied
- NFL season
- season type
- week when applicable
- effective/cutoff timestamp
- schema version
- source version/release update timestamp when available
- source-file SHA-256
- normalized-content SHA-256
- license/provenance basis

## Identity

Identity follows League Vector's safe identity posture:
- native GSIS is accepted as an exact stable identity when supplied
- `league_vector_player_id` is generated only from exact GSIS as `lv:gsis:<id>`
- Sleeper ID is preserved only when supplied by the source
- provider ID is preserved independently
- no fuzzy name matching is performed
- unresolved rows remain explicitly unresolved

Provider-native team values are preserved separately from canonical League Vector team values. Known aliases such as `AZ -> ARI`, `WSH -> WAS`, and `JAC -> JAX` are normalized through an explicit deterministic map; the source-native value remains in both `provider_team` and `provider_native` evidence.

A stable player identity appearing in multiple depth slots on the same team is reported as a repeated identity, not automatically treated as a duplicate conflict. A stable identity appearing on more than one canonical team in the same capture is a structural failure.

## Depth representation

Ordered provider depth is preserved. Starter is a representation of `depth_order == 1`, not a projection bonus.

Provider-native position/slot is retained so later research can reconstruct concepts such as QB1/QB2, RB1/RB2, WR1/WR2/WR3 and TE1/TE2 without discarding source detail.

Derived transition evidence is written separately and may include:
- `BACKUP_TO_STARTER`
- `STARTER_TO_BACKUP`
- `ROLE_PROMOTION`
- `ROLE_DEMOTION`
- `NEW_TO_DEPTH_CHART`
- `LEFT_DEPTH_CHART`
- `team_changed=true`

Derived fields never replace raw-normalized source evidence.

## Roster / reserve state

Roster evidence is a separate feed. PUP, IR, NFI, reserve, practice squad, suspension or other list states are preserved only when the source actually supplies them. The collector does not infer future availability and does not allow a depth-chart appearance to redefine roster status.

A missing roster-status field in the depth-chart feed is therefore not filled from another source inside the raw depth object. Roster status remains an independently timestamped evidence stream and is joined only downstream under point-in-time rules.

## Transactions and vacated opportunity

The archive intentionally preserves the evidence required to derive vacated opportunity later rather than persisting only a final aggregate number.

When an approved transaction feed is added, the same contract will record event timestamp/effective date, player identity, source and team movement. Prior-season targets/carries/attempts remain separate frozen statistical evidence. `vacated_targets`, `vacated_carries` and related features are downstream reconstructions from those inputs.

Until a timestamped transaction feed is approved, a difference between two roster/depth snapshots may establish a state change, but not the exact transaction time or transaction type.

## Quality gates

Each capture reports:
- teams represented
- rows / unique player identities
- missing teams
- resolved vs unresolved GSIS identities
- repeated same-team stable identities
- cross-team stable-identity conflicts
- exact duplicate evidence rows
- missing depth order
- missing roster status
- source timestamp and source age where parseable

Structural fail-closed gates currently require:
- all 32 NFL teams
- at least 1,000 evidence rows per initial feed
- no exact duplicate evidence rows
- no stable identity present on multiple canonical teams in the same capture
- depth-order missingness <=5% for the depth-chart feed
- no missing team values
- <=1% rows without any stable GSIS/provider identity

A failed feed writes a failure record and exits non-zero. It does not fabricate a snapshot or overwrite the last good state.

## Failure handling

Failures are stored under:

`data/opportunity-archive/failures/<year>/<timestamp>/<feed>.json`

GitHub Actions remains failed/visible. The next scheduled run retries from source. No prior good snapshot is changed.

## Cadence

The repository workflow evaluates on a daily cron, while the collector derives eligibility from the same explicit NFL season-phase calendar used for `season_type`.

For the configured 2026 archive calendar:
- **PRE / training camp / preseason:** before `2026-09-10T00:20:00Z`, scheduled capture is eligible daily.
- **REG:** beginning exactly `2026-09-10T00:20:00Z`, scheduled capture is eligible weekly on the approved Tuesday UTC cadence.

The phase boundary, not the calendar month, controls cadence. Therefore September 10–30, 2026 is already REG and does **not** continue daily merely because it is September. Non-Tuesday scheduled evaluations during REG exit as clean cadence skips. A forced workflow dispatch remains available only from the repository default branch for a narrowly justified milestone or source event.

Higher-frequency capture is not enabled initially. nflverse's primary prospective depth feed is updated on a daily cadence; collecting it multiple times per day would add little information while increasing load and repository churn. Revisit only if a licensed source supplies meaningful intraday state changes.

## Named milestone freezes

Routine immutable observations are the source of truth. Milestone freezes are immutable pointers to an already captured observation, never reconstructed states. The archive contract supports these names:
- training camp
- preseason Week 1
- preseason Week 2
- preseason Week 3 / final preseason
- final roster cuts
- final pre-Week-1 snapshot
- regular-season Week N

The scheduled collector guarantees routine daily PRE and weekly REG coverage under the explicit phase calendar. Milestone pointer creation can be automated from an approved 2026 schedule/cutoff configuration without changing underlying observations. The especially important final pre-Week-1 pointer must resolve to the last valid capture strictly before Week 1, matching the existing opportunity backtest cutoff contract.

## Backtest compatibility

The intended path is:

`snapshot archive -> point-in-time normalization -> opportunity features -> chronological model fold`

The archive preserves the existing Current Opportunity v0.1 concepts: provider ID, GSIS identity, canonical team, provider-native team, position/role, ordered depth, roster state, source time, retrieval time, and immutable hashes. Future adapters should consume observations/manifests directly rather than reconstructing state manually.

## Expected storage growth

The implementation does **not** commit the full accumulating nflverse source files (the 2026 depth-chart release itself is already tens of MB). It stores only the selected current state as deterministic gzip plus tiny observations/quality records.

Planning estimate for the initial two feeds:
- normalized depth object: roughly 0.1–0.3 MB compressed per changed state
- roster object: roughly 0.1–0.3 MB compressed per changed state
- observations/quality/manifest: typically only KB per run
- daily PRE capture followed by weekly REG capture under the explicit configured season calendar
- pessimistic if both feeds materially change every eligible capture: roughly 50–150 MB/year
- expected with content deduplication and slower roster changes: materially below that range

This is acceptable for an initial prospective research archive but should be reviewed after 30/90 days. If growth trends toward hundreds of MB/year, migrate immutable content objects to GitHub Releases or approved object storage while retaining compact manifests/hashes in Git. No paid storage is authorized here.

## Live validation / schema evolution

The first real capture occurred on August 14, 2026. Its v1 observation is deliberately retained exactly as written. Real data exposed a provider team-code mismatch: the depth feed represented Arizona as `ARI` while the roster feed used `AZ`. That first observation was **not rewritten**.

Schema v1.1 added explicit team-code normalization while retaining the provider-native team value. A new observation was then captured from the same source state. This is the expected immutability behavior: normalize future evidence correctly, version the schema, and preserve prior evidence rather than silently repairing history.

The v1.1 live validation requires canonical team-set agreement and zero cross-team stable-identity conflicts before the infrastructure is eligible for QA handoff.

## GitHub Actions / integration

Scheduled workflows execute from the repository default branch. The write-enabled capture job also requires `github.ref` to equal the repository default-branch ref, so `workflow_dispatch` on a feature/research branch or tag cannot obtain archive write authority. Pull requests run contract validation only and do not enter capture.

The isolated research branch validates capture mechanics, but **ongoing cron automation requires the narrowly scoped workflow/collector to be integrated into `main` after QA/Core approval**.

The integration candidate remains calculation-neutral: collector, archive data, tests, documentation and workflow only. Scheduled archive commits are data/provenance commits and must not modify production calculation files.

## Sportradar adapter path

Sportradar can later plug into the same archive without changing downstream semantics:
1. vendor payload is retained/normalized under a new `provider=sportradar` feed adapter
2. source timestamp, season/type/week and vendor snapshot/version become observation provenance
3. Sportradar player/team IDs are preserved and crosswalked to GSIS only through exact/approved identity mappings
4. ordered depth, injuries and transactions remain separate evidence types
5. content objects use the same deterministic SHA-256 + observation manifest model
6. historical Sportradar data, if licensed, can use the same schema but must retain its original historical as-of semantics rather than being mixed with prospective retrieval timestamps

## Projection value

This archive does not alter projections today. Its value is future causal/chronological evidence: League Vector will be able to test whether current role state, backup-to-starter transitions, depth changes, roster movement, reserve status, incoming competition and vacated opportunity improve validated projections—especially for second- and third-year players—without hindsight leakage.
