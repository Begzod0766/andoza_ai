"""Plumbing pipe runs and norms for the estimate (spec 2026-11-08).

The run cases are the frontend's own (frontend/src/lib/__tests__/fixtures/plumbingRuns.json), so the
studio's summary and the estimate give the same metres. The fixture stores wall lengths in mm, the
studio's units; saved room geometry is in metres, so they are converted here.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.plumbing import load_plumbing_norms, pipe_run_m, riser_spot

FIXTURE = Path(__file__).resolve().parents[2] / "frontend/src/lib/__tests__/fixtures/plumbingRuns.json"
CASES = json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]


def _geometry(walls, door=None):
    return {"walls": [
        {"id": w["id"], "length": w["length"] / 1000, "elements": ([{"type": "eshik", "width": 0.7, "position": 0.5}] if w["id"] == door else [])}
        for w in walls
    ]}


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_pipe_run_matches_the_studio(case):
    riser = (case["riser"]["wallId"], case["riser"]["positionMm"])
    assert pipe_run_m(_geometry(case["walls"]), case["from"], riser) == pytest.approx(case["expectedM"], abs=0.01)


def test_riser_falls_back_to_the_door_wall_then_the_first_wall():
    walls = CASES[0]["walls"]
    assert riser_spot(_geometry(walls, door="D"), None) == ("D", 0.0)
    assert riser_spot(_geometry(walls), None) == ("A", 0.0)
    assert riser_spot({"walls": []}, None) == ("A", 0.0)


def test_norms_have_every_price():
    n = load_plumbing_norms()
    assert set(n["pipe_m_uzs"]) == {"drain_50", "drain_110", "water_20"}
    assert set(n["fitting_uzs"]) == {"tee_20", "elbow_20", "outlet_20", "valve_20", "tee_50", "elbow_50", "tee_110_50", "elbow_110"}
    assert all(v > 0 for v in n["fitting_uzs"].values()) and n["work_point_uzs"] > 0
    assert "fitting_set_uzs" not in n  # the set per point went with the pipe scheme (2026-11-11)
    assert set(n["work_fixture_uzs"]) == {"bathtub", "sink", "toilet", "shower", "bidet"}


# ─── Fixture points derived on the server (a room that never saved any) ──────

POINT_CASES = json.loads((FIXTURE.parent / "fixturePoints.json").read_text(encoding="utf-8"))["cases"]


def _metres(g):
    out = {"walls": [{**w, "length": w["length"] / 1000} for w in g["walls"]]}
    if g.get("vertices"):
        out["vertices"] = [[x / 1000, z / 1000] for x, z in g["vertices"]]
    return out


@pytest.mark.parametrize("case", POINT_CASES, ids=[c["name"] for c in POINT_CASES])
def test_fixture_points_match_the_studio(case):
    from app.services.plumbing import fixture_points
    assert fixture_points(case["fixture"], case["role"], case["depthM"], _metres(case["geometry"])) == case["expected"]


def test_a_piece_that_is_not_a_fixture_brings_no_points():
    from app.services.plumbing import fixture_points
    case = POINT_CASES[0]
    assert fixture_points(case["fixture"], "sofa", 0.9, _metres(case["geometry"])) == []
