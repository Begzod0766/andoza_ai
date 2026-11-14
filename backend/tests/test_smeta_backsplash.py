"""A kitchen backsplash in the estimate (spec 2026-11-14): tile with its adhesive, grout and laying, or
skinali by the square metre with its fitting; and a tiled wall it covers is not tiled twice."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.smeta import WALL_TILE_NORM_NOTE, compute_estimate
from app.services.smeta_groups import CATEGORY_TO_GROUP
from app.services.smeta_keys import ALL_SMETA_KEYS, KEY_PACK_UNIT
from app.services.smeta_text import localize_formula, localize_label

PAINT = {"kind": "paint", "color": "#ffffff"}
TILE = {"kind": "texture", "url": "/floor/tile/wall/600x600-plain.jpg", "color": "#ffffff", "finish": "tile"}
WALLS = [{"id": w, "length": length, "elements": []} for w, length in zip("ABCD", (2500, 2000, 2500, 2000))]


def splash(material="tile", **kw):
    return {"id": kw.pop("id", "f1"), "wallId": "A", "material": material, "startMm": 200, "lengthMm": 1200,
            "bottomMm": 850, "topMm": 1450, "color": "#F2EFE9", **kw}


def room(backsplashes=None, coverings=None):
    design = {"wallCoverings": coverings or {"ALL": PAINT}}
    if backsplashes is not None:
        design["backsplashes"] = backsplashes
    return SimpleNamespace(
        net_wall_area=24.3, floor_area=5.0, perimeter=9.0, openings_count=0, ceiling_h=2.7, room_type="oshxona", name="Oshxona",
        geometry={"walls": [{**w, "length": w["length"] / 1000} for w in WALLS]}, surfaces={},
        state={"designState": design, "geometry": {"walls": WALLS}}, furniture_layout=[],
    )


def lines(r, catalog=None) -> dict:
    return {ln.label.split(":")[0] if not ln.label.startswith("Ish:") else ln.label: ln
            for ln in compute_estimate(r, {}, {}, catalog=catalog or {}).lines}


NEW = ("Fartuk plitkasi", "Ish: fartuk plitkasini terish", "Skinali (shisha fartuk)", "Ish: skinali o'rnatish")


@pytest.mark.parametrize("value", [None, [], "x", [{"id": "bad"}]])
def test_no_backsplash_no_lines(value):
    got = lines(room(value))
    assert not set(NEW) & set(got)
    assert "Plitka yelimi" not in got


def test_a_tile_backsplash_its_tile_work_adhesive_and_grout():
    got = lines(room([splash()]))
    tile, work = got["Fartuk plitkasi"], got["Ish: fartuk plitkasini terish"]
    assert (tile.qty, tile.unit, tile.unit_price_uzs, tile.is_approximate, tile.warning) == (0.79, "m²", 120_000, True, WALL_TILE_NORM_NOTE)
    assert tile.formula == "1.20 m × 0.60 m = 0.72 m² × 1.10 (chiqindi) = 0.79 m²"
    assert (work.qty, work.unit, work.unit_price_uzs) == (0.72, "m²", 130_000)
    assert {tile.category, work.category} == {"fartuk"}
    assert "0.72 m²" in got["Plitka yelimi"].formula
    assert "Zatirka" in got


def test_two_tile_backsplashes_sum():
    got = lines(room([splash(), splash(id="f2", startMm=0, lengthMm=800, wallId="B")]))
    assert got["Fartuk plitkasi"].formula == "0.72 + 0.48 = 1.20 m² × 1.10 (chiqindi) = 1.32 m²"
    assert got["Ish: fartuk plitkasini terish"].qty == 1.2


def test_a_skinali_backsplash_by_the_square_metre_with_its_fitting():
    got = lines(room([splash("skinali")]))
    glass, work = got["Skinali (shisha fartuk)"], got["Ish: skinali o'rnatish"]
    assert (glass.qty, glass.unit, glass.unit_price_uzs, glass.is_approximate) == (0.72, "m²", 450_000, True)
    assert glass.formula == "1.20 m × 0.60 m = 0.72 m²"
    assert (work.qty, work.unit_price_uzs) == (0.72, 80_000)
    assert "Fartuk plitkasi" not in got and "Plitka yelimi" not in got


def test_a_tagged_shop_skinali_gives_its_price():
    shop = SimpleNamespace(id=uuid.uuid4(), name_uz="Skinali Lux 6 mm", unit="m2", price_uzs=520_000, pack_qty=None, pack_unit=None,
                           smeta_key="skinali", is_active=True, store=SimpleNamespace(name="Glass Pro"))
    by = {ln.label: ln for ln in compute_estimate(room([splash("skinali")]), {}, {}, catalog={"skinali": shop}).lines}
    line = by["Skinali (shisha fartuk): Skinali Lux 6 mm"]
    assert (line.unit_price_uzs, line.is_approximate) == (520_000, False)


def test_a_wall_tiled_to_the_ceiling_is_not_tiled_twice_under_a_backsplash():
    plain = lines(room(None, {"ALL": PAINT, "A": TILE}))["Devor plitkasi"].qty
    with_splash = lines(room([splash("skinali")], {"ALL": PAINT, "A": TILE}))["Devor plitkasi"].qty
    assert with_splash == pytest.approx(plain - 0.72 * 1.10, abs=0.02)


def test_a_backsplash_on_a_wall_the_room_lacks_is_not_priced():
    assert not set(NEW) & set(lines(room([splash(wallId="E")])))


def test_skinali_is_a_shop_key_sold_by_the_square_metre():
    assert "skinali" in ALL_SMETA_KEYS and KEY_PACK_UNIT["skinali"] == "m2"


def test_the_category_is_read_with_the_wall_finish():
    assert CATEGORY_TO_GROUP["fartuk"] == "pardoz"


@pytest.mark.parametrize(("label", "ru", "en"), [
    ("Fartuk plitkasi", "Плитка фартука", "Backsplash tile"),
    ("Ish: fartuk plitkasini terish", "Работа: укладка плитки фартука", "Work: laying the backsplash tile"),
    ("Skinali (shisha fartuk)", "Скинали (стеклянный фартук)", "Skinali (glass backsplash)"),
    ("Ish: skinali o'rnatish", "Работа: монтаж скинали", "Work: fitting the skinali"),
])
def test_every_new_label_reads_in_russian_and_english(label, ru, en):
    assert localize_label(label, "ru") == ru
    assert localize_label(label, "en") == en


def test_the_formula_reads_in_russian():
    assert localize_formula("1.20 m × 0.60 m = 0.72 m²", "ru") == "1.20 м × 0.60 м = 0.72 м²"
