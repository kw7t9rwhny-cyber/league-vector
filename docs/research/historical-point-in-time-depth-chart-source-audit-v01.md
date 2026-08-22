# Historical Point-in-Time Depth Chart Source Audit v0.1

Status: **RESEARCH ONLY — SOURCE / PROVENANCE / LICENSING FEASIBILITY**

Repository: `kw7t9rwhny-cyber/league-vector`

Date: 2026-08-14

Primary source investigated: **Ourlads NFL Historical Depth Chart Archive**

This report does **not** authorize production use, mass scraping, paid licensing, model changes, retrospective reconstruction from current charts, or commercial ingestion of any source whose rights are unresolved.

## Executive conclusion

### Recommendation: **C. HYBRID HISTORICAL SOURCE STRATEGY APPEARS TECHNICALLY VIABLE — RIGHTS REVIEW REQUIRED**

Ourlads is technically valuable enough that League Vector should not assume it is dependent on Sportradar for every historical role feature. The public archive contains genuine dated point-in-time NFL depth-chart snapshots, with ordered Player 1–5 slots, team/position/jersey/name information, reserve/practice-squad/status sections, and source-side update timestamps. The archive selector observed in this audit spans **06/01/2007 through 01/01/2026**, mostly at monthly cadence with occasional special cutover dates near the start of seasons and around recent NFL Draft dates.

That is particularly useful for League Vector's highest-value historical requirement: **a defensible preseason role state near a standardized cutoff**. A methodology such as “last available archive snapshot strictly before Week 1” is technically supportable for many seasons, subject to season-by-season completeness checks.

However, Ourlads is **not a weekly historical feed**. The visible archive schedule is predominantly monthly, so it cannot by itself support high-resolution weekly starter/backup transitions throughout the regular season. It also does not, from the small public sample audited here, provide the same first-class stable player GUIDs, transaction chronology, or distinct weekly injury-report semantics that a structured commercial provider such as Sportradar exposes.

Most importantly, Ourlads' public Terms & Conditions state that reproduction, distribution, or re-publication of information from the site without prior written consent is prohibited and that no license is implied. Public visibility therefore does **not** establish permission for systematic commercial ingestion, model training/feature derivation, or redistribution. Until counsel/licensing review or written permission establishes acceptable rights, any League Vector Ourlads adapter must remain design-only.

Wayback Machine captures could technically help recover point-in-time pages or fill gaps, but Internet Archive access does not erase the underlying publisher's rights. Internet Archive itself warns that it does not guarantee copyright status and that users must ensure their use is lawful. Wayback is therefore a provenance/recovery mechanism, not a licensing workaround.

Sportradar remains materially stronger for weekly depth charts, weekly injuries, stable IDs, and historical API semantics. Its public NFL documentation states historical NFL data goes back to 2000, preseason coverage begins in 2015, and feeds with `season_year` — including Weekly Depth Charts and Weekly Injuries — can be queried historically. Commercial rights still depend on the contract being negotiated with Sportradar.

The strongest evidence-supported sourcing architecture is therefore:

`licensed/approved historical Ourlads role snapshots (if rights obtained)`

`+ historical statistics`

`+ separately licensed/approved transactions/injuries source`

`+ League Vector prospective immutable archive`

with Sportradar retained as the benchmark/all-in-one alternative until coverage and rights are proven sufficient.

---

## 1. Ourlads archive structure

### 1.1 Archive identifier semantics

Observed URL pattern:

`https://www.ourlads.com/nfldepthcharts/archive/<archive_id>/<team>`

or, for the default team route:

`https://www.ourlads.com/nfldepthcharts/archive/<archive_id>/index.html`

The small representative sample supports the interpretation that **`archive_id` identifies a site-wide archive snapshot date**, not a team, NFL week, or season by itself. The same archive ID can be opened for multiple teams and resolves to the same archive date, while each team has its own `Last Updated` timestamp.

Examples:

