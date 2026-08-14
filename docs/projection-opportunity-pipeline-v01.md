# Projection Opportunity v0.1 — Point-in-Time Pipeline Contract

## Status and firewall
This branch remains **research-only / HIGH risk / not READY FOR QA**. No production projection, Dynasty Value, Core, UI, IDP valuation, or `main` behavior is changed. No historical depth chart is fabricated, and current depth charts must never be applied retrospectively.

## What can proceed before Sportradar responds
The data-independent pipeline is now specified around one canonical point-in-time row. Every source adapter must emit: provider + immutable snapshot ID, `data_as_of`, acquisition time, season/type, team, provider player ID, GSIS mapping/confidence, normalized role family, provider depth slot, ordered depth rank when actually supplied, roster/list status, injury status when actually supplied, source quality, and provenance/license basis.

The cutoff is fixed as **team-specific last valid provider snapshot strictly before that team's first regular-season kickoff**. A post-kickoff observation is excluded, not repaired. If a team has no qualifying snapshot, the season/team is incomplete and fails the coverage gate.

Starter status is representational only: `depth_rank === 1`. It does not award projection points. `BACKUP_TO_STARTER` means the same mapped player was non-starter in the previous valid historical state and starter at the current cutoff. `STARTER_TO_BACKUP` is the inverse. Other ordered changes remain promotions/demotions rather than being mislabeled as starter changes.

Vacated opportunity for season Y is computed from season Y-1 team usage. A prior contributor's carries, targets, or pass attempts are vacated only when that mapped player is absent from the same team at the pre-Y cutoff. A team change therefore vacates opportunity for the old team but does not imply that the new team automatically allocates that work to the incoming player.

Role-survival/stability features are descriptive inputs: number of observed snapshots, rank changes, starter-state changes, starter share, final rank, and rank range. They feed an opportunity model and uncertainty estimate; they are not arbitrary bonuses.

Year-2 and year-3, limited-history, backup-to-starter, and team-change cohorts are diagnostic slices. They may reveal where the opportunity-first architecture helps, but cannot bypass overall chronological selection standards.

## Opportunity-first architecture
The intended sequence is:

`point-in-time roster/depth/availability/transactions -> opportunity target -> fantasy efficiency/points`

Primary opportunity targets remain QB pass attempts/meaningful-role games, RB carries + targets, WR targets, and TE targets. A later model may use prior opportunity, current depth state, role stability, vacated team opportunity, team changes/competition, and cutoff-known availability. Fantasy points are downstream outputs; no candidate is eligible until stable pre-2025 chronological evidence beats the validated v0.4 control.

Uncertainty must preserve role uncertainty rather than hide it. The scaffold exposes identity confidence, whether ordered depth is available, number of point-in-time observations, depth volatility, and whether roster status is known. Those are inputs to an uncertainty score/output, not a claim that the score is calibrated before historical backtesting.

## Leakage-safe backtest harness
Selection folds are expanding-window and validation-season strict: every training season is earlier than the validation season. The current policy caps model-selection validation at 2024. 2025 remains retrospective untouched evidence under the v0.4 protocol; 2026 is prospective/unrealized. Any future historical adapter must prove its `data_as_of` falls before the target cutoff before its rows can enter a fold.

Every real backtest run should persist raw-input hashes, canonical-row hashes, cutoff manifests, identity coverage, feature hashes, fold manifests, parameters selected on training/development only, and output hashes. The sample evaluator intentionally returns `accepted_for_modeling=false` even when schema normalization succeeds: vendor semantics and rights are separate gates.

## Prospective 2026 evidence system
Beginning in 2026, store immutable timestamped snapshots rather than overwriting current state. The logical storage key is:

`provider / season / acquired-date / provider_snapshot_id`

Each capture should include raw provider payload (where retention is permitted), canonical normalized rows, a manifest SHA-256, source URI/API endpoint identifier, license basis, acquisition timestamp, `data_as_of`, provider IDs, team, depth/starter state, roster status, injury state, transaction context, and opportunity context available at that timestamp.

Snapshot capture frequency should follow legally permitted source update cadence, with extra captures around roster cuts, major transactions/injuries, final preseason week, and before Week 1 kickoffs. Never mutate an old snapshot because a provider later corrects current data; store the correction as a new snapshot and link it by provider/version metadata when available.

## Source adapters
`nflverse2025Adapter` exists only for mechanics/prospective 2025+ timestamped data where provenance is acceptable for research. It does not retroactively make pre-2025 nflverse depth charts point-in-time safe.

`sportradarAdapter` is deliberately thin and fail-closed. A received sample must be evaluated with explicit external metadata (`snapshot_id`, `data_as_of`, season, source URI, license basis). Passing normalization does **not** prove historical as-of semantics or commercial derived-model rights.

## Still data-blocked
No historical opportunity model can be selected until a source supplies defensible pre-2025 point-in-time ordered depth data. For Sportradar, the remaining gates are: sample coverage/shape; proof that historical responses reflect the intended original point-in-time state rather than later revision; stable player/team IDs and identity completeness; retention/reproducibility rights; commercial derived-model rights; and sufficient 2018-2024 preseason coverage for chronological model selection.

No paid commitment is authorized by this pipeline work.
