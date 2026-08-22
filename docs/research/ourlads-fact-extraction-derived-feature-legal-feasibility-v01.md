# Ourlads Fact-Extraction / Derived-Feature Legal Feasibility v0.1

Status: **RESEARCH ONLY — LEGAL / LICENSING REVIEW REQUIRED**

Date: 2026-08-14

Related source audit: `historical-point-in-time-depth-chart-source-audit-v01.md`

## Question

Could League Vector observe factual historical role states exposed by Ourlads (for example, a named player occupying the first RB slot at a dated snapshot), transform those observations into League Vector's own abstract model features, and retain/use only the features/model rather than republishing or selling Ourlads pages or a copied Ourlads database?

## Bottom line

**Potentially yes as a copyright matter; not safely cleared as a contract/access matter.**

The proposed feature-only architecture is materially different from copying and redistributing Ourlads' database. U.S. copyright law strongly distinguishes uncopyrightable facts from copyrightable expression and creative selection/arrangement. `Feist Publications v. Rural Telephone`, 499 U.S. 340 (1991), holds that facts themselves are not copyrightable and that copyright in a factual compilation does not extend to the underlying facts. Sports-data precedent likewise recognizes that factual game information can be distinct from copyrighted presentation/expression (`NBA v. Motorola`, 105 F.3d 841 (2d Cir. 1997)).

But copyright is not the only issue. League Vector operates in Wisconsin / the Seventh Circuit, where `ProCD v. Zeidenberg`, 86 F.3d 1447 (7th Cir. 1996), is particularly important: contractual restrictions can be enforceable even as to information that copyright itself does not protect. ProCD specifically involved a factual database, commercial reuse, Wisconsin law, and a license restricting commercial use. Therefore **"the facts are uncopyrightable" is not enough to conclude that systematic Ourlads extraction is permitted.**

Ourlads' publicly posted terms found in the source audit prohibit reproduction/distribution/republication without prior written consent and do not affirmatively grant commercial data-ingestion/model-training rights. The exact contractual reach of those terms to manually observed facts, automated extraction, internal derived features, and model coefficients is not clear enough to treat as permission.

### Research classification

**FEATURE-ONLY USE IS LEGALLY MORE DEFENSIBLE THAN RAW-DATA REPUBLICATION, BUT NOT CLEARED FOR SYSTEMATIC COMMERCIAL INGESTION.**

Keep: `LEGAL / LICENSING REVIEW REQUIRED`.

## 1. Copyright analysis

### Strong point for League Vector

`Feist` is unusually relevant. The Supreme Court rejected a "sweat of the brow" property right in collected facts. Facts do not become copyrightable because someone expended substantial effort collecting them. A factual compilation may protect original selection/coordination/arrangement, but not the facts themselves.

A factual observation such as:

`on historical date D, player P was listed first in provider-native RB slot for team T`

is much closer to a fact than to Ourlads' expressive page design. Converting that observation to an independently designed League Vector feature such as:

`preseason_depth_order = 1`

further separates the downstream artifact from Ourlads' page layout, wording, graphics, and selection/arrangement.

`NBA v. Motorola` also supports the general distinction between factual sports information and copyrighted expression. The Second Circuit held that transmitting factual information about NBA games did not infringe copyright in the game broadcasts; its surviving "hot news" theory was narrow.

### What not to copy

Even if individual facts are uncopyrightable, League Vector should not assume it can copy:

- Ourlads page HTML;
- screenshots/logos/design;
- descriptive prose;
- a substantial reproduction of Ourlads' particular selection/arrangement;
- a user-facing clone of its historical depth-chart archive;
- raw archive dumps that function as a substitute for Ourlads.

### Copyright conclusion

**Copyright risk for abstract factual features/model coefficients appears substantially lower than for database republication.** This is not equivalent to a license or a complete legal clearance.

## 2. Contract / Terms-of-Use risk — the principal blocker

`ProCD v. Zeidenberg` is binding Seventh Circuit precedent and is the most important caution for a Wisconsin-based project. The Seventh Circuit treated contractual restrictions as distinct from copyright and held that contracts can restrict a contracting party's use of data even where copyright would not prevent strangers from using the underlying facts.