| archive_id | archive date | sample team | team last updated | interpretation |
|---:|---|---|---|---|
| 14 | 06/01/2007 | MIN | 05/31/2007 | site-wide monthly snapshot |
| 16 | 08/01/2007 | IND | 08/01/2007 | preseason monthly snapshot |
| 17 | 09/02/2007 | IND / NE / NYJ / BAL / HOU / MIN / SEA | 09/01–09/02/2007 | pre-Week-1 / season-boundary snapshot |
| 134 | 08/01/2012 | IND / NO / SF / CLE / PIT / CIN / SEA / TEN / ARZ / KC | 07/26–07/31/2012 | preseason monthly snapshot |
| 135 | 09/01/2012 | IND | 09/01/2012 | season-boundary snapshot |
| 136 | 10/01/2012 | IND | 09/30/2012 | regular-season monthly snapshot |
| 187 | 09/01/2016 | IND / NYJ / MIA / PHI / SF / BAL / ATL / DAL / CAR / CLE / PIT | 08/31/2016 | pre-Week-1 snapshot |
| 224 | 09/02/2019 | IND | 09/01/2019 | pre-Week-1 snapshot |
| 275 | 09/01/2023 | IND / NO / LAR | 08/31/2023 | pre-Week-1 snapshot |
| 289 | 10/01/2024 | IND | 09/30/2024 | regular-season monthly snapshot |
| 300 | 08/01/2025 | IND | 07/31/2025 | preseason monthly snapshot |
| 301 | 09/01/2025 | IND | 08/28/2025 | pre-Week-1 snapshot |
| 308 | 04/01/2026 | IND | 03/26/2026 | offseason monthly snapshot |
| 311 | 06/01/2026 | IND | 05/18/2026 | offseason monthly snapshot |

This means an ingestion model should preserve both:

- `archive_snapshot_date`
- `team_page_last_updated_at`

They are not equivalent.

### 1.2 Archive-date list

The live historical selector observed on an archived Ourlads page lists dates from:

- **06/01/2007** at the old end
- through **01/01/2026** in the selector visible during this audit

The sequence is overwhelmingly monthly. Examples include `01/01`, `02/01`, `03/01`, etc., with occasional deviations such as:

- 09/02/2007
- 08/31/2008
- 09/06/2009
- 09/05/2010
- 09/04/2011
- 12/02/2012
- 07/27/2013
- 09/05/2013
- 07/02/2015
- 05/02/2016
- 09/02/2019
- 12/02/2020
- 03/02/2021
- 05/02/2021
- 07/02/2022
- recent draft-day/archive dates such as 04/27/2023, 04/25/2024, 04/24/2025

These exceptions look like publication/snapshot dates rather than canonical NFL week numbers.

### 1.3 Frequency finding

**Finding: monthly, not weekly.**

The archive is strong for broad point-in-time states and season-boundary snapshots, but it should not be described as a historical weekly depth-chart archive.

Consequences:

- preseason role state: potentially strong
- pre-Week-1 role state: potentially strong
- monthly role stability: feasible
- exact weekly regular-season promotion/demotion timing: generally unsupported from Ourlads archive alone
- exact transaction timestamp: unsupported from snapshot difference alone

---

## 2. Earliest/latest usable coverage

### Earliest directly verified usable snapshot

**06/01/2007** was directly verified for Minnesota. The page contains ordered offensive position rows and multiple depth slots.

### Latest historical coverage

The archive-date selector visible in this audit reaches **01/01/2026**, while individually indexed Ourlads archive pages also show later 2026 archive IDs such as 04/01/2026 and 06/01/2026. Current 2026 depth charts are separately live and timestamped.

For a historical backtest, the safe statement is:

- direct archive evidence is verified from **2007 through 2026**
- exact completeness for every monthly date/team must be audited before bulk use

Do not infer complete 32-team coverage for every historical snapshot solely from the selector.

---

## 3. Representative team/season audit

Small sample only; no full crawl was performed.

### 2007 — oldest range

