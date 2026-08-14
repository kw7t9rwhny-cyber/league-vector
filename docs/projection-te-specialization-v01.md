# TE Specialization / Ranking Research v0.1

Status: **RESEARCH EXECUTION IN PROGRESS — NOT PRODUCTION**

This is an isolated HIGH-risk Projection Research track. Validated Projection v0.4 is the immutable control. No production projection, Dynasty Value, Core, UI, IDP, or `main` behavior is modified.

## Primary question

Can TE projections and rankings improve by modeling TE-specific receiving-role structure rather than treating TE as a generic low-volume receiver?

## Frozen control and chronology

- validated Projection v0.4 control head: `6d931abadbcb06e910bf953d941902c7c2cd1638`
- frozen historical snapshot SHA-256: `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`
- immutable v0.4 player-season comparator SHA-256: `9e329e7901ecb8e925d5f5aae695dadc30195b33e67f3943177dc13087b45ab0`
- architecture/model selection: pre-2025 only
- 2025: `retrospective_observed` only
- validation: expanding-window chronological folds

2025 cannot tune features, thresholds, archetype definitions, hyperparameters, or ranking gates.

## TE-specific features under test

The v0.1 harness uses only chronology-safe prior-season information present in the frozen inputs:

- targets and targets/game
- target share using same-season team target volume
- receptions
- receiving yards
- receiving TDs
- fantasy production and fantasy production/game as control context
- late-season targets/game and late-season target growth
- yards per target
- catch rate
- games and missed games
- age where birth date is valid
- experience only where rookie season is valid
- draft pick only where draft metadata is internally consistent
- prior-year fantasy rank

Red-zone usage is not fabricated. Historical snap/starter/depth status is not inferred from fantasy points and is not used. If the frozen source does not directly support a requested role field, that field remains unavailable.

## Model families

Simple interpretable challengers are tested first:

1. `ridge_generic` — prior TE production/volume baseline.
2. `ridge_role` — richer TE receiving-role features.
3. `ridge_role_light` — stronger regularization on the same role features.
4. `empirical_archetype` — chronology-safe KMeans clusters learned separately inside each training fold from TE receiving-role inputs, then used only as an additional categorical feature. Cluster labels are numeric and empirical; no subjective archetype names are hardcoded.

A separate logistic diagnostic estimates probability of finishing fantasy-relevant (TE24). It is used for role-survival, collapse, and breakout diagnostics only. No probability multiplier is applied to projected points in v0.1.

## Ranking objectives

Every challenger is compared directly with validated v0.4 on:

- MAE
- RMSE
- Spearman rank correlation
- top-12 overlap
- top-24 overlap
- pairwise ranking accuracy

The evidence also records false-breakout, missed-breakout, and collapse-identification diagnostics. These are diagnostics, not point adjustments.

## Candidate gate

A challenger is eligible for `READY FOR QA — HIGH RISK` only if the pre-2025 evidence satisfies all of the following:

- at least three evaluable chronological folds
- majority MAE fold wins versus validated v0.4
- either at least 3% mean MAE improvement or at least +0.04 mean Spearman improvement
- no catastrophic MAE fold worse than -12%
- mean top-12 overlap delta no worse than -0.08
- mean top-24 overlap delta no worse than -0.08

This gate deliberately prevents a small aggregate MAE gain from hiding materially worse useful TE rankings.

## Early-career diagnostics

The selected TE role model is evaluated separately for:

- Year 1 → Year 2
- Year 2 → Year 3
- Year 3 → Year 4

No generic youth multiplier is used. Early-career specialization is not promoted unless its chronological evidence is stable.

## Identity and missing-data contract

The research fails closed on:

- missing source player identity
- duplicate player-season identity
- unresolved source-to-player identity
- unavailable required receiving fields
- non-numeric required receiving fields
- inconsistent draft metadata when draft pick would otherwise be used

True numeric zero remains numeric zero. Missing/unavailable values are not converted to zero. Optional age/experience/draft fields can be explicitly missing and are imputed only inside the research model after their unavailable state has been preserved in the source audit.

## Deterministic evidence

The branch workflow restores the exact frozen v0.4 control artifact, verifies both input hashes, installs pinned research dependencies, executes the complete TE research twice, requires byte-identical JSON output, computes a SHA-256 digest of the actual result, enforces chronology/firewall assertions, and uploads the evidence artifact.

The final research disposition must be exactly one of:

- `READY FOR QA — HIGH RISK`
- `MORE TE RESEARCH REQUIRED`

No production promotion is implied by a research PASS.

## Firewalls

Mandatory throughout this cycle:

- `experimental=true`
- `production_projection_eligible=false`
- `dynasty_value_eligible=false`
- no production changes
- no Core changes
- no UI changes
- no `main` changes
- no Dynasty Value changes
- no IDP changes
