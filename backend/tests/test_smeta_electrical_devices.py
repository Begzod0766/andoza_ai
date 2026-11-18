"""The wall devices themselves (2026-11-18): every room's sockets, switches, media outlet and panel
are priced by the piece, with the fitting work per point. Before this only the cable was. A cooker
outlet (32 A) also brings its own breaker and a heavier cable to the panel."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.smeta import EXTRAS_NORM_NOTE, _electrical_device_lines
from app.services.smeta_keys import ALL_SMETA_KEYS, KEY_SALE_UNIT
from app.services.smeta_text import localize_label

SOCKET1 = "Rozetka (bitta)"
SOCKET2 = "Rozetka (ikkitalik)"
MEDIA = "Media rozetka (TV, internet)"
POWER = "Kuch rozetkasi (plita, 32 A)"
SWITCH1 = "Kalit (bitta)"
SWITCH2 = "Kalit (ikkitalik)"
PANEL = "Elektr qutisi (shchit)"
BREAKER = "Avtomat 32 A (plita liniyasi)"
POWER_CABLE = "Elektr kabel 3×6 mm² (plita liniyasi)"
WORK = "Ish: elektr nuqtalarini o'rnatish"
WORK_PANEL = "Ish: elektr qutisini o'rnatish"


def el(t, i=0):
    return {"id": f"{t}{i}", "type": t, "wallId": "A", "positionMm": 500 + i, "heightMm": 300}


def room(electricals, name="Mehmonxona", room_type="mehmonxona"):
    return SimpleNamespace(state={"electricals": electricals}, name=name, room_type=room_type)


def by_label(electricals, catalog=None, **kw):
    return {ln.label: ln for ln in _electrical_device_lines(room(electricals, **kw), catalog or {})}


def test_no_devices_no_lines():
    assert by_label([]) == {}


def test_one_line_per_device_type_with_its_count_at_the_norm_price():
    got = by_label([el("socket1", 0), el("socket1", 1), el("socket2"), el("socket_media"),
                    el("switch1"), el("switch2"), el("panel")])
    expect = {SOCKET1: (2, 35_000), SOCKET2: (1, 65_000), MEDIA: (1, 150_000), SWITCH1: (1, 30_000),
              SWITCH2: (1, 45_000), PANEL: (1, 350_000)}
    for label, (qty, price) in expect.items():
        ln = got[label]
        assert (ln.qty, ln.unit, ln.unit_price_uzs, ln.category) == (qty, "dona", price, "elektr")
        assert ln.is_approximate is True and ln.warning == EXTRAS_NORM_NOTE
    assert got[SOCKET1].formula == "2 dona × 35 000 so'm"


def test_fitting_work_per_point_and_the_panel_on_its_own():
    got = by_label([el("socket1", 0), el("socket1", 1), el("switch1"), el("panel")])
    w = got[WORK]
    assert (w.qty, w.unit, w.unit_price_uzs, w.formula, w.category) == (3, "dona", 40_000, "3 nuqta × 40 000 so'm", "elektr")
    p = got[WORK_PANEL]
    assert (p.qty, p.unit_price_uzs) == (1, 300_000)


def test_the_air_conditioner_is_not_a_fitting():
    # A split unit is bought and fitted by its own trade; the electrician only brings the line.
    got = by_label([el("ac")])
    assert got == {}


def test_a_cooker_outlet_brings_its_breaker_and_heavier_cable():
    got = by_label([el("socket_power")], name="Oshxona", room_type="oshxona")
    assert (got[POWER].qty, got[POWER].unit_price_uzs) == (1, 120_000)
    assert (got[BREAKER].qty, got[BREAKER].unit_price_uzs, got[BREAKER].unit) == (1, 80_000, "dona")
    c = got[POWER_CABLE]
    assert (c.qty, c.unit, c.unit_price_uzs, c.is_approximate) == (10, "m", 25_000, True)
    assert c.formula == "1 dona × 10 m = 10 m × 25 000 so'm"
    assert got[WORK].qty == 1


def test_two_cooker_outlets_count_twice():
    got = by_label([el("socket_power", 0), el("socket_power", 1)])
    assert (got[POWER].qty, got[BREAKER].qty, got[POWER_CABLE].qty) == (2, 2, 20)


def shop(key, unit, price, name):
    return SimpleNamespace(id=uuid.uuid4(), name_uz=name, unit=unit, price_uzs=price, pack_qty=None, pack_unit=None,
                           smeta_key=key, is_active=True, store=SimpleNamespace(name="Elektr"))


def test_a_tagged_shop_product_gives_its_price_and_name():
    got = by_label([el("socket1"), el("socket_power")], {
        "rozetka": shop("rozetka", "dona", 42_000, "Schneider Sedna"),
        "avtomat_32": shop("avtomat_32", "dona", 95_000, "ABB C32"),
        "kabel_kuch": shop("kabel_kuch", "m", 28_000, "VVG 3x6"),
    })
    s = got[f"{SOCKET1}: Schneider Sedna"]
    assert (s.unit_price_uzs, s.is_approximate) == (42_000, False)
    assert got[f"{BREAKER}: ABB C32"].unit_price_uzs == 95_000
    assert got[POWER_CABLE].unit_price_uzs == 28_000


KEYS = {"rozetka": "dona", "rozetka_2": "dona", "rozetka_media": "dona", "rozetka_kuch": "dona",
        "vyklyuchatel": "dona", "vyklyuchatel_2": "dona", "shchit": "dona", "avtomat_32": "dona",
        "kabel_kuch": "m"}


@pytest.mark.parametrize(("key", "unit"), KEYS.items())
def test_every_new_key_is_one_the_shop_can_tag(key, unit):
    assert key in ALL_SMETA_KEYS and KEY_SALE_UNIT[key] == unit


@pytest.mark.parametrize(("label", "en"), [
    (SOCKET1, "Socket (single)"), (SOCKET2, "Socket (double)"), (MEDIA, "Media outlet (TV, internet)"),
    (POWER, "Power outlet (cooker, 32 A)"), (SWITCH1, "Switch (one-gang)"), (SWITCH2, "Switch (two-gang)"),
    (PANEL, "Consumer unit"), (BREAKER, "Breaker 32 A (cooker line)"),
    (POWER_CABLE, "Electric cable 3×6 mm² (cooker line)"), (WORK, "Work: fitting the electrical points"),
    (WORK_PANEL, "Work: fitting the consumer unit"),
])
def test_every_new_label_reads_in_english_and_russian(label, en):
    assert localize_label(label, "en") == en
    assert localize_label(label, "ru") != label


def test_a_shop_suffixed_label_reads_too():
    assert localize_label(f"{SOCKET1}: Schneider Sedna", "en") == "Socket (single): Schneider Sedna"