Verified archive 17 (09/02/2007) for teams including:

- Indianapolis Colts
- New England Patriots
- New York Jets
- Baltimore Ravens
- Houston Texans
- Minnesota Vikings
- Seattle Seahawks

The same date and archive ID appear across divisions, supporting site-wide snapshot semantics.

### 2012 — mid-old range

Archive 134 (08/01/2012) was verified for teams from multiple divisions/conferences, including:

- Indianapolis
- New Orleans
- San Francisco
- Cleveland
- Pittsburgh
- Cincinnati
- Seattle
- Tennessee
- Arizona
- Kansas City

Rows include offense, defense, special teams, and in some pages reserve/status information.

### 2016 — mid-range

Archive 187 (09/01/2016) was verified across a broad team sample including IND, NYJ, MIA, PHI, SF, BAL, ATL, DAL, CAR, CLE and PIT. Last-updated timestamps were generally 08/31/2016, making the archive directly useful as a pre-Week-1 point-in-time state.

### 2019

Archive 224 (09/02/2019) was verified for Indianapolis with a 09/01/2019 update timestamp.

### 2023

Archive 275 (09/01/2023) was verified for Indianapolis, New Orleans and the Los Angeles Rams, with 08/31/2023 team update timestamps.

### 2024–2026

Recent examples verified:

- 10/01/2024 — archive 289
- 08/01/2025 — archive 300
- 09/01/2025 — archive 301
- 04/01/2026 — archive 308
- 06/01/2026 — archive 311

### Coverage risk

A current archive page can sometimes return an application error or empty table for certain old ID/team combinations. Therefore the eventual coverage audit must count:

- expected team pages per archive date
- HTTP/page success
- table parse success
- non-empty role rows
- team identity correctness
- update timestamp presence

A date appearing in the selector is not sufficient evidence that all 32 team pages are valid.

---

## 4. Preseason cutoff value

### Technical feasibility

**Supported in principle.**

The archive repeatedly provides snapshots very near season start, including:

- 09/02/2007
- 09/06/2009
- 09/05/2010
- 09/04/2011
- 09/01/2012
- 09/05/2013 plus 09/01/2013
- 09/01/2016
- 09/02/2019
- 09/01/2023
- 09/02/2024
- 09/01/2025

For many seasons, the associated team `Last Updated` timestamp is one or several days before Week 1.

### Candidate methodology for later validation

Do **not** finalize yet, but the archive supports testing:

`final_pre_week1_snapshot = latest valid team snapshot with effective timestamp < team/league Week 1 cutoff`

Required chronology rule:

1. choose a canonical season Week 1 cutoff from an approved NFL schedule source;
2. require `team_page_last_updated_at < cutoff`;
3. archive date alone is insufficient if its page update timestamp is later than the intended cutoff;
4. store both archive date and page update timestamp;
5. fail closed if the last pre-cutoff page is missing/empty/ambiguous.

### Important limitation

Because Ourlads snapshots are generally monthly, the “last available before Week 1” state may be several days old. That is still legitimate point-in-time evidence, but its **age at cutoff** must become a quality field and potentially an uncertainty feature.

---

## 5. Role/depth representation

### Deterministic representation supported

Ourlads historical pages expose rows with:

- provider-native position label
- jersey number
- Player 1
- Player 2
- Player 3
- Player 4
- Player 5

A conservative adapter can represent:

- `depth_order = 1..5`
- `is_provider_first = depth_order == 1`
- provider-native position slot (for example `LWR`, `RWR`, `SWR`, `QB`, `RB`, `TE`, `LDE`, `NT`, `NB`, etc.)

This can support later features such as QB1/QB2, RB1/RB2, TE1/TE2 and provider-slot-specific WR ordering without rewriting the original chart.

### Formation/role ambiguity

Do not collapse provider-native rows into one universal fantasy hierarchy without rules and validation.

Observed/current Ourlads structures include concepts such as:

