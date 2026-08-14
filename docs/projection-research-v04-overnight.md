# League Vector Projection Research v0.4 — Canonical Overnight Handoff

Status: **READY FOR HIGH-RISK RE-QA ONLY**

Branch: `codex/projection-research-v04-overnight`
Draft PR: #16

This document supersedes the earlier overnight handoff that incorrectly described 2025 as an untouched/final proof holdout. Independent QA correctly rejected that claim because 2025 had already been inspected during broad model-family and feature-ablation research before the simplified architecture was finalized.

No production projection, dynasty valuation, UI, or IDP firewall behavior is changed. The candidate remains:

```text
experimental = true
production_projection_eligible = false
dynasty_value_eligible = false
```

## Canonical evidence rule

Model-family justification and selection claims are based only on 2020–2024 evidence. The 2025 season is **retrospective observed evidence only**. It is not an untouched holdout and must never be used to change this checkpoint's features, thresholds, ensemble grid, or target policy.

The canonical run uses a frozen nflverse 2015–2025 snapshot. The durable manifest is `data/research/projection-v04-canonical-input-manifest.json`. Composite snapshot SHA-256:

`d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`

The exact frozen CSV bytes are retained in the GitHub Actions artifact `league-vector-projection-v04-canonical` from canonical workflow run `31763952628`; the artifact digest is recorded in the manifest.

## Deterministic reproduction

The canonical workflow executes the same v0.4 candidate twice from the single frozen snapshot and requires byte-identical outputs with `cmp` before succeeding.

Canonical output hashes:

- summary: `c68ed52ce49ac0fec238a2e3ee39456e5c7cc668f98a646c945bdfb3d3540da7`
- baseline player-seasons: `4db202344356d9b21727df4f1e783a969c28e8d91dd93c2aebfec67c604cac29`
- candidate player-seasons: `9e329e7901ecb8e925d5f5aae695dadc30195b33e67f3943177dc13087b45ab0`

Run A and Run B were byte-identical for all four compared canonical files.

## Pre-2025 policy evidence

The canonical policy is retained only because it is defensible without 2025:

| Position | Post-initial development folds won | Lost | Mean MAE gain vs fixed baseline | Policy |
|---|---:|---:|---:|---|
| QB | baseline by design | — | 0.00% | retain transparent 60/30/10 baseline |
| RB | 4/4 | 0 | +4.01% | age + opportunity/efficiency Ridge ensembles |
| WR | 4/4 | 0 | +4.00% | age + opportunity/efficiency Ridge ensembles |
| TE | 3/4 | 1 | +2.29% | age Ridge ensembles; ranking caveat required |

RB development MAE gains were +3.57%, +3.65%, +8.49%, +0.35% in 2021–2024. WR gains were +2.57%, +2.14%, +4.37%, +6.93%. TE was -1.61%, +2.12%, +3.52%, +5.14%.

Target activation remains chronological: a richer target model must beat baseline by at least 0.5% mean MAE over available prior development folds and win a majority of those prior folds; otherwise it falls back to baseline. QB always falls back to baseline in this candidate.

## 2025 retrospective evidence

2025 is reported only to describe what happened after the already-observed research process. Against a selection-safe v0.3 comparator generated from the same frozen snapshot:

| Position | N | MAE gain | RMSE gain | Spearman change |
|---|---:|---:|---:|---:|
| QB | 67 | +1.12% | +0.64% | +0.0060 |
| RB | 121 | +2.65% | +1.25% | +0.0164 |
| WR | 191 | +7.04% | +7.00% | +0.0168 |
| TE | 114 | +0.77% | +0.91% | +0.0061 |

Across the 493 common player-seasons, selection-safe v0.3 MAE was 40.4166 and v0.4 MAE was 38.9334 (+3.67%). RMSE was 58.7311 vs 57.0018 (+2.94%), and Spearman was 0.7653 vs 0.7773. These figures are retrospective evidence, not independent holdout proof.

## Identity and sample completeness

The frozen snapshot audit found:

- 199,868 raw weekly rows;
- 191,281 regular-season rows;
- 63,387 offensive regular-season rows;
- 0 missing player IDs in the offensive regular-season source population;
- 0 duplicate player-week keys;
- 25,037 player-directory rows;
- 0 missing GSIS IDs in that player file;
- 0 duplicate GSIS IDs;
- 0 duplicate aggregated player-seasons;
- 0 validated observations missing GSIS identity.

The retrospective 2025 candidate sample is exactly 493: 67 QB + 121 RB + 191 WR + 114 TE. Per-season/position source, history-eligible, and complete-candidate counts are committed in `data/research/projection-v04-canonical-evidence.json`.

## True zero versus unavailable data

The failed QA correctly identified the old research monkey-patch as too aggressive because it converted every non-`value` stat state to numeric zero.

The canonical runner removes that behavior. A stat is numeric only when the normalized source state is `value`. Explicit numeric 0 remains a true zero. `unavailable`, `null`, `not_applicable`, and `source_error` are never silently converted to zero.

For the required offensive target set in this frozen snapshot, the audit found zero unavailable/null/source-error required cells. Counts of explicit zero versus nonzero required cells are committed in `data/research/projection-v04-canonical-evidence.json`. Optional fields can remain unavailable and are not zero-filled.

## TE ranking investigation

The 2025 top-24 regression is real, but it is not being tuned against because 2025 has already been observed.

The pre-2025 development record shows that the tradeoff existed earlier:

| Season | TE MAE | Top-12 | Top-24 |
|---|---|---|---|
| 2020 | tie | 5 → 5 | 15 → 15 |
| 2021 | worse | 8 → 7 | 17 → 17 |
| 2022 | better | 6 → 6 | 20 → 19 |
| 2023 | better | 7 → 7 | 17 → 17 |
| 2024 | better | 6 → 6 | 17 → 17 |
| 2025 retrospective | better | 4 → 4 | 19 → 17 |

Therefore TE cannot be described as uniformly better. Its point-error gains are more stable than its discrete top-N overlap. No 2025-driven feature or ranking adjustment is allowed in this checkpoint, and TE top-N behavior remains a required independent-QA focus.

## Rookie and limited-history limitations

Zero-history rookies remain outside this veteran model family. They require a separate conservative fallback/model path.

One- and two-season-history behavior remains mixed. The canonical candidate does not claim to solve limited-history projections and must retain conservative fallback behavior for those populations.

## QA-fail remediation map

The canonical checkpoint addresses the prior QA findings as follows:

- P1 invalid 2025 holdout claim: removed; 2025 explicitly retrospective only.
- P1 unpinned/non-deterministic evidence: frozen per-file SHA-256 manifest, composite snapshot hash, two byte-identical runs, output hashes, same-snapshot v0.3 comparator.
- P1 conflicting committed evidence: superseded by `data/research/projection-v04-canonical-evidence.json`, generated from the canonical architecture and consistent with the handoff metrics.
- P2 identity/sample completeness: raw and normalized identity/duplicate/sample-count audits added.
- P2 missing-to-zero handling: blanket coercion removed; explicit zero and unavailable states audited separately.
- P2 TE ranking regression: investigated using development seasons without tuning against 2025; limitation retained.
- P2 rookie/limited-history behavior: limitations retained explicitly.
- P3 stale head language: this document intentionally does not hard-code a self-referential final commit SHA. The exact READY FOR QA head is recorded on PR #16 after the final exact-head workflow passes.

## Core contract

Core must not integrate this candidate yet. A future Core experimental integration requires an independent HIGH-risk QA PASS on the exact READY FOR QA head, preservation of `experimental=true`, `production_projection_eligible=false`, and `dynasty_value_eligible=false`, explicit rookie/limited-history fallback, and no automatic change to production dynasty valuation.

The authoritative machine-readable checkpoint is:

- `data/research/projection-v04-canonical-input-manifest.json`
- `data/research/projection-v04-canonical-evidence.json`
- canonical workflow `.github/workflows/projection-v04-canonical.yml`

Current research decision: **ready for independent re-QA, not ready for Core/Founder product review and not remotely ready for production promotion.**
