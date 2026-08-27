# Creator Test Evidence

This is creator-side validation, not independent acceptance. The exact substantive candidate is commit `ff764a1309a20e19bd54898f260074061a06a638`, tree `fc0600a5ebdbdacfc036ccb1a9dc474b5f742d40`.

## Results

| Validation | Result |
| --- | --- |
| Repository style check | PASS — 129 files |
| JavaScript syntax checks | PASS |
| Node test suite | PASS — 739 passed, 0 failed, 0 skipped |
| Playwright full matrix | PASS — 66 passed, desktop and mobile Chromium |
| Static paid-data contract JSON parse and runtime equality checks | PASS |
| Whitespace/error-marker check with `git diff --check` | PASS |

The repository `validate` wrapper could not invoke its hard-coded `npm` executable because this execution environment supplied a bundled Node and pnpm runtime without `npm` on `PATH`. The exact validation contents were run directly with bundled Node: the repository linter, every JavaScript syntax check listed by the package script, and `node --test tests/*.test.js`. This is an environment-wrapper limitation, not a skipped product check.

## Commands

The runtime was:

```text
/Users/codypaque/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
```

The creator ran the repository linter and each package-listed syntax target with that runtime, followed by:

```text
<bundled-node> --test tests/*.test.js
```

Final Node summary:

```text
tests 739
pass 739
fail 0
skipped 0
```

The final browser matrix ran after the last substantive source change:

```text
<bundled-node> node_modules/@playwright/test/cli.js test --config=/private/tmp/league-vector-paid-beta-playwright-no-server.config.js
```

Final Playwright summary:

```text
66 passed (1.2m)
```

The temporary Playwright config only disabled duplicate server startup and pointed at the repository's existing configuration and tests. It was deleted after the run.

## Mandatory deterministic coverage

`tests/paid-value-partial-data-fail-closed.test.js` exercises all assignment cases:

1. complete required coverage;
2. one required record missing;
3. 17/18 coverage;
4. 1/18 coverage;
5. 0/18 coverage;
6. malformed response;
7. response mapped to the wrong player;
8. duplicate player response;
9. stale response;
10. mixed source/schema/model versions;
11. timeout after partial success;
12. success with an empty payload;
13. cached old data mixed with fresh data;
14. unsupported player identity;
15. all requests fail;
16. complete positive control remains reachable;
17. the same input and contract are byte-reproducible;
18. no numeric IDP dynasty value activates;
19. the existing numeric IDP firewall remains closed; and
20. unrelated offensive age, structure, rookie-floor and trade math remains active.

It also locks the predecessor values at 7,440 / 9,520 / 8,240 and the successor values at 8,240 / 8,240 / 8,240 for 18/18, 1/18 and 0/18 coverage respectively.

The browser test asserts that paid analysis makes zero legacy `/projections/nfl/` requests, exposes the user-visible and machine-readable eligibility state, continues to render separately labeled experimental projections, emits no `NaN`/`Infinity`, and preserves mobile behavior.

Fresh independent QA remains required. Creator validation does not establish `P0 = 0` or `P1 = 0`.
