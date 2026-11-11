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


def test_valid_rails_keeps_only_rails_on_walls_the_room_has():
    rails = [{"id": "r1", "wallId": "A", "positionMm": 600, "heightMm": 1000}, {"id": "r2", "wallId": "Q", "positionMm": 600, "heightMm": 1000}]
    assert [r["id"] for r in valid_rails(rails, _metres(RECT))] == ["r1"]


# ─── One rule with the studio for what counts as a rail (review minor M3) ────

@pytest.mark.parametrize("rail", [
    {"id": "r", "wallId": "A", "positionMm": 1000},                       # no height
    {"id": "r", "wallId": "A", "positionMm": 1000, "heightMm": "high"},   # a height that is no number
    {"id": "r", "wallId": 0, "positionMm": 1000, "heightMm": 1000},       # a wall id that is no string
    {"id": 7, "wallId": "A", "positionMm": 1000, "heightMm": 1000},       # an id that is no string
    {"id": "r", "wallId": "A", "positionMm": float("nan"), "heightMm": 1000},
])
def test_a_rail_the_studio_would_drop_on_load_is_not_priced_either(rail):
    """frontend lib/towelRail saneRails drops these; the estimate used to price them anyway."""
    assert valid_rails([rail], _metres(RECT)) == []
    assert rail_points([rail], _metres(RECT)) == []
