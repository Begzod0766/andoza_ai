"""The pipe scheme on the server (spec 2026-11-11): the studio's rule, through one shared file."""
from __future__ import annotations

import copy
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services.pipe_scheme import EMPTY_SCHEME, build_scheme, pipe_scheme, scheme_input

CASES = json.loads((Path(__file__).resolve().parents[2] / "frontend/src/lib/__tests__/fixtures/pipeScheme.json").read_text(encoding="utf-8"))["cases"]
BY_NAME = {c["name"]: c for c in CASES}


def _metres(g):
    """The studio's geometry (mm; an element's position its left edge from the wall's own start) as a
    room row holds it (metres; an element's position the 0–1 fraction of its middle)."""
    def wall(w):
        length = w["length"]
        els = [{**e, "position": (e["position"] + e["width"] / 2) / length, "width": e["width"] / 1000} for e in w.get("elements") or []]
        return {**w, "length": length / 1000, "elements": els}

    out = {"walls": [wall(w) for w in g["walls"]]}
    if g.get("vertices"):
        out["vertices"] = [[x / 1000, z / 1000] for x, z in g["vertices"]]
    return out


def _riser(case):
    return (case["riser"]["wallId"], case["riser"]["positionMm"])


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_the_input_matches_the_studio(case):
    assert scheme_input(_metres(case["geometry"]), _riser(case), case["points"]) == case["input"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_the_scheme_matches_the_studio(case):
    assert build_scheme(case["input"]) == case["expected"]
    assert pipe_scheme(_metres(case["geometry"]), _riser(case), case["points"]) == case["expected"]


def test_no_room_and_no_points_give_the_empty_scheme():
    assert pipe_scheme(None, ("A", 0), []) == EMPTY_SCHEME
    case = CASES[0]
    assert pipe_scheme(_metres(case["geometry"]), _riser(case), []) == EMPTY_SCHEME
    assert pipe_scheme({"walls": []}, ("A", 0), case["points"]) == EMPTY_SCHEME


@pytest.mark.parametrize("bad", [None, "x", 7, {}, {"kind": "cold"}, {"wallId": "A"}, {"kind": "steam", "wallId": "A", "positionMm": 5, "heightMm": 5},
                                 {"kind": "cold", "wallId": "A", "positionMm": "far", "heightMm": 5}, {"kind": "cold", "wallId": "A", "positionMm": 5, "heightMm": None}])
def test_bad_points_are_skipped_without_error(bad):
    case = CASES[0]
    got = pipe_scheme(_metres(case["geometry"]), _riser(case), [bad, *case["points"]])
    assert got == case["expected"]


def test_the_empty_scheme_is_not_changed_by_use():
    before = copy.deepcopy(EMPTY_SCHEME)
    s = pipe_scheme(None, ("A", 0), [])
    s["fittings"]["tee_20"] = 99
    s["lines"].append({})
    assert EMPTY_SCHEME == before


# ─── A room priced from the studio's saved geometry (no geometry on the row) ─────

def test_the_saved_state_geometry_gives_the_same_scheme_as_the_row_geometry():
    from app.services.smeta import _plumbing_geometry

    for name in ("one door on D, two cold points (the hand-worked case)", "L-shaped polygon, door on wall 5", "two doors: the largest door gap is the cut, the other is crossed"):
        case = BY_NAME[name]
        from_state = _plumbing_geometry(SimpleNamespace(geometry=None, state={"geometry": case["geometry"]}))
        from_row = _plumbing_geometry(SimpleNamespace(geometry=_metres(case["geometry"]), state={}))
        assert pipe_scheme(from_state, _riser(case), case["points"]) == pipe_scheme(from_row, _riser(case), case["points"]) == case["expected"], name


def test_the_saved_state_geometry_keeps_a_door_width_in_metres():
    from app.services.smeta import _plumbing_geometry

    case = BY_NAME["one door on D, two cold points (the hand-worked case)"]
    g = _plumbing_geometry(SimpleNamespace(geometry=None, state={"geometry": case["geometry"]}))
    door = g["walls"][3]["elements"][0]
    assert door["width"] == pytest.approx(0.7)
    assert door["position"] == pytest.approx(0.5)