- LWR / RWR / SWR rather than one WR list
- multiple TE rows on older charts
- FB separated from RB
- defensive front labels that vary by scheme (`LDE`, `RDE`, `NT`, `DT`, etc.)
- nickel back (`NB`) in current by-position pages
- multiple inside/outside linebacker slots
- practice-squad and reserves sections separate from active depth rows

Current Ourlads pages also annotate formation usage (for example `Offense 11 - One RB, One TE (...)`). Historical availability of that percentage/formation metadata was not established across the archive and must not be backfilled.

### Co-starters

If multiple provider rows legitimately represent simultaneous starters — e.g. LWR + RWR + SWR, two TE rows, multiple DL/LB slots — League Vector should preserve each source slot independently. “Starter” is a property of a slot, not a requirement that a team have one player per fantasy position.

---

## 6. Player identity feasibility

### Information visibly present in historical rows

Observed historical rows provide combinations of:

- player name
- jersey number
- team page
- provider-native position slot
- acquisition/draft shorthand appended to names, e.g. `23/2`, `CF22`, `U/Bal`, `T/Phi`, `PUP/ACT`, `SUS/4`

The current Ourlads site exposes player-search and player-profile-style URLs containing numeric `id=` parameters, so Ourlads appears to maintain an internal player identifier system. This audit did **not** prove that every historical archive player cell contains or preserves a stable profile ID link that remains resolvable today.

### Required identity contract

No fuzzy matching may become authoritative.

Proposed identity precedence if rights are approved:

1. exact stable Ourlads player ID from the historical hyperlink, if present and proven stable;
2. exact externally licensed crosswalk from Ourlads ID to GSIS/Sleeper, if available;
3. deterministic exact composite candidate using name + team + jersey + position + season only as a **matching candidate**, never automatic authority when collisions exist;
4. exact GSIS/Sleeper crosswalk from an independently approved identity table;
5. unresolved otherwise.

Store:

- `ourlads_player_id`
- `source_name_raw`
- `source_jersey`
- `source_team`
- `source_position_slot`
- `league_vector_player_id` only after exact resolution
- `identity_resolution_method`
- `identity_resolution_evidence`

Ambiguous same-name players or conflicts remain unresolved.

### Draft/acquisition shorthand is not a universal identity key

Strings such as `18/1`, `CF22`, `U/Den`, `T/Phi`, `PUP/ACT` are useful metadata but should be parsed separately from identity and validated against other sources before use.

---

## 7. Injury / status information

### What Ourlads can represent

The current Ourlads depth-chart legend includes `Red: Injured/Inactive`.

The Ourlads key documents status/acquisition abbreviations, including reserve-list and return semantics. Historical pages directly show status strings within rows and dedicated reserve sections. Examples observed include:

- `IR`
- `PUP`
- `NFI`
- `W/INJ`
- `PUP/ACT`
- `NFI/ACT`
- `SUS/4`
- reserves (`RES`)
- practice squad (`P/SQ`)

### Separation requirement

Ourlads role placement and availability/status must remain separate fields.

Do not infer injury because a player moves down the chart. Do not infer health because a player remains on the depth chart.

Recommended normalized fields:

- `depth_role_state`
- `source_status_code`
- `source_status_text`
- `reserve_section`
- `availability_interpretation` only when the published Ourlads key deterministically defines it

For high-fidelity weekly injury/practice status, Ourlads is weaker than Sportradar's dedicated Weekly Injuries feed.

---

## 8. Historical transition feasibility

### Supported at snapshot resolution

Sequential Ourlads snapshots could support observations such as:

- backup → first slot
- first slot → backup
- rookie climbs within a provider slot
- veteran demotion
- player added to depth chart
- player removed from depth chart
- role stability across monthly snapshots
- number/identity of players ahead within a provider slot
- competition added/removed between snapshots

### Not supported without additional source evidence

A monthly state change does **not** prove:

- exact date/time of the move
- cause of the move
- injury vs coach decision
- exact transaction event
- exact weekly sequence if multiple changes occurred between monthly snapshots

