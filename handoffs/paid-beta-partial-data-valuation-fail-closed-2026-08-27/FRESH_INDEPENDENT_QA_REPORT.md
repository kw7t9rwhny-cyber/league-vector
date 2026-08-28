# Fresh Independent QA Report

## Verdict

**FAIL** for substantive candidate `ff764a1309a20e19bd54898f260074061a06a638`, tree `fc0600a5ebdbdacfc036ccb1a9dc474b5f742d40`.

- P0: **0**
- P1: **2**
- Gate: **not met** (`PASS` requires P0 = 0 and P1 = 0)

The ordinary no-drift path correctly excludes legacy weekly projections and preserves the offensive value control. The candidate nevertheless does not meet the explicit eligibility-drift fail-closed requirement. One per-value guard accepts contradictory unsafe eligibility flags, and the analysis has no authoritative global gate before paid status and team totals render.

No candidate bytes were changed. QA did not remediate, merge, deploy, authorize payment, or activate numeric IDP Dynasty Value.

## Immutable identity and mutable PR state

Testing was performed in an isolated detached checkout. Before tests:

```text
git rev-parse HEAD
ff764a1309a20e19bd54898f260074061a06a638

git show -s --format=%T HEAD
fc0600a5ebdbdacfc036ccb1a9dc474b5f742d40
```

The checkout was clean. The base checkout was independently verified as commit `5b63a851a83092a58e35ddc26e439c7cbda209ed`, tree `2bf072f26ae46e73f3e303ae280438ed58795980`.

At the pre-persistence remote reconciliation, PR #78 was open and draft with head `510b80df336937f9e9e36556ae5ceebfac7be524`. That commit is the later artifact-only handoff commit, not the substantive candidate, and it was not tested as the candidate. The evidence branch and `refs/pull/78/head` both resolved to `510b80df336937f9e9e36556ae5ceebfac7be524` before this QA evidence was appended.

## Exact findings

### P1-01 — Per-value eligibility validation accepts contradictory projection-use flags

`app.js:73-77` defines paid eligibility using only:

1. `state === "PAID_VALUE_ELIGIBLE"`;
2. `numeric_offensive_paid_value_available === true`; and
3. `projection_policy === "CONTEXT_ONLY_NOT_IN_VALUATION"`.

It does not require the remaining safety-bearing fields to remain false, including `legacy_weekly_projection_adjustment_applied`, `projection_data_can_affect_paid_value`, `projection_data_can_affect_player_values`, `projection_data_can_affect_team_totals`, `projection_data_can_affect_sorting_or_ranking`, `projection_data_can_appear_inside_paid_value_components`, `missing_projection_substituted_with_zero`, or `projection_coverage_fabricated`.

Fresh browser falsification wrapped `LeagueVectorCore.calculateValuation`, preserved the three checked fields, and changed:

```js
result.paidValueEligibility.legacy_weekly_projection_adjustment_applied = true;
result.paidValueEligibility.projection_data_can_affect_paid_value = true;
result.paidValueEligibility.projection_data_can_affect_player_values = true;
```

Expected: no paid player value, rank, roster value, or team total.

Actual: `#playerValues .lv-value` resolved to **1** numeric value element instead of 0. Because the same three-field predicate gates collection, sorting, player cards, roster values, and team aggregation (`app.js:80-90`, `103-123`, `203-213`), contradictory unsafe contract state remains eligible across those surfaces.

This is a release blocker because the assignment explicitly requires eligibility drift to fail closed before numeric paid surfaces emit.

### P1-02 — Analysis-wide eligibility drift still emits eligible status and numeric zero team totals

The analysis calculates and renders valuations and team analyses first (`app.js:196-232`), then separately calls `Core.paidValueEligibility()` and copies its fields directly into the page while unconditionally publishing a paid-eligible success message (`app.js:233-244`). There is no single validated analysis-wide eligibility decision before rendering.

Two fresh browser falsifications demonstrate the consequences:

1. Top-level policy drift: overriding the exported eligibility getter to return `state: "PAID_VALUE_ELIGIBLE"` with `projection_policy: "DRIFTED_UNSAFE_POLICY"` produced an element with both `data-state="PAID_VALUE_ELIGIBLE"` and `data-projection-policy="DRIFTED_UNSAFE_POLICY"`, plus the text “PAID_VALUE_ELIGIBLE — Offensive paid values remain available”. This violates the requirement that `PAID_VALUE_ELIGIBLE` be emitted only with `CONTEXT_ONLY_NOT_IN_VALUATION`.
2. Value-level policy drift: changing each valuation's policy to `DRIFTED_UNSAFE_POLICY` did suppress player cards and roster values, but `teamAnalyses()` reduced an empty eligible set to numeric zero and `renderTeamAnalysis()` emitted **4** numeric metric elements (Offensive market, Offensive LV, Starters, Bench/depth), rather than withholding the paid team surface. The page still declared the analysis paid-value eligible.

