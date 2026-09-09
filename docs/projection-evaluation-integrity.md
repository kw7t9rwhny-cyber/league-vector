# Frozen projection evaluation

This evaluator repairs the selected-model evidence path identified in public issue #6. It retains the weighted, ridge, and rare-event shrinkage controls. It evaluates one-season production; it does not build dynasty rankings or establish their accuracy.

The active `projection:v03` command now requires `--input` pointing to a frozen local JSON bundle. A call without it fails before network access. The previous online combined backtest/current-roster generation path is retained as private legacy code, unavailable through the exported runner. Its inspected historical years cannot become untouched evidence. Existing online CI report/preview generation commands must be migrated separately to approved frozen inputs; this candidate changes no workflows or published assets.

## Run and replay

```sh
node scripts/demo-projection-evaluation.js /tmp/lv-evaluation-demo
node scripts/evaluate-projections.js --input /tmp/lv-evaluation-demo/input.json --outputDir /tmp/lv-evaluation-replay
node scripts/evaluate-projections.js --forecast /tmp/lv-evaluation-replay/frozen-evaluation.json --assessment /tmp/lv-evaluation-demo/assessment-input.json --output /tmp/lv-evaluation-replay/assessment.json
node --test tests/projection-evaluation-integrity.test.js
```

The demo generates separate selection (2022), calibration (2023), and final (2025) **synthetic** data. The final shifted-outcome case demonstrates poor future coverage without widening the saved bands. It is a deterministic mechanism test, not a measurement of real predictive performance.

Every output uses canonical JSON, finite numbers, and SHA-256 content identity. Repeated runs with identical input and code produce identical bytes. Retain the input bundle, frozen output, source payloads, assessment input, code commit/tree, and output manifest together. `code_identity` hashes the model and evaluator dependencies, avoiding a self-referential candidate-commit field. The external implementation receipt binds the exact Git commit/tree.

## Input contract

The generated `input.json` is an executable complete example of `lv-projection-evaluation/1`.

- `sources`: IDs, descriptions, and exact normalized `payload.records`; each SHA-256 covers canonical JSON. Every used history, universe, member, exclusion, birth, and outcome record must match a retained source record. Original upstream raw-byte/version references belong in the source description/retained payload. A declared checksum alone cannot bind a changed input row.
- `season_rows`: canonical identity, position, season, source, training forecast cutoff, target window, label availability, feature availability, independently verified participant-games, and typed per-field quantities. These are complete-period observations prepared under a verified participation/field coverage contract, not arbitrary partial sums from event rows.
- `origins`: distinct selection/calibration/final periods with forecast cutoff, one-season horizon, target start/end, format, exact scoring, eligibility rule, and a prior-at-cutoff universe. Development origins also contain later outcomes and their evaluation cutoff. The final origin cannot contain outcomes.
- `universe`: exact included identities/positions/cohort flags, exclusions with reasons and source dates, availability, and content ID. Prefer permanent `player_id`; `gsis_id` remains an optional external alias, with legacy GSIS-only inputs accepted. A rookie needs no GSIS alias to remain in the population. History, birth and outcome keys must use the same canonical identity. Duplicate canonical IDs or external aliases fail within a unit. `universeId(origin)` binds membership, exclusions, rules, scoring, format and period/cutoff. All candidates use the same population at each origin. A changed universe receives a different identity.
- `birth`: optional sourced value/availability objects; absent age remains missing and uses existing ridge training-mean treatment. Birth data is separately checked against each training origin, not just the latest forecast.
- `frozen_at`, `data_kind`, `consumed_periods`: declare when the final forecast was retained and which periods have already been inspected. Known real 2020–2025 development years cannot be final holdouts. Synthetic data always yields synthetic evidence, even with disjoint periods.

Dates are explicit UTC timestamps. All fit labels must end and be available before the forecast. Historical model examples additionally filter features at their own declared training origins. Future/revised features are excluded with reasons. No historical roster, role, injury or position is inferred from future outcomes or a current online roster. These retained models accept only prior season statistics and optional dated birth information; new feature families require their own implementation. Multi-season targets are explicitly unsupported, preventing accidental H3/H4 label reuse in the one-season stack.

