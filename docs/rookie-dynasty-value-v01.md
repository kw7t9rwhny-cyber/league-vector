# Rookie Dynasty Value / Draft Capital / Opportunity v0.1

## Final research status

**ROOKIE DYNASTY ARCHITECTURE READY FOR NEXT VALIDATION STAGE**

RESEARCH ONLY. This does not authorize numeric production Rookie Dynasty Values, production Dynasty Value changes, Rookie Projection v0.1 changes, Projection v0.4 changes, production UI, Core integration, or `main` changes.

The cycle is isolated from the independently QA-passed Rookie Projection v0.1 parent `d7ddbb0cefa27feb687eedc9158af2235f286c8b`. Its coefficients are untouched.

## Canonical evidence boundary

Historical inputs are restored from immutable frozen snapshot SHA-256 `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`.

Model-selection outcomes are capped at 2024. Season 2025 remains `retrospective_observed` only and is emitted separately. No 2026 outcome is used.

The corrected canonical research run at head `dd6d3f949a691e0df2e75808478b654ed6bc47aa` was GitHub Actions run `31838631888`, which passed snapshot, chronology, draft-provenance, production-firewall, corrected league-wide top-tier, duplicate-run byte-identity, and artifact-upload gates. Canonical `run-a.json` SHA-256: `873b4083ed4688bf1a6a36d268a6ebd98080d7b1d436cc94daa55da79d36060f`.

A first run exposed and was rejected for a research-metric defect: top-tier outcomes were initially ranked only against rookies. The corrected runner now defines top-12/top-24 outcomes against all players at that position in the target NFL season. The bad metric was not retained as evidence.

## Data integrity

The fail-closed Rookie v0.1 provenance contract is preserved.

- source→player identity is audited before rookie filtering;
- duplicate identities fail closed;
- `draft_year`, `draft_round`, and `draft_pick` must be internally valid;
- draft year must equal rookie season for ordinary drafted rookies;
- missing draft metadata is not UDFA;
- confirmed UDFA requires independent evidence, which this frozen source does not provide;
- unresolved, partial, inconsistent, and supplemental-draft states are excluded from ordinary draft-capital evidence.

Canonical eligible drafted rookie counts across the frozen source are QB 81, RB 218, WR 297, TE 130 (726 total). The source contains 370 raw rookie rows with unresolved draft metadata; none are silently converted to late picks or UDFAs.

## 1. Draft-capital decay

Absolute Spearman correlation between `log(1+pick)` and fantasy production by horizon, using only outcome seasons through 2024:

| Position | Rookie Y0 | Y+1 | Y+2 | Y+3 | Y+4 |
|---|---:|---:|---:|---:|---:|
| QB | .679 | .576 | .573 | .531 | .582 |
| RB | .622 | .601 | .595 | .643 | .649 |
| WR | .585 | .564 | .533 | .493 | .407 |
| TE | .567 | .520 | .356 | .407 | .411 |

Interpretation:

- **WR shows the clearest decay.** Draft capital is still useful, but the relationship weakens steadily from rookie season to Year 4.
- **TE also decays materially by Year 2**, with smaller/noisier cohorts afterward.
- **RB does not show simple monotonic decay.** NFL investment remains a strong multi-year signal in this dataset; replacing it too aggressively would be unsupported.
- **QB remains strong but small-sample/non-monotonic.** It should not receive a universal decay schedule inferred from the other positions.

Draft pick also retains meaningful top-tier identification signal. For example, pre-2025 draft-pick AUC for future top-tier outcomes is approximately RB .75 at Y+1 and .87 at Y+4, WR .79 at Y+1 and .80 at Y+4, TE .80 at Y+1 but only .55 by Y+4, and QB .75 at Y+1 with much smaller cohorts.

**Conclusion:** there is no evidence for one universal draft-capital half-life. Decay must be position- and evidence-dependent.

## 2. Production versus draft capital

