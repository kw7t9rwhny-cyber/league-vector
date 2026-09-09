# Historical Depth Signal Pilot Gate v0.1

Status: **RESEARCH ONLY — ACQUISITION / CHRONOLOGY GATE**

Date: 2026-08-14

Authority: Issue #48 Founder-approved ephemeral-source architecture. This document does not expand Ourlads acquisition rights, authorize scraping, or modify production.

## Final decision

### **D — RESEARCH BLOCKED BY PROVENANCE / ACCESS**

This is **not** evidence that historical depth-chart position lacks predictive value. No model was fit and no probabilities were estimated because the first defensible multi-season pilot cannot currently satisfy League Vector's `known_at < prediction_cutoff` contract without crossing the approved historical-source acquisition boundary.

A promising independently usable source was found: nflverse publishes weekly depth charts back to 2001 and its data repository is licensed CC BY 4.0. However, its legacy pre-2025 depth-chart schema is week-indexed (`season`, `week`, `game_type`) and does not expose the explicit source timestamp required to prove that a Week-1 observation existed before the relevant game/season prediction cutoff. nflverse changed source after 2024; from 2025 onward the depth-chart schema includes an ISO8601 `dt` point-in-time timestamp and preseason observations. That solves chronology prospectively/for 2025+, but only one completed timestamped season exists, which is insufficient for the required multi-season chronological validation.

Ourlads has dated preseason/pre-Week-1 snapshots suitable in principle for the missing historical `known_at` evidence, but Issue #48 does not authorize systematic acquisition at the scale required for a statistically defensible pilot. Therefore the correct action is to stop at the acquisition gate rather than fit a leakage-prone Week-1 model or silently broaden Ourlads collection.

---

## 1. Provenance status

### Sources actually used in this cycle

**GitHub / League Vector**
- Issue #48 and all comments: Founder legal/provenance/ephemeral-source decision.
- PR #47 existing architecture report.
- existing League Vector prospective opportunity archive documentation.

**nflverse / nflreadr public documentation and source**
- `load_depth_charts()` documentation: week-level depth charts back to 2001.
- legacy example schema: `season`, `club_code`, `week`, `game_type`, `depth_team`, `gsis_id`, `position`, `depth_position`, etc.
- depth-chart dictionary: from 2025 onward `dt` is an ISO8601 timestamp explicitly usable to assign a record to a point in time; new schema also contains `gsis_id`, `pos_slot`, and `pos_rank`.
- nflreadr release notes: after 2024 the depth-chart source changed from NFL Data Exchange to ESPN and the data became date-based including preseason.
- nflverse-data repository: CC BY 4.0.

**Ourlads**
- No new bulk or systematic historical Ourlads acquisition occurred in this cycle.
- Prior bounded audits established dated archive snapshots and pre-Week-1 availability, but those observations were not expanded into a modeling corpus here.

### Temporary source-level observations created

**None.**

No Ourlads HTML, screenshots, rows, historical tables, player-by-date corpus, or source-equivalent dataset was downloaded or retained for this pilot.

### Retained

Only:
- source/provenance findings;
- schema and feature definitions;
- locked pilot sampling design;
- chronology gate analysis;
- acquisition requirements;
- this aggregate report.

### Deleted

No source-level historical corpus existed, so no source-record deletion was necessary. Tool/runtime fetch attempts did not create a retained research dataset in the repository.

### Boundary encountered

Yes. A statistically useful historical Ourlads corpus would require systematic acquisition beyond the currently authorized boundary. Separately, the licensed nflverse legacy data do not expose the exact point-in-time timestamp needed for League Vector's preseason chronology contract.

---

## 2. Minimal schema

If historical acquisition is later approved, the temporary factual table should contain only:

| field | reason |
|---|---|
| `season` | cohort / fold key |
| `known_at` | hard chronology gate |
| `canonical_team` | team context and change detection |
| `league_vector_player_id` | deterministic identity; unresolved rows excluded |
| `position_group` | QB/RB/WR/TE specialization |
| `role_slot` | source-independent role where defensible; may be null |
| `depth_rank` | core ordinal opportunity signal |
| `starter_status` | derived from documented source semantics only |
| `availability_class` | optional; only when explicitly evidenced |
| `provenance_set_id` | links fact to restricted provenance metadata |

A source-specific raw name, page layout, prose, HTML, screenshot, logo, table structure, scouting note, or unnecessary field is not part of the canonical fact table.

