# Stage 3B Protected Environment — Live Observation Record

Observed before candidate QA preparation through the GitHub repository API.

- repository: `kw7t9rwhny-cyber/league-vector`
- repository default branch: `main`
- repository is non-fork according to repository metadata
- Environment: `stage3b-controlled-activation`
- required reviewers protection: present
- required reviewer observed: `kw7t9rwhny-cyber`
- prevent self review: `false`
- administrator bypass: disabled (`can_admins_bypass=false`)
- custom deployment branch policy: enabled
- deployment branch policies: exactly one, `main`, type `branch`

Environment secret names could not be independently enumerated with the available GitHub integration; the environment-secrets endpoint returned HTTP 403. No secret value was requested or exposed.

This observation record is evidence for independent QA orientation only. Runtime execution still re-reads live Environment metadata and fails closed on mismatch. Before any first live test, QA must independently verify the Environment secret name `LEAGUE_VECTOR_STAGE3B_FOUNDER_ACTIVATED` exists in Environment settings.
