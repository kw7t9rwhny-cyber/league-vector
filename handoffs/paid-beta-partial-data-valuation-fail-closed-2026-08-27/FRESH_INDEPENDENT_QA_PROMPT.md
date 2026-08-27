# Fresh Independent QA Prompt

You are the fresh independent QA owner for League Vector issue #76. You did not create this candidate. Do not repair or mutate it while evaluating it.

## Immutable target

- Repository: `kw7t9rwhny-cyber/league-vector`
- Base commit: `5b63a851a83092a58e35ddc26e439c7cbda209ed`
- Candidate commit: `ff764a1309a20e19bd54898f260074061a06a638`
- Candidate tree: `fc0600a5ebdbdacfc036ccb1a9dc474b5f742d40`
- Evidence branch: `codex/paid-beta-partial-data-valuation-fail-closed-2026-08-27`
- Contract: Option 2 — `CONTEXT_ONLY_NOT_IN_VALUATION`

Checkout the exact candidate commit, not the evidence branch head. Before testing, verify:

```text
git rev-parse HEAD
git show -s --format=%T HEAD
```

The results must exactly match the candidate commit and tree above. If they do not, stop and report a candidate identity failure. Any candidate-byte change invalidates QA.

## Review target

Determine whether incomplete, stale, mixed-version, malformed, timed-out, cached, identity-invalid or partially successful legacy weekly projection data can alter or appear inside an ordinary paid-beta dynasty value anywhere in the production path.

Trace retrieval, cache/fallback behavior, identity mapping, coverage, valuation components, player cards, player sorting/ranking, roster values, starter/bench analysis, team totals, warnings/status, saved/exported surfaces, and browser failure behavior. Confirm the selected contract is implemented consistently in code, tests, machine-readable state and user-facing language.

Confirm that:

- paid analysis makes no legacy `/projections/nfl/` request;
- the former weekly projection adjustment and replacement-level computation are absent from paid value;
- experimental projections remain separately labeled and cannot enter paid values;
- `PAID_VALUE_ELIGIBLE` is emitted only with `CONTEXT_ONLY_NOT_IN_VALUATION`;
- eligibility drift fails closed before player values, team totals, roster values or ranks emit;
- the UI states that the source is excluded, the base paid value remains available, safe context can still be inspected, and no zero substitution or fabricated coverage occurred;
- there is no numeric IDP dynasty value or offense-plus-IDP precision; and
- unrelated offensive valuation math remains intact.

## Required adversarial tests

Independently rerun or reimplement, at minimum: complete coverage; one missing record; 17/18, 1/18 and 0/18 coverage; malformed response; wrong-player mapping; duplicate player response; stale response; mixed source/schema/model versions; timeout after partial success; successful empty payload; old cache mixed with fresh data; unsupported identity; and all requests failing.

Reject a reject-all result. Verify the complete positive control remains reachable and identical inputs reproduce byte-equivalent eligibility and values.

Reproduce the predecessor evidence at base commit: 7,440 for 18/18, 9,520 for 1/18 and 8,240 for 0/18. Verify the exact successor candidate produces 8,240 for all three without reading or zero-filling legacy weekly data.

Run all applicable repository validation, Node, syntax, static-contract and Playwright/browser tests. Add adversarial browser interception if the existing suite does not independently prove zero legacy weekly requests and safe rendering.

## Gate

Publish an independent evidence-backed QA result bound to the exact candidate commit and tree. PASS requires `P0 = 0` and `P1 = 0`. Creator tests are evidence but not acceptance.

Do not merge or deploy. Do not change candidate bytes. If a defect is found, report it with severity and reproduction steps and return it to implementation ownership.
