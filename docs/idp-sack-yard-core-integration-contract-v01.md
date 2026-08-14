# IDP Sack-Yard Core Experimental Integration Contract v0.1

Status: **EXPERIMENTAL INTEGRATION PREPARATION ONLY — NOT PRODUCTION READY**

QA-approved research head: `fe936d37f346e3e8b027e33964e272dd34b04e9b`

QA-approved canonical research result SHA-256: `5ffe308142d16641729c23a3542362f031516aa5e6835904e84787ee25096c4c`

Validated scoring-contract base: `5550c83380432abce3ae0e68cc9d2daa0e720ea2`

Frozen historical input SHA-256: `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`

This contract prepares Core to consume the QA-approved `idp_sack_yd` research component experimentally. It does not activate production projection behavior, does not change global scoring completeness, and does not authorize `main`, UI, Dynasty Value, combined rankings, or deployment.

## 1. Approved research scope

Only `idp_sack_yd` for broad modeling families **DL** and **LB** is within the approved research scope.

Development evidence:

- DL: Ridge MAE `12.9023` vs zero `16.5583`; Ridge wins `5/5` development folds.
- LB: Ridge MAE `10.1142` vs zero `12.2345`; Ridge wins `5/5` development folds.
- DB: Ridge MAE `2.7303` vs zero `1.8907`; Ridge wins `0/5` MAE folds and remains unsupported.

The approved research model family is Ridge with `alpha=10` and feature vocabulary:

- prior-season sacks
- prior-season sack yards
- prior-season games
- prior-season solo tackles

The research implementation fits position-specific models inside chronological folds. The QA-approved branch does **not** contain one frozen final 2026 coefficient vector. Therefore Core MUST NOT duplicate the training code, infer coefficients from fold outputs, or independently refit a final model and call it research-approved.

## 2. Model artifact requirement

Core integration is two-stage:

1. Core may implement this adapter/interface contract now.
2. Numeric experimental sack-yard output remains unavailable until Research freezes a dedicated coefficient artifact conforming to this contract.

Required frozen artifact identity:

```text
artifact_type = league-vector-idp-sack-yard-model
model_version = idp-sack-yard-ridge-v0.1
research_head = fe936d37f346e3e8b027e33964e272dd34b04e9b
canonical_research_sha256 = 5ffe308142d16641729c23a3542362f031516aa5e6835904e84787ee25096c4c
validated_scoring_contract_sha = 5550c83380432abce3ae0e68cc9d2daa0e720ea2
input_snapshot_sha256 = d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188
model_family = ridge
alpha = 10
```

The artifact must contain separate DL and LB model payloads. Each payload must declare its intercept, ordered feature names, ordered coefficients, preprocessing parameters needed for deterministic inference, training-period contract, model-library/version provenance, and artifact SHA-256. Core consumes those values; it does not re-derive them.

Until such a frozen artifact exists and passes provenance validation, adapter status MUST be `research_model_unavailable` and `idp_sack_yd` MUST remain unavailable.

## 3. Required player identity

Minimum identity input:

```text
league_vector_player_id
sleeper_id
primary_position
eligible_positions[]
```

`league_vector_player_id` is required and must already resolve through the existing fail-closed League Vector identity pipeline. `sleeper_id` is required for the current Sleeper-integrated experimental path. `gsis_id` should be surfaced when known but absence of `gsis_id` alone does not authorize identity substitution.

Unresolved, conflicting, duplicated, or ambiguous identity => `identity_unresolved`; no sack-yard value is emitted.

## 4. Position-family gate

`primary_position` is the single broad historical modeling family already used by the current-season IDP contract. `eligible_positions` preserves the player's full current Sleeper eligibility.

Routing rules:

| Input state | Result |
| --- | --- |
| `primary_position=DL`, no DB eligibility | DL model eligible |
| `primary_position=LB`, no DB eligibility | LB model eligible |
| `primary_position=DB` | unavailable |
| exact DL/LB hybrid eligibility + `primary_position=DL` | DL model eligible |
| exact DL/LB hybrid eligibility + `primary_position=LB` | LB model eligible |
| DL/LB hybrid with missing/ambiguous primary family | unavailable |
| any eligibility set containing DB, including DB/LB | unavailable in v0.1 |
| unknown/uncanonicalizable defensive position | unavailable |