For descriptive conflict cohorts, `HIGH` capital means Day 1/Day 2 and `LOW` means Day 3. `HIGH` versus `LOW` rookie production is defined relative to the contemporaneous position/rookie-class median. These are diagnostic groups, not valuation thresholds.

Future Year+1–3 fantasy points:

| Pos | Capital | Rookie production | N | Y+1 | Y+2 | Y+3 | Y+1–3 total |
|---|---|---|---:|---:|---:|---:|---:|
| QB | HIGH | HIGH | 25 | 227 | 194 | 173 | 594 |
| QB | HIGH | LOW | 9 | 107 | 71 | 76 | 254 |
| RB | HIGH | HIGH | 36 | 176 | 158 | 161 | 495 |
| RB | HIGH | LOW | 11 | 110 | 130 | 108 | 348 |
| RB | LOW | HIGH | 35 | 79 | 82 | 60 | 222 |
| RB | LOW | LOW | 55 | 26 | 26 | 20 | 71 |
| WR | HIGH | HIGH | 64 | 142 | 142 | 129 | 414 |
| WR | HIGH | LOW | 23 | 65 | 43 | 23 | 132 |
| WR | LOW | HIGH | 31 | 80 | 79 | 57 | 216 |
| WR | LOW | LOW | 67 | 28 | 20 | 14 | 62 |
| TE | HIGH | HIGH | 24 | 102 | 89 | 106 | 296 |
| TE | HIGH | LOW | 11 | 34 | 37 | 32 | 103 |
| TE | LOW | HIGH | 16 | 49 | 48 | 33 | 130 |
| TE | LOW | LOW | 27 | 20 | 34 | 44 | 98 |

Key evidence:

- High draft capital does **not** immunize a player from a poor rookie year. The future gap between high-capital/high-production and high-capital/low-production is very large for WR, QB, and TE, and meaningful for RB.
- Late-capital production matters. Low-capital/high-production RB and WR cohorts materially outperform low-capital/low-production cohorts, so actual NFL success should erase a substantial amount of draft-capital concern.
- Draft capital still matters after production. High-capital/high-production RB/WR/TE generally retain better future outcomes than low-capital/high-production counterparts.
- QB cells are small and should not be converted into precise valuation penalties yet.
- TE lower-capital breakout separation is weaker/noisier than WR/RB, supporting more patience and uncertainty at TE.

A Round-1-only poor-production slice was not promoted as a stable standalone rule in v0.1 because several position/horizon cells become too small. The Day 1/2 conflict cohort is the more defensible architecture-level evidence; Round-1-specific diagnostics should be retained for the next validation stage rather than hardcoded now.

## 3. Opportunity versus draft capital

Historical weekly NFL usage provides chronology-safe **observed** opportunity after games begin. It does not provide historical preseason depth charts.

At end of rookie season, high/low opportunity conflict cohorts show the same basic pattern as production:

- RB high-capital/high-opportunity: Y+1 176, Y+2 164, top-24 rates 51% / 44%.
- RB high-capital/low-opportunity: Y+1 119, Y+2 112, top-24 rates 30% / 40%.
- RB low-capital/high-opportunity: Y+1 89, Y+2 89, top-24 rates 21% / 15%.
- RB low-capital/low-opportunity: Y+1 28, Y+2 23, top-24 rates 6% / 1%.
- WR high-capital/high-opportunity: Y+1 140, Y+2 137, top-24 rates 26% / 30%.
- WR high-capital/low-opportunity: Y+1 65, Y+2 56, top-24 rates 3% / 7%.
- WR low-capital/high-opportunity: Y+1 78, Y+2 75, top-24 rates 9% / 12%.
- WR low-capital/low-opportunity: Y+1 28, Y+2 23, zero top-24 outcomes in this cohort.
- TE high-capital/high-opportunity: Y+1 102, Y+2 89, top-12 rates 29% / 29%.
- TE high-capital/low-opportunity: Y+1 39, Y+2 45, top-12 rates 7% / 7%.

