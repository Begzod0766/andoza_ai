"""A kitchen backsplash's pieces on the server (spec 2026-11-14): the studio's rule, through one shared
file; and the room's walls in the studio's form, whichever form the room keeps them in."""
from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services.backsplash import backsplash_area_m2, backsplash_pieces, studio_walls, valid_backsplashes

CASES = json.loads((Path(__file__).resolve().parents[2] / "frontend/src/lib/__tests__/fixtures/backsplashPieces.json").read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_pieces_match_the_studio(case):
    pieces = backsplash_pieces(case["b"], case["walls"], case["ceilingMm"])
    assert [list(p) for p in pieces] == case["expected"]
    assert backsplash_area_m2(pieces) == pytest.approx(case["areaM2"])


def test_valid_backsplashes_keeps_sound_ones_only():
    good = {"id": "a", "wallId": "A", "material": "skinali", "startMm": 0, "lengthMm": 1000, "bottomMm": 850, "topMm": 1450, "color": "#FFFFFF"}
    bad = [None, 3, {**good, "id": ""}, {**good, "material": "mdf"}, {**good, "lengthMm": float("nan")}, {**good, "wallId": 3}, {**good, "topMm": True}]
    assert valid_backsplashes([good, *bad]) == [good]
    assert valid_backsplashes("x") == [] and valid_backsplashes(None) == []


def test_the_studio_form_is_used_as_saved():
    walls = [{"id": "A", "length": 2500, "elements": [{"type": "deraza", "position": 600, "width": 600, "height": 1200, "sill_height": 900}]}]
    r = SimpleNamespace(geometry={"walls": [{"id": "A", "length": 9.9, "elements": []}]}, state={"geometry": {"walls": walls}})
    assert studio_walls(r) == walls


def test_a_room_in_metres_reads_as_the_studio_draws_it():
    # The row's form: lengths in metres, an opening's middle as a 0-1 fraction, its width and heights in metres.
    row = {"walls": [{"id": "A", "length": 2.5, "elements": [
        {"type": "deraza", "position": 0.36, "width": 0.6, "height": 1.2, "sill_height": 0.9},
    ]}]}
    walls = studio_walls(SimpleNamespace(geometry=row, state={}))
    case = next(c for c in CASES if c["name"].startswith("window"))
    pieces = backsplash_pieces(case["b"], walls, 2700)
    assert [list(map(round, p)) for p in pieces] == case["expected"]
