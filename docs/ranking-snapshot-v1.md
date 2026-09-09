# Ranking Snapshot v1

`ranking-snapshot-v1.js` defines one immutable, platform-neutral JSON run containing both
`dynasty-1qb` and `dynasty-superflex` boards. Rankings, player detail and comparison
consume the same run. This module validates prepared data; it does not compute a
football ranking, ingest providers, publish rankings, or wire any pages.

The fixtures are fictional. Their ranks, observations, names, teams and method are
**SYNTHETIC — NOT FOOTBALL RANKINGS**. Synthetic `PUBLISHED` describes the fixture's
lifecycle example, not a real publication or approval. Evidence labels describe
completeness, never success probabilities or model quality.

## Contract

This document and the exported validator define `lv-ranking-snapshot/v1`. Every
listed property is required, including nullable properties. Unknown fields fail
closed at every object level. No defaults, numeric coercion or missing-to-zero
conversion occurs. Arrays contain only the documented type. Empty arrays mean
nothing recorded; `null` means the explicitly absent value. Strings are bounded,
trimmed and control-free. IDs are nonempty ASCII tokens; player IDs start `lv:`.
Synthetic players must have `lv:synthetic:` IDs and `Synthetic ` names.

| Object | Required fields and meaning |
| --- | --- |
| Snapshot | `schema_version`, unique `run_id`, `data_kind` (`SYNTHETIC` / `REAL`), `generated_at`, `published_at` or null, `data_cutoff`, `valid_until`, `publication`, `method`, `sources`, `formats`, `previous_run` or null |
| Publication | `state` (`STAGED`, `PUBLISHED`, `WITHDRAWN`), `rights_state` (`SYNTHETIC_ONLY`, `UNRESOLVED`, `CLEARED`, `REVOKED`), `reference` to the publication/eligibility decision |
| Method | `id`, `version`, bounded `summary`, `components`, `limitations`. Component array order is the declared fixed explanation order, with no contribution magnitude. |
| Component | `id`, `version`, `label` (at most 60 characters), `required_fields` identifying actual ranking inputs |
| Method limitation | `id`, `text` (at most 300 characters), `reviewed: true`. This is reviewed method interpretation, not a player factual assertion. |
| Source | `source_id`, `manifest_ref`, `content_hash` (`sha256:` plus 64 lowercase hex digits), `observed_at`, `data_cutoff`, `valid_until`, `delivery_state` (`SYNTHETIC_ONLY`, `ELIGIBLE`, `BLOCKED`, `REVOKED`), `eligibility_ref`, `attribution` |
| Formats | Exactly the keys `dynasty-1qb` and `dynasty-superflex`; no partial-run board replacement |
| Board | `assumptions_id`, `universe`, `entries` |
| Universe | `id`, `definition`, `supported_positions` (QB/RB/WR/TE), `eligible_player_ids`, `coverage_count`, `exclusions`. Eligible IDs match exactly the ranked entries. Coverage counts ranked players; total covered records is `entries.length`. |
| Player entry | `player_id`, `name`, `aliases`, `identity_state`, `position`, `team`, `team_state`, `status`, `age`, `identity_evidence_refs`, `ranking_status`, `rank`, `evidence_state`, `unsupported_reason`, `evidence_gaps`, `facts`, `drivers`, `primary_reason`, `limitations`, `change_conditions`, `history` |
| Fact | Run-wide unique `id`, `run_id`, `format`, `player_id`, `field`, `value`, nullable `unit`, `period`, `as_of`, `source_id` |
| Fact value | `state` (`KNOWN`, `MISSING`, `UNKNOWN`, `UNSUPPORTED`) and `value`. KNOWN accepts a finite number, boolean or at most 80 characters of observed text. Other states require null. An observed numeric zero is valid only as KNOWN. |
| Driver | Run-wide unique `id`, `component_id`, `direction` (`supports`, `hurts`, `neutral`, `unknown`), `use` (`ranking`, `context`), 1–3 `fact_refs` |
| Primary reason | `template_id: "observed-support/v1"`, `driver_id`; null for an unsupported player |
| Change condition | `fact_id`, `direction` (`increase`, `decrease`, `becomes_known`), `basis_driver_id`, `kind` (`METHOD`, `EDITORIAL`), `reviewed: true` |
| History | `state`, `previous_rank` or null, `changed_fact_refs`. See lineage below. |

