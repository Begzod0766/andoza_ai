"""A towel rail's points on the server (spec 2026-11-10): the studio's rule, through one shared file."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.towel_rail import rail_points, valid_rails

CASES = json.loads((Path(__file__).resolve().parents[2] / "frontend/src/lib/__tests__/fixtures/towelRailPoints.json").read_text(encoding="utf-8"))["cases"]
RECT = CASES[0]["geometry"]


def _metres(g):
    out = {"walls": [{**w, "length": w["length"] / 1000} for w in g["walls"]]}
    if g.get("vertices"):
        out["vertices"] = [[x / 1000, z / 1000] for x, z in g["vertices"]]
    return out


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_rail_points_match_the_studio(case):
    assert rail_points(case["rails"], _metres(case["geometry"])) == case["expected"]


@pytest.mark.parametrize("rails", [None, "x", 7, {}, [1, "x", None, {}, {"id": "r"}, {"id": "r", "wallId": "A"}, {"wallId": "A", "positionMm": 5}]])
def test_bad_data_gives_no_points_and_no_error(rails):
    assert rail_points(rails, _metres(RECT)) == []
    assert valid_rails(rails, _metres(RECT)) == []


def test_a_room_with_no_geometry():
    assert rail_points([{"id": "r", "wallId": "A", "positionMm": 500, "heightMm": 1000}], None) == []


def test_a_missing_or_bad_height_reads_as_the_usual_one():
    got = rail_points([{"id": "r", "wallId": "A", "positionMm": 1000, "heightMm": "high"}, {"id": "q", "wallId": "A", "positionMm": 1000}], _metres(RECT))
    assert [p["heightMm"] for p in got] == [1000] * 4


def test_valid_rails_keeps_only_rails_on_walls_the_room_has():
    rails = [{"id": "r1", "wallId": "A", "positionMm": 600, "heightMm": 1000}, {"id": "r2", "wallId": "Q", "positionMm": 600, "heightMm": 1000}]
    assert [r["id"] for r in valid_rails(rails, _metres(RECT))] == ["r1"]
