# IDP Research Cycle 3 — Executed Evidence / Remaining Blockers

Status: **MORE RESEARCH REQUIRED — NO NUMERIC IDP DYNASTY CANDIDATE**

Durable evidence manifest: `data/research/idp-foundation-evidence-v03.json`

Successful evidence run:

- branch head evaluated: `af3a6e1608f16b872dc2c9f26a130093a7ff3fa4`
- GitHub Actions run: `31814458512`
- validate: success
- historical-data-audit: success
- projection-benchmark: success
- projection-v03 + IDP foundation research: success
- live publish: skipped
- IDP foundation artifact: `9224459790`
- IDP artifact digest: `sha256:a38e34dda4f202ccb062311e750db1c05db8445eedb532410062771a2b6fd5a9`

The branch remains research-only and the firewall remains:

`idp_dynasty_value_available=false`

## Current-player eligibility

The regenerated 2026 research projection file contained 1,747 projection-ready IDP records before the new current-player eligibility gate.

The fail-closed gate retained 753 current rostered IDPs:

- DL: 278
- LB: 222
- DB: 253

It excluded 994:

- 838 `teamless_active_unverified_fail_closed`
- 25 `injury_status_without_team_fail_closed`
- 131 `inactive_status:inactive`

All 753 included records were `active_roster` under the current contract. No teamless record was automatically called a current free agent.

This is intentionally conservative. It stops stale retired/inactive historical players from entering the current projection pool, but it can create false-negative exclusions for legitimate current free agents until a second current authority verifies them.

### Current free-agent corroboration research

A promising independent research source is nflverse weekly rosters:

`https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_<season>.csv`

The nflreadr `load_rosters_weekly()` implementation points to that release path and documents week-level roster data back to 2002. nflverse describes the weekly roster release as NFL Shield v2-derived. The nflverse-data repository is CC-BY-4.0, while the roster-building code repository is MIT.

This source can be evaluated as a **research corroborator** for exact GSIS identities, especially teamless/free-agent states. It must not be silently promoted to commercial production authority solely because the repository license is permissive; upstream NFL data rights / commercial use should be reviewed separately.

Until such corroboration is incorporated and reviewed, teamless free agents remain data-blocked and fail closed.

## Hybrid / multi-position eligibility

The safely current-eligible pool contained 48 real Sleeper multi-position IDPs:

- DL/LB: 47
- DB/LB: 1

The research contract keeps one historical **model position** and a separate complete **lineup eligibility set**.

A player is scored once and assigned once. One constrained maximum-weight assignment allocates dedicated DL/LB/DB plus shared IDP FLEX slots. A hybrid player can move between valid slots to optimize the league-wide starter set but cannot occupy two slots.

Hybrid-aware replacement was compared with a forced single-model-position counterfactual:

### 12-team shallow: 1 DL / 1 LB / 1 DB / 1 IDP FLEX

- 48 starters
- hybrid-aware starter points: 6,588.309
- single-position counterfactual: 6,570.870
- hybrid effect: +17.439
- selected-player overlap: 44 / 48
- selected hybrids: 11

### 12-team balanced: 2 DL / 2 LB / 2 DB / 2 IDP FLEX

- 96 starters
- hybrid-aware starter points: 11,781.467
- single-position counterfactual: 11,776.124
- hybrid effect: +5.343
- selected-player overlap: 94 / 96
- selected hybrids: 17

### 14-team deep: 2 DL / 3 LB / 2 DB / 2 IDP FLEX

- 126 starters
- hybrid-aware and counterfactual total: 14,484.307
- hybrid effect: 0
- selected-player overlap: 126 / 126
- selected hybrids in hybrid-aware assignment: 21

Conclusion: multi-position eligibility is materially binding in some league structures and non-binding in others. Therefore League Vector must never value a hybrid by calculating independent DL/LB/DB VORP and simply choosing the largest result.

## Replacement

Replacement remains league-specific and was regenerated from:

- league size
- dedicated DL/LB/DB starter counts
- shared IDP FLEX count
- scoring
- current lineup eligibility

No universal replacement constant was introduced.

Under the diagnostic reference-scoring configurations, the optimized one-slot shadow prices changed by league structure:

