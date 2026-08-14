# Current Opportunity / Depth Chart Model v0.1 — Data & Licensing Gate

## Status
**BLOCKED — FOUNDER PURCHASE / LICENSING DECISION**

This is a HIGH-risk research-only track. No opportunity-model performance claim is made and nothing here changes production.

## Research question
Can historically point-in-time preseason/current role information improve League Vector opportunity and fantasy projections beyond validated Projection v0.4, especially for second- and third-year players whose current roles differ from their prior-season roles, without arbitrary starter bonuses or future leakage?

## Research boundary / firewall
- Branch: `codex/projection-opportunity-v01`.
- Validated veteran Projection v0.4 remains immutable control.
- Cycle-2 evidence establishes that model selection must remain pre-2025; 2025 is retrospective observed evidence only.
- No production projection, Dynasty Value, rookie research, UI, Core, IDP valuation, or `main` behavior changes.
- `experimental=true`
- `production_projection_eligible=false`
- `dynasty_value_eligible=false`
- Never use a current depth chart retrospectively.

## GitHub state at track start
- `main`: `b5a3f56e7bb95810b2fd787c4f5ce0ff12c851b6`
- validated v0.4 control: `6d931abadbcb06e910bf953d941902c7c2cd1638`
- Cycle-2 control branch head used to create this branch: `7ee8dbabea1188f1b9413cfaf0a17b3b6164006b`

## Why this data matters
Validated v0.4 Cycle 2 found that role persistence/instability is a major error driver and that young-player under-projection exists, but simple experience corrections and generic second-year models are unstable. That makes current opportunity a high-value next hypothesis: role evidence may explain *why* a young player's prior production is stale without applying arbitrary age/experience boosts.

The intended causal ordering is:

`known pre-season roster / depth / absence / transaction state -> expected role/opportunity -> fantasy production`

not:

`current knowledge -> retroactively relabel old seasons`.

## Data-source and licensing audit

### 1. nflverse depth charts — **approved for mechanics/prospective research; insufficient for historical selection**
Provider: nflverse / nflreadr / nflverse-data.

Important source transition:
- after the 2024 season, `load_depth_charts()` changed from NFL Data Exchange to ESPN;
- from 2025 onward, depth-chart records include ISO timestamp `dt` and ordered `pos_rank`;
- nflverse appends each daily update, which makes 2025+ data genuinely point-in-time reconstructable;
- depth charts update daily and include preseason dates;
- pre-2025 files use the legacy weekly schema (`season`, `week`, `game_type`, `depth_team`, etc.) and do **not** expose the same appended `dt` snapshot contract.

Historical availability:
- annual depth-chart files exist back to 2001;
- the current 2025+ files are much larger because timestamped snapshots are appended;
- this does not establish a defensible final-preseason as-of snapshot for 2018-2024.

License/provenance:
- `nflverse-data` is published under CC BY 4.0 with attribution;
- upstream source provenance still needs to remain documented before any commercial production dependency is approved.

Research verdict:
- **YES** for validating ingestion, identity mapping, cutoff code, snapshot-diff mechanics, and prospective 2026 overlays;
- **NO** for selecting a v0.1 historical opportunity model under the existing pre-2025 gate, because 2025 is retrospective-only evidence and 2026 outcomes do not yet exist.

Official references:
- https://nflreadr.nflverse.com/articles/dictionary_depth_charts.html
- https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html
- https://github.com/nflverse/nflreadr/releases
- https://github.com/nflverse/nflverse-data

### 2. nflverse weekly rosters — **useful supporting source; not sufficient for ordered starter transitions**
Useful fields include season/week roster membership, team, position/depth-position label, roster status, stable/cross-provider IDs and experience. Weekly rosters extend far enough historically to support team-change and roster-membership research.

Critical limitation:
- `depth_chart_position` is a position label rather than an audited `1,2,3...` depth order, and nflverse warns it is not always accurate;
- the public interface does not establish a final-preseason as-of timestamp comparable to the 2025+ depth-chart snapshots.

Research verdict:
- good for team changes, PUP/reserve state, identity and parts of vacated-opportunity reconstruction after cutoff semantics are proven;
- not a replacement for historical ordered depth charts.

### 3. nflverse injuries — **supporting historical availability signal with a 2025+ gap**
Pre-2025 nflverse injury reports include season/week, player/team identity, report/practice injury and status fields, and a modification date. nflverse documents that its prior injury source ended after 2024 and does not currently provide 2025 injury data from that feed.

Research verdict:
- useful as a pre-2025 supporting feature only where the report timestamp/cutoff is demonstrably pre-target;
- cannot be the sole current injury source for a production 2026 overlay.

### 4. Sportradar NFL Weekly Depth Charts — **preferred historical acquisition candidate**
Provider: Sportradar NFL API.

