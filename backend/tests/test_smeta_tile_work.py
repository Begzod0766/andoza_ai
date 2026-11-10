"""Tile adhesive, grout and laying work (spec 2026-11-10): in any room with tile, on the floor or walls."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.services.smeta import TILE_NORM_NOTE, _tile_work_lines, compute_estimate
from app.services.smeta_groups import GROUP_ORDER, group_key_for

TILE = {"kind": "texture", "url": "/floor/tile/wall/600x600-plain.jpg", "color": "#ffffff", "finish": "tile"}
PAINT = {"kind": "paint", "color": "#ffffff"}
STORE = SimpleNamespace(name="Stroy Master")


def product(key, price, unit, pack_qty=None, pack_unit=None, name=None, category="boshqa"):
    return SimpleNamespace(id=uuid.uuid4(), name_uz=name or key, category=category, unit=unit, price_uzs=price,
                           pack_qty=pack_qty, pack_unit=pack_unit, smeta_key=key, is_active=True, store=STORE)


def room(walls=PAINT, floor=None):
    design = {"wallCoverings": {"ALL": walls}}
    if floor:
        design.update(floorConfigured=True, floorType=floor)
    return SimpleNamespace(
        net_wall_area=24.3, floor_area=5.0, perimeter=9.0, openings_count=0, ceiling_h=2.7, room_type="mehmonxona", name="Zal",
        geometry={"walls": [{"id": w, "length": length, "elements": []} for w, length in zip("ABCD", (2.5, 2.0, 2.5, 2.0))]},
        surfaces={}, state={"designState": design}, furniture_layout=[],
    )


def by_label(lines):
    return {ln.label: ln for ln in lines}


def work(r, catalog=None, **kw):
    return by_label(ln for ln in compute_estimate(r, {}, {}, catalog=catalog or {}, **kw).lines if ln.category == "plitka_ish")


def test_adhesive_grout_and_work_for_a_floor_and_walls():
    got = by_label(_tile_work_lines(5.0, 20.0, {}))
    glue = got["Plitka yelimi"]
    assert (glue.qty, glue.unit, glue.unit_price_uzs) == (5, "qop", 45_000)  # 125 kg in 25 kg bags
    assert glue.is_approximate and glue.warning == TILE_NORM_NOTE and "125" in glue.formula
    grout = got["Zatirka"]
    assert (grout.qty, grout.unit, grout.unit_price_uzs) == (5, "dona", 35_000)  # 10 kg in 2 kg packs
    assert (got["Ish: pol plitkasini terish"].qty, got["Ish: pol plitkasini terish"].subtotal_uzs) == (5.0, 400_000)
    assert (got["Ish: devor plitkasini terish"].qty, got["Ish: devor plitkasini terish"].subtotal_uzs) == (20.0, 2_000_000)
    assert all(ln.category == "plitka_ish" for ln in got.values())


def test_bags_round_up_and_a_floor_alone_has_no_wall_work():
    got = by_label(_tile_work_lines(5.2, 0.0, {}))
    assert got["Plitka yelimi"].qty == 2  # 26 kg
    assert got["Zatirka"].qty == 2        # 2.08 kg
    assert "Ish: devor plitkasini terish" not in got and "Ish: pol plitkasini terish" in got


def test_no_tile_no_lines():
    assert _tile_work_lines(0.0, 0.0, {}) == []


def test_a_shop_adhesive_gives_its_bag_price_and_name():
    glue = product("plitka_yelimi", 52_000, "qop", 25, "kg", name="Ceresit CM 11")
    line = by_label(_tile_work_lines(5.0, 0.0, {"plitka_yelimi": glue}))["Plitka yelimi: Ceresit CM 11"]
    assert line.unit_price_uzs == 52_000 and line.qty == 1 and line.store_name == "Stroy Master"
    assert line.is_approximate is False and line.warning is None


def test_a_shop_bag_of_another_size_is_counted_in_its_own_bags():
    glue = product("plitka_yelimi", 30_000, "qop", 10, "kg", name="Yelim 10 kg")
    assert by_label(_tile_work_lines(5.0, 0.0, {"plitka_yelimi": glue}))["Plitka yelimi: Yelim 10 kg"].qty == 3  # 25 kg


def test_a_tiled_room_gets_the_lines_from_its_own_areas():
    got = work(room(walls=TILE, floor="tile"))
    assert got["Ish: pol plitkasini terish"].qty == 5.0
    assert got["Ish: devor plitkasini terish"].qty == 24.3
    assert got["Plitka yelimi"].qty == 6  # (5 + 24.3) × 5 = 146.5 kg


def test_a_floor_already_finished_is_left_out():
    got = work(room(walls=TILE, floor="tile"), floor_state="tayyor")
    assert "Ish: pol plitkasini terish" not in got
    assert got["Plitka yelimi"].qty == 5  # walls only: 121.5 kg


def test_a_room_without_tile_has_no_tile_work():
    assert work(room(walls=PAINT, floor="laminate")) == {}


def test_a_picked_floor_tile_product_counts_as_a_tile_floor():
    tile = product(None, 120_000, "m2", name="Keramogranit", category="plitka")
    r = room()
    r.surfaces = {"floor": str(tile.id)}
    got = by_label(ln for ln in compute_estimate(r, {str(tile.id): tile}, {}, catalog={}).lines if ln.category == "plitka_ish")
    assert got["Ish: pol plitkasini terish"].qty == 5.0


def test_the_group_sits_right_after_the_floor():
    assert group_key_for("plitka_ish") == "plitka_ish"
    assert GROUP_ORDER.index("plitka_ish") == GROUP_ORDER.index("pol") + 1
