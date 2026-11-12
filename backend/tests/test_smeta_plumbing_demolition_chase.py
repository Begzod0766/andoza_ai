"""Taking the old plumbing out, and chasing the walls for the new pipes (2026-11-13).

Two switches in the Santexnika panel, read from ``designState``: ``plumbingDemolition`` (off unless
exactly true) and ``pipesInWall`` (on unless exactly false). The chase is as long as the room's pipe
scheme: the water trunk and its branches, and the Ø50 drain's branches (the drain trunk and the Ø110
way run in the floor).
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services.pipe_scheme import pipe_scheme
from app.services.plumbing import riser_spot
from app.services.smeta import _plumbing_lines, _round2
from app.services.smeta_text import localize_formula, localize_label

GEOMETRY = {"walls": [
    {"id": "A", "length": 2.5, "elements": []}, {"id": "B", "length": 2.0, "elements": []},
    {"id": "C", "length": 2.5, "elements": []},
    {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "position": 0.5}]},
]}
POINTS = [
    {"id": "s:drain", "kind": "drain", "diameterMm": 50, "wallId": "A", "positionMm": 1200, "heightMm": 500, "fixtureId": "s"},
    {"id": "s:cold", "kind": "cold", "diameterMm": 20, "wallId": "A", "positionMm": 1100, "heightMm": 550, "fixtureId": "s"},
    {"id": "s:hot", "kind": "hot", "diameterMm": 20, "wallId": "A", "positionMm": 1300, "heightMm": 550, "fixtureId": "s"},
    {"id": "t:drain", "kind": "drain", "diameterMm": 110, "wallId": "B", "positionMm": 600, "heightMm": 200, "fixtureId": "t"},
    {"id": "t:cold", "kind": "cold", "diameterMm": 20, "wallId": "B", "positionMm": 800, "heightMm": 150, "fixtureId": "t"},
]
FURNITURE = [
    {"id": "s", "furniture_id": "slug-rak", "name": "Rakovina 3", "x": 0, "y": 0, "rotation": 0},
    {"id": "t", "furniture_id": "slug-uni", "name": "Unitaz kompakt", "x": 0, "y": 0, "rotation": 0},
    {"id": "v", "furniture_id": "slug-van", "name": "Vanna 1", "x": 0, "y": 0, "rotation": 0},
]
OLD_FIXTURES = "Ish: eski santexnikani demontaj qilish"
OLD_PIPES = "Ish: eski quvurlarni demontaj qilish"
CHASE_WATER = "Ish: shtroba (suv quvuri)"
CHASE_DRAIN = "Ish: shtroba (kanalizatsiya Ø50)"
NEW = (OLD_FIXTURES, OLD_PIPES, CHASE_WATER, CHASE_DRAIN)


def room(design: dict | None = None, furniture=FURNITURE, plumbing=POINTS):
    state = {"furniture": list(furniture), "plumbing": list(plumbing)}
    if design is not None:
        state["designState"] = design
    return SimpleNamespace(state=state, geometry=GEOMETRY, room_type="hammom", name="Hammom")


def got(r) -> dict:
    return {ln.label: ln for ln in _plumbing_lines(r, {}) if ln.label in NEW}


def scheme():
    return pipe_scheme(GEOMETRY, riser_spot(GEOMETRY, None), POINTS)["pipes"]


# ─── Old plumbing out ─────────────────────────────────────────────────────────

def test_no_demolition_unless_switched_on():
    for design in (None, {}, {"plumbingDemolition": False}, {"plumbingDemolition": "yes"}):
        lines = got(room(design))
        assert OLD_FIXTURES not in lines and OLD_PIPES not in lines


def test_switched_on_each_fixture_is_taken_out_at_its_own_price_and_the_old_pipes_once():
    lines = got(room({"plumbingDemolition": True}))
    fixtures = lines[OLD_FIXTURES]
    assert (fixtures.qty, fixtures.unit, fixtures.unit_price_uzs) == (1, "komplekt", 200_000 + 100_000 + 80_000)
    assert fixtures.formula == "1 vanna × 200 000 + 1 rakovina × 80 000 + 1 unitaz × 100 000 = 380 000 so'm"
    pipes = lines[OLD_PIPES]
    assert (pipes.qty, pipes.unit, pipes.unit_price_uzs) == (1, "komplekt", 150_000)
    assert fixtures.category == pipes.category == "santexnika"


def test_a_room_with_no_fixtures_has_nothing_to_take_out():
    assert got(room({"plumbingDemolition": True}, furniture=[], plumbing=[])) == {}


# ─── Chasing the walls ────────────────────────────────────────────────────────

def test_the_chase_is_on_unless_switched_off_and_as_long_as_the_scheme():
    p = scheme()
    for design in (None, {}, {"pipesInWall": True}):
        lines = got(room(design))
        water = lines[CHASE_WATER]
        w_mm = p["water_20"]["trunkMm"] + p["water_20"]["branchMm"]
        assert (water.qty, water.unit, water.unit_price_uzs) == (_round2(w_mm / 1000), "m", 35_000)
        assert water.formula == (f"Magistral {p['water_20']['trunkMm'] / 1000:.2f} m + tik bo'laklar "
                                 f"{p['water_20']['branchMm'] / 1000:.2f} m = {w_mm / 1000:.2f} m × 35 000 so'm")
        drain = lines[CHASE_DRAIN]
        d_mm = p["drain_50"]["branchMm"]
        assert (drain.qty, drain.unit, drain.unit_price_uzs) == (_round2(d_mm / 1000), "m", 60_000)
        assert drain.formula == f"Tik bo'laklar {d_mm / 1000:.2f} m × 60 000 so'm"


def test_switched_off_no_chase():
    lines = got(room({"pipesInWall": False}))
    assert CHASE_WATER not in lines and CHASE_DRAIN not in lines


def test_no_points_no_chase():
    assert got(room(None, furniture=[], plumbing=[])) == {}


def test_no_ø50_branches_no_drain_chase():
    only_water = [p for p in POINTS if p["kind"] != "drain"]
    lines = got(room(None, plumbing=only_water))
    assert CHASE_WATER in lines and CHASE_DRAIN not in lines


# ─── Text ─────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("label", NEW)
def test_every_new_label_reads_in_russian_and_english(label):
    assert localize_label(label, "ru") != label
    assert localize_label(label, "en") != label


@pytest.mark.parametrize("formula,ru,en", [
    ("1 vanna × 200 000 + 1 rakovina × 80 000 + 1 unitaz × 100 000 = 380 000 so'm",
     "1 ванна × 200 000 + 1 раковина × 80 000 + 1 унитаз × 100 000 = 380 000 сум",
     "1 bathtub × 200 000 + 1 sink × 80 000 + 1 toilet × 100 000 = 380 000 UZS"),
    ("Tik bo'laklar 1.20 m × 60 000 so'm", "Отводы 1.20 м × 60 000 сум", "Branches 1.20 m × 60 000 UZS"),
])
def test_the_formulas_read_in_russian_and_english(formula, ru, en):
    assert localize_formula(formula, "ru") == ru
    assert localize_formula(formula, "en") == en
