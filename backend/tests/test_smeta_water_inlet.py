"""The water inlet unit (2026-11-14): a meter, a coarse filter, a pressure reducer and a check valve
on each incoming line, and the work of putting it together. A switch in the Santexnika panel
(``designState.waterInlet``, off unless exactly true). Cold always comes in; hot too when the room
has a hot point and no water heater of its own.
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.smeta import EXTRAS_NORM_NOTE, _plumbing_lines
from app.services.smeta_keys import ALL_SMETA_KEYS, KEY_SALE_UNIT
from app.services.smeta_text import localize_label

GEOMETRY = {"walls": [
    {"id": "A", "length": 2.5, "elements": []}, {"id": "B", "length": 2.0, "elements": []},
    {"id": "C", "length": 2.5, "elements": []},
    {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "position": 0.5}]},
]}
METER, FILTER, REDUCER, CHECK = "Suv hisoblagichi", "Dag'al filtr", "Bosim reduktori", "Teskari klapan"
WORK = "Ish: suv kirish uzelini yig'ish"
PARTS = {METER: 180_000, FILTER: 60_000, REDUCER: 250_000, CHECK: 40_000}
NEW = (*PARTS, WORK)


def piece(name: str, i: int = 0) -> dict:
    return {"id": f"f{i}", "furniture_id": f"slug-{i}", "name": name, "x": 0, "y": 0, "rotation": 0}


def room(*names: str, design: dict | None = None, plumbing: list | None = None):
    state: dict = {"furniture": [piece(n, i) for i, n in enumerate(names)]}
    if plumbing is not None:
        state["plumbing"] = plumbing
    if design is not None:
        state["designState"] = design
    return SimpleNamespace(state=state, geometry=GEOMETRY, room_type="hammom", name="Hammom")


def point(kind: str, i: int) -> dict:
    return {"id": f"p{i}", "kind": kind, "diameterMm": 20, "wallId": "A", "positionMm": 1000 + i * 100, "heightMm": 600}


COLD_HOT = [point("cold", 0), point("hot", 1)]


def lines(r, catalog=None) -> dict:
    return {(ln.label if ln.label in NEW else ln.label.split(":")[0]): ln for ln in _plumbing_lines(r, catalog or {})}


@pytest.mark.parametrize("design", [None, {}, {"waterInlet": False}, {"waterInlet": "yes"}])
def test_no_inlet_unless_switched_on(design):
    assert not set(NEW) & set(lines(room(design=design, plumbing=COLD_HOT)))


def test_cold_and_hot_each_get_a_meter_filter_reducer_and_check_valve():
    got = lines(room(design={"waterInlet": True}, plumbing=COLD_HOT))
    for label, price in PARTS.items():
        ln = got[label]
        assert (ln.qty, ln.unit, ln.unit_price_uzs, ln.is_approximate, ln.warning) == (2, "dona", price, True, EXTRAS_NORM_NOTE)
        assert ln.formula.startswith("2 liniya = 2 dona × ")
        assert ln.category == "santexnika"
    assert (got[WORK].qty, got[WORK].unit, got[WORK].unit_price_uzs) == (2, "dona", 200_000)
    assert got[WORK].formula == "2 liniya = 2 dona × 200 000 so'm"


def test_with_a_water_heater_only_the_cold_line_comes_in():
    got = lines(room(design={"waterInlet": True, "waterHeater": True}, plumbing=COLD_HOT))
    assert got[METER].qty == 1 and got[WORK].qty == 1
    assert got[METER].formula == "1 liniya = 1 dona × 180 000 so'm"


def test_only_cold_points_one_line():
    got = lines(room(design={"waterInlet": True}, plumbing=[point("cold", 0), point("drain", 1)]))
    assert got[REDUCER].qty == 1


def test_a_room_with_no_points_still_takes_the_cold_inlet():
    got = lines(room(design={"waterInlet": True}, plumbing=[]))
    assert got[METER].qty == 1 and got[WORK].qty == 1


def shop(key: str, unit: str = "dona", price: int = 310_000):
    return SimpleNamespace(id=uuid.uuid4(), name_uz="Valtec VT.087", unit=unit, price_uzs=price, pack_qty=None, pack_unit=None,
                           smeta_key=key, is_active=True, store=SimpleNamespace(name="Santex Pro"))


def test_a_tagged_shop_reducer_gives_its_price():
    by = {ln.label: ln for ln in _plumbing_lines(room(design={"waterInlet": True}, plumbing=COLD_HOT), {"reduktor": shop("reduktor")})}
    line = by[f"{REDUCER}: Valtec VT.087"]
    assert (line.unit_price_uzs, line.is_approximate, line.qty) == (310_000, False, 2)


def test_a_shop_product_not_sold_by_the_piece_is_ignored():
    got = lines(room(design={"waterInlet": True}, plumbing=COLD_HOT), {"filtr_suv": shop("filtr_suv", unit="m")})
    assert (got[FILTER].unit_price_uzs, got[FILTER].is_approximate) == (60_000, True)


def test_the_new_keys_are_sold_by_the_piece():
    for key in ("hisoblagich_suv", "filtr_suv", "reduktor", "klapan_teskari"):
        assert key in ALL_SMETA_KEYS and KEY_SALE_UNIT[key] == "dona"


@pytest.mark.parametrize(("label", "ru", "en"), [
    (METER, "Счётчик воды", "Water meter"),
    (FILTER, "Фильтр грубой очистки", "Coarse water filter"),
    (REDUCER, "Редуктор давления", "Pressure reducer"),
    (CHECK, "Обратный клапан", "Check valve"),
    (WORK, "Работа: сборка узла ввода воды", "Work: assembling the water inlet"),
])
def test_every_new_label_reads_in_russian_and_english(label, ru, en):
    assert localize_label(label, "ru") == ru
    assert localize_label(label, "en") == en


def test_a_shop_name_after_the_part_is_kept():
    assert localize_label(f"{METER}: Valtec", "ru") == "Счётчик воды: Valtec"
