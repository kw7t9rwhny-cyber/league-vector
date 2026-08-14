# Prospective opportunity archive

Append-only prospective NFL state captured by `scripts/prospective-opportunity-archive.py`.

- `objects/`: content-addressed deterministic gzip normalized evidence
- `observations/`: immutable timestamped retrieval records and quality reports
- `derived/`: separately derived transitions/features; never replaces raw-normalized evidence
- `failures/`: failed capture records; failures never fabricate snapshots
- `manifest.jsonl`: append-only observation index

Do not manually rewrite old observations or content objects. See `docs/prospective-opportunity-archive.md`.