That creates two separate questions:

1. Is League Vector actually bound by Ourlads' website terms under the manner in which notice/assent is presented and access occurs?
2. If bound, do those terms prohibit the contemplated factual observation -> abstract feature -> model workflow?

This audit does not have enough evidence to answer either question conclusively. Website-term enforceability is fact-specific: placement, notice, assent, account/login flow, actual knowledge, repeated use, and the wording in force when access occurs can matter.

Because League Vector now has actual knowledge that restrictive Ourlads terms exist, it would be especially poor risk management to build a large automated collector first and argue about assent later.

### Contract conclusion

**This is the reason not to green-light systematic Ourlads ingestion yet.** The feature-only architecture helps with copyright/substitution concerns but does not automatically defeat a contractual restriction on access/use.

## 3. Automated access / CFAA / technical-control risk

Public accessibility materially reduces classic unauthorized-computer-access concerns, but it does not create blanket permission to scrape.

`hiQ Labs v. LinkedIn`, 31 F.4th 1180 (9th Cir. 2022), treated publicly available pages differently from password-protected/non-public areas for CFAA analysis. More recent public-data litigation such as `X Corp. v. Bright Data` likewise illustrates that public-data scraping can involve separate contract, preemption, trespass, and technical-access questions even when the information is publicly viewable.

League Vector should therefore never:

- bypass login/paywall/access controls;
- evade CAPTCHAs or blocks;
- rotate identities/IPs to defeat restrictions;
- defeat rate limits or technical measures;
- continue after an explicit access revocation without legal review;
- interpret Wayback as a means to evade source restrictions.

No such conduct is authorized by this research.

## 4. Misappropriation / sports-data risk

`NBA v. Motorola` recognizes only a narrow surviving "hot-news" theory in the Second Circuit, centered on highly time-sensitive information, free-riding, direct competition, and threat to the incentive to produce the information.

League Vector's contemplated use is historical preseason state used as a statistical input, not real-time substitution for Ourlads' live depth-chart product. That distinction should reduce classic hot-news concerns. It does not eliminate contract or other state-law theories and is not a Wisconsin-specific legal opinion.

## 5. Risk comparison of possible architectures

| Architecture | Copyright posture | Contract/access posture | Product substitution | Current research classification |
|---|---|---|---|---|
| Copy Ourlads HTML/screenshots/archive into LV | poor | poor | high | DO NOT USE |
| Republish normalized Ourlads depth-chart database | better on raw facts but compilation issues remain | poor/uncleared | high | DO NOT USE |
| Bulk scrape then retain raw rows internally | better than republication | still materially uncleared | medium | NOT CLEARED |
| Extract only factual role observations into independent LV schema | materially stronger | still uncleared | low | RIGHTS REVIEW REQUIRED |
| Retain only abstract features after validated identity/provenance | strongest investigated architecture | still uncleared | very low | RIGHTS REVIEW REQUIRED |
| Use resulting aggregate coefficients/model weights only | strongest downstream separation | depends on legality of upstream acquisition | very low | RIGHTS REVIEW REQUIRED |
| Obtain written commercial/derived-use permission | strong | strong subject to agreement | governed by license | PREFERRED CLEARANCE PATH |

## 6. Lowest-data-retention architecture if rights are approved

If counsel/licensing review clears the source, prefer:

`dated source page -> ephemeral parser/observation -> exact identity resolution -> provider-native role fact -> independent LV feature -> model research`

with product-facing outputs containing League Vector projections/rankings rather than Ourlads tables.

Potential retained provenance:

- source name;
- source URL/archive ID;
- archive/snapshot date;
- source last-updated timestamp;
- exact source player identifier if permitted/available;
- canonical League Vector player ID after deterministic resolution;
- independent normalized role fields (`provider_slot`, `depth_order`);
- source-access/license basis/version;
- parser/schema version.

Avoid retaining page HTML/screenshots unless counsel says the evidentiary need justifies it. Do not publish a source reconstruction endpoint.

Important: deleting raw data after extraction does **not** cure an impermissible acquisition. Data minimization is risk reduction, not permission.

