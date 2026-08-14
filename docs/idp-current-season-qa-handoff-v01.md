# QA handoff — Experimental IDP Current-Season Rankings v0.1

Candidate status: **READY FOR QA**

Risk: **HIGH**

Scope is current-season IDP projection/scarcity ranking only. The candidate does not expose or enable IDP Dynasty Value.

QA must test the exact candidate head and independently verify:

- current eligibility excludes retired, inactive, missing-current-identity, and unverified teamless records;
- current eligibility counts and DL/LB/DB populations reconstruct from the current Sleeper snapshot;
- actual league scoring is applied to projected stats without reference-scoring leakage;
- meaningful unsupported active IDP scoring keys fail closed;
- missing projected stats required by active scoring fail closed;
- DL/LB, LB/DB and any other supported hybrids preserve full eligibility and are never double-counted;
- dedicated DL/LB/DB + IDP_FLEX demand is reconstructed from actual roster positions;
- unknown IDP-like roster slots fail closed;
- replacement thresholds are deterministic and use the player's exact eligibility set;
- projected surplus equals projected points minus the exact-eligibility replacement threshold;
- sorting/tie behavior is deterministic;
- negative current-season surplus is handled without becoming a Dynasty Value;
- `role_confidence=limited` and `historical_role_model_available=false` remain visible;
- `idp_dynasty_value_available=false` and `dynasty_value=null` for every player;
- no combined offense+IDP Dynasty Ranking is activated;
- no production/UI behavior changes are included in this candidate.

Required final QA verdict must cite the exact tested head SHA.
