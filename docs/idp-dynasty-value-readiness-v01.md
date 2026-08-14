# IDP Dynasty Value v0.1 — Position Readiness

Status: **RESEARCH ONLY — NOT READY FOR QA AS A NUMERIC DYNASTY MODEL**

Permanent firewall: `idp_dynasty_value_available=false`.

Production current-season IDP ranking is owned by Core/QA and is not modified by this branch.

## Position matrix

| Position | Current-season ranking | Multi-year projection | Dynasty surplus | Production Dynasty Value |
| --- | --- | --- | --- | --- |
| DL | Core/QA-owned; out of scope here | RESEARCH PARTIAL — NOT READY | NOT READY | NOT READY |
| LB | Core/QA-owned; out of scope here | RESEARCH PARTIAL — NOT READY | NOT READY | NOT READY |
| DB | Core/QA-owned; out of scope here | RESEARCH PARTIAL — NOT READY | NOT READY | NOT READY |

## DL

Evidence supports meaningful production persistence through three observed lags. Total-point Spearman persistence is 0.6100 at one year, 0.5586 at two years and 0.4679 at three years. Among currently studied broad positions, DL retains the strongest three-year rank persistence. p50 production-relevance survival is 0.6801 and p75 survival is 0.6194.

This is enough to justify building and chronologically testing a DL-specific multi-year production model. It is not enough to freeze a dynasty horizon. Historical role survival, true opportunity transitions, scoring-specific persistence, and multi-year replacement remain incomplete.

## LB

LB has the strongest one-year persistence: total-point Spearman 0.6441 and points-per-observed-week Spearman 0.6385. Persistence decays more sharply by year three (total-point Spearman 0.4202), and LB has the largest year-over-year total-point volatility in the current sample (standard deviation 46.8158). p50 production-relevance survival is 0.6977 while p75 survival is 0.5950.

This argues for an LB-specific horizon/uncertainty model rather than sharing DL assumptions. Multi-year projection research should continue, but no horizon or dynasty survival curve is frozen.

## DB

DB one-year total-point rank persistence is meaningful at 0.5971, but two- and three-year persistence are lower at 0.4599 and 0.4139. p75 next-season production-relevance survival is 0.5320, the weakest high-end persistence among DL/LB/DB in this evidence checkpoint. Year-over-year total-point volatility remains substantial.

DB therefore supports multi-year modeling research, but current evidence does not justify a production dynasty horizon or surplus value.

## Age

Historical age is valid player-season age at the September 1 season cutoff. It is suitable for position-specific age research. The current evidence shows later-career participation and conditional production deterioration across all three broad groups, with different shapes. These diagnostics must be tested prospectively before becoming model multipliers.

## Experience

Experience curves are **BLOCKED** in this checkpoint. The normalized player-bio source contains zero valid `rookie_year` / `entry_year` values for the empirical IDP player-season population. Missing experience is preserved as null and is not inferred from first observed season.

## Scoring, starter count, FLEX and hybrid sensitivity

Starter-count sensitivity is clearly material because replacement changes substantially as league size and starter demand increase. Scoring sensitivity is also structurally established: tackle-heavy, pressure-heavy and interception/pass-defense-heavy settings change positional scoring differently.

However, historical multi-year persistence/survival coefficients have not yet been re-estimated under arbitrary target Sleeper scoring. IDP FLEX and hybrid effects are supported by the current constrained-assignment architecture, but retrospective hybrid/FLEX effects are blocked until point-in-time historical position eligibility exists. Current Sleeper hybrid labels may not be applied backward.

## What is impossible with current approved history

The current dataset cannot establish historical defensive snap opportunity, starter/reserve status, depth order, backup-to-starter transitions, starter-to-backup transitions, or true role survival. Tackles, fantasy points, observed weeks and production percentiles are not substitutes for those concepts.

A future opportunity source can plug into the prepared adapter using stable player identity plus point-in-time season/week and fields for team, eligibility, depth/role, starter/depth order, defensive snaps where licensed, timestamp and provenance.

## Next research gate

The next defensible step is a leakage-safe chronological multi-year projection benchmark by DL/LB/DB. It should compare separately chosen candidate horizons, age effects, historical production persistence and uncertainty on unseen seasons. Experience remains excluded until valid metadata exists. Scoring-specific refits should be tested before any dynasty coefficients are frozen.

Dynasty surplus remains blocked until position-specific multi-year projections, fantasy-relevance survival, league-specific future replacement and horizon/discount treatment are validated. Production Dynasty Value remains blocked beyond that until the model receives independent high-risk QA and the firewall is explicitly authorized to change.
