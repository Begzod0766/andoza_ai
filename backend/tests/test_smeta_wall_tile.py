"""Wall tile in the estimate (spec 2026-11-10): priced by the square metre of the tiled band, not as
a photo print the AI has to guess a price for."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.smeta import (
    FINISH_STAND_IN_NOTE, WALL_TILE_NORM_NOTE, _band_opening_m2, _tile_wall_areas, compute_estimate,
)

TILE = {"kind": "texture", "url": "/floor/tile/wall/600x600-plain.jpg", "color": "#ffffff", "finish": "tile"}
PHOTO = {"kind": "texture", "url": "https://x/my-photo.jpg", "color": "#ffffff"}
DOOR = {"type": "eshik", "width": 0.7, "height": 2.05, "position": 0.5}
WINDOW = {"type": "deraza", "width": 1.2, "height": 1.4, "sill_height": 0.9, "position": 0.5}
PLITKA = SimpleNamespace(id=uuid.uuid4(), name_uz="Kafel 30x60", category="plitka", unit="m2", price_uzs=150_000,
                         pack_qty=None, pack_unit=None, smeta_key=None, is_active=True, store=SimpleNamespace(name="Stroy Master"))


def room(coverings, elements=None, walls=None, vertices=None):
    walls = walls or [{"id": w, "length": length, "elements": (elements or {}).get(w, [])} for w, length in zip("ABCD", (2.5, 2.0, 2.5, 2.0))]
    geometry = {"walls": walls, **({"vertices": vertices} if vertices else {})}
    return SimpleNamespace(
        net_wall_area=24.3, floor_area=5.0, perimeter=9.0, openings_count=0, ceiling_h=2.7, room_type="hammom", name="Hammom",
        geometry=geometry, surfaces={}, state={"designState": {"wallCoverings": coverings}}, furniture_layout=[],
    )


def areas(r):
    return {wall: pytest.approx(area) for wall, area in _tile_wall_areas(r)}


def test_a_covering_set_only_under_ALL_tiles_every_wall():
    assert dict(_tile_wall_areas(room({"ALL": TILE}))) == {
        "A": pytest.approx(2.5 * 2.7), "B": pytest.approx(2.0 * 2.7), "C": pytest.approx(2.5 * 2.7), "D": pytest.approx(2.0 * 2.7),
    }


def test_one_tiled_wall_among_painted_ones():
    r = room({"ALL": {"kind": "paint", "color": "#fff"}, "A": TILE})
    assert dict(_tile_wall_areas(r)) == {"A": pytest.approx(2.5 * 2.7)}


def test_a_door_is_taken_out_of_its_wall():
    r = room({"ALL": TILE}, elements={"D": [DOOR]})
    assert dict(_tile_wall_areas(r))["D"] == pytest.approx(2.0 * 2.7 - 0.7 * 2.05)


@pytest.mark.parametrize(("element", "band", "expected"), [
    (WINDOW, 1.5, 1.2 * 0.6),    # the window's lower 0.6 m is inside the band
    (WINDOW, 0.8, 0.0),          # wholly above it
    (WINDOW, 2.7, 1.2 * 1.4),    # wholly inside
    (DOOR, 1.5, 0.7 * 1.5),      # a door reaches past the band
    (DOOR, 2.7, 0.7 * 2.05),
])
def test_only_the_part_of_an_opening_inside_the_band_counts(element, band, expected):
    assert _band_opening_m2(element, band) == pytest.approx(expected)


def test_a_scanned_polygon_room_is_tiled_wall_by_wall():
    walls = [{"id": str(i), "length": length, "elements": []} for i, length in enumerate((4.0, 2.0, 2.0, 1.5, 2.0, 3.5))]
    r = room({"ALL": TILE}, walls=walls, vertices=[[0, 0], [4, 0], [4, 2], [2, 2], [2, 3.5], [0, 3.5]])
    got = dict(_tile_wall_areas(r))
    assert list(got) == ["0", "1", "2", "3", "4", "5"]
    assert got["3"] == pytest.approx(1.5 * 2.7)


def test_a_room_with_no_walls_has_no_tile_area():
    r = room({"ALL": TILE})
    r.geometry = {}
    assert _tile_wall_areas(r) == []


def lines(r, catalog=None):
    return compute_estimate(r, {}, {}, catalog=catalog or {}).lines


def test_tile_is_a_tile_line_not_an_ai_priced_print():
    got = lines(room({"ALL": TILE}))
    tile = [ln for ln in got if ln.category == "plitka_devor"]
    assert len(tile) == 1
    assert not [ln for ln in got if ln.category == "texture"]
    assert not any(ln.needs_ai_price for ln in got)
    total = (2.5 + 2.0 + 2.5 + 2.0) * 2.7
    assert tile[0].qty == pytest.approx(round(total * 1.10, 2), abs=0.011)
    assert tile[0].unit == "m²" and "1.10" in tile[0].formula


def test_the_shops_tile_prices_it_and_is_named():
    [tile] = [ln for ln in lines(room({"ALL": TILE}), {"finish:plitka": PLITKA}) if ln.category == "plitka_devor"]
    assert tile.label == "Devor plitkasi: Kafel 30x60"
    assert tile.unit_price_uzs == 150_000 and tile.store_name == "Stroy Master"
    assert tile.is_approximate is True and tile.warning == FINISH_STAND_IN_NOTE


def test_without_a_shop_tile_the_norm_price_is_used():
    [tile] = [ln for ln in lines(room({"ALL": TILE})) if ln.category == "plitka_devor"]
    assert tile.label == "Devor plitkasi" and tile.unit_price_uzs == 120_000
    assert tile.is_approximate is True and tile.warning == WALL_TILE_NORM_NOTE


def test_a_users_own_photo_is_still_a_print():
    got = lines(room({"ALL": PHOTO}))
    assert [ln for ln in got if ln.category == "texture"]
    assert not [ln for ln in got if ln.category == "plitka_devor"]


# ─── Tile to a chosen height, paint above (Task 5) ─────────────────────────────

from app.services.smeta import _tile_above_areas  # noqa: E402


def band(mm, **extra):
    return {**TILE, "tileHeightMm": mm, **extra}


def test_tile_to_a_height_splits_the_wall():
    r = room({"ALL": {"kind": "paint", "color": "#fff"}, "A": band(1500)})
    assert dict(_tile_wall_areas(r)) == {"A": pytest.approx(2.5 * 1.5)}
    assert dict(_tile_above_areas(r)) == {"A": pytest.approx(2.5 * 1.2)}


def test_openings_are_shared_between_the_band_and_what_is_above():
    r = room({"A": band(1500), "ALL": {"kind": "plaster"}}, elements={"A": [DOOR]})
    assert dict(_tile_wall_areas(r))["A"] == pytest.approx(2.5 * 1.5 - 0.7 * 1.5)
    assert dict(_tile_above_areas(r))["A"] == pytest.approx(2.5 * 1.2 - 0.7 * 0.55)
    r = room({"A": band(1500), "ALL": {"kind": "plaster"}}, elements={"A": [WINDOW]})
    assert dict(_tile_wall_areas(r))["A"] == pytest.approx(2.5 * 1.5 - 1.2 * 0.6)
    assert dict(_tile_above_areas(r))["A"] == pytest.approx(2.5 * 1.2 - 1.2 * 0.8)


def test_a_height_past_the_ceiling_is_the_ceiling_and_a_tiny_one_is_30_cm():
    r = room({"A": band(3500), "ALL": {"kind": "plaster"}})
    assert dict(_tile_wall_areas(r))["A"] == pytest.approx(2.5 * 2.7)
    assert _tile_above_areas(r) == []
    r = room({"A": band(100), "ALL": {"kind": "plaster"}})
    assert dict(_tile_wall_areas(r))["A"] == pytest.approx(2.5 * 0.3)


def test_an_old_covering_with_no_height_goes_to_the_ceiling():
    assert _tile_above_areas(room({"ALL": TILE})) == []


def test_the_wall_above_the_tile_is_painted():
    r = room({"ALL": {"kind": "plaster"}, "A": band(1500, aboveColor="#EEE8DD")})
    paint = [ln for ln in lines(r) if ln.category == "boyoq"]
    assert len(paint) == 1 and paint[0].formula.startswith("3.0 m² (devor A)")  # 2.5 × 1.2 m² above the tile


def _prep(r, **kw):
    return {ln.category: ln for ln in compute_estimate(r, {}, {}, current_state="xom", **kw).lines if ln.category in ("suvoq", "grunt", "shpatlyovka")}


def test_no_putty_under_tile_when_every_wall_is_tiled_to_the_ceiling():
    """Tile is laid on plaster and primer; putty under it is money thrown away."""
    prep = _prep(room({"ALL": TILE}))
    assert set(prep) == {"suvoq", "grunt"}
    assert prep["suvoq"].formula.startswith("24.3 m²")


def test_putty_only_for_the_part_of_the_walls_that_is_not_tile():
    half = {**TILE, "tileHeightMm": 1350}          # half of a 2.7 m wall
    prep = _prep(room({"ALL": half}))
    assert prep["shpatlyovka"].formula.startswith("12.2 m² × ")   # 24.3 − 12.15
    assert prep["grunt"].formula.startswith("24.3 m²")


def test_putty_is_unchanged_in_a_room_without_tile():
    prep = _prep(room({"ALL": {"kind": "paint", "color": "#ffffff"}}))
    assert prep["shpatlyovka"].formula.startswith("24.3 m² × ")