**Conclusion:** observed opportunity is not merely noise around the draft prior. When NFL investment and actual role evidence disagree, future outcomes move materially with the role evidence, especially for WR/RB. But capital still contains residual signal, so the evidence supports updating rather than binary replacement.

## 4. Early-NFL updating

Five ridge families were compared in expanding chronological folds:

- draft only;
- opportunity only;
- production only;
- draft + opportunity;
- draft + opportunity + production.

### Year+1 prediction at each checkpoint

The most important rookie-end comparison is:

| Position | Best rookie-end family | Best MAE | Draft-only MAE | MAE gain vs draft | Best Spearman | Draft Spearman |
|---|---|---:|---:|---:|---:|---:|
| QB | production only | 69.7 | 82.4 | 15.4% | .801 | .506 |
| RB | draft + opportunity + production | 56.7 | 62.7 | 9.7% | .702 | .619 |
| WR | draft + opportunity + production | 43.5 | 57.0 | 23.6% | .716 | .577 |
| TE | draft + opportunity | 34.3 | 36.4 | 5.7% | .565 | .514 |

Checkpoint behavior differs by position:

- **WR:** draft-only is no longer the best family even at Week 1; by Week 8 and rookie-end, combined NFL evidence clearly dominates draft-only. Rookie-end Year+2 and Year+3 MAE also improve about 15% and 13% versus draft-only.
- **RB:** draft-only remains strongest at Week 1; combined evidence is approximately tied by Week 4 and wins by Week 8/rookie-end. This supports slower decay than WR.
- **TE:** evidence is delayed and noisier. Draft-only is best at Week 4, while opportunity begins to improve ordering by Week 8 and rookie-end. Adding production indiscriminately is not always better than draft+opportunity.
- **QB:** samples are small. Production/opportunity can materially improve Year+1 ordering by rookie-end, but Year+2 still favors draft-only in this sample. No precise QB decay schedule is justified.

Across all position/cutoff/horizon cells, the lowest-MAE family was draft+opportunity+production 16 times, opportunity-only 8, draft-only 7, draft+opportunity 7, and production-only 6. At Week 1, draft-only wins most often; at Week 4/8/end, observed NFL evidence wins increasingly often.

This is the central v0.1 result: **draft capital behaves like a prior whose relative value generally falls as NFL evidence accumulates, but the speed of that update is strongly position-specific.**

## 5. Position-specific persistence

For mature pre-2025 cohorts with three future seasons observable:

| Position | N | Rookie→Y+1 rho | Rookie→Y+2 rho | Rookie→Y+3 rho | Draft pick→Y+1 rho | Draft pick→Y+3 rho | Mean active Y+1–3 seasons |
|---|---:|---:|---:|---:|---:|---:|---:|
| QB | 50 | .678 | .648 | .589 | -.614 | -.531 | 2.02 |
| RB | 137 | .650 | .620 | .597 | -.612 | -.643 | 2.41 |
| WR | 185 | .688 | .651 | .612 | -.566 | -.493 | 2.22 |
| TE | 78 | .670 | .559 | .541 | -.549 | -.407 | 2.64 |

Observed rookie production itself is highly persistent. That is a direct reason not to treat draft capital as permanent player value after meaningful NFL evidence exists.

## 6. Proposed Rookie Dynasty Value architecture

The evidence supports the following architecture for the **next validation stage**, not a frozen production formula:

`Prospect Prior + Expected NFL Opportunity + Expected Production + Multi-Year Persistence + Position Scarcity / Replacement + Uncertainty`

Recommended interpretation by stage:

- **Preseason:** draft capital can carry substantial weight because validated NFL production evidence does not exist yet. Add the separate prospective opportunity layer only as explicitly unvalidated evidence.
- **Week 1:** update lightly. RB especially still favors the draft prior; WR may begin moving sooner.
- **Week 4:** opportunity/production begin competing with the prior, especially WR. TE should remain more conservative.
- **Week 8:** combined evidence can materially re-order WR/RB; TE opportunity becomes more useful; QB remains sample-constrained.
- **Rookie end:** observed NFL evidence should have major influence. WR should no longer be primarily draft-capital driven; RB should retain more residual capital weight; TE should emphasize role/opportunity with slower, noisier updating; QB requires wider uncertainty and more research.