## Selection and final assessment

Family selection retains the existing 2% MAE improvement and fold-win rule, now applied to identical keyed rows across available candidates. Candidate support, unmatched counts, full forecast/abstention ledgers and exact period keys remain visible. Results are `selection_only`; age ablations are on the same matched population. Whole-candidate abstentions remain visible in the candidate ledger and global candidate list.

Calibration occurs after selection on a distinct later period. Final forecasts use the frozen family and the existing refit-on-all-mature-prior-data policy. Ridge alpha tuning remains earlier-only. Selection, calibration and final periods cannot overlap, and development outcomes must mature before the next stage's forecast cutoff. Preprocessing/model/format/policy decisions must not be retuned on final results.

`freeze` never receives final outcomes. `assess` binds their exact manifest and evaluation cutoff to the saved forecast hash and universe. Outcomes are left-joined to every eligible member. Missing outcomes remain unknown, model failures remain abstentions, and zero production requires actual observed zero or verified complete-scope structural-zero evidence. Rookies and players without admitted forecasts are counted, not invented predictions. Overlapping cohort counts are reported separately and must not be summed as unique players.

Each ranking unit is forecast cutoff × target period/horizon × scoring/format/eligibility × frozen universe, with position slices. No cross-season top-N list exists. Duplicate canonical player-season entries fail; repeated players in later seasons are distinct valid units. Spearman uses average tied ranks. Top-N uses canonical-ID order for boundary ties and reports effective N when the sample is smaller. Pairwise ties are separate from reversals. Errors are descriptive observation-weighted metrics on finite forecast/outcome pairs, accompanied by full-population counts and exclusions.

## Missing values and intervals

The existing typed cell representation is retained: finite observed values (including observed zero), `null`/`missing`, `unavailable`, `unsupported`, `not_applicable`, and `source_error`. Structural zero is `state:value,value:0` plus field, source, documented rule and complete-coverage evidence. No source's blank values are automatically structural zeros. Counting an observed sum starts at zero; an incomplete sum is separately `partial_totals`, while its full target stays null.

The active blanket fill is removed. Aggregation records per-field counts and cannot derive total tackles from a missing component. Source tackle categories 79/80/82 and committed/own/opponent fumble events remain distinct. Unverified assist/recovery scoring mappings are withheld as unsupported. They need a verified credit mapping and regenerated data before use; the code does not guess a mapping or reinterpret the shipped historical asset.

IDP profile means require complete statistic support, with counts retained. Compact/browser numeric fields reject null, booleans, containers and numeric strings; the CSV normalizer still accepts finite numeric strings. Unknown experience does not become rookie zero. Explicit valid zeros survive all these boundaries.

Intervals are historical residual bands, not probabilities. Construction diagnostics are named `construction_coverage`. Final coverage counts use the saved one-decimal endpoints after the same sanitation/clipping/rounding as delivered forecasts. Counts, mean widths, unknown outcomes and the single-origin dependence limitation accompany the result. Existing legacy sanitation, including negative projection clipping, is preserved and measured rather than silently changed; signed observed yardage remains signed. Marginal stat bands are never summed into a calibrated player/board interval.

Confidence stays `HEURISTIC` through artifact transport and visible labels. The evaluator rejects calibrated-probability, universal-accuracy, guaranteed-performance, dynasty-accuracy and reused-selection “best model” claims. Allowed assessment statements are historical error, observed coverage, and ordinal performance on the exact declared set, conditional on the documented support. Numerical coverage does not establish external calibration.

## Limits and independent validation

A hash verifies retained bytes; it cannot prove a caller supplied an honest historical timestamp or had never seen an outcome. Independently retain and timestamp the forecast before outcomes, and verify that receipt during QA before making an untouched/prospective claim. Output deliberately states this requirement. A newly reconstructed inspected retrospective is development evidence, even with temporally separated code paths.

Exact original historical raw inputs and forecast-time universes are not reconstructed by this change. Synthetic regression artifacts do not estimate the historical defects' magnitude. Source rights, final ranking models, real ranking publication, release/deployment, and legacy market/league integration are outside this candidate. Fresh independent QA evaluates the exact candidate and its evidence; creator tests are not approval.
