"""A washing machine's socket (2026-11-14): an IP44 socket, a cable to it and the work, per machine."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.smeta import ELEC_CABLE_PRICE_UZS, EXTRAS_NORM_NOTE, _plumbing_lines
from app.services.smeta_text import localize_formula, localize_label

GEOMETRY = {"walls": [
    {"id": "A", "length": 2.5, "elements": []}, {"id": "B", "length": 2.0, "elements": []},
    {"id": "C", "length": 2.5, "elements": []},
    {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "position": 0.5}]},
]}
M1 = {"id": "m1", "wallId": "A", "positionMm": 800}
M2 = {"id": "m2", "wallId": "C", "positionMm": 1200}
SOCKET = "Kir yuvish mashinasi rozetkasi (IP44)"
CABLE = "Elektr kabel (kir yuvish mashinasi)"
WORK = "Ish: kir yuvish mashinasi rozetkasini o'rnatish"
NEW = (SOCKET, CABLE, WORK)


def room(washers):
    state = {"furniture": [], "plumbing": [], "washers": washers}
    return SimpleNamespace(state=state, geometry=GEOMETRY, room_type="hammom", name="Hammom")


def by_label(washers, catalog=None):
    return {ln.label: ln for ln in _plumbing_lines(room(washers), catalog or {})}


def test_no_machine_no_socket_lines():
    assert not set(NEW) & set(by_label([]))


def test_one_machine_brings_its_socket_cable_and_work():
    got = by_label([M1])
    s, c, w = got[SOCKET], got[CABLE], got[WORK]
    assert (s.qty, s.unit, s.unit_price_uzs, s.is_approximate, s.warning) == (1, "dona", 70_000, True, EXTRAS_NORM_NOTE)
    assert s.formula == "1 mashina = 1 dona × 70 000 so'm"
    assert (c.qty, c.unit, c.unit_price_uzs, c.is_approximate) == (3, "m", ELEC_CABLE_PRICE_UZS, True)
    assert (w.qty, w.unit, w.unit_price_uzs, w.formula) == (1, "dona", 50_000, "1 dona × 50 000 so'm")
    assert {got[k].category for k in NEW} == {"santexnika"}
    assert "Namga chidamli rozetka (IP44)" not in got


def test_two_machines_count_twice():
    got = by_label([M1, M2])
    assert (got[SOCKET].qty, got[CABLE].qty, got[WORK].qty) == (2, 6, 2)


def shop(key, unit, price, name):
    return SimpleNamespace(id=uuid.uuid4(), name_uz=name, unit=unit, price_uzs=price, pack_qty=None, pack_unit=None,
                           smeta_key=key, is_active=True, store=SimpleNamespace(name="Elektr"))


def test_tagged_shop_socket_and_cable_give_their_prices():
    got = by_label([M1], {"rozetka_ip44": shop("rozetka_ip44", "dona", 85_000, "Schneider IP44"),
                          "kabel": shop("kabel", "m", 14_000, "VVG 3x2.5")})
    assert got[f"{SOCKET}: Schneider IP44"].unit_price_uzs == 85_000
    assert got[CABLE].unit_price_uzs == 14_000


@pytest.mark.parametrize(("label", "ru", "en"), [
    (SOCKET, "Розетка для стиральной машины (IP44)", "Washing machine socket (IP44)"),
    (CABLE, "Электрокабель (стиральная машина)", "Electric cable (washing machine)"),
    (WORK, "Работа: установка розетки для стиральной машины", "Work: fitting the washing machine socket"),
])
def test_every_new_label_reads_in_russian_and_english(label, ru, en):
    assert localize_label(label, "ru") == ru
    assert localize_label(label, "en") == en


def test_shop_suffixed_socket_label_reads_too():
    assert localize_label(f"{SOCKET}: Schneider IP44", "en") == "Washing machine socket (IP44): Schneider IP44"


def test_socket_formula_reads_in_russian():
    assert localize_formula("1 mashina = 1 dona × 70 000 so'm", "ru") != "1 mashina = 1 dona × 70 000 so'm"