Every derived transition must carry interval provenance:

`known_after_previous_snapshot && known_by_current_snapshot`

not a fabricated point event timestamp.

---

## 9. Legal / commercial rights findings

### Ourlads public terms

Ourlads Terms & Conditions publicly state, in substance, that reproduction, distribution or re-publication of website information without prior written consent is prohibited and that the website does not grant a license to Ourlads intellectual property.

Source reviewed:

- `https://secure.ourlads.com/tc/default.aspx`

### What can be concluded

- pages are publicly viewable;
- public viewing is **not** commercial ingestion permission;
- the terms are restrictive enough that League Vector should **not** begin systematic collection for a commercial product without rights review;
- this audit cannot determine whether internal feature extraction/derived-model use would be accepted under Ourlads' terms or applicable law;
- no assumption of fair use or facts-only exemption is authorized here.

### Required status

**LEGAL / LICENSING REVIEW REQUIRED**

Before production historical ingestion, Founder should obtain legal review and, if needed, written Ourlads permission/license covering at least:

- automated retrieval/cadence and rate limits
- historical archive access
- local storage/caching
- internal analytics/model training/feature derivation
- commercial derived outputs
- retention after termination
- audit/provenance requirements
- redistribution restrictions
- attribution requirements
- use of player/team identifiers

### Contact path

Ourlads pages expose a `Contact Us` path and references to depth-chart questions/suggestions. No contact was made during this audit.

### robots/access controls

This audit did not rely on bypassing access controls and performed no large-scale crawl. A production ingestion decision must separately verify the current `robots.txt`, any rate-limit language, authentication/subscription boundaries, and written licensing terms at implementation time.

---

## 10. Wayback feasibility

### Technical value

Wayback provides timestamped archived web captures and permits users to locate specific historical snapshots by URL/date. It can therefore be useful for:

- proving a page existed at or before a cutoff;
- recovering a missing historical live page;
- comparing what a publisher displayed on two historical dates;
- filling isolated provenance gaps where live archives are incomplete.

### Limitations

Internet Archive documentation notes that pages can be missing because crawlers did not discover them, pages were blocked by `robots.txt`, password protected, inaccessible, or excluded at a site owner's request.

Snapshot frequency is not equivalent to publisher update frequency. A Wayback capture proves the archived representation was captured by that timestamp; it does not prove the underlying source was freshly updated at that moment.

Complex navigation, dynamic assets and form-driven routes can fail in archived pages.

### Rights limitation

Internet Archive's rights guidance states that it does not guarantee copyright status and users must ensure their use is non-infringing and lawful. Therefore:

**Wayback cannot be treated as a mechanism to bypass Ourlads licensing restrictions.**

### Feasibility status

**Useful supplemental provenance / gap-fill source, but not a primary rights basis.**

A later small CDX/capture-frequency audit should test representative URLs for 2007, 2012, 2016, 2019, 2023 and 2025 before any engineering commitment.

---

## 11. Alternative-source findings

### Sportradar

Public NFL developer documentation establishes:

- Weekly Depth Charts endpoint by season, season type and week;
- `depth` integer with `1 = starter`;
- provider team/player identifiers, including stable GUID/SR IDs in related feeds;
- dedicated Weekly Injuries feed with injury and practice status;
- historical NFL data back to 2000;
- preseason coverage starting in 2015;
- historical access for feeds with `season_year`, explicitly including Weekly Depth Charts and Weekly Injuries;
- offseason depth charts are not monitored until training camp.

This is the strongest technically documented all-in-one option in the current audit. Commercial/derived-model rights remain contract-dependent and are already pending Founder/vendor discussion.

### Official team / NFL archives

Official club sites preserve historical game centers, media/dope-sheet pages and PDFs. A representative Green Bay sample shows:

- historical season schedule pages;
- preseason and regular-season game centers;
- gamebook PDFs;
- dated Week 1 “Dope Sheet” media-guide content;
- training-camp reports discussing first-team/depth-chart roles.

