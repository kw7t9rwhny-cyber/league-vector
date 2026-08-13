# Experimental Projection Frontend v0.3

League Vector's v0.3 projection frontend is an **experimental display layer**. It consumes pre-generated 2026 football-stat projections, applies the imported Sleeper league's supported scoring settings in the browser, and displays projected points, position rank, stat lines, empirical stat-level uncertainty and heuristic confidence.

## Data path

1. CI builds Projection System v0.3 from approved historical data.
2. `scripts/build-projection-frontend.js` converts the full output into a compact static browser asset.
3. The static site loads that asset after the existing Sleeper league analysis succeeds.
4. Players join by exact Sleeper ID from the validated projection/crosswalk pipeline. The frontend does not fuzzy-match names.
5. The same projected football stat line is scored against the imported league's Sleeper scoring settings.
6. Only complete supported scoring profiles receive positional ranks and authoritative projected-point display.

The browser does not download historical training data, train models, require SportsDataIO, or use API secrets.

## Projection statuses

The generated readiness artifact carries current-player status records for supported position groups. The compact frontend asset can therefore preserve statuses such as:

- `projection_ready`
- `rookie_model_required`
- `insufficient_history`
- `identity_unresolved`
- `missing_required_inputs`
- `data_unavailable`

Unavailable players are shown as unavailable instead of receiving fabricated values.

## Scoring coverage

The frontend maps supported Sleeper scoring keys to League Vector projected football statistics. It supports common offense and IDP counting-stat keys and explicitly audits position-relevant unsupported settings such as bonuses that the current model does not project.

If a position-relevant scoring key cannot be scored, the result is marked `partial`; projected fantasy points are withheld from the authoritative display and the unsupported keys are shown.

## Uncertainty and confidence

Per-stat model metadata and historical 80% residual ranges are included in the compact asset. These are empirical historical error bands, not guarantees that a player's future result has an exact 80% probability of falling in the interval.

Confidence remains explicitly **heuristic**. It is not displayed as a probability.

## Dynasty-value firewall

Projection v0.3 remains:

- `experimental: true`
- `production_projection_eligible: false`
- `dynasty_value_eligible: false`

The experimental frontend module does not import or call the dynasty valuation function. Existing dynasty value calculation remains in the established v0.8 analysis path. Automated tests enforce the isolation.

## Static preview

GitHub Actions assembles a `league-vector-experimental-site-preview` artifact containing the static site plus the generated compact projection asset. This allows pre-merge testing without changing the production GitHub Pages deployment, custom domain, DNS, or `main` branch.

## Known limitations

- Rookie football projections are not yet implemented.
- Current-player identity remains intentionally unresolved where the crosswalk cannot defend a mapping.
- Unsupported Sleeper bonus categories reduce scoring completeness rather than being treated as zero.
- Team projected-starter totals include only starters with complete experimental projections and are not win, playoff, or championship probabilities.
- Experimental projected production remains separate from dynasty roster value.
