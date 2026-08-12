# Data sources and commercial readiness

## Sleeper

Used for league configuration, rosters, users, player metadata, transactions, traded picks and NFL state. These documented endpoints use `https://api.sleeper.app/v1`.

Sleeper's public documentation says the API is free for non-commercial use and asks commercial users to contact Sleeper. Commercial launch is therefore blocked until the owner confirms acceptable commercial terms. League Vector has not contacted Sleeper or accepted terms on the owner's behalf.

The projection adapter currently calls Sleeper's undocumented `/projections/nfl/...` endpoint. It is explicitly labeled unstable, has timeouts and partial-failure reporting, and must be replaced before relying on it commercially.

## DynastyProcess

Used for the offensive dynasty market baseline and ECR snapshot. League Vector selects the feed's 1QB or 2QB columns from the imported lineup. The upstream `dynastyprocess/data` repository currently declares the GNU GPL v3. That is a material compatibility question for a proprietary commercial product, especially if League Vector later caches, modifies or redistributes the dataset. Before commercial launch, obtain legal review of the repository license, required notices, attribution, database rights and the terms of the feed's own upstream sources. v0.8 does not claim that the data is commercially cleared.

## IDP

No legally and methodologically defensible IDP market/projection source has been integrated. The frontend reports DL/LB/DB demand and scoring context but marks all numeric IDP value as unavailable. It does not substitute fabricated rankings.

## Operational status

- Repository visibility: public.
- Default branch protection: not enabled as of the v0.8 audit.
- GitHub Pages HTTPS enforcement: reported disabled as of the v0.8 audit.
- Secrets: none required or committed.
- Open-source license: none selected.

Branch protection, HTTPS/DNS changes, provider contracts and a private backend require owner approval outside this pull request.
