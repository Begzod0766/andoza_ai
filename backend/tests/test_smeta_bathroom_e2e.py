"""Estimate fixes from the 2026-11-18 end-to-end bathroom test.

- A tile nobody picked a product for no longer names an unrelated shop product (a black 60×120
  for a white 300×600): the median of the shop's tiles of the chosen size, named, when there are
  any, else an unnamed "(o'rtacha narx)" line at the median of all tiles.
- A ceiling not finished yet is primed and painted (with the painter's work), whatever is built.
- A bathroom with a tile floor has no skirting unless the user puts one on; a skirting the user
  took off (designState.skirting = null) is not priced in any room.
- Paint sold in cans of a size the product names ("2,5 л") is bought in whole cans.
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services import estimate_catalog as ec
from app.services.smeta import FINISH_STAND_IN_NOTE, compute_estimate
from app.services.smeta_text import localize_formula, localize_label

STORE = SimpleNamespace(name="Qurilish Bozori")


def product(category, price, unit, name, smeta_key=None):
    return SimpleNamespace(
        id=uuid.uuid4(), name_uz=name, category=category, unit=unit, price_uzs=price, pack_qty=None,
        pack_unit=None, smeta_key=smeta_key, is_active=True, store=STORE, roll_width_cm=None, roll_length_m=None,
    )


BLACK_60x120 = product("plitka", 204_000, "m2", "Керамогранит Geolam стекловидная плитка 60х120см Tegal nero (Маттовый)")
WHITE_300x600 = product("plitka", 150_000, "m2", "Kafel oq marmar 30x60")
PAINT_CAN = product("boyoq", 48_000, "litr", "Краска Polisan Perla матовая 2,5 л")
TILE_600x300 = {"kind": "texture", "url": "/wall/tile/marble-white-600x300.jpg", "color": "#ffffff", "finish": "tile"}


def room(design=None, room_type="hammom", floor_area=4.5, perimeter=8.6):
    walls = [{"id": w, "length": length, "elements": []} for w, length in zip("ABCD", (2.5, 1.8, 2.5, 1.8))]
    return SimpleNamespace(
        net_wall_area=23.2, floor_area=floor_area, perimeter=perimeter, openings_count=0, ceiling_h=2.7,
        room_type=room_type, name="Hammom" if room_type == "hammom" else "Mehmonxona",
        geometry={"walls": walls}, surfaces={}, state={"designState": design or {}}, furniture_layout=[],
    )


def estimate(r, catalog, **kw):
    return compute_estimate(r, {}, {}, catalog=catalog, **kw).lines


def of(lines, category):
    return [ln for ln in lines if ln.category == category]


# ── #8: the tile a line is labelled with ────────────────────────────────────

@pytest.mark.parametrize(("name", "size"), [
    ("Керамогранит Geolam стекловидная плитка 60х120см Tegal nero (Маттовый)", (600, 1200)),
    ("Керамогранит (кафель) Lux ceramics group, R CASTELLO B, 600x600 мм", (600, 600)),
    ("Estima Oq 60×60", (600, 600)),
    ("Kafel 600x300", (300, 600)),
    ("Keramik kafel", None),
])
def test_a_tiles_size_is_read_off_its_name(name, size):
    assert ec.tile_size_mm(name) == size


def test_the_median_tile_of_each_size_is_kept_too():
    big = product("plitka", 200_000, "m2", "Plitka 60x120 sm")
    picked = ec.pick_median_finishes([BLACK_60x120, big, WHITE_300x600])
    assert picked["finish:plitka:600x1200"] is big          # the lower middle of 200 000 and 204 000
    assert picked["finish:plitka:300x600"] is WHITE_300x600
    assert picked["finish:plitka"] is WHITE_300x600 or picked["finish:plitka"] is big


def test_a_wall_tile_with_no_shop_tile_of_its_size_names_no_product():
    lines = estimate(room({"wallCoverings": {"ALL": TILE_600x300}}), {"finish:plitka": BLACK_60x120})
    [tile] = of(lines, "plitka_devor")
    assert tile.label == "Devor plitkasi (o'rtacha narx)"
    assert tile.unit_price_uzs == BLACK_60x120.price_uzs
    assert tile.material_id is None and tile.store_name is None
    assert tile.is_approximate and tile.warning == FINISH_STAND_IN_NOTE


def test_a_wall_tile_takes_the_shops_tile_of_its_size():
    catalog = {"finish:plitka": BLACK_60x120, "finish:plitka:300x600": WHITE_300x600}
    [tile] = of(estimate(room({"wallCoverings": {"ALL": TILE_600x300}}), catalog), "plitka_devor")
    assert tile.label == f"Devor plitkasi: {WHITE_300x600.name_uz}"
    assert tile.unit_price_uzs == WHITE_300x600.price_uzs and tile.material_id == str(WHITE_300x600.id)
    assert tile.is_approximate and tile.warning == FINISH_STAND_IN_NOTE


def test_a_tile_floor_with_no_size_names_no_product():
    lines = estimate(room({"floorType": "tile", "floorConfigured": True}), {"finish:plitka": BLACK_60x120})
    [floor] = of(lines, "plitka")
    assert floor.label == "Pol plitkasi (o'rtacha narx)"
    assert floor.unit_price_uzs == BLACK_60x120.price_uzs
    assert floor.material_id is None and floor.store_name is None
    assert floor.is_approximate and floor.warning == FINISH_STAND_IN_NOTE


def test_a_tile_floor_of_a_chosen_size_takes_the_shops_tile_of_that_size():
    design = {"floorType": "tile", "floorConfigured": True,
              "floorPattern": {"id": "stake_bond", "settings": {"plankLengthCm": 60, "plankWidthCm": 30}}}
    catalog = {"finish:plitka": BLACK_60x120, "finish:plitka:300x600": WHITE_300x600}
    [floor] = of(estimate(room(design), catalog), "plitka")
    assert floor.label == f"Plitka: {WHITE_300x600.name_uz}"
    assert floor.unit_price_uzs == WHITE_300x600.price_uzs and floor.is_approximate


def test_a_backsplash_tile_names_no_product():
    design = {"backsplashes": [{"id": "b1", "wallId": "A", "material": "tile", "startMm": 0, "lengthMm": 1000,
                                "bottomMm": 900, "topMm": 1500}]}
    lines = estimate(room(design, room_type="oshxona"), {"finish:plitka": BLACK_60x120})
    tiles = [ln for ln in of(lines, "fartuk") if "plitkasi" in ln.label and not ln.label.startswith("Ish")]
    assert [ln.label for ln in tiles] == ["Fartuk plitkasi (o'rtacha narx)"]
    assert tiles[0].material_id is None


def test_the_new_tile_labels_are_translated():
    assert localize_label("Devor plitkasi (o'rtacha narx)", "ru") != "Devor plitkasi (o'rtacha narx)"
    assert localize_label("Pol plitkasi (o'rtacha narx)", "en") != "Pol plitkasi (o'rtacha narx)"
    assert localize_label("Fartuk plitkasi (o'rtacha narx)", "en") != "Fartuk plitkasi (o'rtacha narx)"


# ── #9: the ceiling ─────────────────────────────────────────────────────────

def ceiling_lines(lines):
    return [ln for ln in lines if ln.category == "shift_boyoq"]


@pytest.mark.parametrize("design", [{}, {"ceiling": {"design": "non_drop"}}, {"ceiling": {"design": "flat"}}])
def test_a_ceiling_is_primed_and_painted(design):
    lines = ceiling_lines(estimate(room(design), {"finish:boyoq": PAINT_CAN}))
    labels = [ln.label for ln in lines]
    assert labels[0].startswith("Shift grunti")
    assert labels[1] == f"Namga chidamli shift bo'yog'i: {PAINT_CAN.name_uz}"   # a bathroom's
    assert labels[2] == "Ish: shiftni bo'yash"
    paint, work = lines[1], lines[2]
    assert "4.5 m²" in paint.formula and paint.is_approximate and paint.warning.startswith(FINISH_STAND_IN_NOTE)
    assert work.qty == pytest.approx(4.5) and work.subtotal_uzs > 0


def test_a_living_rooms_ceiling_paint_is_a_plain_one():
    lines = ceiling_lines(estimate(room(room_type="mehmonxona"), {"finish:boyoq": PAINT_CAN}))
    assert lines[1].label == f"Shift bo'yog'i: {PAINT_CAN.name_uz}"


def test_a_ceiling_with_no_paint_in_any_shop_is_still_priced():
    lines = ceiling_lines(estimate(room(), {}))
    assert [ln.label for ln in lines][1] == "Namga chidamli shift bo'yog'i (material tanlanmagan)"
    assert all(ln.subtotal_uzs > 0 for ln in lines)


def test_a_finished_ceiling_is_not_painted_again():
    assert ceiling_lines(estimate(room(), {"finish:boyoq": PAINT_CAN}, ceiling_state="tayyor")) == []


def test_a_puttied_ceiling_is_painted_but_not_primed():
    from app.services.smeta import STAGE_SHPAKLOVKA

    lines = ceiling_lines(estimate(room(), {"finish:boyoq": PAINT_CAN}, ceiling_state=STAGE_SHPAKLOVKA))
    assert [ln.label for ln in lines] == [f"Namga chidamli shift bo'yog'i: {PAINT_CAN.name_uz}", "Ish: shiftni bo'yash"]


def test_the_ceiling_labels_are_translated():
    for label in ("Shift grunti: X", "Shift grunti (asosiy qatlam) 5 kg qop", "Shift bo'yog'i: X",
                  "Namga chidamli shift bo'yog'i: X", "Shift bo'yog'i (material tanlanmagan)",
                  "Namga chidamli shift bo'yog'i (material tanlanmagan)", "Ish: shiftni bo'yash"):
        assert localize_label(label, "ru") != label, label


# ── #10: skirting ───────────────────────────────────────────────────────────

TILE_FLOOR = {"floorType": "tile", "floorConfigured": True}
CATALOG = {"finish:plitka": BLACK_60x120, "finish:laminat": product("laminat", 95_000, "m2", "Laminat")}


def test_a_bathroom_with_a_tile_floor_has_no_skirting_by_default():
    assert of(estimate(room(TILE_FLOOR), CATALOG), "plintus") == []


def test_a_bathroom_skirting_the_user_put_on_is_priced():
    design = {**TILE_FLOOR, "skirting": {"id": "tekis", "heightMm": 144, "widthMm": 18}}
    assert len(of(estimate(room(design), CATALOG), "plintus")) == 1


def test_a_skirting_the_user_took_off_is_not_priced_in_any_room():
    design = {"floorType": "laminate", "floorConfigured": True, "skirting": None}
    assert of(estimate(room(design, room_type="mehmonxona"), CATALOG), "plintus") == []


def test_a_living_room_keeps_its_default_skirting():
    design = {"floorType": "laminate", "floorConfigured": True}
    assert len(of(estimate(room(design, room_type="mehmonxona"), CATALOG), "plintus")) == 1


def test_a_picked_tile_product_in_a_bathroom_has_no_skirting_either():
    mine = product("plitka", 150_000, "m2", "Mening plitkam")
    r = room(TILE_FLOOR)
    r.surfaces = {"floor": str(mine.id)}
    lines = compute_estimate(r, {str(mine.id): mine}, {}, catalog=CATALOG).lines
    assert of(lines, "plintus") == []


# ── paint in whole cans ─────────────────────────────────────────────────────

def test_paint_sold_in_cans_is_bought_in_whole_cans():
    # Wall C painted: 2.5 m × 2.7 m = 6.75 m² × 2 coats ÷ 9 m²/l = 1.5 l → 1 can of 2.5 l.
    design = {"wallCoverings": {"ALL": TILE_600x300, "C": {"kind": "paint", "color": "#ffffff"}}}
    [paint] = of(estimate(room(design), {"finish:boyoq": PAINT_CAN}), "boyoq")
    assert paint.qty == pytest.approx(2.5)
    assert paint.formula.endswith("= 1.5 litr → 1 banka (2.5 litr) = 2.5 litr")
    assert paint.subtotal_uzs == round(2.5 * PAINT_CAN.price_uzs)


def test_paint_with_no_can_size_is_still_bought_by_the_litre():
    plain = product("boyoq", 45_000, "litr", "Akril devor bo'yog'i")
    design = {"wallCoverings": {"ALL": TILE_600x300, "C": {"kind": "paint", "color": "#ffffff"}}}
    [paint] = of(estimate(room(design), {"finish:boyoq": plain}), "boyoq")
    assert paint.qty == 2 and paint.formula.endswith("= 2 litr")


# ── formulas ────────────────────────────────────────────────────────────────

def test_the_heated_floor_formula_is_translated():
    formula = "4.50 m² − 1.67 m² (jihozlar ostida) = 2.83 m² → 2.5 m²"
    assert "jihozlar" not in localize_formula(formula, "ru")
    assert "jihozlar" not in localize_formula(formula, "en")
    assert localize_formula(formula, "uz") == formula


def test_a_can_in_a_formula_is_translated():
    ru = localize_formula("6.8 m² × 2 qatlam ÷ 9.0 m²/litr = 1.5 litr → 1 banka (2.5 litr) = 2.5 litr", "ru")
    assert "banka" not in ru and "litr" not in ru