The references intentionally replace raw source payloads. The referenced immutable
manifest must identify exact source fields, transformations, cutoff, custody and
upstream provenance; the eligibility packet must cover the actual delivery context
and displayed/derived outputs. A source's declared eligibility is inherited by its
facts and identity fields. `identity_evidence_refs` documents the displayed identity,
team/status and optional age, including the evidence of an unresolved identity.
A structural validator cannot verify these external decisions, authorship, athlete
identity or factual truth. A hash or `CLEARED` string grants no publication authority.

Both boards share run, method and source identities. Shared player IDs must have
identical identity fields across formats. Fact references explicitly bind player,
format and run; drivers and reasons inherit that binding through their containing
entry and cannot reference another entry. Fact fields are unique within an entry.

`ASSUMPTIONS` exports the two immutable profiles, bound by board `assumptions_id`:
12 teams; 1 QB, 2 RB, 3 WR, 1 TE, two RB/WR/TE flex slots; Superflex adds one
QB/RB/WR/TE slot. Scoring is PPR, 0.1 rush/receive yards, 6 rush/receive TDs, 0.04
passing yards, 4 passing TDs, -2 interceptions/lost fumbles and 2 for successful
two-point conversions. There is no TE premium, custom scoring or personalized
roster adjustment. Horizon is multi-season dynasty preference at cutoff. These
are disclosure metadata, not a new scoring or projection engine.

## Ranked and unsupported records

A ranked entry requires verified identity, QB/RB/WR/TE position, nonretired status,
a positive safe integer rank, every required method input KNOWN and eligible,
at least one supporting ranking driver, a primary reason and 1–3 reviewed method
limitations. Required input omissions never qualify as Limited. Actual ranking
drivers may reference only fields declared by their component and KNOWN eligible
facts. Context-only drivers cannot justify the primary reason.

`renderPrimaryReason` uses the versioned template:
`[component label]: [observed value] [unit] ([period]) supports the rank.`
It deterministically chooses the lowest fact ID when a driver binds several facts.
The rendered sentence must fit 180 characters. Up to three supporting and three
negative drivers are supported. The leading driver, method order and stable IDs
supply deterministic presentation without invented contribution values.

`identity_state` is VERIFIED or UNRESOLVED. Position additionally accepts OTHER or
UNKNOWN for unsupported records. `team_state` is KNOWN (nonempty team), UNKNOWN or
FREE_AGENT (team null). `status` is ACTIVE, RESERVE, UNKNOWN or RETIRED. Status is
an explicit sourced declaration; a null team does not imply free agency or retirement.
Age is null or `{years, as_of}` with years greater than zero and at most 60. No full
birth date is stored. Optional missing age/team is disclosed as Limited for ranked
entries; omission and numeric zero are invalid substitutes.

`DOCUMENTED` means all required inputs and explanation support are present with no
disclosed optional gaps. `LIMITED` requires precise `evidence_gaps`: `missing_age`,
`missing_team`, `missing_change_condition`, `optional_input_missing`, or
`nonblocking_disagreement`. The first four must agree exactly with recorded state.
A missing change condition always makes the entry Limited. Numeric conditions
require a known numeric fact; `becomes_known` requires an absent observation.
A METHOD condition must bind a ranking driver. EDITORIAL conditions are labeled
review interpretations with a reviewed factual/driver basis, never predicted reversals.