This provides excellent provenance for targeted validation and possibly official pregame depth-chart evidence, but it is heterogeneous and team-specific. It is unlikely to provide a uniform low-burden 32-team adapter without substantial normalization.

Commercial reuse rights for club/NFL content must be reviewed separately; official publication does not imply unrestricted commercial ingestion.

### FantasyPros

FantasyPros maintains current NFL depth-chart pages and a research/depth-chart area. This audit did not establish a first-class dated historical archive or commercial ingestion permission sufficient for League Vector's requirements.

Classification: **insufficient evidence as primary historical point-in-time source**.

### Other commercial providers (Rotowire / similar)

No source was promoted in this audit without clear public evidence of historical point-in-time depth-chart structure and commercial rights. These remain candidates for future vendor-specific audits if Sportradar/Ourlads terms are unfavorable.

---

## 12. Source quality matrix

Scores are qualitative for this feasibility audit only.

| Source | Historical depth | Preseason | Weekly regular season | 32-team consistency | Structured data | Identity quality | Injury/status | Transactions | Point-in-time provenance | Commercial rights | Automation | Engineering burden |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Ourlads live archive** | Strong: verified 2007–2026 | Strong monthly / pre-W1 potential | **Weak: mostly monthly** | Promising, not fully audited | Semi-structured HTML table | Medium; stable profile-ID potential unproven historically | Medium; reserve/status codes present | Weak as event source | Strong archive date + team update time | **Restrictive/unclear — written rights review required** | Technically straightforward if approved | Medium |
| **Sportradar** | Strong; docs say NFL to 2000 | Documented from 2015 | **Strong weekly** | Strong by API design | Strong JSON/XML | **Strong GUID/SR IDs** | **Strong dedicated weekly feed** | Strong supporting feeds/change log | Strong season/type/week semantics | Contract-dependent | Strong | Low–Medium after licensing |
| **Wayback + Ourlads** | Potentially strong gap fill | Potential | Depends on capture frequency | Irregular | Archived HTML | Same as underlying Ourlads | Same/possibly degraded | Weak | **Strong capture timestamp**, underlying freshness variable | **Does not cure Ourlads rights** | Medium–Low | High |
| **Official team/NFL archives** | Varies by club/year | Often strong in camp/media guides | Potential weekly media packets | **Heterogeneous** | Mostly HTML/PDF | Medium–High when roster context clear | Often good in official reports | Medium | Strong dated official publication | Review required | Low without per-team adapters | **High** |
| **FantasyPros** | Historical archive not proven here | Unproven | Unproven | Current coverage strong | Web structured | Medium | Limited for this purpose | Limited | Historical provenance not established | Review required | Unknown | Medium |
| **League Vector prospective archive** | 2026 forward only | **Strong prospectively** | Strong under chosen cadence | Explicit quality gates | Deterministic normalized objects | Exact GSIS/provider IDs where supplied | Separate feed when approved | Separate feed when approved | **Very strong immutable retrieval provenance** | Depends on upstream licenses | Strong | Already designed |

---

## 13. Proposed historical ingestion adapter — only if source rights are approved

No implementation is authorized by this report. This is a schema/interface proposal.

### 13.1 Raw source record

```text
provider = "ourlads"
source_url
archive_id
archive_snapshot_date
team_page_last_updated_at
retrieved_at
team_source_code
team_source_name
section              # offense / defense / special teams / practice squad / reserves
position_slot_raw
jersey_raw
player_name_raw
player_cell_raw
source_status_raw
source_player_profile_url
ourlads_player_id     # only if deterministically parsed from historical link
source_html_hash
```

### 13.2 Normalized role record

```text
league_vector_team
season
season_type_context
snapshot_effective_at
snapshot_age_at_cutoff
position_slot_raw
position_family_normalized
slot_instance
provider_depth_order
provider_first
league_vector_player_id | null
identity_status = resolved | unresolved | conflict
identity_method
availability_status_raw
availability_status_normalized | null
reserve_category | null
```

