"""Waterproofing areas for a bathroom (spec 2026-11-10): the floor, the foot of the walls, and the
walls a bathtub or shower touches."""
from __future__ import annotations

import math

import pytest

from app.services.waterproofing import waterproof_areas

# 2.5 m (A, C) × 2.0 m (B, D), room-centred: A at z = -1, C at z = +1, D at x = -1.25, B at x = +1.25.
RECT = {"walls": [{"id": "A", "length": 2.5}, {"id": "B", "length": 2.0}, {"id": "C", "length": 2.5}, {"id": "D", "length": 2.0}]}
DOOR = 0.7
GAP = 0.04  # a fixture stands this far off its wall


def fixture(x, z, w, d, rotation=0.0):
    """Centre in metres (the function takes mm), turned `rotation`; its back is towards -z at 0."""
    return {"x": x * 1000, "y": z * 1000, "rotation": rotation, "w": w, "d": d}


def areas(fixtures, geometry=RECT, floor=5.0, doors=DOOR):
    return waterproof_areas(geometry, fixtures, floor, doors)


def test_no_fixtures_the_floor_and_the_foot_of_the_walls():
    got = areas([])
    assert got["floor"] == 5.0
    assert got["base"] == pytest.approx((9.0 - 0.7) * 0.2)
    assert got["wet"] == 0
    assert got["total"] == pytest.approx(5.0 + 1.66)
    assert got["tape_m"] == pytest.approx(8.3)


def test_a_bathtub_along_a_wall_wets_that_wall():
    tub = fixture(0, -1 + GAP + 0.35, 1.7, 0.7)  # back on A, centred, ends clear of B and D
    got = areas([tub])
    assert got["wet"] == pytest.approx((1.7 + 0.6) * 1.6)
    assert got["tape_m"] == pytest.approx(8.3)


def test_a_bathtub_in_a_corner_wets_both_walls_and_the_corner_gets_tape():
    tub = fixture(1.25 - GAP - 0.85, -1 + GAP + 0.35, 1.7, 0.7)  # its end against B
    got = areas([tub])
    on_a = (1.7 + GAP + 0.3)      # clipped at the corner on one side, +0.3 on the other
    on_b = (0.7 + GAP + 0.3)
    assert got["wet"] == pytest.approx((on_a + on_b) * 1.6, abs=0.02)
    assert got["tape_m"] == pytest.approx(8.3 + 1.8)


def test_a_shower_in_a_corner_wets_two_walls():
    shower = fixture(-1.25 + GAP + 0.5, 1 - GAP - 0.5, 1.0, 1.0, rotation=math.pi)  # corner C–D
    got = areas([shower])
    assert got["wet"] == pytest.approx(2 * (1.0 + GAP + 0.3) * 1.6, abs=0.02)
    assert got["tape_m"] == pytest.approx(8.3 + 1.8)


def test_strips_that_overlap_on_one_wall_are_counted_once():
    a = fixture(-0.4, -1 + GAP + 0.35, 0.8, 0.7)
    b = fixture(0.4, -1 + GAP + 0.35, 0.8, 0.7)   # side by side: together 1.6 m wide
    assert areas([a, b])["wet"] == pytest.approx((1.6 + 0.6) * 1.6)


def test_a_fixture_in_the_middle_of_the_room_wets_nothing():
    assert areas([fixture(0, 0, 0.9, 0.9)])["wet"] == 0


def test_a_fixture_turned_at_an_angle_wets_no_more_than_its_shadow_on_the_wall():
    turned = fixture(0, -1 + 0.62, 0.8, 0.8, rotation=math.pi / 4)  # a corner 5 cm off wall A
    got = areas([turned])
    span = 0.8 * math.sqrt(2)
    assert 0 < got["wet"] <= (span + 0.6) * 1.6 + 1e-6