- shallow 12: DL 124.187, LB 124.187, DB 102.752, FLEX 124.187
- balanced 12: DL 99.675, LB 99.675, DB 92.663, FLEX 99.675
- deep 14: DL/LB/DB/FLEX all 82.957

These are **not dynasty values** and are not production constants. Their purpose is to demonstrate that scarcity must be generated from the actual league contract.

## Player-season age / experience curves

The player-season age runner executed on 2015–2025 data:

- 90,819 IDP weekly observations
- 9,439 IDP player-seasons
- 9,439 with historical player-season age
- 0 missing age in the executed sample

Age is calculated at September 1 of each historical season. Current age is never copied retrospectively.

Selected participation / conditional production diagnostics:

### DB

- age 24: n=496; next-season participation 74.07%; conditional YoY points/observed-week delta -0.0512
- age 27: n=324; participation 72.76%; delta -0.5732
- age 30: n=147; participation 55.15%; delta -0.8443

### DL

- age 24: n=430; participation 77.81%; delta +0.0814
- age 27: n=320; participation 78.65%; delta -0.3042
- age 30: n=164; participation 75.00%; delta -0.6632

### LB

- age 24: n=483; participation 79.87%; delta +0.1474
- age 28: n=217; participation 78.01%; delta -1.0152
- age 31: n=70; participation 46.88%; delta -1.8096

These are survivor-conditioned diagnostics, not causal dynasty age multipliers. Raw late-career production is heavily selection-biased because weak players leave the sample.

## Opportunity / role survival

**Still blocked.**

The normalized historical source supplied **zero player-season rows with defensive snaps** in this executed age-curve pipeline. League Vector therefore did not impute snap opportunity, starter status, depth role, or true role survival from tackles, fantasy points, or current depth charts.

Current diagnostic `next_season_any_idp_observed` is a participation-survival proxy only. It is not a starter-survival or role-survival label.

True role survival remains:

`BLOCKED_WITHOUT_POINT_IN_TIME_ROLE_OR_SNAP_AUTHORITY`

This is now the largest common foundation blocker across DL/LB/DB.

## Within-IDP readiness

### DL — NOT READY

The eligibility, hybrid, historical-age and replacement contracts are materially improved, but true historical role/opportunity survival remains unavailable.

### LB — NOT READY

Same foundational blocker as DL, plus prior whole-player error / role instability remains the weakest of the three position groups.

### DB — NOT READY, CLOSEST

DB has the strongest prior modeling evidence and now has a clean historical player-season age/participation curve, but that curve is still survivor-conditioned and has no true historical starter/opportunity signal. DB is not advanced merely because it is relatively stronger than DL/LB.

No position is marked `READY FOR QA / HIGH` in this cycle.

## What can proceed now

Research can continue immediately on:

- current roster/free-agent corroboration adapters using exact stable IDs;
- real hybrid sensitivity across additional Sleeper league structures/scoring systems;
- league-specific replacement reconstruction from actual Sleeper roster-position settings;
- age/experience survival modeling with explicit survivor-bias controls;
- uncertainty outputs by DL/LB/DB;
- historical opportunity/snap/role source evaluation;
- DB-only experimental architecture, while keeping all numeric dynasty output disabled.

## What remains data-blocked

The following may not be claimed or activated without stronger source evidence:

- current teamless free-agent eligibility when no independent current authority verifies the player;
- exact historical starter / reserve role;
- historical defensive-snap opportunity from the current normalized weekly-stat source;
- true starter-to-backup / backup-to-starter role survival for IDP;
- finer EDGE/off-ball LB/CB/S age curves unless historical role classification is trustworthy and sample sizes support them;
- numeric DL/LB/DB dynasty values;
- offense-vs-IDP normalization;
- combined offense/defense rankings.

## Final checkpoint decision

The cycle resolved the **methodology** for fail-closed current eligibility, real hybrid eligibility and league-specific replacement, and it corrected historical aging to player-season age. The empirical run confirms each implementation behaves on the live research pool.

It did **not** resolve the common historical opportunity / true role-survival blocker. Therefore:

**MORE RESEARCH REQUIRED. `idp_dynasty_value_available=false`. NO POSITION IS READY FOR QA YET.**