`NOT_RANKED` requires rank and primary reason null, evidence UNAVAILABLE, no drivers
or conditions, and one bounded reason:
`insufficient_history`, `rookie_method_unavailable`, `identity_unresolved`,
`source_unavailable`, `unsupported_position`, `required_input_missing`,
`method_unavailable`, `outside_eligible_universe`.
Known unsupported records remain in `entries`; they are not silently discarded to
fill a board. An empty or incomplete eligible universe is valid. There is no 200-player
minimum. Unknown requested ID and covered-but-NOT_RANKED are distinct results.

Rank order is ascending overall ordinal. Repeated rank is an explicit declaration
of an exact method tie, using competition ranking: `1,1,3`, never `1,1,2`.
Within exact ties, internal player ID sorts ascending. No score/proximity rule
creates a tie. Unsupported entries sort after ranked entries by player ID. Filters
must retain stored overall ranks. Numeric trade values, prices, tiers, probabilities
and arbitrary generated recommendation fields are outside this strict schema.

## Time, rights and immutable readback

All timestamps use the exact UTC form `YYYY-MM-DDTHH:mm:ss.sssZ` and must be real
calendar times. Fact as-of cannot exceed its source cutoff, source cutoff cannot
exceed the run cutoff, cutoff cannot exceed generation, and source observation
cannot exceed generation. Source expiry bounds run `valid_until`; publication
cannot precede generation or reach expiry. Staged runs have null publication time.
Synthetic runs/sources require SYNTHETIC_ONLY. Real published runs require declared
CLEARED rights and eligible sources. Revoked real rights require WITHDRAWN state.

`getRunState(snapshot, now)` takes an explicit timestamp, never the wall clock.
It returns SYNTHETIC, AVAILABLE, OUTDATED or UNAVAILABLE. Current use expires at
the earlier of `valid_until` and seven days after publication (generation for staged
synthetic fixtures). Dates before the publication anchor are unavailable. Outdated
snapshots may supply historical views; no current comparison preference is allowed.
Normal selectors reject WITHDRAWN runs and staged real data.

Corrections produce new run IDs/artifacts. The module has no persistence, latest
pointer or withdrawal service. A serving layer must honor external withdrawal/
replacement notices before handing out historical bytes; hashing cannot revoke an
already distributed artifact. Changing lifecycle metadata creates different bytes,
not an in-place update. Duplicate run IDs are rejected by catalog validation.

Canonical JSON uses sorted object keys, ECMAScript JSON number/string encoding and
UTF-8, with no whitespace, BOM or trailing newline. No RFC 8785 conformance claim is
made. Collections with set semantics sort by identity; entries sort by rank/player
ID, components retain declared method order, drivers follow component order then ID.
Optional values are explicit null. Array holes, accessors, custom prototypes, hidden
or symbol fields, undefined, nonfinite numbers, negative zero, lone surrogates,
unsafe keys and cycles are rejected. Hashing does not invoke caller `toJSON`.

`canonicalizeSnapshot` validates and emits canonical text without mutating input.
`snapshotArtifactId` returns SHA-256 of its UTF-8 bytes, using Web Crypto available
in Node 20+ and secure browser contexts; no dependency or crypto infrastructure is
added. Artifact identity lives outside the hashed envelope to avoid self-reference.
`parseCanonicalSnapshot` checks exact canonical bytes after parsing and returns a
frozen object. Duplicate JSON keys and alternate encodings are therefore rejected.
For untrusted serialized artifacts, use this strict parser rather than calling
`JSON.parse` first (which would discard duplicate-key evidence).

## Prior runs

`createPreviousRun(publishedSnapshot)` produces a frozen compact summary containing
`run_id`, `artifact_id`, `published_at`, `data_cutoff`, full `method`, and both format
boards with `assumptions_id`, `universe`, and entries of `player_id`, `rank`,
`ranking_status` and facts `{field,value}`. No live source access is needed. The
prior summary must precede current generation, have a nonfuture cutoff, valid ranks,
and KNOWN required inputs for every previously ranked player.

History states are derived and validated, never trusted as free-form narration:

- NOT_RANKED for a current unsupported entry; FIRST_RUN when previous_run is null.
- NOT_COMPARABLE if method or assumptions differ.
- NEW_PLAYER if not ranked in that predecessor.
- NOT_COMPARABLE for previously ranked players when universe metadata/membership differs.
- COMPARABLE otherwise, with exact prior rank and changed current fact IDs whose
  value/state differs from the same prior field. A newly recorded field counts as changed.

Noncomparable states require null previous rank and an empty change list. Comparable
movement is `previous_rank - rank`; zero is a real unchanged rank. A changed rank
with no changed facts means the stored ordering changed without evidence of new
player inputs; it does not imply player news. Comparison history makes no claims
about changed drivers or removed fields; only the retained value/state comparison
is supported in v1. Consumers show at most three changed facts.

Standalone validation checks summary consistency; it cannot authenticate a claimed
predecessor from its hash alone. `validateSnapshotCatalog` requires the complete
available chain, rejects duplicate run IDs/publication times, verifies each summary
and artifact hash against its full prior snapshot, and checks the immediately prior
published run as of publication (generation for staged runs). An intervening
publication requires regeneration; it cannot be silently skipped. Use this at artifact ingestion. It is a validation function, not a
registry or database. Callers must supply one publication lineage, not unrelated
experiments combined into a catalog.

## Consumer API and fixture checks

CommonJS: `require('./ranking-snapshot-v1.js')`. Browser script global:
`LeagueVectorRankingSnapshotV1`. Neither path performs network access.

```js
const api = require('./ranking-snapshot-v1.js');
const snapshot = require('./fixtures/ranking-snapshot-v1/synthetic-current.json');
api.validateSnapshot(snapshot); // true or throws Error with code invalid_snapshot
const bytes = api.canonicalizeSnapshot(snapshot);
const artifactId = await api.snapshotArtifactId(snapshot);
const frozen = api.parseCanonicalSnapshot(bytes);
const selection = {
  run_id: frozen.run_id, format: 'dynasty-1qb', player_id: 'lv:synthetic:alpha'
};
api.selectPlayer(frozen, selection); // canonical frozen entry, or null for unknown ID
api.renderPrimaryReason(frozen, selection); // bounded sentence, or null if not ranked
api.nearbyAlternatives(frozen, selection); // nearest same-position entries, at most two
api.comparePlayers(frozen, {
  run_id: frozen.run_id, format: 'dynasty-1qb',
  player_ids: ['lv:synthetic:alpha', 'lv:synthetic:bravo'],
  now: frozen.published_at
});
```

Selectors throw for an invalid run/format or unavailable display. Returned entries
are detached and recursively frozen. Neighbors use the nearest same-position player
above and below; at an edge use the next available same-side neighbor.

Comparison evaluates invalid/missing/unsupported/withdrawn/outdated state first and
returns UNAVAILABLE. It permits exactly two distinct players within the requested
format/run. Otherwise it returns NO_CLEAR_PREFERENCE (`exact_tie` or
`no_pairwise_rule`), with both structured records, assumptions, limitations, evidence
caveat and review conditions. V1 intentionally declares no pairwise preference rule.
The order alone never selects a winner. No ORDER_FAVORS outcome or reversal is
manufactured from two positive drivers or a rank gap. A future approved method rule
would require a separately reviewed schema/implementation extension.

Fixtures include both complete format boards, tied ranked veterans, unsupported
rookie/insufficient-history/unresolved records, missing age/team/context/conditions,
known numeric zero, prior/no-prior state, rank movement and unchanged-player-input
movement. `invalid-cases.json` contains named mutations of the valid current fixture
for negative tests; it is a test recipe, never a snapshot to serve.

Run `node --test tests/ranking-snapshot-v1.test.js`, then `npm run validate`.
Tests cover canonical bytes/digests, Node/browser parity, strict validation, lineage,
ties, ordering, optional data, source/evidence binding and consumer abstention.
Passing deterministic checks is implementation evidence, not independent QA,
rights clearance, method validation, real publication or release authorization.
