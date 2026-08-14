#!/usr/bin/env python3
"""League Vector prospective NFL opportunity archive.

Research/infrastructure only. This collector freezes legally approved public source state
at retrieval time. It never rewrites prior observations or content objects.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import pathlib
import urllib.request
from collections import Counter, defaultdict

SCHEMA_VERSION = "lv-prospective-opportunity-archive-v1.1"
ROOT = pathlib.Path("data/opportunity-archive")
EXPECTED_TEAMS = 32
USER_AGENT = "LeagueVector-ProspectiveArchive/0.1 (+research provenance capture)"
TEAM_ALIASES = {
    "AZ": "ARI",
    "ARZ": "ARI",
    "JAC": "JAX",
    "WSH": "WAS",
    "LAR": "LA",
    "STL": "LA",
    "OAK": "LV",
    "SD": "LAC",
}

SOURCES = {
    "depth_chart": {
        "provider": "nflverse",
        "dataset": "depth_charts",
        "release_api": "https://api.github.com/repos/nflverse/nflverse-data/releases/tags/depth_charts",
        "url": "https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_{season}.csv.gz",
        "license_basis": "CC-BY-4.0 via nflverse-data; upstream provenance recorded; research/commercial provenance review remains explicit",
    },
    "roster": {
        "provider": "nflverse",
        "dataset": "weekly_rosters",
        "release_api": "https://api.github.com/repos/nflverse/nflverse-data/releases/tags/weekly_rosters",
        "url": "https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_{season}.csv",
        "license_basis": "CC-BY-4.0 via nflverse-data; derived from NFL Shield v2; commercial provenance review remains explicit",
    },
}


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def iso_z(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def compact_ts(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json_bytes(value) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=90) as response:
        return response.read()


def release_metadata(url: str) -> dict:
    try:
        return json.loads(http_get(url).decode("utf-8"))
    except Exception as exc:
        return {"metadata_error": str(exc)}


def parse_csv(raw: bytes, gzipped: bool = False) -> list[dict]:
    if gzipped:
        raw = gzip.decompress(raw)
    text = raw.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def clean(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def normalize_team(value):
    team = clean(value)
    if not team:
        return None
    team = team.upper()
    return TEAM_ALIASES.get(team, team)


def int_or_none(value):
    try:
        if value is None or str(value).strip() == "":
            return None
        return int(float(value))
    except (TypeError, ValueError):
        return None


def league_vector_id(gsis_id):
    gsis = clean(gsis_id)
    return f"lv:gsis:{gsis}" if gsis else None


def identity_from_row(row: dict) -> dict:
    gsis = clean(row.get("gsis_id"))
    sleeper = clean(row.get("sleeper_id"))
    provider_id = clean(row.get("espn_id") or row.get("gsis_id") or row.get("nfl_id"))
    return {
        "league_vector_player_id": league_vector_id(gsis),
        "gsis_id": gsis,
        "sleeper_id": sleeper,
        "provider_player_id": provider_id,
        "mapping_method": "native_gsis" if gsis else ("native_provider_id" if provider_id else "unresolved"),
        "resolved": bool(gsis),
    }


def normalize_depth(rows: list[dict], season: int) -> tuple[list[dict], str | None, str]:
    season_rows = [r for r in rows if int_or_none(r.get("season")) in (None, season)]
    timestamps = sorted({clean(r.get("dt")) for r in season_rows if clean(r.get("dt"))})
    if not timestamps:
        raise RuntimeError("depth chart source has no dt timestamps for current season")
    latest = timestamps[-1]
    selected = [r for r in season_rows if clean(r.get("dt")) == latest]
    normalized = []
    for r in selected:
        identity = identity_from_row(r)
        provider_team = clean(r.get("team"))
        depth_order = int_or_none(r.get("pos_rank") or r.get("depth"))
        normalized.append({
            "schema_version": SCHEMA_VERSION,
            "evidence_type": "depth_chart",
            "season": season,
            "source_timestamp": latest,
            "team": normalize_team(provider_team),
            "provider_team": provider_team,
            "player_name": clean(r.get("player_name") or r.get("full_name")),
            "position": clean(r.get("pos_grp") or r.get("position")),
            "provider_depth_position": clean(r.get("pos_slot") or r.get("depth_chart_position")),
            "depth_order": depth_order,
            "starter": depth_order == 1 if depth_order else None,
            "roster_status": clean(r.get("status")),
            "identity": identity,
            "provider_native": {k: clean(v) for k, v in r.items()},
        })
    return normalized, latest, "PRE"


def normalize_roster(rows: list[dict], season: int) -> tuple[list[dict], str | None, str]:
    season_rows = [r for r in rows if int_or_none(r.get("season")) in (None, season)]
    if not season_rows:
        raise RuntimeError("weekly roster source has no current-season rows")
    weeks = [int_or_none(r.get("week")) for r in season_rows]
    weeks = [w for w in weeks if w is not None]
    latest_week = max(weeks) if weeks else None
    selected = [r for r in season_rows if latest_week is None or int_or_none(r.get("week")) == latest_week]
    normalized = []
    for r in selected:
        provider_team = clean(r.get("team"))
        normalized.append({
            "schema_version": SCHEMA_VERSION,
            "evidence_type": "roster",
            "season": season,
            "source_week": latest_week,
            "team": normalize_team(provider_team),
            "provider_team": provider_team,
            "player_name": clean(r.get("full_name") or r.get("player_name")),
            "position": clean(r.get("position")),
            "provider_depth_position": clean(r.get("depth_chart_position")),
            "roster_status": clean(r.get("status")),
            "practice_squad": "PRACTICE" in str(r.get("status") or "").upper(),
            "identity": identity_from_row(r),
            "provider_native": {k: clean(v) for k, v in r.items()},
        })
    return normalized, f"week:{latest_week}" if latest_week is not None else None, "PRE"


def stable_identity(row: dict) -> str | None:
    identity = row.get("identity") or {}
    if identity.get("gsis_id"):
        return f"gsis:{identity['gsis_id']}"
    if identity.get("provider_player_id"):
        return f"provider:{identity['provider_player_id']}"
    return None


def quality_report(feed: str, rows: list[dict], source_timestamp: str | None, retrieved_at: dt.datetime) -> dict:
    teams = sorted({r.get("team") for r in rows if r.get("team")})
    ids = [stable_identity(r) for r in rows]
    ids_nonnull = [x for x in ids if x]
    repeated_ids = sorted([key for key, n in Counter(ids_nonnull).items() if n > 1])
    teams_by_identity = defaultdict(set)
    for row in rows:
        key = stable_identity(row)
        if key and row.get("team"):
            teams_by_identity[key].add(row["team"])
    cross_team_conflicts = sorted(key for key, team_set in teams_by_identity.items() if len(team_set) > 1)
    exact_keys = [
        (r.get("team"), stable_identity(r), r.get("provider_depth_position"), r.get("depth_order"), r.get("roster_status"))
        for r in rows
    ]
    exact_duplicates = sum(n - 1 for n in Counter(exact_keys).values() if n > 1)
    resolved = sum(1 for r in rows if (r.get("identity") or {}).get("resolved"))
    missing_depth = sum(1 for r in rows if feed == "depth_chart" and r.get("depth_order") is None)
    missing_roster_status = sum(1 for r in rows if not r.get("roster_status"))
    source_age_hours = None
    if source_timestamp and not source_timestamp.startswith("week:"):
        try:
            parsed = dt.datetime.fromisoformat(source_timestamp.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=dt.timezone.utc)
            source_age_hours = (retrieved_at - parsed.astimezone(dt.timezone.utc)).total_seconds() / 3600
        except ValueError:
            pass
    report = {
        "schema_version": SCHEMA_VERSION,
        "feed": feed,
        "retrieved_at": iso_z(retrieved_at),
        "source_timestamp": source_timestamp,
        "source_age_hours": source_age_hours,
        "row_count": len(rows),
        "team_count": len(teams),
        "teams": teams,
        "missing_teams_count": max(0, EXPECTED_TEAMS - len(teams)),
        "unique_player_identity_count": len(set(ids_nonnull)),
        "resolved_gsis_count": resolved,
        "identity_resolved_pct": resolved / len(rows) if rows else 0,
        "unresolved_identity_count": len(rows) - resolved,
        "repeated_stable_identity_count": len(repeated_ids),
        "repeated_stable_identity_sample": repeated_ids[:25],
        "cross_team_identity_conflict_count": len(cross_team_conflicts),
        "cross_team_identity_conflict_sample": cross_team_conflicts[:25],
        "exact_duplicate_row_count": exact_duplicates,
        "missing_depth_order_count": missing_depth,
        "missing_depth_order_pct": missing_depth / len(rows) if rows else 1,
        "missing_roster_status_count": missing_roster_status,
    }
    failures = []
    if len(teams) != EXPECTED_TEAMS:
        failures.append(f"expected {EXPECTED_TEAMS} NFL teams, found {len(teams)}")
    if len(rows) < 1000:
        failures.append(f"implausibly small {feed} capture: {len(rows)} rows")
    if exact_duplicates:
        failures.append(f"exact duplicate evidence rows: {exact_duplicates}")
    if cross_team_conflicts:
        failures.append(f"stable identities appear on multiple teams in one capture: {len(cross_team_conflicts)}")
    if feed == "depth_chart" and report["missing_depth_order_pct"] > 0.05:
        failures.append(f"missing depth order exceeds 5%: {report['missing_depth_order_pct']:.3%}")
    if any(not r.get("team") for r in rows):
        failures.append("one or more rows are missing team")
    if sum(1 for r in rows if not stable_identity(r)) > max(5, int(0.01 * len(rows))):
        failures.append("more than 1% of rows lack any stable provider/GSIS identity")
    report["structurally_valid"] = not failures
    report["structural_failures"] = failures
    return report


def write_json(path: pathlib.Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        raise RuntimeError(f"immutability violation: refusing to overwrite {path}")
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def write_gzip(path: pathlib.Path, raw: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return
    with path.open("wb") as fh:
        with gzip.GzipFile(filename="", mode="wb", fileobj=fh, mtime=0) as gz:
            gz.write(raw)


def append_manifest(entry: dict) -> None:
    path = ROOT / "manifest.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    line = canonical_json_bytes(entry).decode("utf-8")
    if path.exists():
        existing = path.read_text(encoding="utf-8")
        if f'"snapshot_id":"{entry["snapshot_id"]}"' in existing:
            raise RuntimeError(f"duplicate snapshot_id in manifest: {entry['snapshot_id']}")
    with path.open("a", encoding="utf-8") as fh:
        fh.write(line)


def latest_previous_observation(feed: str, before_snapshot_id: str) -> dict | None:
    path = ROOT / "manifest.jsonl"
    if not path.exists():
        return None
    candidates = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        if item.get("feed") == feed and item.get("snapshot_id") != before_snapshot_id:
            candidates.append(item)
    return sorted(candidates, key=lambda x: x.get("retrieved_at", ""))[-1] if candidates else None


def load_object(entry: dict) -> list[dict]:
    path = pathlib.Path(entry["file_path"])
    with gzip.open(path, "rb") as fh:
        payload = json.loads(fh.read().decode("utf-8"))
    return payload["rows"]


def derive_depth_transitions(previous: list[dict], current: list[dict]) -> list[dict]:
    prev = {stable_identity(r): r for r in previous if stable_identity(r)}
    curr = {stable_identity(r): r for r in current if stable_identity(r)}
    out = []
    for key in sorted(set(prev) | set(curr)):
        a, b = prev.get(key), curr.get(key)
        transition = "STABLE_OR_UNORDERED"
        if a and not b:
            transition = "LEFT_DEPTH_CHART"
        elif b and not a:
            transition = "NEW_TO_DEPTH_CHART"
        elif a and b:
            ar, br = a.get("depth_order"), b.get("depth_order")
            if ar != 1 and br == 1:
                transition = "BACKUP_TO_STARTER"
            elif ar == 1 and br != 1:
                transition = "STARTER_TO_BACKUP"
            elif ar is not None and br is not None and ar != br:
                transition = "ROLE_PROMOTION" if br < ar else "ROLE_DEMOTION"
        out.append({
            "player_key": key,
            "team_from": a.get("team") if a else None,
            "team_to": b.get("team") if b else None,
            "team_changed": bool(a and b and a.get("team") != b.get("team")),
            "previous_depth_position": a.get("provider_depth_position") if a else None,
            "current_depth_position": b.get("provider_depth_position") if b else None,
            "previous_depth_order": a.get("depth_order") if a else None,
            "current_depth_order": b.get("depth_order") if b else None,
            "transition": transition,
        })
    return out


def capture_feed(feed: str, season: int, retrieved_at: dt.datetime, milestone: str | None = None) -> dict:
    cfg = SOURCES[feed]
    source_url = cfg["url"].format(season=season)
    raw = http_get(source_url)
    source_file_hash = sha256(raw)
    rows = parse_csv(raw, gzipped=source_url.endswith(".gz"))
    metadata = release_metadata(cfg["release_api"])
    if feed == "depth_chart":
        normalized, source_timestamp, season_type = normalize_depth(rows, season)
    elif feed == "roster":
        normalized, source_timestamp, season_type = normalize_roster(rows, season)
    else:
        raise RuntimeError(f"unsupported feed {feed}")
    normalized.sort(key=lambda r: (r.get("team") or "", stable_identity(r) or "", r.get("provider_depth_position") or "", r.get("depth_order") or 999))
    quality = quality_report(feed, normalized, source_timestamp, retrieved_at)
    if not quality["structurally_valid"]:
        raise RuntimeError(f"{feed} structural validation failed: {'; '.join(quality['structural_failures'])}")

    content_payload = {
        "schema_version": SCHEMA_VERSION,
        "provider": cfg["provider"],
        "source_dataset": cfg["dataset"],
        "season": season,
        "season_type": season_type,
        "source_timestamp": source_timestamp,
        "rows": normalized,
    }
    content_bytes = canonical_json_bytes(content_payload)
    content_hash = sha256(content_bytes)
    object_path = ROOT / "objects" / feed / content_hash[:2] / f"{content_hash}.json.gz"
    write_gzip(object_path, content_bytes)

    stamp = compact_ts(retrieved_at)
    snapshot_id = f"{season}/{season_type}/{stamp}/{feed}/{cfg['provider']}"
    obs_dir = ROOT / "observations" / str(season) / season_type / stamp
    observation = {
        "schema_version": SCHEMA_VERSION,
        "snapshot_id": snapshot_id,
        "feed": feed,
        "provider": cfg["provider"],
        "source_dataset": cfg["dataset"],
        "source_url": source_url,
        "source_release_api": cfg["release_api"],
        "source_version": metadata.get("updated_at") or metadata.get("published_at"),
        "source_timestamp": source_timestamp,
        "retrieved_at": iso_z(retrieved_at),
        "effective_cutoff_timestamp": iso_z(retrieved_at),
        "season": season,
        "season_type": season_type,
        "week": max([int_or_none(r.get("provider_native", {}).get("week")) or 0 for r in normalized]) or None,
        "milestone": milestone,
        "license_basis": cfg["license_basis"],
        "source_file_sha256": source_file_hash,
        "content_sha256": content_hash,
        "file_path": str(object_path),
        "row_count": quality["row_count"],
        "team_count": quality["team_count"],
        "player_count": quality["unique_player_identity_count"],
        "schema_version_normalized": SCHEMA_VERSION,
        "quality_path": str(obs_dir / f"{feed}.quality.json"),
    }
    prior = latest_previous_observation(feed, snapshot_id)
    observation["content_changed_from_previous"] = prior is None or prior.get("content_sha256") != content_hash
    observation["previous_snapshot_id"] = prior.get("snapshot_id") if prior else None
    write_json(obs_dir / f"{feed}.json", observation)
    write_json(obs_dir / f"{feed}.quality.json", quality)
    append_manifest(observation)

    if feed == "depth_chart" and prior and observation["content_changed_from_previous"]:
        previous_rows = load_object(prior)
        derived = {
            "schema_version": SCHEMA_VERSION,
            "derived_from": [prior["snapshot_id"], snapshot_id],
            "derived_at": iso_z(retrieved_at),
            "features": derive_depth_transitions(previous_rows, normalized),
        }
        derived_bytes = canonical_json_bytes(derived)
        derived_hash = sha256(derived_bytes)
        derived_path = ROOT / "derived" / str(season) / stamp / f"depth-transitions-{derived_hash}.json.gz"
        write_gzip(derived_path, derived_bytes)
        write_json(obs_dir / "depth_chart.derived-link.json", {
            "schema_version": SCHEMA_VERSION,
            "snapshot_id": snapshot_id,
            "derived_transition_sha256": derived_hash,
            "derived_transition_path": str(derived_path),
        })

    return observation


def write_failure(feed: str, retrieved_at: dt.datetime, exc: Exception) -> pathlib.Path:
    stamp = compact_ts(retrieved_at)
    path = ROOT / "failures" / retrieved_at.strftime("%Y") / stamp / f"{feed}.json"
    value = {
        "schema_version": SCHEMA_VERSION,
        "feed": feed,
        "retrieved_at": iso_z(retrieved_at),
        "error_type": type(exc).__name__,
        "error": str(exc),
        "snapshot_fabricated": False,
        "last_good_snapshot_overwritten": False,
    }
    write_json(path, value)
    return path


def should_run_auto(now: dt.datetime) -> bool:
    # Daily during offseason/training camp/preseason; weekly (Tuesday UTC) during Oct-Jan.
    if now.month in (10, 11, 12, 1):
        return now.weekday() == 1
    return True


def self_test() -> None:
    assert normalize_team("AZ") == "ARI"
    assert normalize_team("ARI") == "ARI"
    sample = [
        {"identity": {"gsis_id": "A"}, "team": "X", "provider_depth_position": "QB", "depth_order": 2},
        {"identity": {"gsis_id": "B"}, "team": "Y", "provider_depth_position": "RB", "depth_order": 1},
    ]
    current = [
        {"identity": {"gsis_id": "A"}, "team": "X", "provider_depth_position": "QB", "depth_order": 1},
        {"identity": {"gsis_id": "B"}, "team": "Z", "provider_depth_position": "RB", "depth_order": 2},
    ]
    transitions = {x["player_key"]: x for x in derive_depth_transitions(sample, current)}
    assert transitions["gsis:A"]["transition"] == "BACKUP_TO_STARTER"
    assert transitions["gsis:B"]["transition"] == "STARTER_TO_BACKUP"
    assert transitions["gsis:B"]["team_changed"] is True
    payload = canonical_json_bytes({"b": 2, "a": 1})
    assert payload == b'{"a":1,"b":2}\n'
    assert sha256(payload) == sha256(payload)
    print("prospective opportunity archive self-test: PASS")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", type=int, default=2026)
    parser.add_argument("--feed", action="append", choices=sorted(SOURCES), help="repeatable; defaults to all approved feeds")
    parser.add_argument("--milestone", default=None)
    parser.add_argument("--cadence", choices=["auto", "force"], default="auto")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return 0
    now = utc_now()
    if args.cadence == "auto" and not should_run_auto(now):
        print(json.dumps({"status": "cadence_skip", "retrieved_at": iso_z(now)}, indent=2))
        return 0
    feeds = args.feed or sorted(SOURCES)
    results, failures = [], []
    for feed in feeds:
        try:
            results.append(capture_feed(feed, args.season, now, args.milestone))
        except Exception as exc:
            failures.append({"feed": feed, "failure_path": str(write_failure(feed, now, exc)), "error": str(exc)})
    summary = {"status": "failed" if failures else "ok", "retrieved_at": iso_z(now), "observations": results, "failures": failures}
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
