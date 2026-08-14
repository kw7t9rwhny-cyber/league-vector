# READY FOR QA — HIGH RISK

Candidate scope: `idp_sack_yd` for **DL and LB only**.

Do not interpret this as global support for `idp_sack_yd`. DB remains unsupported because the tested Ridge model worsens DB MAE versus zero despite better RMSE/rank signal.

Non-candidates: `bonus_sack_2p`, `fum_rec_td`, `idp_blk_kick`, `idp_fum_ret_yd`, `idp_int_ret_yd`, `idp_pass_def_3p`, `st_ff`, `st_fum_rec`, `st_td`.

Required QA checks:

- reproduce frozen input snapshot SHA-256 `d261bfb0f64f60f01db7e85cffe36b4025bf5a2958e9ef940968cbd2115c6188`;
- verify true-zero versus unavailable source semantics and fail-closed behavior;
- verify 2020-2024 chronological folds and 2025 retrospective-only status;
- independently reconstruct DL/LB sack-yard MAE/RMSE/rank and 5/5 fold wins versus zero;
- verify DB cannot receive the candidate model or a zero-fill fallback;
- verify bonus probability signals are research-only and do not add projected scoring;
- verify PR #30's full scoring completeness gate remains fail-closed;
- verify all production and Dynasty eligibility firewalls remain false/closed.

No merge or production promotion is authorized by a QA PASS.
