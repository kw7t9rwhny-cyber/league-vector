# Current Opportunity / Depth Chart Model v0.1 — Research Checkpoint

## Research question
Can point-in-time preseason/current-season role information materially improve League Vector opportunity and fantasy projections beyond validated Projection v0.4 without arbitrary starter bonuses or future leakage?

## Research boundary
- Research only.
- Validated veteran Projection v0.4 remains control.
- No production projection, Dynasty Value, UI, Core, IDP, or main behavior changes.
- `experimental=true`
- `production_projection_eligible=false`
- `dynasty_value_eligible=false`

## GitHub state at start
- `main`: `b5a3f56e7bb95810b2fd787c4f5ce0ff12c851b6`
- Cycle 2 control branch head: `7ee8dbabea1188f1b9413cfaf0a17b3b6164006b`
- This branch: `codex/projection-opportunity-v01`, created from Cycle 2 control head.

## Repository audit
No historical depth-chart/starter snapshot dataset exists in the League Vector repository. Existing research contains historical player stats, identities, rosters/player metadata, rookie draft capital, and validated v0.4 artifacts, but no defensible preseason depth-order history.

## Candidate source audit

### nflverse weekly rosters
Provider: nflverse / nflreadr

Available fields/useful signals:
- season/week roster membership
- team
- primary position and depth-chart-position label
- roster status (ACT, PUP, RES, etc.)
- GSIS and multiple cross-provider identity IDs
- years of experience

Historical depth: weekly rosters documented back to 2002.

Format: CSV/RDS/Parquet releases.

License: nflverse-data repository is published under CC BY 4.0 with attribution. Weekly rosters are documented as derived from NFL Shield v2 API, so underlying-source provenance/production-rights review remains required before League Vector treats this as a commercial production dependency.

Critical limitation: the public weekly roster interface does not establish a reliable preseason `as_of` timestamp or an ordered starter depth (`1,2,3...`) field suitable for a leakage-safe backup→starter historical backtest. `depth_chart_position` is a position label, not an audited depth order, and nflverse itself warns that the field is not always accurate.

Research verdict: useful for team-change, roster-status, PUP/IR, current-team identity, and potentially vacated-opportunity research after cutoff semantics are proven; insufficient alone for historical starter transitions.

### Sportradar NFL Weekly Depth Charts
Provider: Sportradar

Fields:
- season year/type/week
- team and stable Sportradar IDs
- depth-chart position
- ordered `depth` where 1 = starter
- weekly depth-chart snapshots

Historical/point-in-time structure: endpoint is explicitly indexed by season, season type, and NFL week, including preseason (`PRE`) and regular season (`REG`). This is the strongest discovered architecture for leakage-safe historical role snapshots.

Update behavior: documentation says weekly depth charts update shortly before games and can also be updated during/postgame. Therefore the acquisition protocol must freeze the exact preseason/Week-1 endpoint response before games, or confirm historical API semantics preserve the pregame snapshot rather than returning a later revised state.

Access/commercial rights: trial and production access exist; production is for customers. Trial lasts 30 days. Pricing/commercial terms are not public enough to approve production use from documentation alone.

Research verdict: strongest candidate for a true starter-transition backtest, subject to API access plus confirmation of historical snapshot semantics and commercial rights.

**FOUNDER DECISION REQUIRED** before purchasing/contracting.

### SportsDataIO NFL Depth Charts
Provider: SportsDataIO

Fields:
- TeamID / PlayerID
- position/category
- `DepthOrder` (1 = starter)
- `Updated` timestamp per record
- active/all depth-chart variants
- injury/PUP/IR context
- team scheme metadata

Operational quality: depth charts are updated year-round based on transactions, injuries, player usage, official sources and credible media reports. Each change is timestamped.

Historical limitation: public documentation proves current/live depth-chart behavior but does not by itself prove an endpoint that reconstructs the full point-in-time preseason depth chart for each historical season. Historical/replay access may be available commercially, but that must be confirmed with the vendor.

Commercial rights: vendor subscription required for production. Some individual dictionary fields are explicitly marked not licensed for public/commercial use, so field-level rights must be reviewed in the contract.

Research verdict: very strong live-2026 provider and potentially strong historical provider if SportsDataIO confirms historical depth-chart replay/snapshots.