## 7. Manual observation versus systematic ingestion

A researcher manually viewing a handful of public pages to evaluate feasibility is meaningfully different in scale and substitution effect from building a commercial historical database by systematically extracting the entire archive.

However, this report does **not** conclude that manual collection at production scale is a loophole. Changing an automated scraper into human data entry does not necessarily change contractual restrictions on use. Do not operationalize a manual workaround.

## 8. Wayback does not solve the rights question

Internet Archive can strengthen proof that a page existed at a historical timestamp and may fill technical gaps. It does not grant League Vector rights that the underlying content owner did not grant. Treat Wayback as provenance/recovery evidence, not rights laundering.

## 9. What an attorney/licensing review should answer

Before systematic ingestion, obtain a focused answer to these questions rather than a generic "can we scrape this site?" inquiry:

1. Are Ourlads' current/historical website terms enforceably incorporated against an unauthenticated public-page visitor under the relevant law?
2. Does the actual wording prohibit extracting uncopyrightable factual role observations for internal commercial statistical analysis?
3. Does retaining only independent features/model coefficients materially change the contract analysis?
4. May League Vector retain source URLs/archive IDs/timestamps and exact player identifiers for reproducibility?
5. Does automated access create additional contractual/trespass risk compared with permitted API/licensed access?
6. Are there any applicable state-law misappropriation claims beyond copyright preemption in this jurisdiction?
7. Would written permission limited to historical factual extraction + internal derived-model use be sufficient, without redistribution rights?
8. What attribution, audit, deletion, or rate-limit conditions should an agreement contain?

## 10. Recommended permission scope if League Vector later contacts Ourlads

No contact is authorized in this research cycle. If Founder later authorizes contact, the narrow request should be for permission to:

- programmatically access specified historical NFL depth-chart archive pages at an agreed low rate;
- extract factual player/team/position/depth-order/status observations;
- crosswalk identities internally;
- use those observations for internal statistical/model research and commercial derived projections/rankings;
- retain limited provenance/audit records;
- **not** republish or resell the Ourlads historical database/pages.

A narrow derived-model license may be more attainable/less expensive than full redistribution/data-feed rights.

## 11. Decision for League Vector now

### Allowed under this research cycle

- small public-page source/provenance samples;
- legal/technical feasibility analysis;
- adapter/schema design without ingestion;
- evaluation of independently licensed/open alternatives;
- prospective League Vector archive collection from already approved sources.

### Not authorized

- mass scraping;
- systematic historical extraction;
- bypassing technical controls;
- production model training on a bulk Ourlads-derived dataset;
- publishing Ourlads-derived historical tables;
- claiming that feature-only use is legally approved;
- vendor contact/spend without Founder authorization.

## Final recommendation

The earlier source audit should be refined as follows:

> **Ourlads remains technically attractive. A feature-only/coefficients-only League Vector architecture has a substantially stronger copyright posture than copying or redistributing Ourlads' database. U.S. law strongly protects the freedom to use facts, but Seventh Circuit contract precedent means that restrictive terms can still matter even for uncopyrightable data. Therefore League Vector should not treat factuality or transformation alone as permission for systematic commercial extraction. Keep Ourlads as a candidate source, design for data minimization, and require either focused legal clearance or written derived-model permission before bulk ingestion.**

This finding strengthens the feasibility case but does not remove the rights blocker.

## Authorities reviewed

- `Feist Publications, Inc. v. Rural Telephone Service Co.`, 499 U.S. 340 (1991).
- `ProCD, Inc. v. Zeidenberg`, 86 F.3d 1447 (7th Cir. 1996).
- `National Basketball Association v. Motorola, Inc.`, 105 F.3d 841 (2d Cir. 1997).
- `hiQ Labs, Inc. v. LinkedIn Corp.`, 31 F.4th 1180 (9th Cir. 2022).
- `X Corp. v. Bright Data Ltd.`, public-data scraping litigation (N.D. Cal. 2024).
- Ourlads public Terms & Conditions as identified in the parent source audit.

This is research analysis, not legal advice or a substitute for counsel.