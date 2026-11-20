"""A washing machine in the estimate (spec 2026-11-13): its tap, its trap and its connection, and its two
points in the pipe scheme. The machine itself is not priced."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.services.smeta import EXTRAS_NORM_NOTE, _plumbing_lines
from app.services.smeta_keys import ALL_SMETA_KEYS, KEY_SALE_UNIT
from app.services.smeta_text import localize_formula, localize_label
from app.services.washer import washer_points

GEOMETRY = {"walls": [
    {"id": "A", "length": 2.5, "elements": []}, {"id": "B", "length": 2.0, "elements": []},
    {"id": "C", "length": 2.5, "elements": []},
    {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "position": 0.5}]},
]}
COLD = {"id": "p1", "kind": "cold", "diameterMm": 20, "wallId": "B", "positionMm": 1000, "heightMm": 500}
M1 = {"id": "m1", "wallId": "A", "positionMm": 800}
M2 = {"id": "m2", "wallId": "C", "positionMm": 1200}
TAP, TRAP, WORK = "Kir yuvish mashinasi krani", "Kir yuvish mashinasi sifoni", "Ish: kir yuvish mashinasini ulash"
NO_KEY = object()


def room(washers=NO_KEY, plumbing=(COLD,)):
    state: dict = {"furniture": [], "plumbing": list(plumbing)}
    if washers is not NO_KEY:
        state["washers"] = washers
    return SimpleNamespace(state=state, geometry=GEOMETRY, room_type="hammom", name="Hammom")


def lines(r, catalog=None) -> dict:
    out = {}
    for ln in _plumbing_lines(r, catalog or {}):
        out[ln.label if ln.label in (TAP, TRAP, WORK) or ln.label.startswith("Ish:") else ln.label.split(":")[0]] = ln
    return out


def test_one_machine_brings_its_tap_trap_and_connection():
    got = lines(room([M1]))
    assert (got[TAP].qty, got[TAP].unit_price_uzs, got[TAP].is_approximate, got[TAP].warning) == (1, 60_000, True, EXTRAS_NORM_NOTE)
    assert (got[TRAP].qty, got[TRAP].unit_price_uzs) == (1, 70_000)
    assert (got[WORK].qty, got[WORK].unit_price_uzs) == (1, 150_000)
    assert {got[k].category for k in (TAP, TRAP, WORK)} == {"santexnika"}


def test_two_machines_and_the_formula():
    got = lines(room([M1, M2]))
    assert got[TAP].qty == got[TRAP].qty == got[WORK].qty == 2
    assert got[TAP].formula == "2 mashina = 2 dona × 60 000 so'm"
    assert got[WORK].formula == "2 dona × 150 000 so'm"


def test_a_tagged_shop_tap_gives_its_price_and_name():
    shop = SimpleNamespace(id=uuid.uuid4(), name_uz="Vieir kran-filtr", unit="dona", price_uzs=85_000, pack_qty=None, pack_unit=None,
                           smeta_key="kran_kir", is_active=True, store=SimpleNamespace(name="Santex Pro"))
    by = {ln.label: ln for ln in _plumbing_lines(room([M1]), {"kran_kir": shop})}
    assert (by[f"{TAP}: Vieir kran-filtr"].unit_price_uzs, by[f"{TAP}: Vieir kran-filtr"].is_approximate) == (85_000, False)


def test_its_points_join_the_pipes_and_fittings():
    without, with_one = lines(room([])), lines(room([M1]))
    assert with_one["Suv rozetkasi Ø20"].qty == without["Suv rozetkasi Ø20"].qty + 1
    assert with_one["Ish: nuqtani ulash"].qty == without["Ish: nuqtani ulash"].qty + 2
    assert with_one["Kanalizatsiya quvuri Ø50"].qty > 0
    assert "Kanalizatsiya quvuri Ø50" not in without


def test_a_stray_machine_point_saved_in_plumbing_is_not_counted_twice():
    stray = washer_points([M1], GEOMETRY)
    assert lines(room([M1], plumbing=(COLD, *stray)))["Suv rozetkasi Ø20"].qty == lines(room([M1]))["Suv rozetkasi Ø20"].qty


def test_an_old_room_with_no_washers_key_is_as_before():
    key = lambda r: [(ln.label, ln.qty, ln.subtotal_uzs) for ln in _plumbing_lines(r, {})]  # noqa: E731
    assert key(room()) == key(room([]))
    assert not {TAP, TRAP, WORK} & set(lines(room()))


def test_the_keys_are_sold_by_the_piece():
    for key in ("kran_kir", "sifon_kir"):
        assert key in ALL_SMETA_KEYS and KEY_SALE_UNIT[key] == "dona"


def test_the_labels_and_formula_read_in_russian_and_english():
    for label in (TAP, TRAP, WORK):
        assert localize_label(label, "ru") != label and localize_label(label, "en") != label
    assert localize_formula("2 mashina = 2 dona × 60 000 so'm", "ru") == "2 машины = 2 шт. × 60 000 сум"
    assert localize_formula("1 mashina = 1 dona × 60 000 so'm", "en") == "1 machine = 1 pc × 60 000 UZS"