**FOUNDER DECISION REQUIRED** for vendor confirmation/quote before historical model use.

### FantasyPros API
Provider: FantasyPros

Commercial API access exists, but free/premium access is non-commercial/personal and commercial use requires a separate agreement. Commercial terms also prohibit/limit competitive use in ways requiring explicit review for League Vector. Public API documentation does not establish the historical point-in-time NFL depth-chart archive needed for this backtest.

Research verdict: not preferred for this role model without a negotiated commercial agreement and historical snapshot confirmation.

## Leakage-safe cutoff proposal
Preferred historical cutoff: the last provider snapshot before each team's first regular-season game, or a single league-wide timestamp after final roster cuts but before the first Week-1 game.

Every row must carry:
- `data_as_of`
- provider snapshot identifier/version
- acquisition timestamp if live
- season/week/preseason identifier
- player provider ID + mapped GSIS ID
- team
- depth position
- depth order
- roster/injury status

A historical API that simply returns the latest revised value for `season/week` is not sufficient unless vendor documentation confirms the result corresponds to the relevant pregame snapshot.

## Planned role variables once historical snapshots are available
- starter status: starter / rotational-or-secondary / deep backup
- depth order by normalized role family (QB, RB, WR, TE)
- role delta vs prior-season opportunity class
- team-change flag
- prior-team vacated carries/targets/attempts
- incoming competition draft/free-agent indicators
- preseason PUP/IR/known-absence state
- history depth and experience

No starter bonus will be hardcoded. The initial target is opportunity, not fantasy points.

## Vacated opportunity research contract
For season Y, using only information known before Y:
1. compute each team’s Y-1 total carries/targets/pass attempts and player shares;
2. identify Y-1 contributors absent from the validated pre-Y roster snapshot;
3. sum vacated role-specific opportunity;
4. join to current roster/depth-chart candidates without assigning that opportunity automatically;
5. let chronological models determine whether depth order + vacated opportunity predicts Y opportunity.

This can be implemented after a trustworthy pre-Y roster/depth snapshot is secured.

## Historical model plan
Compare, per QB/RB/WR/TE:
1. validated v0.4 / historical-only opportunity proxy;
2. historical-only role-survival model;
3. historical + starter/depth-order state;
4. historical + depth order + vacated opportunity;
5. plus team-change / injury-status ablations.

Primary targets:
- QB attempts / meaningful-role games
- RB carries + targets
- WR targets
- TE targets

Secondary outputs:
- fantasy points
- Spearman / top-N rank overlap
- role-survival AUC / Brier / calibration
- second-year and low-history subgroup error

Selection must be chronological and based only on pre-2025 evidence. 2025 remains retrospective observed evidence.

## Failure modes to test
- multiple WR starters with ambiguous hierarchy
- committee RB depth labels
- listed starter who is injured
- rookie backup who wins role after snapshot
- team changes
- misleading unofficial depth chart
- duplicated/misaligned identities
- provider revisions after games

## Current 2026 overlay architecture (future only)
If historical validation succeeds, the recommended architecture to test is:

`validated historical projection -> expected baseline opportunity`

`current opportunity model -> predicted current role/opportunity`

`reconciliation layer -> final experimental current-season projection`

Role information may also feed a separate role-stability probability and uncertainty interval. No arbitrary additive percentage should be used.

## Current blocker
A defensible ordered historical preseason depth-chart dataset is not available in the repository or a clearly approved free source discovered in this cycle.

Sportradar provides the cleanest season/week-addressable depth-chart API and SportsDataIO provides strong ordered/timestamped live depth-chart data, but vendor access/terms and historical snapshot semantics must be confirmed before the HIGH-risk backtest can proceed.

## Readiness
No opportunity-model performance claim is made. No starter-transition effect size is claimed. No v0.4 improvement claim is made.

Exact next unlock:
- obtain a trial/sample or contractual confirmation from Sportradar and/or SportsDataIO that historical preseason/Week-1 ordered depth-chart snapshots can be retrieved with stable identities and lawful research/commercial-model rights;
- freeze 2018–2024 snapshots at a defensible cutoff;
- then execute the opportunity-first chronological backtest defined above.

Status: MORE CURRENT OPPORTUNITY RESEARCH REQUIRED
