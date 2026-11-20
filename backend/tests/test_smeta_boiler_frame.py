"""A wall-hung toilet's frame, and a water heater (2026-11-13).

A toilet whose name says it hangs on the wall (osma / подвесн / wall-hung / installyats) takes a
frame and its fitting work, in place of a pan connector and a hose (those come in the frame). A water
heater is a switch in the Santexnika panel (``designState.waterHeater``, off unless exactly true): the
heater, its connection kit, a cable and the work.
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.smeta import ELEC_CABLE_PRICE_UZS, EXTRAS_NORM_NOTE, _plumbing_lines
from app.services.smeta_keys import ALL_SMETA_KEYS, KEY_SALE_UNIT
from app.services.smeta_text import localize_label

GEOMETRY = {"walls": [
    {"id": "A", "length": 2.5, "elements": []}, {"id": "B", "length": 2.0, "elements": []},
    {"id": "C", "length": 2.5, "elements": []},
    {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "position": 0.5}]},
]}
FRAME = "Installyatsiya (osma unitaz uchun)"
WORK_FRAME = "Ish: installyatsiya o'rnatish"
HEATER = "Suv isitgich (boyler)"
KIT = "Boyler ulash to'plami"
CABLE = "Elektr kabel (boyler)"
WORK_HEATER = "Ish: boyler o'rnatish"
GOFRA = "Unitaz gofrasi"
HOSE = "Ulash shlangi (podvodka)"
NEW = (FRAME, WORK_FRAME, HEATER, KIT, CABLE, WORK_HEATER)


def piece(name: str, i: int = 0) -> dict:
    return {"id": f"f{i}", "furniture_id": f"slug-{i}", "name": name, "x": 0, "y": 0, "rotation": 0}


def room(*names: str, design: dict | None = None, room_type: str = "hammom"):
    state = {"furniture": [piece(n, i) for i, n in enumerate(names)], "plumbing": []}
    if design is not None:
        state["designState"] = design
    return SimpleNamespace(state=state, geometry=GEOMETRY, room_type=room_type, name="Hammom")


def base(label: str) -> str:
    return label if label in (*NEW, GOFRA, HOSE) else label.split(":")[0]


def lines(r, catalog=None) -> dict:
    return {base(ln.label): ln for ln in _plumbing_lines(r, catalog or {})}


# ─── The frame ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("name", [
    "Osma unitaz Geberit", "Подвесной унитаз GEBERIT Acanto", "Wall-hung toilet", "Unitaz installyatsiya bilan",
])
def test_a_wall_hung_toilet_takes_a_frame_and_its_work_not_a_connector_or_hose(name):
    got = lines(room(name))
    assert got[FRAME].qty == 1 and got[FRAME].unit == "dona"
    assert (got[FRAME].unit_price_uzs, got[FRAME].is_approximate, got[FRAME].warning) == (2_000_000, True, EXTRAS_NORM_NOTE)
    assert got[FRAME].formula == "1 unitaz = 1 dona × 2 000 000 so'm"
    assert (got[WORK_FRAME].qty, got[WORK_FRAME].unit_price_uzs) == (1, 400_000)
    assert GOFRA not in got and HOSE not in got


def test_a_floor_toilet_is_as_before():
    got = lines(room("Unitaz kompakt"))
    assert FRAME not in got and WORK_FRAME not in got
    assert got[GOFRA].qty == 1 and got[HOSE].qty == 1


def test_two_wall_hung_and_one_floor_toilet():
    got = lines(room("Osma unitaz", "Osma unitaz", "Unitaz kompakt"))
    assert got[FRAME].qty == 2 and got[WORK_FRAME].qty == 2
    assert got[GOFRA].qty == 1 and got[HOSE].qty == 1


def test_a_tagged_shop_frame_gives_its_price():
    shop = SimpleNamespace(id=uuid.uuid4(), name_uz="Geberit Duofix", unit="dona", price_uzs=3_100_000, pack_qty=None, pack_unit=None,
                           smeta_key="installyatsiya", is_active=True, store=SimpleNamespace(name="Santex Pro"))
    by = {ln.label: ln for ln in _plumbing_lines(room("Osma unitaz"), {"installyatsiya": shop})}
    line = by[f"{FRAME}: Geberit Duofix"]
    assert (line.unit_price_uzs, line.is_approximate) == (3_100_000, False)


# ─── The water heater ─────────────────────────────────────────────────────────

def test_no_water_heater_unless_switched_on():
    for design in (None, {}, {"waterHeater": False}, {"waterHeater": "yes"}):
        got = lines(room("Rakovina 3", design=design))
        assert not {HEATER, KIT, CABLE, WORK_HEATER} & set(got)


def test_switched_on_the_heater_its_kit_cable_and_work():
    got = lines(room("Rakovina 3", design={"waterHeater": True}))
    assert (got[HEATER].qty, got[HEATER].unit, got[HEATER].unit_price_uzs, got[HEATER].is_approximate) == (1, "dona", 1_800_000, True)
    assert (got[KIT].qty, got[KIT].unit, got[KIT].unit_price_uzs) == (1, "komplekt", 120_000)
    assert (got[CABLE].qty, got[CABLE].unit, got[CABLE].unit_price_uzs) == (5, "m", ELEC_CABLE_PRICE_UZS)
    assert (got[WORK_HEATER].qty, got[WORK_HEATER].unit_price_uzs) == (1, 250_000)
    assert {got[k].category for k in (HEATER, KIT, CABLE, WORK_HEATER)} == {"santexnika"}


def test_a_heater_in_a_room_with_no_fixtures_still_counts():
    got = lines(room(design={"waterHeater": True}))
    assert HEATER in got and WORK_HEATER in got


def test_a_tagged_shop_heater_and_cable_give_their_prices():
    heater = SimpleNamespace(id=uuid.uuid4(), name_uz="Ariston ABS 80", unit="dona", price_uzs=2_400_000, pack_qty=None, pack_unit=None,
                             smeta_key="boyler", is_active=True, store=SimpleNamespace(name="Texnomart"))
    cable = SimpleNamespace(id=uuid.uuid4(), name_uz="VVG 3x2.5", unit="m", price_uzs=14_000, pack_qty=None, pack_unit=None,
                            smeta_key="kabel", is_active=True, store=SimpleNamespace(name="Elektro"))
    by = {ln.label: ln for ln in _plumbing_lines(room(design={"waterHeater": True}), {"boyler": heater, "kabel": cable})}
    assert by[f"{HEATER}: Ariston ABS 80"].unit_price_uzs == 2_400_000
    assert by[CABLE].unit_price_uzs == 14_000


# ─── Keys and text ────────────────────────────────────────────────────────────

def test_the_new_keys_are_sold_by_the_piece():
    for key in ("installyatsiya", "boyler"):
        assert key in ALL_SMETA_KEYS and KEY_SALE_UNIT[key] == "dona"


@pytest.mark.parametrize("label", NEW)
def test_every_new_label_reads_in_russian_and_english(label):
    assert localize_label(label, "ru") != label
    assert localize_label(label, "en") != label