Restricted provenance metadata should be separate and minimal: source class, locator, published/effective timestamp, observed timestamp, identity-evidence method, corroboration classification, confidence, and rights-basis status.

### Exact derived features planned

Core first-pass features:
- `preseason_depth_rank`
- `preseason_starter`
- `players_ahead_count`
- `players_behind_count`
- `depth_rank_bucket`
- `position_competition_count`

Only when two valid pre-cutoff observations exist:
- `depth_movement`
- `role_stability`
- `depth_chart_uncertainty`

Only with separately timestamped approved evidence:
- `vacated_opportunity`
- `competition_removed`
- `team_change_known`
- injury/availability interactions

No feature may be inferred from later-season outcomes.

---

## 3. Position-specific hypothesis architecture

Depth charts are modeled as **opportunity/role evidence**, not talent or efficiency magic.

### QB

Signals:
- QB1 vs QB2+
- returning QB1 vs newly promoted QB1
- movement between two pre-cutoff checkpoints
- competition ahead/behind

Primary outcomes:
- games active
- starts
- pass attempts
- snaps where approved
- fantasy points conditional on playing opportunity

Hypothesis: QB1 should strongly predict starts/attempt opportunity; incremental efficiency prediction after controls should be weak.

### RB

Signals:
- first listed RB
- second/third depth rank
- number of credible RBs ahead/behind
- stable RB1 vs recent promotion
- committee ambiguity

Primary outcomes:
- carries
- targets
- snaps/routes where approved
- games with meaningful usage
- fantasy points / fantasy relevance

Hypothesis: depth rank should add opportunity signal, but a simple `RB1=true` indicator may be insufficient where multiple backs have distinct roles.

### WR

Signals:
- provider slot rank (LWR/RWR/SWR where source supports it)
- source-independent depth rank bucket
- number of WR competitors ahead
- stable first-slot role vs preseason climb/fall

Primary outcomes:
- targets
- receptions
- receiving yards
- routes/snaps where approved
- top-N fantasy relevance

Hypothesis: depth evidence may be particularly useful for second/third-year WRs whose prior production understates a newly earned role.

### TE

Signals:
- TE1 vs TE2+
- stability of TE1 role
- multiple-TE ambiguity
- competition count

Primary outcomes:
- targets/routes/snaps
- starts
- receiving production
- TE12/TE24 relevance survival

Hypothesis: TE1 is opportunity evidence, but formation/multi-TE structure and blocking roles should make the raw rank less deterministic than at QB.

### Opportunity vs efficiency separation

Primary model target family: role/opportunity first (`starts`, `snaps`, `routes`, `targets`, `carries`, `attempts`).

Secondary production model: predict fantasy production **conditional on projected opportunity**, using prior efficiency/production information separately. Depth rank should not receive an arbitrary fantasy-point boost.

---

## 4. Locked small-sample design — declared before outcomes

The intended first multi-season pilot was fixed before viewing any model outcomes:

- seasons: **2018–2024**
- teams: **all NFL teams represented by the approved source**; no team cherry-picking
- positions: **QB, RB, WR, TE**
- historical checkpoint: **one final valid pre-Week-1 observation per player-season**
- optional second preseason checkpoint only for movement/stability research
- identity: exact GSIS/approved deterministic crosswalk only
- unresolved identity: excluded and counted
- sampling: all eligible player-seasons meeting the same rules

Planned chronological evaluation:
- development history through 2020 → test 2021
- history through 2021 → test 2022
- history through 2022 → test 2023
- history through 2023 → test 2024

No random train/test split across seasons.

### Why the pilot was not executed

The legacy nflverse data can populate depth rank and stable player IDs, but the available schema does not establish the required exact `known_at` timestamp for the 2018–2024 Week-1 rows. Treating `week=1` as proof that the chart predates Week-1 kickoff would weaken the explicit chronology standard.

The 2025+ nflverse schema has the required timestamp and preseason records, but there is only one completed historical season under that schema. It cannot support the planned expanding-window out-of-sample validation or the requested age/experience/draft-capital interactions.

Collecting enough dated Ourlads pre-Week-1 observations to fill 2018–2024 would be systematic historical acquisition and is not currently authorized by Issue #48.

---

## 5. Exact chronology contract

For a preseason feature to enter a model:

`known_at < season_prediction_cutoff`

