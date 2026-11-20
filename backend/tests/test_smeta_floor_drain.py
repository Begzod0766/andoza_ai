"""A floor drain for a shower with no tray (spec 2026-11-13): ``designState.floorDrain``, counted only
when exactly true, swaps each shower's tray trap for a floor drain and its fitting work."""
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
TRAY_TRAP, DRAIN, WORK, MIXER = "Dush poddoni sifoni", "Pol trapi", "Ish: trap o'rnatish", "Dush smesiteli"


def room(*names: str, design: dict | None = None):
    state = {"furniture": [{"id": f"f{i}", "furniture_id": f"slug-{i}", "name": n, "x": 0, "y": 0, "rotation": 0} for i, n in enumerate(names)], "plumbing": []}
    if design is not None:
        state["designState"] = design
    return SimpleNamespace(state=state, geometry=GEOMETRY, room_type="hammom", name="Hammom")


def lines(r, catalog=None) -> dict:
    return {ln.label if ln.label.startswith("Ish:") else ln.label.split(":")[0]: ln for ln in _plumbing_lines(r, catalog or {})}


@pytest.mark.parametrize("design", [None, {}, {"floorDrain": False}, {"floorDrain": "yes"}])
def test_off_by_default_the_tray_trap_as_before(design):
    got = lines(room("Dush poddoni 90", design=design))
    assert got[TRAY_TRAP].qty == 1
    assert DRAIN not in got and WORK not in got


def test_on_a_shower_tray_takes_a_floor_drain_and_its_work_the_mixer_unchanged():
    got = lines(room("Dush poddoni 90", design={"floorDrain": True}))
    assert TRAY_TRAP not in got
    assert (got[DRAIN].qty, got[DRAIN].unit_price_uzs, got[DRAIN].is_approximate, got[DRAIN].warning) == (1, 450_000, True, EXTRAS_NORM_NOTE)
    assert (got[WORK].qty, got[WORK].unit_price_uzs) == (1, 200_000)
    assert got[MIXER].qty == 1


def test_on_a_shower_cabin_takes_the_same_swap():
    got = lines(room("Dush kabinasi 90x90", design={"floorDrain": True}))
    assert TRAY_TRAP not in got and got[DRAIN].qty == 1 and got[WORK].qty == 1


def test_on_two_showers_two_drains():
    got = lines(room("Dush poddoni 90", "Dush paneli", design={"floorDrain": True}))
    assert got[DRAIN].qty == 2 and got[WORK].qty == 2


def test_on_with_no_shower_adds_nothing():
    got = lines(room("Rakovina 3", design={"floorDrain": True}))
    assert DRAIN not in got and WORK not in got


def test_a_tagged_shop_drain_gives_its_price():
    shop = SimpleNamespace(id=uuid.uuid4(), name_uz="Трап кафель 300 мм", unit="dona", price_uzs=380_000, pack_qty=None, pack_unit=None,
                           smeta_key="trap_pol", is_active=True, store=SimpleNamespace(name="Santex Pro"))
    by = {ln.label: ln for ln in _plumbing_lines(room("Dush poddoni 90", design={"floorDrain": True}), {"trap_pol": shop})}
    assert by[f"{DRAIN}: Трап кафель 300 мм"].unit_price_uzs == 380_000


def test_the_key_and_labels():
    assert "trap_pol" in ALL_SMETA_KEYS and KEY_SALE_UNIT["trap_pol"] == "dona"
    for label in (DRAIN, WORK):
        assert localize_label(label, "ru") != label and localize_label(label, "en") != label


# The shower zone sloped to the drain (spec 2026-11-14).
MIX, SLOPE = "Qiyalik styajkasi aralashmasi", "Ish: dush zonasini trapga qiyalatish"


def test_off_no_slope_lines():
    got = lines(room("Dush poddoni 90"))
    assert MIX not in got and SLOPE not in got


def test_on_with_no_shower_no_slope_lines():
    got = lines(room("Rakovina 3", design={"floorDrain": True}))
    assert MIX not in got and SLOPE not in got


def test_on_one_shower_with_no_footprint_slopes_90_by_90():
    got = lines(room("Dush poddoni 90", design={"floorDrain": True}))
    m, s = got[MIX], got[SLOPE]
    assert (m.qty, m.unit, m.unit_price_uzs, m.is_approximate, m.warning) == (2, "qop", 45_000, True, EXTRAS_NORM_NOTE)
    assert m.formula == "0.81 m² × 54 kg = 43.7 kg ÷ 25 kg → 2 qop"
    assert (s.qty, s.unit, s.unit_price_uzs) == (0.81, "m²", 150_000)
    assert s.formula == "0.90 m × 0.90 m = 0.81 m² × 150 000 so'm"
    assert {m.category, s.category} == {"santexnika"}


def test_two_showers_sum_their_zones_from_the_catalog_and_scale():
    r = room("Dush poddoni", "Dush kabinasi", design={"floorDrain": True})
    r.state["furniture"][1]["scaleOverride"] = 1.0
    row = SimpleNamespace(name_uz="Dush poddoni 120x100", category=None, is_active=True, price_uzs=0, footprint_w=120, footprint_d=100,
                          store=None, id=uuid.uuid4())
    got = lines(r, {"furniture:slug-0": row})
    assert got[SLOPE].qty == 2.01
    assert got[SLOPE].formula == "1.20 + 0.81 = 2.01 m² × 150 000 so'm"
    assert got[MIX].qty == 5  # 2.01 × 54 = 108.5 kg ÷ 25 → 5


def test_a_tagged_shop_bag_gives_its_price():
    bag = SimpleNamespace(id=uuid.uuid4(), name_uz="Styajka M150 25 kg", unit="dona", price_uzs=52_000, pack_qty=None, pack_unit=None,
                          smeta_key="styajka", is_active=True, store=SimpleNamespace(name="Qurilish"))
    by = {ln.label: ln for ln in _plumbing_lines(room("Dush poddoni 90", design={"floorDrain": True}), {"styajka": bag})}
    got = by[f"{MIX}: Styajka M150 25 kg"]
    assert (got.unit_price_uzs, got.is_approximate) == (52_000, False)


def test_styajka_is_a_piece_key():
    assert "styajka" in ALL_SMETA_KEYS and KEY_SALE_UNIT["styajka"] == "dona"


@pytest.mark.parametrize(("label", "ru", "en"), [
    (MIX, "Смесь для стяжки с уклоном", "Sloped screed mix"),
    (SLOPE, "Работа: уклон душевой зоны к трапу", "Work: sloping the shower zone to the drain"),
])
def test_slope_labels_read_in_russian_and_english(label, ru, en):
    assert localize_label(label, "ru") == ru
    assert localize_label(label, "en") == en
