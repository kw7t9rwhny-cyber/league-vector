# League Vector IDP Research Cycle 3 — Foundational Eligibility / Age / Replacement

Status: **MORE RESEARCH REQUIRED — NO NUMERIC IDP DYNASTY CANDIDATE**

Branch: `codex/idp-foundation-research-v03`
Parent checkpoint: `codex/idp-projection-research-v02` at `957ad8cb288661c3692081ec1fe4c5539e0648d2`

This cycle is research-only. No production UI, production projection activation, production Dynasty Value math, offense/IDP combined ranking, Core activation, or `main` change is authorized.

Required firewall remains:

`idp_dynasty_value_available=false`

unless and until a position-specific or broader model is independently QA-approved.

## 1. Current-player eligibility — fail-closed contract strengthened by live evidence

Cycle 2 proved the retained 2026 projection-ready universe could contain stale retired players. Cycle 3 separates historical production eligibility from **current fantasy-player eligibility**.

A timestamped Sleeper NFL player snapshot is useful current platform evidence because Sleeper exposes `active`, `status`, `fantasy_positions`, `team`, injury status and depth-chart fields. It is **not sufficient to trust `active` in isolation**.

A live League Vector historical-identity workflow artifact generated on 2026-08-14 contained 12,218 Sleeper records: 9,411 had `active=true`, and 7,273 were active plus fantasy-relevant by the existing broad position gate. Within the unresolved/ambiguous/conflicting review subset alone, there were 223 records with `active=true` but explicit `status=Inactive`, 32 with `active=true` and missing status, and 2,336 teamless records with `active=true` plus `status=Active`. Those review-subset counts are not population prevalence estimates; they prove that contradictory and teamless/stale-looking combinations exist and therefore cannot be auto-approved. Durable provenance is retained in `data/research/idp-current-sleeper-safety-evidence-v03.json`.

Fail-closed current eligibility contract implemented in `idp-foundation-research-v03.js`:

- `active === true` is required but never sufficient alone.
- a recognized current `status` is required; missing or unknown status is excluded rather than guessed.
- retired or inactive states are excluded even when `active === true` conflicts.
- `Active` + current NFL team => `active_roster`.
- `Active` + no NFL team => `teamless_unverified` and is excluded by default.
- a teamless player may become `verified_free_agent` only when a separate current authority explicitly verifies that exact player identity as a current NFL free agent.
- recognized IR/PUP/NFI states remain current-eligible only when an NFL team is present.
- recognized practice-squad state remains current-eligible only when an NFL team is present.
- missing current Sleeper identity for a historical/projection record fails closed.
- no player-name exception list is permitted.

The projection model may still learn from a retired player's historical seasons when those seasons were valid training observations. The player is simply barred from the **current** projection-ready pool if current eligibility fails.

The audit runner `scripts/idp-current-pool-v03.js` produces counts by included position/current class, excluded reason and real hybrid eligibility set. It does not currently provide a second source that can verify teamless free agents, so those records remain excluded in this cycle.

### Remaining current-eligibility limitation

Sleeper status strings must be monitored as an external contract. A newly introduced status is not auto-approved. It lands in `unknown_status_fail_closed` until explicitly reviewed. Teamless free-agent inclusion remains data-blocked until a legally usable current roster/transaction authority can independently establish the player's current NFL status.

## 2. Multi-position / hybrid eligibility — representation and allocation contract resolved

Cycle 2 had only one normalized modeling position. Cycle 3 formalizes two independent concepts:

1. **model position** — exactly one historical modeling group (`DL`, `LB`, or `DB`) used for training, age curves and model diagnostics;
2. **lineup eligibility** — the complete current platform eligibility set preserved separately.

Canonical current mappings include:

- DL family: `DL`, `DE`, `DT`, `EDGE` -> `DL`
- LB family: `LB`, `ILB`, `OLB` -> `LB`
- DB family: `DB`, `CB`, `S`, `FS`, `SS` -> `DB`

A real player may therefore have lineup eligibility such as `[DL, LB]` or `[DB, LB]` while retaining one model position.

### Scoring

Projected statistics are scored once under the league scoring rules. Dual eligibility does not create a second statistical projection and never creates two observations for one player-season.

### Starter allocation / replacement

`maximumWeightAssignment()` performs one deterministic constrained slot assignment across dedicated DL/LB/DB and IDP-flex slots. A player can occupy at most one slot. The assignment can move a hybrid player between valid slots to preserve the strongest overall lineup, so slot scarcity is handled globally rather than by independent position sorts.

An initial CI test exposed a rematching bookkeeping defect in the first implementation; that defect caused a displaced hybrid to lose its new assignment. The research branch was not treated as valid while that test failed. The state transition was corrected and the deterministic test suite was expanded to cover dedicated-slot reassignment and IDP-flex sharing.

### Hybrid value

League Vector must not calculate DL VORP and LB VORP independently and then choose whichever is larger. The implemented research quantity `playerMarginalStarterValue()` is the change in the optimized league starter-pool total when that player is removed. Any positional benefit therefore comes from a real constrained assignment and replacement cascade, not from a hand-selected label.

`replacementShadowPrices()` additionally exposes the marginal score unlocked by one extra dedicated DL/LB/DB or IDP-flex slot. These are league/configuration outputs, not universal constants.

### Remaining hybrid limitation

The real 2026 hybrid population still needs the current fail-closed Sleeper snapshot audit before numerical sensitivity conclusions are accepted. Mapping strings are a versioned platform contract and unknown position labels must be reviewed rather than silently coerced.

