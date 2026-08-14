# IDP Dynasty Value v0.1 — Position Readiness

Status: **RESEARCH ONLY — NOT READY FOR QA AS A NUMERIC DYNASTY MODEL**

Permanent firewall: `idp_dynasty_value_available=false`.

Production current-season IDP ranking, PR #32, production UI, combined offense+IDP rankings, and `main` are outside this branch.

Empirical checkpoint source head: `d5e86dc08bfd23ec686393c1cdb86dc95a763416`.

The checkpoint workflow ran the full 2015–2025 historical analysis twice with a commit-derived timestamp and required byte-identical JSON before upload. Workflow run `31833395177` passed validation, deterministic comparison, research-status checks, and the Dynasty Value firewall.

## Position readiness matrix

| Position | Multi-year production evidence | Y+1 / Y+2 / Y+3 p50 relevance survival | Horizon | Uncertainty | Numeric Dynasty Value |
| --- | --- | --- | --- | --- | --- |
| DL | SUPPORTED FOR CHRONOLOGICAL BACKTEST | 0.6801 / 0.5946 / 0.5189 | UNFROZEN | YoY total-point delta SD 36.9698 | BLOCKED |
| LB | SUPPORTED FOR CHRONOLOGICAL BACKTEST | 0.6977 / 0.5727 / 0.4551 | UNFROZEN | YoY total-point delta SD 46.8158 | BLOCKED |
| DB | SUPPORTED FOR CHRONOLOGICAL BACKTEST | 0.6756 / 0.5350 / 0.4307 | UNFROZEN | YoY total-point delta SD 39.5259 | BLOCKED |

These survival values mean **production-percentile fantasy relevance**, not starter/depth/role survival. A player who is absent or no longer in the same DL/LB/DB model group at the target horizon does not count as production-relevant. No historical starter or depth role is inferred from fantasy points.

## DL

DL total-point rank persistence remains the strongest at the three-year lag in this broad-position sample: Spearman 0.6100 at Year+1, 0.5586 at Year+2, and 0.4679 at Year+3. p75 relevance survival is 0.6194 / 0.5503 / 0.4510 across Year+1/+2/+3.

This supports a DL-specific chronological multi-year forecast experiment. It does **not** justify freezing a three-year dynasty horizon. Horizon inclusion must improve unseen-season ranking/error after age, survival, scoring, replacement, and uncertainty are handled without leakage.

## LB

LB has the strongest one-year broad-position rank persistence at 0.6441, declining to 0.5230 at Year+2 and 0.4202 at Year+3. p75 relevance survival is 0.5950 / 0.4984 / 0.3752. LB also has the largest observed Year-over-Year total-point delta standard deviation, 46.8158.

The combination of strong near-term persistence, faster multi-year decay, and higher volatility argues for an LB-specific horizon and uncertainty treatment rather than an offensive or DL default. The horizon remains **UNFROZEN**.

## DB

DB broad-position rank persistence is 0.5971 / 0.4599 / 0.4139 at Year+1/+2/+3. High-end p75 relevance survival falls from 0.5320 to 0.3917 to 0.3328, the weakest three-year high-end survival among the three broad groups in this checkpoint.

DB therefore supports multi-year research, but current evidence especially cautions against a long default horizon without chronological validation.

## Age and decline evidence

Historical age remains player-season age at the September 1 season cutoff. A descriptive, survivor-conditioned scan finds the earliest two-age run of negative conditional next-season points-per-observed-week change at age 25 for DL, age 25 for LB, and age 24 for DB in this sample.

These are **not** production decline ages, causal aging breakpoints, dynasty multipliers, retirement curves, or role-survival estimates. Selection, opportunity, injury, team context, and role transitions are not resolved by this history. Age effects must be fitted and validated inside a chronological forecast rather than hard-coded from these descriptive cut points.

## Experience

Experience remains **BLOCKED**. Across 25,035 normalized player bios, the current source provides zero valid `rookie_year` / `entry_year` values for the empirical IDP population. Missing experience remains null; first observed season is never substituted for NFL experience.