### 13.3 Point-in-time rule

`effective_at = team_page_last_updated_at` when that timestamp is present and parseable; archive date is retained as a distinct site snapshot label.

Never substitute retrieval time or today's live chart for historical effective time.

### 13.4 Parse safeguards

Fail closed on:

- missing archive date
- missing/invalid last-updated timestamp when cutoff selection depends on it
- team mismatch
- empty chart where expected
- duplicated source slot/order collisions that cannot be explained
- player identity collisions
- malformed status codes affecting availability semantics
- historical page redirecting silently to a current chart

### 13.5 Coverage manifest

Before model use, materialize a deterministic coverage table:

```text
archive_id
archive_snapshot_date
team
page_ok
chart_rows
role_rows
reserve_rows
last_updated_at
identity_resolved_rate
parse_warnings
rights_basis_version
source_hash
```

No historical feature should enter a backtest without a coverage manifest proving the exact source state used.

---

## 14. Potential hybrid historical strategy

A technically coherent lower-dependency architecture is:

### Layer A — role state

Ourlads monthly/pre-Week-1 historical depth snapshots, **only if rights are approved**.

### Layer B — production

Existing chronology-safe historical player/team statistics already approved by League Vector.

### Layer C — availability / transactions

A separate source with timestamped injuries, PUP/IR, roster moves and transactions. Sportradar could still fill only this layer if licensing allows modular use; another licensed provider may also qualify.

### Layer D — identity

League Vector exact identity crosswalk with GSIS/Sleeper/provider IDs. No fuzzy authoritative matching.

### Layer E — prospective truth

League Vector's existing immutable prospective opportunity archive from 2026 forward.

This hybrid can plausibly support preseason opportunity features without requiring an all-inclusive historical vendor, but only if:

1. Ourlads commercial rights are acceptable;
2. preseason team coverage is high enough;
3. identity resolution is sufficiently deterministic;
4. injuries/transactions are sourced independently when needed;
5. backtests explicitly account for snapshot staleness and missingness.

It does **not** eliminate the value of Sportradar for weekly historical role transitions.

---

## 15. Exact blockers

### Blocker 1 — Ourlads commercial/derived-model rights

**P0 sourcing blocker for ingestion.** Public terms are restrictive; written rights/legal review is required before systematic commercial use.

### Blocker 2 — complete coverage proof

This audit sampled teams/seasons only. We do not yet have deterministic counts for valid team pages by archive date/season.

### Blocker 3 — historical stable player ID proof

Current Ourlads uses numeric player-profile IDs, but historical archive-cell linkage/stability was not proven for the entire archive.

### Blocker 4 — weekly transition resolution

Ourlads is generally monthly. Weekly regular-season transitions require Sportradar, another weekly source, official weekly artifacts, or sufficiently dense Wayback captures.

### Blocker 5 — Wayback capture-frequency audit

Wayback is technically plausible but representative capture counts and parser survivability were not established in this cycle.

### Blocker 6 — distinct transaction/injury event source

Ourlads statuses are useful but do not replace a complete timestamped transaction and weekly injury-report feed.

### Blocker 7 — scheme normalization

Provider-native role labels vary by formation and era. A normalization ontology must preserve native rows and avoid collapsing co-starters/hybrid roles incorrectly.

---

## 16. Recommended next sourcing decision

### Do now

1. **Do not scrape Ourlads at scale.**
2. Preserve this audit as the technical basis for a Founder/legal licensing question.
3. If Founder wants to pursue Ourlads, seek written clarification/licensing covering automated historical access and commercial derived-model use.
4. Independently run a small Wayback CDX feasibility audit on 6–10 representative Ourlads/team URLs and official team pages.
5. Continue the pending Sportradar rights discussion; ask specifically whether historical Weekly Depth Charts, Weekly Injuries, transactions and stable player IDs may be retained and used in commercial derived models.
6. Keep collecting League Vector's own prospective 2026 archive so this historical dependency shrinks every season.

