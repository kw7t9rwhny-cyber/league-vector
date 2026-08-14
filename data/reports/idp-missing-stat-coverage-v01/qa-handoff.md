# READY FOR QA — HIGH RISK

Candidate scope: `idp_sack_yd` for **DL and LB only**.

Do not interpret this as global support for `idp_sack_yd`. DB remains unsupported because the tested Ridge model worsens DB MAE versus zero. DB must not receive the DL/LB model and must not be zero-filled.

Non-candidates remain unsupported/research-only: `bonus_sack_2p`, `fum_rec_td`, `idp_blk_kick`, `idp_fum_ret_yd`, `idp_int_ret_yd`, `idp_pass_def_3p`, `st_ff`, `st_fum_rec`, `st_td`.

## Canonical evidence contract

The canonical research result is `canonical-result.json`. It contains deterministic research inputs/results/provenance only. Primary finite floating results are normalized to 8 decimal places. Spearman/rank-correlation diagnostics are normalized to 3 decimal places because independent runs showed solver-level perturbations around tie/rank boundaries at roughly `1e-4`, which exceeds defensible precision for those secondary diagnostics but does not affect the primary MAE candidate decisions. Negative zero is normalized, JSON keys are sorted, encoding is UTF-8, line endings are LF, and exactly one terminal newline is written.

Workflow/run metadata is intentionally excluded from the canonical result and written separately to `evidence-manifest.json`.

The workflow restores **two clean copies** of frozen input snapshot SHA-256 `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`, executes the complete analysis independently against both, requires byte-identical canonical outputs, computes the SHA-256 from the actual `canonical-result.json`, records that exact SHA in `evidence-manifest.json`, and independently rechecks the manifest SHA against the uploaded payload. A manually copied hash in documentation is not authoritative.

## Required QA checks

- reproduce frozen input snapshot SHA-256 `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`;
- independently hash `canonical-result.json` and verify it exactly matches `evidence-manifest.json`;
- independently repeat the canonical analysis from a clean restored frozen input and verify byte identity under the declared field-specific canonicalization contract;
- verify true numeric zero remains zero;
- verify null/non-numeric/unavailable required input fails closed before preprocessing/modeling/scoring and cannot become zero;
- verify 2020-2024 chronological folds and 2025 retrospective-only status;
- independently reconstruct DL Ridge MAE ~12.90 vs zero ~16.56 and 5/5 fold wins;
- independently reconstruct LB Ridge MAE ~10.11 vs zero ~12.23 and 5/5 fold wins;
- verify DB remains unsupported at Ridge MAE ~2.73 vs zero ~1.89 and cannot receive the DL/LB model or a zero-fill fallback;
- verify `bonus_sack_2p` and `idp_pass_def_3p` probability signals remain research diagnostics only and do not add threshold-bonus scoring outputs;
- verify every other non-candidate remains unsupported/research-only;
- verify PR #30's full Founder-like scoring completeness gate remains fail-closed;
- verify `experimental=true`, `production_projection_eligible=false`, `idp_dynasty_value_available=false`, `dynasty_value=null`, and combined offense+IDP Dynasty rankings remain unavailable;
- rerun full League Vector CI.

No merge or production promotion is authorized by a QA PASS.