## 3. Player-season age / experience curves — retrospective-age bug removed

Cycle 3 adds `scripts/idp-age-curves-v03.js`.

Historical age is calculated as completed years from `birth_date` at **September 1 of each historical season**. Current player age is never copied backward across historical seasons.

Experience is calculated as:

`experience_season = season - rookie_year + 1`

when `rookie_year` is known. Missing birth date or rookie year remains missing.

The runner separates DL/LB/DB and reports by player-season age:

- reference-scoring annual production;
- production per observed statistical week;
- an explicitly labeled observed-week participation/availability proxy;
- next-season IDP statistical participation rate;
- next-season same-model-position persistence;
- conditional year-over-year per-observed-week production change;
- defensive snaps only where the approved normalized source actually provides them.

### Critical terminology guard

`observed_stat_weeks` is **not** claimed to be exact games played, health availability or snap opportunity. It is a diagnostic proxy.

True `role_survival` remains `BLOCKED_WITHOUT_POINT_IN_TIME_ROLE_OR_SNAP_AUTHORITY`. This cycle deliberately does not convert tackles, fantasy points or current depth charts into fake historical role labels.

Finer EDGE / off-ball LB / safety / corner age curves remain research-only until the underlying historical role classification and sample sizes support them.

## 4. Replacement — improved hybrid-safe methodology, not yet approved numeric dynasty value

Cycle 2's league-specific replacement principle is retained: league size, dedicated starter counts, shared IDP-flex, scoring and eligibility determine scarcity.

Cycle 3 improves it by replacing independent canonical-position allocation with a single constrained assignment that supports real multi-position eligibility and cannot double-count hybrids.

No replacement constants are hardcoded. Any retained boundary must be regenerated for the league and scoring configuration. Tests now explicitly show that a slot shadow price changes when the league's starter structure changes.

Before a numeric dynasty candidate can be approved, research still needs:

- real current hybrid-population sensitivity;
- replacement stability across representative and adversarial league structures;
- deterministic reconstruction from the exact league roster-position contract;
- proof that unsupported scoring keys remain explicit rather than treated as zero.

## 5. Cross-position normalization

**DEFERRED.**

No offense-vs-IDP normalization is created in this cycle. Cycle 2's conceptual one-year surplus bridge remains research context only. The required next proof is defensible within-IDP value separately for DL, LB and DB.

## 6. Position readiness

### DL — NOT READY

Current-eligibility and hybrid representation blockers now have explicit contracts. Remaining blockers include true role/opportunity survival, real hybrid sensitivity, age-curve execution/review, and uncertainty integration.

### LB — NOT READY

Same foundational improvements apply, but prior whole-player error and role instability remain the weakest of the three groups. No numeric candidate.

### DB — NOT READY, STILL CLOSEST

DB retains the strongest prior age/Ridge evidence and comparatively better tail behavior, but this cycle does not yet supply the missing independently reviewed player-season age/survival evidence or true role-survival authority. DB is therefore **not** marked READY FOR QA.

A position does not advance merely because its relative evidence is better than DL/LB.

## 7. Firewall verification

This branch adds only research contracts, runners, tests, CI evidence collection and documentation. It does not authorize a numeric IDP dynasty value or combined offense/defense rankings.

Required state remains:

- `experimental=true`
- `idp_dynasty_value_available=false`
- `production_projection_eligible=false` for any new dynasty quantity from this cycle
- `dynasty_value_eligible=false`
- `READY_FOR_QA=false`

## 8. Deterministic tests added

`tests/idp-foundation-research-v03.test.js` covers:

- fail-closed retired/inactive/missing/contradictory status behavior;
- teamless Active fail-closed behavior plus explicit separately verified free-agent inclusion;
- current active-roster, IR/PUP and practice-squad classification;
- DL/LB, LB/DB and EDGE/LB canonical hybrid eligibility;
- no hybrid double counting;
- reassignment under dedicated-slot scarcity;
- shared IDP-flex assignment;
- optimized marginal starter value rather than max-of-position VORP;
- league-structure-sensitive replacement shadow prices;
- player-season age and experience calculation;
- failure when no current Sleeper identity exists.

`tests/idp-age-curves-v03.test.js` covers historical season-age calculation, production aggregation, missing-snap preservation, participation survival diagnostics and the explicit true-role-survival block.

## 9. Next required evidence

Before any position-specific READY FOR QA / HIGH handoff:

1. execute the tightened current Sleeper eligibility audit against the regenerated raw 2026 projection-ready file and inspect all unknown statuses / missing current identities / teamless exclusions;
2. quantify the real current hybrid population and replacement/ranking sensitivity across representative Sleeper roster configurations;
3. execute the 2015-2025 player-season age runner and review sample size, survivor conditioning and position/age stability;
4. add legally and temporally defensible historical opportunity/role evidence before claiming true role-survival curves;
5. rerun within-IDP replacement and uncertainty sensitivity independently for DL/LB/DB;
6. only then decide whether DB alone is sufficiently mature for a HIGH-risk experimental QA candidate.

## Final decision

Cycle 3 resolves the **methodological contracts** for fail-closed current-player eligibility and hybrid lineup eligibility and removes the retrospective-current-age error from the age-curve pipeline. Live evidence forced the current-player gate to become stricter: teamless `Active` is not accepted as a free-agent proof. The cycle still does not establish enough empirical role-survival / opportunity evidence to expose numeric dynasty values.

**MORE RESEARCH REQUIRED. NO POSITION IS READY FOR QA YET.**
