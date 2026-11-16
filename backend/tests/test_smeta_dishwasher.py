"""A dishwasher in the estimate (2026-11-16): its tap with a tee, its outlet trap, the connection, and
its socket; the machine itself is not priced. Washing machines are as before."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.smeta import ELEC_CABLE_PRICE_UZS, EXTRAS_NORM_NOTE, _plumbing_lines
from app.services.smeta_keys import ALL_SMETA_KEYS, KEY_SALE_UNIT
from app.services.smeta_text import localize_label

GEOMETRY = {"walls": [
    {"id": "A", "length": 3.0, "elements": []}, {"id": "B", "length": 3.0, "elements": []},
    {"id": "C", "length": 3.0, "elements": []}, {"id": "D", "length": 3.0, "elements": []},
]}
DW = {"id": "d1", "wallId": "A", "positionMm": 1200, "kind": "dishwasher", "widthMm": 600}
WM = {"id": "m1", "wallId": "C", "positionMm": 1200}
TAP, TRAP, WORK = "Idish yuvish mashinasi krani (uchlik bilan)", "Idish yuvish mashinasi sifoni (chiqishli)", "Ish: idish yuvish mashinasini ulash"
SOCKET, CABLE, SWORK = "Idish yuvish mashinasi rozetkasi (IP44)", "Elektr kabel (idish yuvish mashinasi)", "Ish: idish yuvish mashinasi rozetkasini o'rnatish"
NEW = (TAP, TRAP, WORK, SOCKET, CABLE, SWORK)


def room(washers):
    return SimpleNamespace(state={"furniture": [], "plumbing": [], "washers": washers}, geometry=GEOMETRY, room_type="oshxona", name="Oshxona")


def by_label(washers, catalog=None):
    return {ln.label: ln for ln in _plumbing_lines(room(washers), catalog or {})}


def test_a_dishwasher_brings_its_six_lines():
    got = by_label([DW])
    assert (got[TAP].qty, got[TAP].unit_price_uzs, got[TAP].is_approximate, got[TAP].warning) == (1, 70_000, True, EXTRAS_NORM_NOTE)
    assert got[TAP].formula == "1 mashina = 1 dona × 70 000 so'm"
    assert (got[TRAP].qty, got[TRAP].unit_price_uzs) == (1, 90_000)
    assert (got[WORK].qty, got[WORK].unit_price_uzs, got[WORK].formula) == (1, 200_000, "1 dona × 200 000 so'm")
    assert (got[SOCKET].qty, got[SOCKET].unit_price_uzs) == (1, 70_000)
    assert (got[CABLE].qty, got[CABLE].unit, got[CABLE].unit_price_uzs) == (3, "m", ELEC_CABLE_PRICE_UZS)
    assert (got[SWORK].qty, got[SWORK].unit_price_uzs) == (1, 50_000)
    assert {got[k].category for k in NEW} == {"santexnika"}


def test_it_is_not_priced_as_a_washing_machine():
    got = by_label([DW])
    assert not any(k.startswith("Kir yuvish mashinasi") or k == "Ish: kir yuvish mashinasini ulash" for k in got)


def test_a_washing_machine_beside_it_is_as_before():
    got = by_label([DW, WM])
    assert got["Kir yuvish mashinasi krani"].qty == 1 and got["Ish: kir yuvish mashinasini ulash"].qty == 1
    assert got["Kir yuvish mashinasi rozetkasi (IP44)"].qty == 1
    assert got[TAP].qty == 1 and got[SOCKET].qty == 1


def test_its_two_points_are_in_the_pipes():
    with_dw = by_label([DW])
    assert with_dw["Ish: nuqtani ulash"].qty == 2


def test_two_dishwashers_count_twice():
    got = by_label([DW, {**DW, "id": "d2", "positionMm": 2300, "widthMm": 450}])
    assert (got[TAP].qty, got[TRAP].qty, got[WORK].qty, got[CABLE].qty) == (2, 2, 2, 6)


def test_tagged_shop_parts_give_their_prices():
    def shop(key, price, name):
        return SimpleNamespace(id=uuid.uuid4(), name_uz=name, unit="dona", price_uzs=price, pack_qty=None, pack_unit=None,
                               smeta_key=key, is_active=True, store=SimpleNamespace(name="Santex"))
    got = by_label([DW], {"kran_idish": shop("kran_idish", 65_000, "Kran uchlik 1/2"), "sifon_idish": shop("sifon_idish", 110_000, "Sifon 2 chiqishli")})
    assert got[f"{TAP}: Kran uchlik 1/2"].unit_price_uzs == 65_000
    assert got[f"{TRAP}: Sifon 2 chiqishli"].unit_price_uzs == 110_000


def test_the_new_keys_are_sold_by_the_piece():
    for key in ("kran_idish", "sifon_idish"):
        assert key in ALL_SMETA_KEYS and KEY_SALE_UNIT[key] == "dona"


@pytest.mark.parametrize(("label", "ru", "en"), [
    (TAP, "Кран для посудомоечной машины (с тройником)", "Dishwasher tap (with a tee)"),
    (TRAP, "Сифон для посудомоечной машины (с отводом)", "Dishwasher trap (with an outlet)"),
    (WORK, "Работа: подключение посудомоечной машины", "Work: connecting the dishwasher"),
    (SOCKET, "Розетка для посудомоечной машины (IP44)", "Dishwasher socket (IP44)"),
    (CABLE, "Электрокабель (посудомоечная машина)", "Electric cable (dishwasher)"),
    (SWORK, "Работа: установка розетки для посудомоечной машины", "Work: fitting the dishwasher socket"),
])
def test_labels_read_in_russian_and_english(label, ru, en):
    assert (localize_label(label, "ru"), localize_label(label, "en")) == (ru, en)
