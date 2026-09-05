# Historical Factual Observation / Derived Model Architecture v0.1

Status: **RESEARCH ONLY — LEGAL / PROVENANCE / MODEL ARCHITECTURE**
Date: 2026-08-14

This is a research risk assessment, not legal advice. It does not authorize bulk scraping, automated Ourlads extraction, mirroring, production use, current-site display, or redistribution.

## Conclusion

### **MORE RESEARCH REQUIRED**

A controlled factual-observation architecture is technically coherent and materially reduces copyright/reconstruction risk, but current evidence does not justify declaring systematic Ourlads-derived research legally cleared.

Copyright doctrine is comparatively favorable. *Feist Publications v. Rural Telephone*, 499 U.S. 340 (1991), holds that facts are not copyrightable and compilation copyright does not extend to underlying facts. *NBA v. Motorola*, 105 F.3d 841 (2d Cir. 1997), likewise distinguishes factual sports information from protectable broadcast expression. This supports a real distinction between copying an Ourlads database/presentation and recording a minimal football fact.

The unresolved issue is contract/access. Ourlads' current Terms say access/use/download constitutes agreement and expressly prohibit reproduction, distribution, or republication without prior written consent. The text reviewed does not separately state an express ban on commercial use, statistical analysis, model training, or automated collection. That omission is relevant but **is not permission**. *ProCD v. Zeidenberg*, 86 F.3d 1447 (7th Cir. 1996), applying Wisconsin law, shows contractual restrictions may be enforceable even when underlying database facts are uncopyrightable.

Therefore: mirroring/redistribution and large-scale automated extraction are not authorized; a minimal source-independent fact corpus is architecturally viable but rights remain unresolved if systematically populated from Ourlads; aggregate coefficients/probabilities are the strongest non-substitutive output, but lawful acquisition/use of inputs must still be established.

## A/B/C distinction

**A — Database/presentation copying:** HTML, screenshots, full tables, Ourlads column structure, near-complete historical mirror or public depth-chart product. Outside the architecture; highest risk.

**B — Minimal factual observation:** e.g. `effective_as_of=2016-08-31, team=IND, player_id=<independent ID>, position_group=WR, depth_order=1`. This is a football-state record, not an Ourlads row.

**C — Aggregate derived artifact:** coefficients, calibrated probabilities, model structure, uncertainty and validation metrics. Production must not contain historical source rows or allow their reconstruction.

## Minimal factual schema

For the first predictive experiment, the smallest useful canonical record is:

- `effective_as_of`
- `season`
- `canonical_team`
- `league_vector_player_id` (only deterministic resolution)
- `position_group`
- `depth_order`
- `provenance_set_id`

Optional only when explicitly supported: `role_slot`, `availability_class`, `observation_confidence`.

Keep source metadata in a separate restricted provenance table: source type/locator, publication/effective time, observation time, identity evidence, corroboration result, confidence and rights-basis status.

Do **not** retain page HTML, screenshots, copied prose, formatting, logos, CSS, navigation, table layout, or unnecessary source annotations.

## Source-independent representation

Canonical records describe football state, never a publisher row. One fact may have multiple provenance records (Ourlads, official team material, contemporaneous news, licensed provider, League Vector prospective archive). Removing Ourlads must not change the canonical schema or model contract.

Identity fails closed. Fuzzy name matching is never authoritative.

## Small corroboration feasibility sample

No bulk collection was performed.

**Indianapolis 2016:** Ourlads archive 187 is dated 2016-09-01, last updated 2016-08-31, and contains ordered offensive roles. The Colts' official September 2016 archive independently preserves final-cut material and a 2016 regular-season depth-chart release dated 2016-09-06. This is useful independent chronology but not exact same-timestamp corroboration. Classification: **PARTIAL / TEMPORAL NEAR-CORROBORATION**.

**Green Bay 2019:** contemporaneous 2019-09-03 reporting records a Week-1 structure including Aaron Rodgers QB1, Aaron Jones RB1, Davante Adams first LWR, Marquez Valdes-Scantling first RWR, Geronimo Allison first slot WR and Jimmy Graham first TE; independent preseason reporting also documents the competition behind Adams. Classification: **CORROBORATION AVAILABLE**, subject to semantic normalization.

A later approved corroboration audit should freeze cutoff first, prefer official team/NFL sources, then dated reputable reporting, and classify each fact EXACT / PARTIAL / CONFLICT / UNAVAILABLE / IDENTITY_UNRESOLVED. Never silently prefer Ourlads in conflicts.

## Sparse sampling strategy

The prior source audit established Ourlads historical archives are predominantly monthly, not weekly. Even if rights are cleared, do not mirror every snapshot.

Minimum useful experiment:

1. final valid pre-Week-1 snapshot — highest value;
2. optional earlier training-camp/preseason snapshot only for movement/stability;
3. Week 4 or midseason checkpoints only for separate transition research where genuine point-in-time evidence exists.

The primary predictive test needs only **one preseason cutoff per player-season**. This materially reduces collection and rights exposure.

## Reconstruction/substitution firewall

Independent test: with only the retained production artifact, can a reviewer recover player/team/date-level historical depth records? If plausibly yes, production promotion fails.

Production must not contain source URLs per row, historical player/date tables, source-native layouts, screenshots/HTML, record-level training exports, historical lookup endpoints, or tiny aggregate cells that effectively reveal source records.

