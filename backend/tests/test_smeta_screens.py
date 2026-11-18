"""A bath's and a shower's screen (2026-11-18): glass or a curtain on a rod, the user's pick, priced
with its fitting; a shower cabin or panel has its own glass and gets none."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.services.smeta import EXTRAS_NORM_NOTE, _plumbing_lines
from app.services.smeta_keys import ALL_SMETA_KEYS, KEY_PACK_UNIT
from app.services.smeta_text import localize_label

GEOMETRY = {"walls": [
    {"id": "A", "length": 2.5, "elements": []}, {"id": "B", "length": 2.0, "elements": []},
    {"id": "C", "length": 2.5, "elements": []},
    {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "position": 0.5}]},
]}
BATH_G, BATH_GW = "Vanna shtorkasi (shisha)", "Ish: vanna shtorkasini o'rnatish"
SHOWER_G, SHOWER_GW = "Dush to'sig'i (shisha)", "Ish: dush shishasini o'rnatish"
CURTAIN, CURTAIN_W = "Parda va tayoqcha (vanna, dush)", "Ish: parda tayoqchasini o'rnatish"
ALL = (BATH_G, BATH_GW, SHOWER_G, SHOWER_GW, CURTAIN, CURTAIN_W)


def room(*names: str, bath=None, shower=None):
    furniture = [{"id": f"f{i}", "furniture_id": f"slug-{i}", "name": n, "x": 0, "y": 0, "rotation": 0} for i, n in enumerate(names)]
    ds = {k: v for k, v in (("bathScreen", bath), ("showerScreen", shower)) if v is not None}
    return SimpleNamespace(state={"furniture": furniture, "plumbing": [], "designState": ds}, geometry=GEOMETRY, room_type="hammom", name="Hammom")


def lines(r, catalog=None) -> dict:
    return {ln.label if ln.label.startswith("Ish:") else ln.label.split(":")[0]: ln for ln in _plumbing_lines(r, catalog or {})}


def test_glass_on_a_bath_and_a_shower_tray():
    got = lines(room("Vanna 170", "Dush poddoni", bath="glass", shower="glass"))
    assert (got[BATH_G].qty, got[BATH_G].unit_price_uzs, got[BATH_G].is_approximate, got[BATH_G].warning) == (1, 1_200_000, True, EXTRAS_NORM_NOTE)
    assert (got[BATH_GW].qty, got[BATH_GW].unit_price_uzs) == (1, 150_000)
    assert (got[SHOWER_G].qty, got[SHOWER_G].unit_price_uzs) == (1, 2_000_000)
    assert (got[SHOWER_GW].qty, got[SHOWER_GW].unit_price_uzs) == (1, 300_000)
    assert not {CURTAIN, CURTAIN_W} & set(got)
    assert {got[k].category for k in (BATH_G, BATH_GW, SHOWER_G, SHOWER_GW)} == {"santexnika"}


def test_curtains_are_one_line_for_both():
    got = lines(room("Vanna 170", "Dush poddoni", bath="curtain", shower="curtain"))
    assert (got[CURTAIN].qty, got[CURTAIN].unit_price_uzs) == (2, 150_000)
    assert got[CURTAIN].formula == "1 vanna + 1 dush = 2 dona × 150 000 so'm"
    assert (got[CURTAIN_W].qty, got[CURTAIN_W].unit_price_uzs) == (2, 50_000)
    assert not {BATH_G, SHOWER_G} & set(got)


def test_none_unless_picked():
    assert not set(ALL) & set(lines(room("Vanna 170", "Dush poddoni")))
    assert not set(ALL) & set(lines(room("Vanna 170", bath="none")))


def test_a_cabin_or_a_shower_panel_has_its_own_glass():
    got = lines(room("Dush kabinasi", "Dush paneli", shower="glass"))
    assert not {SHOWER_G, SHOWER_GW} & set(got)


def test_a_pick_with_no_such_fixture_prices_nothing():
    assert not set(ALL) & set(lines(room("Rakovina", bath="glass", shower="curtain")))


def test_shop_products_give_their_prices():
    def shop(key, price, name):
        return SimpleNamespace(id=uuid.uuid4(), name_uz=name, unit="dona", price_uzs=price, pack_qty=None, pack_unit=None,
                               smeta_key=key, is_active=True, store=SimpleNamespace(name="Santex"))
    got = lines(room("Vanna 170", "Dush poddoni", bath="glass", shower="glass"),
                {"shtorka_vanna": shop("shtorka_vanna", 1_450_000, "Ravak PVS1"), "dush_shisha": shop("dush_shisha", 2_300_000, "Walk-in 90")})
    assert (got[BATH_G].unit_price_uzs, got[SHOWER_G].unit_price_uzs) == (1_450_000, 2_300_000)


def test_keys_and_translations():
    assert {"shtorka_vanna", "dush_shisha", "parda_hammom"} <= ALL_SMETA_KEYS
    assert all(KEY_PACK_UNIT[k] is None for k in ("shtorka_vanna", "dush_shisha", "parda_hammom"))
    for label in ALL:
        assert localize_label(label, "ru") != label
