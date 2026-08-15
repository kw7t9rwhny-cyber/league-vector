# Stage 3B Protected Environment — Live Observation Record

Observed before remediation QA preparation through the GitHub repository API.

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

Environment secret names cannot be independently enumerated with the available GitHub integration; the environment-secrets endpoint returned HTTP 403. No secret value was requested or exposed.

That inventory gap is **not** an authorization dependency in the remediated design. Founder authorization is admission of the exact execute job through the protected Environment after its Founder required-reviewer gate, not a value resolved from `secrets.*`. Repository, organization, and Environment secrets of the former activation name are not read as Founder authority.

This observation record is evidence for independent QA orientation only. Runtime execution still re-reads live Environment metadata and fails closed if the required reviewer, self-review setting, administrator-bypass setting, or exact `main` deployment policy no longer matches the contract.