Documented fit:
- Weekly Depth Charts endpoint is addressable by `season_year`, `season_type`, and week;
- `PRE`, `REG`, and `PST` are supported;
- ordered `depth` is supplied (`1 = starter`);
- Sportradar's historical-data documentation says NFL data extends to 2000 and **preseason coverage begins in 2015**;
- historical feeds explicitly include Weekly Depth Charts, Weekly Injuries and Daily Transactions;
- documentation notes preseason depth charts become meaningful around training camp.

Critical point-in-time caveat:
- the endpoint documentation says depth charts can be updated shortly before, during, or after games;
- before any modeling, vendor confirmation/sample data must establish that historical PRE/week responses preserve the intended historical snapshot semantics and are not simply a later revised state.

Commercial/licensing gate:
- access is governed by Sportradar terms/order forms;
- its current terms explicitly distinguish Core, Expanded and Complete History products;
- the exact historical package, storage/derived-model rights, attribution/display restrictions and commercial use must be confirmed in the order form before League Vector depends on it.

Research verdict: **best candidate to purchase/evaluate first**.

Official references:
- https://developer.sportradar.com/football/docs/nfl-ig-historical-data
- https://developer.sportradar.com/football/reference/nfl-weekly-depth-charts
- https://developer.sportradar.com/football/docs/nfl-ig-rosters
- https://developer.sportradar.com/sportradar-updates/page/terms-and-conditions

### 5. SportsDataIO NFL Depth Charts / Vault — **strong secondary vendor; historical snapshot semantics must be proven**
Documented fit:
- ordered `DepthOrder` (`1 = Starter`) and record-level `Updated` timestamp;
- depth charts are actively maintained around transactions/injuries/usage;
- the current depth-chart product was publicly launched in 2022;
- SportsDataIO advertises a commercial historical/Vault product for research, backtesting and ML/training use cases, enabled through sales.

Critical limitation:
- public documentation establishes current/live depth-chart behavior and generic historical-data access, but does not establish that historical NFL depth-chart *change history* or final-preseason point-in-time snapshots for 2018-2024 are reconstructable;
- because the public depth-chart product dates to 2022, it cannot be assumed to cover the full desired 2018-2024 development window without vendor confirmation.

Research verdict:
- excellent candidate for a live/current opportunity overlay;
- historical candidate only if sales/support supplies a sample proving archived point-in-time depth snapshots and lawful derived-model rights.

Official references:
- https://sportsdata.io/developers/data-dictionary/nfl
- https://sportsdata.io/developers/workflow-guide/nfl
- https://sportsdata.io/sportsdataio-nfl-depth-chart-api-update
- https://sportsdata.io/developers

### 6. Ourlads historical NFL depth-chart archive — **discoverable but not approved for ingestion**
Ourlads exposes an NFL depth-chart archive and current ordered depth charts with update timestamps. This is evidence that historical chart states exist outside the commercial APIs.

However:
- no suitable API/data-license contract or explicit commercial modeling right was established in this audit;
- the pages are copyrighted publisher content;
- League Vector will **not scrape or train on the archive** without explicit written permission/licensing.

Research verdict: potential validation/corroboration lead only; not an approved source.

Reference:
- https://www.ourlads.com/nfldepthcharts/archive/new/index.html

### 7. FantasyPros / other ranking-projection publishers — **not selected**
No public source audited here established the required historical, ordered, timestamped preseason depth-chart archive with clean commercial/modeling rights. Proprietary projections/rankings also create unnecessary contamination of League Vector's projection-research objective.

Research verdict: do not use for this track unless Founder separately negotiates a specific data license and the source contract is re-audited.

## Historical point-in-time contract
A source is usable for model selection only if every historical row can be tied to information available before the target season/game. Required fields/metadata:
- `data_as_of`
- provider + provider snapshot/version ID
- season
- season type / preseason identifier
- team
- provider player ID
- mapped GSIS ID with mapping confidence
- normalized role family
- provider depth position
- ordered depth rank
- roster/list status
- injury/availability status where licensed
- source-quality flag
- acquisition provenance

Preferred cutoff:
1. league-wide final roster-cut timestamp before the first regular-season game, **or**
2. team-specific last provider snapshot before that team's first regular-season kickoff.

The cutoff must be fixed before inspecting season-Y outcomes. A historical endpoint that returns only a later revised value is not acceptable.

## Proposed feature families after acquisition
All features are computed using only data available at the season-Y cutoff.

### Depth / starter transition
- current ordered depth rank
- starter indicator derived from provider rank, never hardcoded as a point bonus
- change from prior valid historical depth state
- number of preseason rank changes
- starter-stability / depth-volatility features

### Vacated opportunity
For season Y:
1. compute Y-1 team carries, targets and pass attempts;
2. identify Y-1 contributors absent from the pre-Y roster/snapshot;
3. sum vacated role-specific opportunity and shares;
4. measure incoming competition;
5. let chronological models learn allocation rather than assigning vacated work automatically.

