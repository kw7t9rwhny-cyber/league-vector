#!/usr/bin/env python3
import importlib.util
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "prospective-opportunity-archive.py"
spec = importlib.util.spec_from_file_location("prospective_archive", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class ProspectiveArchiveTests(unittest.TestCase):
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

    def test_content_hash_is_deterministic(self):
        a = mod.canonical_json_bytes({"z": 1, "a": [2, 3]})
        b = mod.canonical_json_bytes({"a": [2, 3], "z": 1})
        self.assertEqual(a, b)
        self.assertEqual(mod.sha256(a), mod.sha256(b))

    def test_auto_cadence_weekly_in_regular_window(self):
        import datetime as dt
        tuesday = dt.datetime(2026, 10, 6, tzinfo=dt.timezone.utc)
        wednesday = dt.datetime(2026, 10, 7, tzinfo=dt.timezone.utc)
        august = dt.datetime(2026, 8, 14, tzinfo=dt.timezone.utc)
        self.assertTrue(mod.should_run_auto(tuesday))
        self.assertFalse(mod.should_run_auto(wednesday))
        self.assertTrue(mod.should_run_auto(august))


if __name__ == "__main__":
    unittest.main()