## Finer role splits

The normalized history supplies enough stable within-season role hints to pass a **sample-size gate only** for all requested candidate families:

| Candidate split | Stable player-seasons | Sample gate (250) | Empirically justified for dynasty modeling? |
| --- | ---: | --- | --- |
| EDGE | 1,621 | PASS ONLY | NO |
| Interior DL | 1,478 | PASS ONLY | NO |
| Off-ball LB | 297 | PASS ONLY | NO |
| CB | 1,904 | PASS ONLY | NO |
| S | 388 | PASS ONLY | NO |

Overall, 6,283 of 9,439 player-seasons have one normalized non-missing role hint and 3,156 are unspecified-only. These labels are not equivalent to licensed point-in-time depth/starter roles. A finer split can advance only if provenance is stable enough for the intended claim **and** a leakage-safe chronological comparison demonstrates predictive benefit over DL/LB/DB. Production role inference remains unauthorized.

## Scoring sensitivity

The same 90,819 historical weekly observations were re-scored under four fixed research profiles. All required stat cells were complete for all four profiles. The profiles are perturbation tests, not proposed production defaults.

At Year+1, broad-position rank persistence remains meaningful but changes with scoring. For example, DL Spearman ranges from 0.5964 in the tackle-heavy profile to 0.6189 in the pressure-heavy profile; LB ranges from 0.6335 to 0.6574; DB ranges from 0.5927 to 0.5995.

Replacement moves much more. For a 12-team / two-dedicated-starter sensitivity case, DL replacement is 98.0 in balanced reference scoring, 91.5 tackle-heavy, 119.5 pressure-heavy, and 75.25 coverage/big-play. LB is 143.75 / 157.5 / 142.5 / 121.75; DB is 108.5 / 129.0 / 83.0 / 113.5.

Therefore historical production persistence is somewhat robust to these profile changes, while the amount of league-specific surplus over replacement is materially scoring-sensitive. Any future Dynasty Value must re-score history and future projections from the **exact target Sleeper settings** rather than transfer one reference coefficient set.

## Starter count, IDP FLEX, and hybrid sensitivity

League size and dedicated starter count can be varied deterministically as replacement-demand sensitivity. This is supported research and does not require historical depth charts.

Historical IDP FLEX and hybrid-position effects remain blocked because point-in-time historical eligibility is unavailable. Current Sleeper hybrid labels may be used for current constrained assignment, but they may never be projected backward to create historical eligibility.

## Candidate multi-year surplus architecture

The research candidate is:

`sum_h discount_position(h) × P(fantasy_relevant at h | information available at valuation time) × max(0, expected league-scored points_h - league replacement_h)`

A signed-surplus alternative without zero clipping must also be tested. Neither form is selected yet. The architecture is **ARCHITECTURE ONLY** and emits no numeric Dynasty Value.

The evidence supports keeping survival probability as an explicit term rather than assuming a player remains relevant throughout a fixed horizon. However, survival cannot simply be multiplied into an offensive-style horizon: each DL/LB/DB horizon, discount treatment, production forecast, and uncertainty model must be selected by chronological out-of-sample evidence.

## Current blockers

Historical point-in-time starter/depth role authority, historical point-in-time hybrid eligibility, valid experience metadata, chronological multi-year forecast validation, position-specific horizon validation, discount-function validation, exact target-league scoring refits, uncertainty calibration, and any future offense-vs-IDP normalization remain unresolved.

No production numeric IDP Dynasty Value, combined offense+IDP ranking, production UI, or activation is authorized by this checkpoint.

## Next research gate

Build a leakage-safe expanding-window or rolling-origin multi-year forecasting harness separately for DL/LB/DB. Candidate models should compare naive persistence baselines against age-aware production history, explicit production-relevance survival, scoring-specific re-fits, and uncertainty. Evaluate Year+1/+2/+3 contributions independently so a horizon is included only when it improves unseen-season performance.

Finer-role variants may be tested as challengers, but broad DL/LB/DB remains the baseline and no finer role is accepted merely because its sample count is large.
