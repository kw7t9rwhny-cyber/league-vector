#!/usr/bin/env python3
import datetime as dt
import importlib.util
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "prospective-opportunity-archive.py"
spec = importlib.util.spec_from_file_location("prospective_archive", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
RUNNER = ROOT / "scripts" / "run-prospective-opportunity-archive.py"
runner_spec = importlib.util.spec_from_file_location("prospective_archive_runner", RUNNER)
runner = importlib.util.module_from_spec(runner_spec)
runner_spec.loader.exec_module(runner)


class ProspectiveArchiveTests(unittest.TestCase):
    def test_team_aliases_are_canonical(self):
        self.assertEqual(mod.normalize_team("AZ"), "ARI")
        self.assertEqual(mod.normalize_team("ARI"), "ARI")
        self.assertEqual(mod.normalize_team("WSH"), "WAS")

    def test_transition_semantics(self):
        previous = [
            {"identity": {"gsis_id": "A"}, "team": "GB", "provider_depth_position": "QB", "depth_order": 2},
            {"identity": {"gsis_id": "B"}, "team": "GB", "provider_depth_position": "RB", "depth_order": 1},
        ]
        current = [
            {"identity": {"gsis_id": "A"}, "team": "GB", "provider_depth_position": "QB", "depth_order": 1},
            {"identity": {"gsis_id": "B"}, "team": "CHI", "provider_depth_position": "RB", "depth_order": 2},
        ]
        rows = {row["player_key"]: row for row in mod.derive_depth_transitions(previous, current)}
        self.assertEqual(rows["gsis:A"]["transition"], "BACKUP_TO_STARTER")
        self.assertEqual(rows["gsis:B"]["transition"], "STARTER_TO_BACKUP")
        self.assertTrue(rows["gsis:B"]["team_changed"])

    def test_identity_is_fail_closed_without_gsis(self):
        row = {"espn_id": "123", "player_name": "Example"}
        identity = mod.identity_from_row(row)
        self.assertFalse(identity["resolved"])
        self.assertIsNone(identity["league_vector_player_id"])
        self.assertEqual(identity["provider_player_id"], "123")

    def test_cross_team_identity_conflict_fails_closed(self):
        rows = []
        for i in range(1000):
            rows.append({
                "identity": {"gsis_id": "A" if i < 2 else f"G{i}", "resolved": True},
                "team": "GB" if i != 1 else "CHI",
                "provider_depth_position": "QB",
                "depth_order": 1,
                "roster_status": "ACT",
            })
        report = mod.quality_report("roster", rows, "week:1", dt.datetime(2026, 8, 14, tzinfo=dt.timezone.utc))
        self.assertFalse(report["structurally_valid"])
        self.assertGreater(report["cross_team_identity_conflict_count"], 0)

    def test_content_hash_is_deterministic(self):
        a = mod.canonical_json_bytes({"z": 1, "a": [2, 3]})
        b = mod.canonical_json_bytes({"a": [2, 3], "z": 1})
        self.assertEqual(a, b)
        self.assertEqual(mod.sha256(a), mod.sha256(b))

    def test_auto_cadence_weekly_in_regular_window(self):
        tuesday = dt.datetime(2026, 10, 6, tzinfo=dt.timezone.utc)
        wednesday = dt.datetime(2026, 10, 7, tzinfo=dt.timezone.utc)
        august = dt.datetime(2026, 8, 14, tzinfo=dt.timezone.utc)
        self.assertTrue(mod.should_run_auto(tuesday))
        self.assertFalse(mod.should_run_auto(wednesday))
        self.assertTrue(mod.should_run_auto(august))

    def test_explicit_2026_season_phase(self):
        self.assertEqual(runner.season_type_at(dt.datetime(2026, 8, 14, tzinfo=dt.timezone.utc), 2026), "PRE")
        self.assertEqual(runner.season_type_at(dt.datetime(2026, 9, 10, 0, 20, tzinfo=dt.timezone.utc), 2026), "REG")
        with self.assertRaisesRegex(RuntimeError, "regular-season archive window ended"):
            runner.season_type_at(dt.datetime(2027, 1, 15, tzinfo=dt.timezone.utc), 2026)
        with self.assertRaisesRegex(RuntimeError, "season phase not configured"):
            runner.season_type_at(dt.datetime(2027, 8, 1, tzinfo=dt.timezone.utc), 2027)

    def test_observation_write_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as td:
            path = pathlib.Path(td) / "observation.json"
            mod.write_json(path, {"snapshot_id": "first"})
            with self.assertRaisesRegex(RuntimeError, "immutability violation"):
                mod.write_json(path, {"snapshot_id": "replacement"})
            self.assertIn('"first"', path.read_text())

    def test_structural_quality_fails_closed_on_incomplete_league(self):
        now = dt.datetime(2026, 8, 14, 18, 0, tzinfo=dt.timezone.utc)
        rows = []
        for i in range(1000):
            rows.append({
                "team": f"T{i % 31:02d}",
                "provider_depth_position": "WR",
                "depth_order": 1,
                "roster_status": "ACT",
                "identity": {"gsis_id": f"G{i}", "provider_player_id": f"P{i}", "resolved": True},
            })
        report = mod.quality_report("depth_chart", rows, "2026-08-14T08:00:00Z", now)
        self.assertFalse(report["structurally_valid"])
        self.assertTrue(any("expected 32 NFL teams" in item for item in report["structural_failures"]))


if __name__ == "__main__":
    unittest.main()