### Decision framing

- If Ourlads grants acceptable derived-model/data-access rights and coverage/identity audits pass: **hybrid strategy becomes a serious alternative to full Sportradar dependency for preseason role research.**
- If Ourlads does not grant acceptable rights: **do not use Wayback as a workaround**; Sportradar or another licensed provider remains required for systematic historical role ingestion.
- If the research goal expands to weekly in-season role transitions: **Ourlads alone is insufficient even with rights**, because cadence is predominantly monthly.

---

## 17. Evidence URLs reviewed

### Ourlads

- `https://www.ourlads.com/nfldepthcharts/default.aspx`
- `https://secure.ourlads.com/tc/default.aspx`
- `https://www.ourlads.com/nfldepthcharts/archive/14/MIN`
- `https://www.ourlads.com/nfldepthcharts/archive/16/index.html`
- `https://www.ourlads.com/nfldepthcharts/archive/17/index.html`
- `https://www.ourlads.com/nfldepthcharts/archive/17/NE`
- `https://www.ourlads.com/nfldepthcharts/archive/17/NYJ`
- `https://www.ourlads.com/nfldepthcharts/archive/134/index.html`
- `https://www.ourlads.com/nfldepthcharts/archive/134/NO`
- `https://www.ourlads.com/nfldepthcharts/archive/135/index.html`
- `https://www.ourlads.com/nfldepthcharts/archive/136/index.html`
- `https://www.ourlads.com/nfldepthcharts/archive/187/index.html`
- `https://www.ourlads.com/nfldepthcharts/archive/187/NYJ`
- `https://www.ourlads.com/nfldepthcharts/archive/224/IND`
- `https://www.ourlads.com/nfldepthcharts/archive/275/index.html`
- `https://www.ourlads.com/nfldepthcharts/archive/289/index.html`
- `https://www.ourlads.com/nfldepthcharts/archive/300/index.html`
- `https://www.ourlads.com/nfldepthcharts/archive/301/index.html`
- `https://www.ourlads.com/nfldepthcharts/archive/308/index.html`
- `https://www.ourlads.com/nfldepthcharts/archive/311/index.html`
- `https://www.ourlads.com/nfldepthcharts/key.aspx`
- `https://www.ourlads.com/nfldepthcharts/playersearch.aspx`

### Sportradar official developer documentation

- `https://developer.sportradar.com/football/reference/nfl-weekly-depth-charts`
- `https://developer.sportradar.com/football/reference/nfl-weekly-injuries`
- `https://developer.sportradar.com/football/docs/nfl-ig-rosters`
- `https://developer.sportradar.com/football/docs/nfl-ig-historical-data`
- `https://developer.sportradar.com/football/reference/nfl-team-roster`

### Internet Archive official help

- `https://archivesupport.zendesk.com/hc/en-us/articles/360004651732-Using-The-Wayback-Machine`
- `https://archivesupport.zendesk.com/hc/en-us/articles/360014759692-Rights`
- `https://archivesupport.zendesk.com/hc/en-us/articles/360004716091-Wayback-Machine-General-Information`

### Official club sample

- `https://www.packers.com/schedule/2023/`
- `https://www.packers.com/game-day/2023/reg-week1/packers-at-bears/`
- `https://www.packers.com/game-day/2023/pre/packers-at-bengals/`
- `https://www.packers.com/news/dope-sheet-packers-open-the-season-at-the-bears-week-1-2023`

---

## 18. Permanent contamination firewall

**CURRENT DEPTH CHARTS MUST NEVER BE USED TO RECONSTRUCT HISTORICAL ROLE.**

For every historical role feature, League Vector must retain a timestamp proving the evidence existed at or before the model cutoff. Later corrections, current charts, retrospective articles or hindsight roster knowledge cannot rewrite an earlier role state.

This report authorizes no production behavior. It establishes only that Ourlads is a technically credible historical point-in-time role source worthy of rights review and a deeper coverage/identity audit.