### Team / transaction change
- player changed team
- incumbent left via transaction
- new veteran competition arrived
- drafted competition arrived, using only already-approved draft-capital data
- team coaching/offensive-environment features only if a separately timestamped/licensed source is available

### Availability / roster state
- active / reserve / PUP state at cutoff
- known preseason absence state when timestamped and licensed
- no use of regular-season injury outcomes to inform the preseason forecast

### Young-player subgroup focus
Primary diagnostic cohorts:
- NFL year 2
- NFL year 3
- one prior season of meaningful opportunity
- prior-year backup / low-opportunity player who is starter/top-depth at current cutoff
- team-changing young player

This is subgroup evaluation, **not** a subgroup-only selection loophole. Overall and position-level stability still matter.

## Chronological model plan after the gate clears
Per QB/RB/WR/TE, compare:
1. validated v0.4 / historical-only opportunity proxy;
2. historical role-survival control;
3. + depth/starter state;
4. + vacated opportunity;
5. + team/transaction features;
6. + availability/roster-state features;
7. regularized interaction candidates only after main effects prove stable.

Primary opportunity targets:
- QB attempts / meaningful-role games
- RB carries + targets
- WR targets
- TE targets

Secondary projection outputs:
- fantasy points
- MAE / RMSE
- Spearman rank correlation
- top-N overlap where relevant
- role-survival Brier / AUC / calibration
- error by position, season, experience and history depth

Selection rules:
- development/model selection uses pre-2025 folds only;
- 2025 remains untouched retrospective evidence under the existing v0.4 protocol;
- no parameter may be selected because it looks good on 2025;
- deterministic snapshot hashes, feature hashes, fold manifests and output hashes are required;
- any candidate must beat validated v0.4 stably, not merely on aggregate average.

## Expected modeling value of purchasing historical depth data
**Expected value: HIGH for research, unproven for production.**

Why the purchase is justified as a research input:
- Cycle 2 already isolated role instability as a large error source;
- young-player under-projection exists, but direct age/experience corrections failed;
- a point-in-time role signal is the missing variable most directly aligned with that failure mode;
- ordered preseason depth plus vacated opportunity can distinguish a player whose prior production is stale because his role genuinely changed from a player who merely shares the same age/experience bucket.

What the purchase does **not** guarantee:
- it may fail to improve v0.4;
- unofficial depth charts may be noisy, especially RB committees and multiple-WR formations;
- one fold or one young-player subgroup is not enough for promotion.

Minimum useful vendor sample before purchase:
- 2018, 2020, 2022 and 2024 PRE/final-preseason snapshots for all 32 teams;
- stable player/team IDs;
- ordered depth;
- explicit snapshot semantics/as-of meaning;
- at least one year showing depth changes over preseason if change history is sold;
- written confirmation that League Vector may store the licensed inputs during the subscription, derive model features/weights, and use the resulting model commercially under the negotiated agreement.

## Founder purchase/licensing decision
Recommended order:
1. **Sportradar first** — request quote/sample for NFL historical access sufficient for 2018-2024 PRE Weekly Depth Charts, Weekly Injuries and Daily Transactions, with derived-model/commercial rights.
2. **SportsDataIO second** — request a historical-depth sample only if it can reconstruct true point-in-time 2018-2024 preseason states (not merely current values with `Updated` fields).
3. Do not buy Ourlads/FantasyPros data for this track without an explicit machine-readable commercial license and re-audit.

Questions Founder should send vendors:
- Can you return historical NFL preseason depth charts for each season 2018-2024?
- Is the response the original point-in-time snapshot, or a later revised/restated value?
- What is the earliest historical preseason depth-chart season with ordered player depth?
- Can we retrieve multiple preseason snapshots/change history, or only one chart per PRE week?
- Are historical injuries, roster statuses and transactions available with original timestamps?
- May we retain snapshots for model reproducibility after the subscription ends?
- May we train/fit internal predictive models and commercially use model outputs/derived parameters without redistributing raw data?
- What attribution, display, audit or deletion obligations apply?
- What product tier/history package is required and what is the price?

## Exact blocker / next unlock
The free 2025+ nflverse source solves **future** point-in-time collection, but not the pre-2025 multi-season selection requirement. Therefore no defensible depth-chart model can be selected yet.

Next unlock:
1. Founder obtains a vendor sample/contract answer, preferably from Sportradar.
2. Research validates historical snapshot semantics against known kickoff dates and hashes the raw snapshot manifest.
3. Only then build the 2018-2024 chronological opportunity-first backtest.

## Readiness
- `READY_FOR_QA`: **false**
- risk: **HIGH**
- model candidate: **none yet**
- production eligibility: **false**
- Dynasty Value eligibility: **false**
- current status: **BLOCKED — FOUNDER PURCHASE / LICENSING DECISION**
