"""A washing machine's points on the server (spec 2026-11-13): the studio's rule, through one shared file."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.washer import valid_washers, washer_points

CASES = json.loads((Path(__file__).resolve().parents[2] / "frontend/src/lib/__tests__/fixtures/washerPoints.json").read_text(encoding="utf-8"))["cases"]
RECT = CASES[0]["geometry"]


def _metres(g):
    out = {"walls": [{**w, "length": w["length"] / 1000} for w in g["walls"]]}
    if g.get("vertices"):
        out["vertices"] = [[x / 1000, z / 1000] for x, z in g["vertices"]]
    return out


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_washer_points_match_the_studio(case):
    assert washer_points(case["washers"], _metres(case["geometry"])) == case["expected"]


@pytest.mark.parametrize("washers", [None, "x", 7, {}, [1, "x", None, {}, {"id": "m"}, {"id": "m", "wallId": "A"}, {"wallId": "A", "positionMm": 5}]])
def test_bad_data_gives_no_points_and_no_error(washers):
    assert washer_points(washers, _metres(RECT)) == []
    assert valid_washers(washers, _metres(RECT)) == []


def test_no_geometry():
    assert washer_points([{"id": "m", "wallId": "A", "positionMm": 500}], None) == []
