"""An electric heated floor (2026-11-18): a mat under the tile on the free floor (the floor less what
stands on it for good: a bathtub, a shower, a toilet, a wardrobe...), a thermostat with its sensor,
a breaker and cable, and the work."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.services.smeta import EXTRAS_NORM_NOTE, _heated_floor_lines
from app.services.smeta_keys import ALL_SMETA_KEYS, KEY_PACK_UNIT
from app.services.smeta_text import localize_label

MAT, THERMO, KIT, BREAKER, CABLE = (
    "Issiq pol mati (elektr)", "Issiq pol termoregulyatori", "Gofra quvur va datchik (issiq pol)",
    "Avtomat 16 A (issiq pol)", "Elektr kabel (issiq pol)",
)
W_MAT, W_THERMO = "Ish: issiq pol matini yotqizish", "Ish: termoregulyatorni o'rnatish"
ALL = (MAT, THERMO, KIT, BREAKER, CABLE, W_MAT, W_THERMO)


def room(*names: str, heated=True, room_type="hammom", floor_area=4.0):
    furniture = [{"id": f"f{i}", "furniture_id": f"slug-{i}", "name": n, "x": 0, "y": 0, "rotation": 0} for i, n in enumerate(names)]
    ds = {"heatedFloor": heated} if heated is not None else {}
    return SimpleNamespace(state={"furniture": furniture, "designState": ds}, room_type=room_type, name="Xona",
                           floor_area=floor_area, room_scan=None)


def lines(r, catalog=None, floor_done=False) -> dict:
    return {ln.label if ln.label.startswith("Ish:") else ln.label.split(":")[0]: ln for ln in _heated_floor_lines(r, catalog or {}, floor_done)}


def test_a_bathroom_with_a_bath_and_a_toilet_heats_the_rest_of_the_floor():
    # 4.00 m² − bathtub 1.70×0.70 (1.19) − toilet 0.40×0.65 (0.26) = 2.55 → a 2.5 m² mat (sold in 0.5 m² steps, never under a fixture)
    got = lines(room("Vanna 170", "Unitaz"))
    assert set(got) == set(ALL)
    assert (got[MAT].qty, got[MAT].unit, got[MAT].unit_price_uzs) == (2.5, "m²", 180_000)
    assert got[MAT].formula == "4.00 m² − 1.45 m² (jihozlar ostida) = 2.55 m² → 2.5 m²"
    assert (got[MAT].is_approximate, got[MAT].warning) == (True, EXTRAS_NORM_NOTE)
    assert (got[W_MAT].qty, got[W_MAT].unit_price_uzs) == (2.5, 50_000)
    assert (got[THERMO].qty, got[THERMO].unit_price_uzs) == (1, 350_000)
    assert (got[KIT].qty, got[KIT].unit, got[KIT].unit_price_uzs) == (1, "komplekt", 60_000)
    assert (got[BREAKER].qty, got[BREAKER].unit_price_uzs) == (1, 80_000)
    assert (got[CABLE].qty, got[CABLE].unit) == (5, "m")
    assert (got[W_THERMO].qty, got[W_THERMO].unit_price_uzs) == (1, 100_000)
    assert {ln.category for ln in got.values()} == {"issiq_pol"}


def test_a_sink_or_a_chair_does_not_take_floor_away():
    # A sink hangs on the wall and a chair stands on legs: the mat runs under them.
    assert lines(room("Rakovina 3", "Ovqatlanish stuli"))[MAT].qty == 4.0


def test_a_kitchen_gets_it_too():
    assert lines(room(room_type="oshxona"))[MAT].qty == 4.0


def test_off_unless_exactly_true():
    assert lines(room(heated=None)) == {}
    assert lines(room(heated="true")) == {}


def test_only_in_a_bathroom_or_a_kitchen():
    assert lines(room(room_type="yotoqxona")) == {}


def test_not_when_the_floor_is_already_finished():
    assert lines(room(), floor_done=True) == {}


def test_too_little_free_floor_gets_nothing():
    # 2.0 − 1.19 = 0.81 m²: under the smallest mat (1 m²).
    assert lines(room("Vanna 170", floor_area=2.0)) == {}


def test_a_shop_mat_per_square_metre_and_a_thermostat_give_their_prices():
    def shop(key, price, unit, name):
        return SimpleNamespace(id=uuid.uuid4(), name_uz=name, unit=unit, price_uzs=price, pack_qty=None, pack_unit=None,
                               smeta_key=key, is_active=True, store=SimpleNamespace(name="Issiqlik"))
    got = lines(room(), {"issiq_pol": shop("issiq_pol", 210_000, "m2", "Devi mat 150 W"),
                         "termoregulyator": shop("termoregulyator", 420_000, "dona", "Devireg 530")})
    assert (got[MAT].unit_price_uzs, got[MAT].is_approximate) == (210_000, False)
    assert got[THERMO].unit_price_uzs == 420_000


def test_the_two_keys_are_shop_keys():
    assert {"issiq_pol", "termoregulyator"} <= ALL_SMETA_KEYS
    assert (KEY_PACK_UNIT["issiq_pol"], KEY_PACK_UNIT["termoregulyator"]) == ("m2", None)


def test_every_label_is_translated():
    for label in ALL:
        assert localize_label(label, "ru") != label