The v0.1 DB-containing-hybrid block is intentionally conservative. The presence of `LB` in `DB/LB` MUST NOT silently route that player into the LB sack-yard model. A later research candidate must explicitly validate and authorize that mapping.

A DL/LB hybrid is modeled exactly once through its explicit single `primary_position`. Core must never run both DL and LB models and choose the larger output.

## 5. Required source fields

Core-facing inference inputs are previous-season player-level values corresponding to the approved feature vocabulary:

```text
prior_sacks
prior_sack_yards
prior_games
prior_solo_tackles
```

Each field must carry source-state semantics, not only a number:

```json
{
  "value": 0,
  "state": "observed_numeric"
}
```

Allowed state for inference: `observed_numeric` only.

Disallowed states include `missing`, `null`, `non_numeric`, `not_applicable`, `unresolved`, `source_unavailable`, or any equivalent unknown state.

No median imputation, zero substitution, prior-season fallback, position average, or proxy is authorized in the Core adapter. Research preprocessing parameters belong in the frozen model artifact; Core must apply exactly that artifact contract only after all required source states are valid.

## 6. Missing-state and numeric-zero contract

True numeric zero and unavailable are different states.

- observed `0 sacks` => valid numeric zero
- observed `0 sack yards` => valid numeric zero
- observed `0 solo tackles` => valid numeric zero
- unavailable sack yards => unavailable, never zero
- null/non-numeric input => unavailable, never zero

If any required field is unavailable, the entire `idp_sack_yd` component for that player fails closed. Core must not emit `0`, must not score `0 × league_weight`, and must not mark the category supported.

## 7. Experimental adapter output

Recommended smallest Core object:

```json
{
  "key": "idp_sack_yd",
  "value": null,
  "status": "available|identity_unresolved|position_unsupported|ambiguous_position|missing_required_input|research_model_unavailable|artifact_provenance_mismatch|inference_error",
  "supported_position_family": null,
  "experimental": true,
  "production_projection_eligible": false,
  "confidence": {
    "level": "limited",
    "interval_low": null,
    "interval_high": null,
    "method": "not_yet_calibrated"
  },
  "warnings": [],
  "provenance": {
    "model_version": "idp-sack-yard-ridge-v0.1",
    "research_head": "fe936d37f346e3e8b027e33964e272dd34b04e9b",
    "canonical_research_sha256": "5ffe308142d16641729c23a3542362f031516aa5e6835904e84787ee25096c4c",
    "model_artifact_sha256": null
  }
}
```

`value` may become numeric only when identity, position, inputs, model artifact, and inference all pass.

## 8. Uncertainty / confidence

Research has not QA-approved calibrated player-level prediction intervals for sack yards. Core therefore MUST NOT manufacture precise confidence intervals.

Required v0.1 confidence behavior:

```text
confidence.level = limited
confidence.interval_low = null
confidence.interval_high = null
confidence.method = not_yet_calibrated
```

Warnings should state that the component is experimental, broad-position research only, and lacks calibrated player-level uncertainty.

If Research later supplies an independently QA-approved interval/quantile artifact, Core may consume it under a new versioned contract.

## 9. Scoring-adapter interface

The sack-yard component is a partial-position projected-stat provider, not a global scoring-support declaration.

Proposed interface:

```text
resolveExperimentalProjectedStat(player, "idp_sack_yd", context)
  -> { status, value, supported_position_family, warnings, provenance, confidence }
```

The existing scoring adapter may score `idp_sack_yd` only when the returned component status is `available` for that exact player.

The scoring layer must continue to report `idp_sack_yd` as **not globally supported** because DB remains unavailable. A league containing active nonzero `idp_sack_yd` scoring and rankable DB demand cannot be declared globally complete merely because DL/LB rows have experimental values.