Allowed candidate artifacts: aggregate coefficients, calibrated probabilities, model structures, uncertainty parameters, validation metrics and source-independent feature definitions. Red-team membership/row memorization, named-player inference and uniqueness leakage before promotion.

## Derived-model firewall

`APPROVED SOURCE ACCESS -> RESTRICTED PROVENANCE -> MINIMAL FACT TABLE (research only) -> DERIVED FEATURES (research only) -> MODEL FIT/VALIDATION -> AGGREGATE PARAMETERS -> separate QA/promotion/Founder gate -> PRODUCTION`

Production has no runtime dependency on the historical research corpus.

## Retention / reproducibility

Deleting source observations after fitting does not cure impermissible acquisition and can undermine reproducibility. If rights are approved, retain a restricted minimal reproducibility corpus plus provenance/identity evidence separately from the production artifact. After validation/audit, counsel/data governance should decide deletion vs restricted retention. Always preserve model/version, feature definitions, cutoff rules, cohort counts, aggregate metrics and parameter hashes.

## Current-vs-historical rights separation

Permanent rule: `HISTORICAL RESEARCH RIGHTS != CURRENT PRODUCT DISPLAY RIGHTS`.

Historical research: approved factual evidence -> aggregate learning.
Current product: separately approved/licensed/prospective data -> current depth display.

The existing 2026 prospective archive is unchanged and should gradually reduce future external historical dependence.

## Chronology-safe statistical design

Primary question: does preseason depth add predictive information for future NFL opportunity/fantasy production after controlling for prior production, draft capital, age, experience, position and team change, all frozen at cutoff?

Unit: player-season with one pre-Week-1 observation strictly before Week 1.

Initial features: `depth_order`, `is_first_in_role`, `players_ahead_count`, `players_behind_count`. Only with two valid observations: `depth_movement`, `role_stability`, `role_uncertainty`. Only with separately approved transaction/stat evidence: `competition_removed`, `vacated_opportunity`.

Outcomes: subsequent games active/started, snap share where approved, routes/targets/carries/attempts, fantasy points and positional relevance.

Use season-forward chronological folds, baseline-vs-baseline+depth comparisons, position-specific results, complete sample/missingness/identity exclusions and uncertainty. Do not fit production coefficients from unapproved systematic Ourlads collection.

## Ourlads Terms — conservative reading

Current Terms at `https://secure.ourlads.com/tc/default.aspx` state in substance that access/use/download constitutes agreement; reproduction, distribution or republication without prior written consent is prohibited; no IP license is granted; ungranted rights are reserved.

The reviewed text does **not expressly state** a separate prohibition on all commercial use, statistical analysis/model training, or automated collection. Do not infer permission from silence. Whether a minimal internal factual corpus constitutes prohibited reproduction/use under an enforceable agreement remains unresolved.

Targeted counsel question: whether Ourlads web terms form an enforceable agreement for this access, whether minimal internal football-fact normalization is prohibited reproduction/use, and whether other state-law/database/misappropriation/access theories materially change the result.

## Risk matrix (research classification, not legal advice)

| Activity | Risk |
|---|---|
| isolated manual factual observation | LOWER |
| small purpose-limited research sample | MODERATE |
| multi-source corroborated fact | LOWER–MODERATE |
| systematic internal minimal dataset sourced from Ourlads | UNRESOLVED |
| sufficiently aggregated cohort statistics | LOWER, assuming lawful inputs |
| non-reconstructive model coefficients/probabilities | LOWER, assuming lawful inputs |
| large-scale automated Ourlads extraction | HIGHER / UNRESOLVED |
| full historical mirror | HIGHER |
| public redistribution of historical records | HIGHER |
| current Ourlads-derived product display | HIGHER / SEPARATELY UNAUTHORIZED |

## Alternative-source matrix

| Source | Best role | Limitation |
|---|---|---|
| Official team/NFL archives/releases | high-authority corroboration and selected checkpoints | inconsistent historical structure/availability |
| Wayback | timestamp/provenance recovery | gaps; not a rights workaround |
| Dated reputable news archives | competition/role corroboration | prose/semantic ambiguity |
| Transactions/roster sources | movement/status corroboration | not equivalent to ordered depth |
| Licensed commercial provider | structured historical feed | contract/cost/coverage dependent |
| League Vector prospective archive | strongest future chronology and provenance | starts in 2026; cannot reconstruct past |

A genuinely multi-source corpus is feasible in principle: use official/team evidence first where available, Ourlads only under an approved rights basis, dated reporting for corroboration, separate approved transaction/status evidence, and League Vector prospective observations going forward.

## Exact blockers

1. No targeted legal conclusion yet on Ourlads web-term formation/scope for minimal internal factual normalization.
2. No authorization for systematic or automated Ourlads extraction.
3. Corroboration rate has not been measured on a statistically useful sample.
4. Historical identity crosswalk quality is not yet proven at cohort scale.
5. No rights-approved historical corpus exists from which production coefficients may be fitted.

## Recommendation

**MORE RESEARCH REQUIRED.**

The architecture should be preserved because it sharply separates factual research from database copying and makes the final product non-substitutive. The next gate is not engineering: obtain a targeted legal/rights determination for controlled factual observation, then—only if cleared—run a small pre-registered corroboration/identity sample before any larger historical collection.