Candidate season cutoff:

`season_prediction_cutoff = kickoff timestamp of the earliest regular-season game for that NFL season`

A stricter per-team formulation may later use each team's Week-1 kickoff, but the league-wide earliest kickoff is preferred initially because it creates one conservative cutoff and avoids a Thursday-game team receiving a different information horizon from a Sunday team.

### Required evidence

Every historical role observation must have either:
1. a source-provided timestamp/date whose semantics prove the state existed at that time; or
2. independently archived publication evidence proving existence before the cutoff.

`season + week=1` without publication/effective-time proof is insufficient for this pilot.

### Leakage tests

Fail a row/run if:
- `known_at` missing;
- `known_at >= prediction_cutoff`;
- source record can only be dated retrospectively;
- later transaction/injury/start/snap outcome enters the feature set;
- current chart is applied to a prior season;
- identity resolution uses future-only information;
- future-season production participates in feature engineering or imputation.

---

## 6. Baseline specification

No baseline was fit because the chronology gate failed before model estimation.

The locked control model is:
- prior-season production / opportunity, using only prior completed season data;
- age as known at cutoff;
- NFL experience;
- draft capital;
- position;
- known team / team-change state at cutoff;
- simple team context available at cutoff.

For rookies, prior NFL production is explicitly missing/not zero; draft capital and age/position/team context carry the prior.

For veterans, prior production remains an important prior until valid role evidence provides incremental information.

---

## 7. Planned incremental depth test

Compare on identical eligible rows:

`CONTROL`

vs

`CONTROL + PRESEASON DEPTH/ROLE FEATURES`

Planned interpretable first models:
- logistic regression for starter/meaningful-role probability;
- regularized linear regression for targets/carries/attempts/fantasy points;
- transition matrices for depth bucket → regular-season role;
- calibrated role-survival probabilities;
- simple position-specific models before pooling/hierarchical extensions.

Required reporting:
- MAE and RMSE for continuous opportunity/production outcomes;
- Brier score / log loss / calibration curve or calibration error for probabilities;
- Spearman/pairwise/top-N behavior for ranking tasks;
- chronological fold results, not only pooled averages;
- sample size and missingness by position/year;
- identity exclusions;
- uncertainty intervals where defensible.

No increase in in-sample fit alone qualifies as evidence.

---

## 8. Interaction tests reserved for a valid corpus

Predeclared interactions:
- depth × prior production
- depth × age
- depth × NFL experience
- depth × rookie / Year-2 / Year-3 status
- depth × draft capital
- depth × team change
- depth × vacated targets/carries
- depth × incumbent competition
- depth × prior late-season production
- depth × explicitly timestamped injury/availability evidence

These should test **prior decay/update**, not replace priors arbitrarily.

Examples:
- Rookie draft capital can begin as a strong prior and decay as actual role + opportunity + production evidence arrives.
- Veteran production priors can remain strong until trustworthy current role evidence indicates promotion/demotion/team-context change.

---

## 9. Research cohorts / counts

### Actual fitted cohort

**None.** No model-eligible historical fact corpus was constructed.

Therefore:
- player-seasons fitted: 0
- QB/RB/WR/TE fitted rows: 0
- chronological folds executed: 0
- learned probabilities: none
- baseline metrics: none
- incremental metrics: none

This is intentional fail-closed behavior, not missing reporting.

### Source availability findings

- nflverse legacy weekly depth charts: documented back to 2001; suitable fields for identity/depth ordering but no explicit pre-2025 point-in-time timestamp in the legacy schema.
- nflverse 2025+: explicit `dt` point-in-time timestamp and date-based/preseason structure; only one completed season at present.
- Ourlads: prior audit shows dated pre-Week-1 snapshots across many historical seasons; systematic corpus creation remains outside current authorization.

---

## 10. Learned relationships

**None estimated.**

Do not report or infer:
- `P(meaningful season | RB1)`
- `P(role survival | returning starter)`
- `P(role gain | backup + vacated opportunity)`
- WR2/WR3/WR4 probabilities
- TE1 probabilities

until a chronology-valid corpus supports them.

Existing intuitive football beliefs are hypotheses, not League Vector evidence.

---

## 11. Candidate signal classification

Because the pilot could not validly fit, no signal can be marked SUPPORTED or REJECTED.

