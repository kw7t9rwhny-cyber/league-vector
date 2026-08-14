# IDP Research → Core contract v0.1

This contract prepares Core to consume proven IDP research without enabling production numeric IDP dynasty values.

## Firewall

Until Core explicitly promotes a research model, `idp_dynasty_value_available` remains `false`. No scoring-pressure-only value, fake fallback, combined offense+IDP ranking, arbitrary age adjustment, or market substitution is permitted.

## Required per-player projection record

```json
{
  "identity": {
    "league_vector_player_id": "lv:gsis:...",
    "sleeper_id": "...",
    "gsis_id": "..."
  },
  "position": "DL|LB|DB",
  "projected_stats": { "solo_tackles": 0, "sacks": 0 },
  "supported_stat_keys": ["solo_tackles", "sacks"],
  "uncertainty": {
    "type": "empirical_interval|quantile|other documented method",
    "level": 0.8,
    "low": null,
    "high": null
  },
  "model": {
    "name": "...",
    "version": "...",
    "status": "ready|insufficient_history|unavailable",
    "research_approved": false
  },
  "source": { "name": "...", "version": "..." }
}
```

Identity must fail closed when unresolved. Position must canonicalize to DL, LB, or DB. Missing projected stats must remain missing, not become zero.

## Scoring support

Core applies the imported Sleeper IDP scoring settings only to supported projected stats. Research must provide the stat-key support set. Core reports supported scoring keys, unsupported scoring keys, missing projected stat keys, and completeness as complete/partial/unsupported/unavailable.

## Replacement methodology input

Research must provide a versioned, approved methodology specification that consumes actual league lineup demand. Required metadata: methodology name/version, canonical position, player-pool eligibility rules, starter-demand basis, treatment of shared IDP_FLEX, season/horizon, and any minimum sample requirement. Core will not use one universal DL/LB/DB threshold.

## Scarcity

Scarcity is a separate layer from replacement/VORP. Research must state whether a proposed scarcity feature is descriptive context or an independently validated adjustment. It must not re-apply lineup pressure already embedded in replacement level.

## Age / dynasty horizon

Any age curve must be position-specific, versioned, temporally validated, and explicitly research-approved. Required inputs include position, horizon, curve parameters, training seasons, validation seasons, sample size, and uncertainty. Core supplies hooks but no default IDP age numbers.

## Cross-position normalization

To compare offense and IDP in the future, Research must provide an approved versioned surplus/VORP normalization method with calibration evidence. Core will not force IDP onto the offensive 0–10,000 scale and will not create a combined ranking until this contract is approved separately.

## Status vocabulary

Core must be able to preserve at least: `fully_supported`, `partial_scoring_coverage`, `projection_unavailable`, `identity_unresolved`, `insufficient_history`, and `research_model_unavailable`.

## PR #4 salvage review

Useful concepts retained: separation of structural lineup pressure from scoring environment; explicit partial scoring coverage; fail-closed IDP identity; and the rule that scoring context is informational rather than dynasty value.

Already superseded on `main`: PR #4's `idp-scoring-context-v01.js` concept is present in a fuller current implementation; `scoring-coverage-v02.js` is superseded by the current v0.3.2 coverage path; identity/projection conflict handling has moved into the newer projection identity/alias pipeline.

Not ported: PR #4 experimental IDP UI, old projection-generation edits, old index wiring, or its identity module wholesale. Those areas either conflict with newer `main`, belong to Projection Research, or overlap current UI work.
