# Paid-Beta Partial-Data Valuation Fail-Closed Implementation Report

## Candidate

- Assignment: `VAS-2026-08-27-LEAGUE-VECTOR-PARTIAL-DATA-VALUATION-FAIL-CLOSED-REMEDIATION-001`
- Branch: `codex/paid-beta-partial-data-valuation-fail-closed-2026-08-27`
- Resolved base: `5b63a851a83092a58e35ddc26e439c7cbda209ed`
- Substantive candidate: `ff764a1309a20e19bd54898f260074061a06a638`
- Substantive tree: `fc0600a5ebdbdacfc036ccb1a9dc474b5f742d40`
- Selected contract: **Option 2 — adjustment excluded from paid-beta valuation**

No merge or deployment is authorized. This report records creator implementation and testing only; it is not independent QA.

## Fresh-base resolution

The assignment expected main at `bbc8de7108e1c61d8a9c0bf856738dcb4c6b73ae` (tree `19af8168710e97d6ce5152409d06cec5f7394d8c`). Fresh main resolved to `5b63a851a83092a58e35ddc26e439c7cbda209ed` (tree `2bf072f26ae46e73f3e303ae280438ed58795980`).

The intervening delta touched CI, the experimental projection data file, `index.html`, premium homepage assets, and premium homepage tests. The paid valuation implementation files `app.js`, `core-v08.js`, and `data-sources-v08.js` were unchanged. The `index.html` delta added premium homepage assets and did not change the paid-value contract. The remediation was therefore bound to fresh main while preserving the newer homepage work.

No open PR or remote branch contained this exact remediation when work began.

## Predecessor production path and root cause

The defect reproduced on fresh main with the assignment's deterministic fixture:

| Weekly responses | Displayed predecessor value |
| --- | ---: |
| 18/18 | 7,440 |
| 1/18 | 9,520 |
| 0/18 | 8,240 |

The complete path was:

1. `data-sources-v08.js` requested 18 undocumented Sleeper weekly projection endpoints. Each failed week was caught and returned as `[]`.
2. Per-week cache entries and network responses could be combined without an immutable snapshot, model version, schema version, freshness or completeness proof.
3. `app.js` flattened the successful rows, aggregated them by Sleeper player ID, scored the remaining rows and rebuilt neutral and league replacement levels from that partial population.
4. `core-v08.js` converted the partial target/replacement comparison into a capped projection adjustment and included it in `finalValue`.
5. The same `finalValue` fed player cards, sort/rank order, roster values, starter/bench summaries and team totals.
6. The UI reported `partial` or `unavailable`, but then completed successfully and emitted ordinary numeric paid values.

There was no separate saved or exported paid-result surface in the current application. Browser failure behavior was therefore the final externally visible failure path, and it completed instead of failing the paid-value contract closed.

## Contract selection

Option 2 is the smallest defensible contract because the undocumented source does not provide the metadata required to prove a complete, fresh, identity-resolved, version-consistent immutable snapshot. Implementing Option 1 on top of that source would manufacture guarantees the provider response does not carry.

Under the selected contract:

- paid offensive value is computed from the market baseline or applicable rookie floor, age, and structural league pressure;
- the former weekly projection adjustment and replacement-level path are absent from paid valuation;
- paid analysis does not request the undocumented weekly projection endpoint;
- weekly and experimental projection data may appear only as separately labeled context;
- projection data cannot change player values, team totals, roster values, sorting or ranking;
- no missing projection is substituted with zero and no coverage is fabricated;
- offensive paid values expose `PAID_VALUE_ELIGIBLE` with projection policy `CONTEXT_ONLY_NOT_IN_VALUATION`; and
- the existing IDP numeric dynasty-value and combined-ranking firewalls remain closed.

The contract is persisted at `docs/paid-data-eligibility-contract-v01.json`, returned on every offensive valuation, exposed on the results DOM and `window.__leagueVectorPaidValueEligibility`, and explained in the UI.

## Successor behavior

The predecessor fixture now produces the same value for every projection-coverage shape because projections are outside the paid-value contract:

| Weekly responses supplied adversarially | Successor paid value | State |
| --- | ---: | --- |
| 18/18 | 8,240 | `PAID_VALUE_ELIGIBLE` |
| 1/18 | 8,240 | `PAID_VALUE_ELIGIBLE` |
| 0/18 | 8,240 | `PAID_VALUE_ELIGIBLE` |

Complete coverage remains a reachable positive control and produces byte-equivalent eligibility/value output for identical inputs. The runtime also rejects emission to value cards, roster values, team totals and ranked collections if the eligibility object drifts from the approved state.

## Scope accounting

The implementation did not add a provider, redesign unrelated valuation math, change market values, alter pick formulas, activate numeric IDP value, combine offense and IDP rankings, modify OS.1/VectorOS, merge, deploy, accept payment or expose private R&D.

Homepage code was not changed. `index.html` changed only the existing paid-analysis copy/eligibility surface and cache-busting versions for the three modified paid-analysis scripts; all fresh-main premium homepage references were preserved.

## Creator validation

- Style: 129 files passed.
- Syntax: passed.
- Node: 739/739 passed, 0 failed, 0 skipped.
- Playwright: 66/66 passed across desktop and mobile Chromium after the final source change.
- Static contract parsing and runtime equality: passed.
- Candidate diff check: passed.

See `CREATOR_TEST_EVIDENCE.md` for the commands and complete mandatory-case accounting. Fresh independent QA against the exact substantive commit remains the next gate; PASS requires `P0 = 0` and `P1 = 0`.
