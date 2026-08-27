# League Vector

League Vector is a static Sleeper league analyzer that explains how dynasty market value changes inside a specific league. The paid-beta v0.8 contract uses market baseline, age, league structure and the rookie floor. Legacy weekly projections are excluded from paid value instead of allowing partial data to change an ordinary numeric result.

## Current scope

- Imports Sleeper league settings, users, rosters, players, transactions and traded picks.
- Selects DynastyProcess 1QB or 2QB market data from lineup structure.
- Keeps scoring inputs available as league context and for separately labeled experimental projections.
- Uses explicit stable-ID crosswalks, exact identity matching with team verification and manual overrides; no fuzzy matches.
- Calculates offensive player and team values under an explicit machine-readable paid-value eligibility contract.
- Shows IDP context, but deliberately does not invent numeric IDP values.
- Caches stable data in IndexedDB and cancels stale analyses.

This repository is the public frontend. The proprietary Top Dog Engine and licensed data providers belong behind a future private API; no credentials or private model logic should be committed here.

## Local development

The application has no runtime build step. Serve the repository with any static HTTP server:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Direct `file://` access is not supported because the app fetches its override file and remote data.

## Validation

Node 20 or newer is required.

```bash
npm run validate
```

The validation command checks whitespace/style, parses all JavaScript and runs the Node test suite. GitHub Actions runs the same command for pull requests and pushes to `main`.

Browser tests use Playwright with deterministic Sleeper, market and contextual-projection fixtures:

```bash
npx playwright install chromium
npm run test:e2e
```

They cover paid-value eligibility, legacy weekly projection exclusion, one-QB and superflex analysis, ambiguous identities, IDP completeness warnings, imported-text escaping and mobile keyboard/layout behavior.

To evaluate a SportsDataIO trial safely in Codex Cloud, keep the key in the environment's Secrets section and run `npm run evaluate:sportsdataio` from the setup script. The command writes only a sanitized access/schema report to `/tmp/league-vector-sportsdataio-evaluation.json`; see `docs/DATA_SOURCES.md` for details.

## Player crosswalk

`data/player-crosswalk.json` maps verified Sleeper IDs to stable market/provider IDs. It is intentionally empty until mappings have been verified. Stable mappings take priority over name/team fallback and stale mappings are reported rather than ignored.

Generate an offline audit report from pinned inputs:

```bash
npm run audit:crosswalk -- --players players.json --market values-players.csv --crosswalk data/player-crosswalk.json --overrides data/player-overrides.json --format 1qb
```

The report separates stable-crosswalk, manual, exact, team-verified, unmatched and ambiguous records. The command does not download data or write mappings automatically.

## Player overrides

`data/player-overrides.json` maps Sleeper player IDs to explicit market identities. Example:

```json
{
  "1234": {
    "marketName": "Example Player",
    "position": "WR",
    "team": "GB",
    "fpId": "99999"
  }
}
```

Use overrides only after verifying the identity. The application does not silently fuzzy-match names.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Data sources and licensing](docs/DATA_SOURCES.md)
- [v0.8 changelog](docs/CHANGELOG.md)
- [Remaining roadmap](docs/ROADMAP.md)

No open-source license has been selected. All rights remain with the repository owner unless and until a license is added.
