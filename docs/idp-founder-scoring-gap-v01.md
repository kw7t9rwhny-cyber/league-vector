# Founder-like IDP scoring coverage audit v0.1

This document freezes the active defensive scoring shape observed from the Founder production league on 2026-08-14 and classifies it against Experimental IDP Current-Season Rankings v0.1.

## Individual IDP keys already supported by the projected stat line

- `idp_tkl` 1.25 -> `total_tackles`
- `idp_tkl_solo` 1.75 -> `solo_tackles`
- `idp_tkl_ast` 0.75 -> `assisted_tackles`
- `idp_tkl_loss` 3 -> `tackles_for_loss`
- `idp_sack` 5 -> `sacks`
- `idp_qb_hit` 0.5 -> `qb_hits`
- `idp_int` 6 -> `interceptions`
- `idp_pass_def` 3 -> `passes_defended`
- `idp_ff` 4 -> `forced_fumbles`
- `idp_fum_rec` 2 -> `fumble_recoveries`
- `idp_def_td` 6 -> `defensive_td`
- `idp_safe` 6 -> `safeties`

Sleeper documents Tackle as stacking with Solo Tackle, Assisted Tackle, Tackle For Loss and Sack. The adapter therefore intentionally preserves stacking when those individual IDP settings are simultaneously active.

## Active keys that are not individual-player IDP scoring

These belong to Sleeper Team Defense or Special Teams Defense and must not be added to an individual defender's projected points:

- `blk_kick` 2
- `def_st_ff` 1
- `def_st_fum_rec` 1
- `def_st_td` 6
- `def_st_tkl_solo` 2
- `def_td` 6
- `ff` 1
- `fum_rec` 2
- `sack` 1
- `safe` 2

The pre-hotfix adapter incorrectly treated several generic team-defense keys as individual player scoring aliases. The candidate reports them as `non_player_keys` and excludes them from individual points and from meaningful-unsupported coverage.

## Meaningful individual-player categories that remain unsupported

The current League Vector 2026 IDP projection artifact does not contain defensible projections for these active player-scoring settings, so the rankings must remain fail-closed while any has a nonzero league weight:

- `bonus_sack_2p` 2 — requires a projection of qualifying sack-bonus events/games, not season sack total alone.
- `fum_rec_td` 6 — requires fumble-recovery touchdowns specifically; aggregate `defensive_td` cannot distinguish interception-return and fumble-return touchdowns.
- `idp_blk_kick` 3 — no blocked punt/PAT/FG projection.
- `idp_fum_ret_yd` 0.1 — no fumble-return-yard projection.
- `idp_int_ret_yd` 0.1 — historical normalization can ingest interception return yards, but the approved current-season projection artifact does not project them.
- `idp_pass_def_3p` 2 — requires qualifying pass-defended bonus events/games; season pass-defended total is insufficient.
- `idp_sack_yd` 0.1 — historical normalization can ingest sack yards, but the approved current-season projection artifact does not project them.
- `st_ff` 1 — Special Teams Player forced fumble is not projected.
- `st_fum_rec` 1 — Special Teams Player fumble recovery is not projected.
- `st_td` 6 — Special Teams Player touchdown is not projected.

No proxy, ratio, zero-fill, or derived fallback is authorized for these categories.

## Coverage

Before the scope correction, the adapter classified 17 of 32 active defensive-looking keys as supported and 15 as unsupported, but 5 of those 17 supported keys were team-defense settings incorrectly capable of double-counting individual player points, and 5 additional unsupported keys were team/special-teams-defense settings that should not gate individual-player rankings.

After the scope correction:

- 12 individual IDP keys are supported.
- 10 team-defense/special-teams-defense keys are explicitly non-player keys.
- 10 meaningful player-scoring keys remain unsupported.
- Player-scoring coverage is therefore 12 / 22 active player-relevant keys = 54.5% by active-key count.
- The full Founder scoring shape remains fail-closed and yields zero rankable IDP rows until the remaining player-level projection gaps are solved by approved projection research.

## Production boundary

This work does not authorize IDP Dynasty Value. The permanent requirements remain:

- `idp_dynasty_value_available=false`
- `dynasty_value=null`
- combined offense+IDP Dynasty rankings unavailable
- offensive Dynasty Value unchanged
