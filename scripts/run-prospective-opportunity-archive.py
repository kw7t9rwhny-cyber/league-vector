#!/usr/bin/env python3
"""Run the prospective archive with an explicit 2026 NFL season-phase contract.

The underlying collector intentionally does not infer season type from hindsight. This
runner supplies the approved 2026 boundary and fails closed after the configured
regular-season archive window instead of silently labeling postseason/offseason data.
"""
from __future__ import annotations

import datetime as dt
import importlib.util
import pathlib

COLLECTOR = pathlib.Path(__file__).resolve().with_name("prospective-opportunity-archive.py")
spec = importlib.util.spec_from_file_location("lv_prospective_archive", COLLECTOR)
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)

REGULAR_SEASON_START_UTC = dt.datetime(2026, 9, 10, 0, 20, tzinfo=dt.timezone.utc)
REGULAR_ARCHIVE_END_UTC = dt.datetime(2027, 1, 14, 12, 0, tzinfo=dt.timezone.utc)


def season_type_at(when: dt.datetime, season: int) -> str:
    when = when.astimezone(dt.timezone.utc)
    if season != 2026:
        raise RuntimeError(f"season phase not configured for NFL season {season}; fail closed until an approved calendar is added")
    if when < REGULAR_SEASON_START_UTC:
        return "PRE"
    if when < REGULAR_ARCHIVE_END_UTC:
        return "REG"
    raise RuntimeError("2026 regular-season archive window ended; configure the next approved season/postseason boundary before capture")


_original_depth = archive.normalize_depth
_original_roster = archive.normalize_roster


def _depth_with_phase(rows, season):
    normalized, source_timestamp, _ = _original_depth(rows, season)
    return normalized, source_timestamp, season_type_at(archive.utc_now(), season)


def _roster_with_phase(rows, season):
    normalized, source_timestamp, _ = _original_roster(rows, season)
    return normalized, source_timestamp, season_type_at(archive.utc_now(), season)


archive.normalize_depth = _depth_with_phase
archive.normalize_roster = _roster_with_phase


if __name__ == "__main__":
    raise SystemExit(archive.main())