def test_a_strip_never_runs_past_its_wall():
    wide = fixture(0, -1 + GAP + 0.35, 2.4, 0.7)  # 5 cm short of B and D: it touches all three walls
    got = areas([wide])
    # Wall A end to end (2.5 m, not 2.4 + 0.6), and the tub's ends on B and D. Two decimals.
    assert got["wet"] == pytest.approx((2.5 + 2 * (0.7 + GAP + 0.3)) * 1.6, abs=0.006)
    assert got["tape_m"] == pytest.approx(8.3 + 2 * 1.8)


def test_a_scanned_polygon_room():
    ell = {"walls": [{"id": str(i), "length": length} for i, length in enumerate((4.0, 2.0, 2.0, 1.5, 2.0, 3.5))],
           "vertices": [[0, 0], [4, 0], [4, 2], [2, 2], [2, 3.5], [0, 3.5]]}
    # Centroid of the six vertices is (2.0, 1.8333): the corner of walls 0 and 5 is at (-2, -1.8333).
    shower = fixture(-2 + GAP + 0.5, -11 / 6 + GAP + 0.5, 1.0, 1.0)
    got = waterproof_areas(ell, [shower], 11.0, 0.8)
    assert got["wet"] == pytest.approx(2 * (1.0 + GAP + 0.3) * 1.6, abs=0.02)
    assert got["base"] == pytest.approx((15.0 - 0.8) * 0.2)


def test_a_room_with_no_walls_is_only_its_floor():
    got = waterproof_areas({"walls": []}, [fixture(0, 0, 1, 1)], 5.0, 0.0)
    assert (got["base"], got["wet"], got["tape_m"], got["total"]) == (0, 0, 0, 5.0)


# ─── Final review: a fixture must be AT the wall, not merely on its line ───────

U_ROOM = {"walls": [{"id": str(i), "length": length} for i, length in enumerate((6.0, 6.0, 2.0, 4.0, 2.0, 4.0, 2.0, 6.0))],
          "vertices": [[0, 0], [6, 0], [6, 6], [4, 6], [4, 2], [2, 2], [2, 6], [0, 6]]}


def test_a_wall_across_a_notch_is_not_wet_by_a_fixture_behind_its_line():
    # The vertices' mean is (3.0, 3.5). A shower in the right leg, against the outer wall x = 6 at
    # z = 4..5: the left leg's inner wall (x = 2) spans the same z, but the shower is 3 m behind it.
    shower = fixture(6 - 3.0 - GAP - 0.5, 4.5 - 3.5, 1.0, 1.0, rotation=-math.pi / 2)
    got = waterproof_areas(U_ROOM, [shower], 28.0, 0.8)
    assert got["wet"] == pytest.approx((1.0 + 0.6) * 1.6, abs=0.02)


def test_a_fixture_left_outside_the_room_wets_nothing():
    assert areas([fixture(2.0, 0, 1.0, 1.0)])["wet"] == 0


def test_a_fixture_a_few_millimetres_past_an_inner_corner_does_not_wet_the_next_wall():
    ell = {"walls": [{"id": str(i), "length": length} for i, length in enumerate((4.0, 2.0, 2.0, 1.5, 2.0, 3.5))],
           "vertices": [[0, 0], [4, 0], [4, 2], [2, 2], [2, 3.5], [0, 3.5]]}
    # Wall 2 runs along z = 2 from x = 4 to x = 2 (inner corner at (2, 2)). A tub under it in the
    # lower leg whose end reaches 5 mm past x = 2 along wall 3's line must not wet wall 3.
    cx, cz = 2.0, 11 / 6
    tub = fixture(2.85 - 0.005 - cx, 2 - GAP - 0.35 - cz, 1.7, 0.7, rotation=math.pi)
    got = waterproof_areas(ell, [tub], 11.0, 0.8)
    assert got["wet"] == pytest.approx(min(2.0, 1.7 + 0.6) * 1.6, abs=0.02)