This is a release blocker because the assignment requires drift to fail closed before team totals emit and forbids zero substitution from representing unavailable paid data.

The machine-readable exact finding records are in `FRESH_INDEPENDENT_QA_FINDINGS.json`.

## Required adversarial coverage

An independent temporary Node harness, separate from the creator-authored test file, passed all of the following against the frozen candidate:

- complete coverage;
- one missing record;
- 17/18, 1/18, and 0/18 coverage;
- malformed response;
- wrong-player mapping;
- duplicate player response;
- stale response;
- mixed source/schema/model versions;
- timeout after partial success;
- successful empty payload;
- old cache mixed with fresh data;
- unsupported identity; and
- all requests failing.

Every hostile legacy context produced the same byte-equivalent valuation object and successor value `8,240`. The complete positive control remained a positive numeric value, so the result was not reject-all. Identical inputs reproduced byte-equivalent eligibility and valuation output.

An actual detached checkout of the base commit ran the predecessor production aggregation, scoring, replacement-level, and valuation functions and reproduced:

```text
18/18 = 7,440
 1/18 = 9,520
 0/18 = 8,240
```

The exact candidate produced `8,240 / 8,240 / 8,240` without reading or zero-filling legacy weekly projection data.

## Production-path review

- Retrieval/cache/fallback: `seasonProjections` and `projectionWeek` are absent from the production adapter; `/projections/nfl/` is absent from `data-sources-v08.js` and `app.js`.
- Paid components: the former projection aggregation, scoring, replacement-level, VORP, and projection-adjustment fields are absent from `calculateValuation` and its returned paid components.
- Identity: unresolved/ambiguous offensive identities do not produce valuations; independent hostile legacy identity fields do not enter the paid calculation.
- Player values/ranks/rosters/team totals: ordinary control is projection-independent, but the two P1 drift findings prevent acceptance.
- Warnings/status/language: the ordinary path states exclusion, continued base paid value availability, safe inspection, no zero substitution, and no fabricated coverage. P1-02 shows this language can be emitted under drift.
- Experimental projections: the separate experimental panel remains labeled experimental and states Dynasty values are unchanged.
- Saved/exported surfaces: no paid-value save/export implementation exists in the reviewed production path.
- IDP: numeric IDP Dynasty Value and offense-plus-IDP combined Dynasty rankings remain unavailable; browser and Node controls preserved the firewall.
- Offensive regressions: age, structure, rookie-floor, confidence, and informational trade-count behavior remained covered by the full suite.

## Executed validation

| Validation | Result |
| --- | --- |
| Candidate identity and clean checkout | PASS |
| `git diff --check` | PASS |
| Repository style check | PASS — 129 files |
| JavaScript syntax checks from `package.json` | PASS — 25 targets |
| Full Node suite | PASS — 739 passed, 0 failed, 0 skipped |
| Frozen targeted creator suite rerun | PASS — 22 passed, 0 failed |
| Independent successor adversarial Node harness | PASS — 5 passed, 0 failed |
| Actual-base predecessor production-function harness | PASS — 1 passed, 0 failed |
| Full repository Playwright matrix | PASS — 66 passed, 0 failed; desktop and mobile Chromium |
| Fresh independent intercepted browser control | PASS — zero legacy weekly requests and truthful ordinary rendering |
| Fresh independent eligibility-drift browser falsification | **FAIL — 3 failing assertions grouped into 2 P1 root causes** |

The environment had no system `node`/`npm` on `PATH`. The bundled Node v24.19.0 runtime executed the repository linter, all package-listed syntax checks, and Node tests directly. Playwright 1.62.1 and its already-installed Chromium were reused from the frozen creator environment; no dependency or candidate update was made. Initial sandboxed browser startup failed with `listen EPERM` on `127.0.0.1:4173`; the same browser command then ran with approved local server/browser permission.

## Terminal boundary

Result: **FAIL — return to implementation ownership**. No remediation is authorized or performed by this QA assignment. A future candidate requires a new exact-SHA independent QA decision.

