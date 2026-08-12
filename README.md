# League Vector

League Vector is a static Sleeper league analyzer that explains how dynasty market value changes inside a specific league. The v0.8 foundation separates market baseline, age, league structure, projection/VORP and rookie-floor signals. It discloses missing data rather than manufacturing a complete-looking result.

## Current scope

- Imports Sleeper league settings, users, rosters, players, transactions and traded picks.
- Selects DynastyProcess 1QB or 2QB market data from lineup structure.
- Audits scoring keys used by the projection calculation.
- Uses exact identity matching with team verification and manual overrides; no fuzzy matches.
- Calculates offensive player and team values with completeness reporting.
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