The full Founder-like scoring configuration remains fail-closed/not globally rankable.

## 10. Non-candidates remain unavailable

No behavior in this integration contract changes:

- `bonus_sack_2p`
- `fum_rec_td`
- `idp_blk_kick`
- `idp_fum_ret_yd`
- `idp_int_ret_yd`
- `idp_pass_def_3p`
- `st_ff`
- `st_fum_rec`
- `st_td`

No proxy, zero-fill, threshold scoring, or hidden derived fallback is permitted.

## 11. Provenance surfaced to Core

Every available experimental result must expose:

```text
model_version
research_head
canonical_research_sha256
model_artifact_sha256
model_artifact_version
input_snapshot_sha256
validated_scoring_contract_sha
position_family_used
source_state_verified=true
experimental=true
production_projection_eligible=false
```

A mismatch in any immutable provenance identifier fails closed before inference.

## 12. Deterministic tests Core must implement

Core integration tests MUST include at minimum:

1. canonical DL player + valid numeric inputs + valid frozen DL artifact => `available`, exactly one DL inference.
2. canonical LB player + valid numeric inputs + valid frozen LB artifact => `available`, exactly one LB inference.
3. canonical DB player => `position_unsupported`, `value=null`.
4. DL/LB hybrid + `primary_position=DL` => exactly one DL inference.
5. DL/LB hybrid + `primary_position=LB` => exactly one LB inference.
6. DL/LB hybrid + missing/ambiguous primary => fail closed.
7. DB/LB hybrid regardless of primary => fail closed in v0.1.
8. unknown defensive position => fail closed.
9. each required input independently set to true numeric zero => zero remains a valid input and inference still executes.
10. each required input independently set to null => fail closed, no inference.
11. each required input independently set to non-numeric => fail closed, no inference.
12. missing model artifact => `research_model_unavailable`.
13. wrong artifact SHA, wrong research SHA, wrong canonical research SHA, wrong model version, or wrong feature order => `artifact_provenance_mismatch`.
14. DB must never receive a numeric zero fallback when unsupported.
15. adapter exception/non-finite output => `inference_error`, `value=null`.
16. active `idp_sack_yd` scoring with DL/LB support but DB demand => global scoring completeness remains false.
17. Founder-like full scoring fixture from the validated scoring contract remains fail-closed.
18. every listed non-candidate remains unsupported even if similarly named source fields exist.
19. `production_projection_eligible=false`, `idp_dynasty_value_available=false`, `dynasty_value=null`, and combined offense+IDP Dynasty rankings unavailable in every result path.
20. repeated inference from identical artifact + identical validated inputs => identical numeric result and provenance.

## 13. Rollback / fail-closed behavior

Experimental integration must be removable by disabling or deleting the model artifact/provider registration without altering the underlying scoring adapter.

Rollback result:

- `idp_sack_yd` returns `research_model_unavailable` for all players;
- no cached prior numeric sack-yard values may remain eligible for scoring;
- global scoring completeness remains unchanged/fail-closed;
- no other projected stat is affected;
- no Dynasty or combined ranking state changes.

Any artifact load error, model-version mismatch, schema mismatch, position ambiguity, missing input, non-finite inference, or provenance mismatch is equivalent to component unavailability, never a zero result.

## 14. Permanent firewalls for this preparation lane

```text
experimental=true
production_projection_eligible=false
idp_dynasty_value_available=false
dynasty_value=null
combined offense+IDP Dynasty rankings unavailable
```

No production activation, UI wiring, Core merge, deployment, or `main` promotion is authorized by this contract.

## Core handoff state

Core may implement the interface, provenance validation, position/missing-state gates, tests, and rollback behavior against a non-numeric fixture artifact.

Core must NOT emit numeric experimental `idp_sack_yd` until Research supplies a separately frozen coefficient/preprocessing artifact and that artifact receives the required validation/QA for inference use.

**READY FOR CORE EXPERIMENTAL INTEGRATION PREPARATION**