| signal | classification | reason |
|---|---|---|
| preseason starter | PROMISING / MORE RESEARCH | plausible and directly testable once dated history exists; no valid multi-season fit yet |
| depth rank / bucket | PROMISING / MORE RESEARCH | available structurally; chronology gate blocks historical pilot |
| competition ahead/behind | PROMISING / MORE RESEARCH | derivable from valid point-in-time chart; no fit yet |
| depth movement | PROMISING / MORE RESEARCH | requires >=2 dated pre-cutoff states |
| role stability | PROMISING / MORE RESEARCH | requires repeated dated states |
| role uncertainty | PROMISING / MORE RESEARCH | architecture supported; calibration untested |
| vacated opportunity interaction | PROMISING / MORE RESEARCH | requires independent timestamped transactions/roster evidence |
| team-change interaction | PROMISING / MORE RESEARCH | only if move is known before cutoff |
| arbitrary depth-based fantasy boost | REJECTED AS ARCHITECTURE | violates opportunity-first design; any production effect must flow through validated opportunity/role evidence |

---

## 12. Production / reconstruction firewall

No production artifact was created.

Any future successful research run must emit only non-source-equivalent artifacts such as:
- model coefficients;
- calibrated transition probabilities;
- position-specific priors;
- uncertainty parameters;
- aggregate validation metrics;
- model/feature/version metadata.

It must not emit:
- historical player-by-date depth rows;
- Ourlads URLs per player;
- historical lookup tables;
- source page structure;
- screenshots/HTML;
- a model artifact whose tables let a user reconstruct the source archive.

### Reconstruction test

An independent reviewer given only the proposed production artifact should not be able to answer historical queries such as:

`What did Ourlads list as the Packers WR depth chart on date X?`

If player/team/date-level source records can be reconstructed with meaningful fidelity, the artifact fails promotion.

Current result trivially passes because no production artifact and no source corpus exist.

---

## 13. Deletion evidence

No Ourlads-level research corpus was created in this cycle.

Repository retention from this work is limited to architecture/provenance/report material. No HTML, screenshot, downloaded Ourlads table, temporary normalized Ourlads fact file, or source-level player/date observation file was committed.

If a later approved run creates temporary source observations, the deterministic workflow must:
1. create them only in ephemeral workspace;
2. derive features;
3. fit and validate;
4. write aggregate evidence;
5. hash/record allowed aggregate outputs;
6. delete source-level workspace;
7. assert absence of source-level files before artifact upload/commit;
8. upload/retain only approved aggregate evidence and deletion manifest.

Reproducibility conflicts with that deletion policy must fail closed and be escalated rather than solved by silently retaining source-equivalent history.

---

## 14. What would unblock the pilot

Any one of the following could provide the missing multi-season chronology evidence, subject to rights review:

### Path A — approved bounded Ourlads factual acquisition

Authorize a narrowly bounded historical pilot only, e.g. 4–7 seasons, all teams, final pre-Week-1 checkpoint only, minimal factual fields, ephemeral deletion firewall. This is **not currently authorized** by this report.

### Path B — licensed provider historical snapshots

Sportradar or another provider supplies dated historical depth/roster state with commercial derived-model rights.

### Path C — sufficiently complete official-team/NFL historical corpus

Build a multi-source corpus from dated official releases/archives if coverage and identity can be proven without hindsight. Engineering burden is expected to be materially higher and completeness remains unproven.

### Path D — time / prospective accumulation

Continue the League Vector-owned 2026 prospective archive. This is the cleanest provenance path but cannot answer the multi-season question immediately.

### Separate research possibility

Legacy nflverse Week-1 depth data could be studied as a **Week-1-associated role signal** if a future provenance audit proves the historical records were generated/published before the relevant kickoff. Until that evidence exists, do not relabel them as preseason point-in-time observations.

---

## 15. Founder / Lead decision

### **D — RESEARCH BLOCKED BY PROVENANCE / ACCESS**

Reason:

The hypothesis remains unresolved. We found a licensed, structured historical depth source and therefore reduced dependence on Ourlads for schema/identity, but the legacy data do not presently prove the exact pre-cutoff `known_at` required by League Vector. The timestamped 2025+ version is too short for chronological validation, while enough dated Ourlads history to run the intended pilot would require systematic acquisition beyond Issue #48's current authorization.

This result should **not** be interpreted as `C — no material incremental value`.

No model was fit, no claimed probability was fabricated, no production change was made, and no Ourlads historical database was created or retained.