No fixed weights are authorized yet. The next validation stage should estimate weights/ranking architecture with nested or otherwise selection-safe evaluation and explicit uncertainty/scarcity layers.

Validated Rookie Projection v0.1 may be tested later as a separate expected-production input/comparator. Its coefficients must remain untouched by dynasty optimization.

## 7. What cannot yet be historically validated

Historical preseason starter/backup/depth/competition/injury tests are **BLOCKED** because the frozen source does not contain verified original point-in-time preseason depth charts.

Blocked tests include:

- Round-1 player listed backup;
- Round-3 player listed starter;
- Day-3 RB with weak competition;
- Day-2 RB behind an elite incumbent;
- Round-1 WR buried behind veterans;
- late-round WR earning first-team preseason role;
- high-capital TE with low immediate depth role;
- lower-capital TE earning a first-team role;
- competitor injury/release/trade known at the preseason cutoff;
- historical ordered competition ahead on the depth chart;
- historical preseason role promotion/demotion.

Current depth charts must never be inserted retrospectively.

Also not yet validated for production Dynasty Value:

- calibrated valuation uncertainty;
- position scarcity/replacement-adjusted multi-year surplus;
- true market/dynasty-value outcome targets rather than football production/ranking proxies;
- Round-1-only and other narrow conflict slices with sufficient sample sizes;
- independent/nested family-selection validation of a final weighting rule.

## 8. Prospective 2026 opportunity framework

The League Vector Prospective Opportunity Archive may support a separate **PROSPECTIVE / UNVALIDATED** 2026 layer using point-in-time captures of:

- ordered depth position;
- starter/backup designation;
- snapshot-to-snapshot promotion/demotion;
- competitor injury/reserve state known at capture time;
- veteran release/trade known at capture time;
- chronology-safe prior-season vacated carries/targets;
- current competition structure;
- exact snapshot timestamp/source/provenance.

Potential prospective signals include “rookie listed starter,” “rookie promoted,” “veteran ahead injured/released/traded,” “rookie buried,” and “role improving between snapshots.” These may inform research/display only. They have **no historical predictive validation yet**.

## 9. Future backtest with Sportradar or equivalent historical opportunity data

The source must first prove original point-in-time semantics, ordered depth coverage, stable identities, historical injury/reserve state, reproducibility/retention rights, and commercial derived-model rights.

Then:

1. freeze immutable snapshots and hashes;
2. use a team-specific final-preseason cutoff strictly before first regular-season kickoff;
3. join only information known by that cutoff;
4. compare draft-only, opportunity-only, draft+opportunity, and combined+production families;
5. explicitly test NFL-investment-versus-depth-chart conflicts by position;
6. preserve expanding chronology with 2025 only `retrospective_observed`;
7. report MAE, RMSE, Spearman, pairwise ranking accuracy, top-N identification, false breakouts, and missed breakouts;
8. add replacement/scarcity and uncertainty only after their independent evidence gates pass;
9. require exact-head deterministic reproduction and independent HIGH-risk QA before any promotion discussion.

## Final decision

The evidence is strong enough to advance the **architecture** because it establishes three useful, chronology-safe facts:

1. draft capital is predictive well beyond the rookie season, so it cannot be discarded immediately;
2. actual NFL opportunity/production materially changes future outcomes and increasingly outperforms draft-only as evidence accumulates;
3. the update rate is position-specific, with WR updating fastest in this study, RB retaining more capital signal, TE requiring role-sensitive patience, and QB remaining sample-constrained.

The blocked depth-chart history, scarcity/replacement, uncertainty, and final valuation-target work prevent numeric production Rookie Dynasty Values.

**ROOKIE DYNASTY ARCHITECTURE READY FOR NEXT VALIDATION STAGE**
