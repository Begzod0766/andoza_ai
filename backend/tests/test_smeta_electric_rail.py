"""An electric towel rail (2026-11-14): no hot water points, so no pipe for it; the rail, an IP44
socket, a cable to it and the work."""
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
WATER = {"id": "r1", "wallId": "A", "positionMm": 600, "heightMm": 1000}
ELECTRIC = {"id": "r2", "wallId": "C", "positionMm": 1200, "heightMm": 1000, "kind": "electric"}
RAIL, SOCKET, CABLE = "Elektr sochiq quritgich", "Namga chidamli rozetka (IP44)", "Elektr kabel (sochiq quritgich)"
WORK = "Ish: elektr sochiq quritgichni o'rnatish"
NEW = (RAIL, SOCKET, CABLE, WORK)


def room(rails):
    state = {"furniture": [], "towelRails": rails, "plumbing": []}
    return SimpleNamespace(state=state, geometry=GEOMETRY, room_type="hammom", name="Hammom")


def by_label(rails, catalog=None):
    return {ln.label: ln for ln in _plumbing_lines(room(rails), catalog or {})}


def test_a_water_rail_is_as_before():
    got = by_label([WATER])
    assert "Sochiq quritgich" in got and "Suv quvuri PPR Ø20" in got
    assert not set(NEW) & set(got)


def test_an_electric_rail_has_its_four_lines_and_no_pipe():
    got = by_label([ELECTRIC])
    assert (got[RAIL].qty, got[RAIL].unit_price_uzs, got[RAIL].is_approximate, got[RAIL].warning) == (1, 900_000, True, EXTRAS_NORM_NOTE)
    assert (got[SOCKET].qty, got[SOCKET].unit_price_uzs) == (1, 70_000)
    assert (got[CABLE].qty, got[CABLE].unit, got[CABLE].unit_price_uzs, got[CABLE].is_approximate) == (3, "m", ELEC_CABLE_PRICE_UZS, True)
    assert (got[WORK].qty, got[WORK].unit_price_uzs, got[WORK].formula) == (1, 150_000, "1 dona × 150 000 so'm")
    assert {got[k].category for k in NEW} == {"santexnika"}
    assert "Sochiq quritgich" not in got and "Ish: sochiq quritgichni o'rnatish" not in got
    assert "Suv quvuri PPR Ø20" not in got and "Ish: nuqtani ulash" not in got


def test_one_of_each():
    got = by_label([WATER, ELECTRIC, {**ELECTRIC, "id": "r3", "positionMm": 400}])
    assert got["Sochiq quritgich"].qty == 1 and got["Ish: sochiq quritgichni o'rnatish"].qty == 1
    assert (got[RAIL].qty, got[SOCKET].qty, got[CABLE].qty, got[WORK].qty) == (2, 2, 6, 2)
    assert got["Suv rozetkasi Ø20"].qty == 2


def test_an_unknown_kind_is_a_water_rail():
    got = by_label([{**WATER, "kind": "gas"}])
    assert "Sochiq quritgich" in got and RAIL not in got


def shop(key, unit, price, name):
    return SimpleNamespace(id=uuid.uuid4(), name_uz=name, unit=unit, price_uzs=price, pack_qty=None, pack_unit=None,
                           smeta_key=key, is_active=True, store=SimpleNamespace(name="Santex"))


def test_tagged_shop_rail_socket_and_cable_give_their_prices():
    got = by_label([ELECTRIC], {"sochiq_quritgich_el": shop("sochiq_quritgich_el", "dona", 1_200_000, "Terminus Electro"),
                                "rozetka_ip44": shop("rozetka_ip44", "dona", 85_000, "Schneider IP44"),
                                "kabel": shop("kabel", "m", 14_000, "VVG 3x2.5")})
    assert got[f"{RAIL}: Terminus Electro"].unit_price_uzs == 1_200_000
    assert got[f"{SOCKET}: Schneider IP44"].unit_price_uzs == 85_000
    assert got[CABLE].unit_price_uzs == 14_000


def test_the_new_keys_are_sold_by_the_piece():
    for key in ("sochiq_quritgich_el", "rozetka_ip44"):
        assert key in ALL_SMETA_KEYS and KEY_SALE_UNIT[key] == "dona"


@pytest.mark.parametrize(("label", "ru", "en"), [
    (RAIL, "Электрический полотенцесушитель", "Electric towel rail"),
    (SOCKET, "Влагозащищённая розетка (IP44)", "Moisture-proof socket (IP44)"),
    (CABLE, "Электрокабель (полотенцесушитель)", "Electric cable (towel rail)"),
    (WORK, "Работа: установка электрического полотенцесушителя", "Work: fitting the electric towel rail"),
])
def test_every_new_label_reads_in_russian_and_english(label, ru, en):
    assert localize_label(label, "ru") == ru
    assert localize_label(label, "en") == en
