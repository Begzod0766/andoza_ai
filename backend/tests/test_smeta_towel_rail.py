"""A heated towel rail in the estimate (spec 2026-11-10): the rail, its two points' pipe, fittings and work."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.pipe_scheme import pipe_scheme
from app.services.plumbing import riser_spot
from app.services.smeta import EXTRAS_NORM_NOTE, _plumbing_lines, _round2, compute_estimate
from app.services.smeta_groups import group_key_for
from app.services.smeta_text import localize_label
from app.services.towel_rail import rail_points

GEOMETRY = {"walls": [
    {"id": "A", "length": 2.5, "elements": []}, {"id": "B", "length": 2.0, "elements": []},
    {"id": "C", "length": 2.5, "elements": []},
    {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "position": 0.5}]},
]}
POLYGON = {"walls": [{"id": str(i), "length": length, "elements": []} for i, length in enumerate((3.0, 2.0, 1.803, 1.803, 2.0))],
           "vertices": [[0, 0], [3, 0], [3, 2], [1.5, 3], [0, 2]]}
RAIL = {"id": "r1", "wallId": "A", "positionMm": 600, "heightMm": 1000}
RAIL2 = {"id": "r2", "wallId": "C", "positionMm": 1200, "heightMm": 1000}
COLD = {"id": "p1", "kind": "cold", "diameterMm": 20, "wallId": "B", "positionMm": 1000, "heightMm": 500}
NO_KEY = object()


def room(rails=NO_KEY, plumbing=NO_KEY, furniture=(), geometry=GEOMETRY):
    state: dict = {"furniture": list(furniture)}
    if rails is not NO_KEY:
        state["towelRails"] = rails
    if plumbing is not NO_KEY:
        state["plumbing"] = plumbing
    return SimpleNamespace(
        state=state, geometry=geometry, net_wall_area=24.3, floor_area=5.0, perimeter=9.0, openings_count=1, ceiling_h=2.7,
        room_type="hammom", name="Hammom", surfaces={}, furniture_layout=[], room_scan=None,
    )


def by_label(lines):
    return {ln.label: ln for ln in lines}


def run_m(points, geometry=GEOMETRY):
    """The water pipe of the room's pipe scheme (spec 2026-11-11), with the reserve."""
    water = pipe_scheme(geometry, riser_spot(geometry, None), points)["pipes"]["water_20"]
    return _round2((water["trunkMm"] + water["branchMm"]) / 1000 * 1.15)


def test_a_rail_adds_the_rail_its_pipe_fittings_and_work():
    got = by_label(_plumbing_lines(room(rails=[RAIL]), {}))
    rail = got["Sochiq quritgich (50×80)"]
    assert (rail.qty, rail.unit, rail.unit_price_uzs, rail.category) == (1, "dona", 650_000, "santexnika")
    assert rail.is_approximate and rail.warning == EXTRAS_NORM_NOTE
    assert got["Suv rozetkasi Ø20"].qty == 2 and got["Ish: nuqtani ulash"].qty == 2
    pipe = got["Suv quvuri PPR Ø20"]
    assert pipe.formula.startswith("Magistral ")
    assert pipe.qty == run_m(rail_points([RAIL], GEOMETRY)) > 0
    work = got["Ish: sochiq quritgichni o'rnatish"]
    assert (work.qty, work.unit, work.unit_price_uzs, work.category) == (1, "dona", 200_000, "santexnika")


def test_two_rails_count_twice():
    got = by_label(_plumbing_lines(room(rails=[RAIL, RAIL2]), {}))
    assert got["Sochiq quritgich (50×80)"].qty == 2 and got["Sochiq quritgich (50×80)"].subtotal_uzs == 1_300_000
    assert got["Suv rozetkasi Ø20"].qty == 4 and got["Ish: sochiq quritgichni o'rnatish"].qty == 2


def test_rail_points_join_saved_points():
    got = by_label(_plumbing_lines(room(rails=[RAIL], plumbing=[COLD]), {}))
    assert got["Suv rozetkasi Ø20"].qty == 3
    assert got["Suv quvuri PPR Ø20"].qty == run_m([COLD, *rail_points([RAIL], GEOMETRY)])


def test_a_room_with_saved_empty_plumbing_and_a_rail_still_gets_the_lines():
    got = by_label(_plumbing_lines(room(rails=[RAIL], plumbing=[]), {}))
    assert got["Suv rozetkasi Ø20"].qty == 2 and "Suv quvuri PPR Ø20" in got


def test_rail_points_join_derived_points():
    tub = {"id": "tub", "furniture_id": "vanna-1", "name": "Vanna 1", "x": 0, "y": -610, "rotation": 0}
    without = by_label(_plumbing_lines(room(furniture=[tub]), {}))
    with_rail = by_label(_plumbing_lines(room(rails=[RAIL], furniture=[tub]), {}))
    assert without["Ish: nuqtani ulash"].qty == 3 and with_rail["Ish: nuqtani ulash"].qty == 5
    assert without["Suv rozetkasi Ø20"].qty == 2 and with_rail["Suv rozetkasi Ø20"].qty == 4


@pytest.mark.parametrize("rails", [[{"id": "r1", "wallId": "Z", "positionMm": 600, "heightMm": 1000}], "x", None, [None, 3]])
def test_a_rail_the_room_cannot_hold_is_skipped(rails):
    assert _plumbing_lines(room(rails=rails), {}) == []


def test_a_saved_rail_point_is_not_counted_twice():
    """Rail points are never saved; one that got into ``plumbing`` anyway is ignored in favour of the rule."""
    stray = {**rail_points([RAIL], GEOMETRY)[0]}
    got = by_label(_plumbing_lines(room(rails=[RAIL], plumbing=[stray]), {}))
    assert got["Suv rozetkasi Ø20"].qty == 2


def test_a_tagged_shop_rail_gives_its_price_name_and_shop():
    shop = SimpleNamespace(id=uuid.uuid4(), name_uz="Terminus Versal", unit="dona", price_uzs=820_000, pack_qty=None, pack_unit=None,
                           smeta_key="sochiq_quritgich", is_active=True, store=SimpleNamespace(name="Stroy Master"))
    rail = by_label(_plumbing_lines(room(rails=[RAIL]), {"sochiq_quritgich": shop}))["Sochiq quritgich: Terminus Versal"]
    assert (rail.unit_price_uzs, rail.store_name, rail.is_approximate, rail.warning) == (820_000, "Stroy Master", False, None)


def test_no_rails_no_change():
    key = lambda r: [(ln.label, ln.qty, ln.subtotal_uzs) for ln in _plumbing_lines(r, {})]  # noqa: E731
    assert key(room(rails=[], plumbing=[COLD])) == key(room(plumbing=[COLD]))
    assert _plumbing_lines(room(rails=[]), {}) == []


def test_a_polygon_room():
    rail = {"id": "r1", "wallId": "2", "positionMm": 900, "heightMm": 1000}
    got = by_label(_plumbing_lines(room(rails=[rail], geometry=POLYGON), {}))
    assert got["Sochiq quritgich (50×80)"].qty == 1
    assert got["Suv quvuri PPR Ø20"].qty == run_m(rail_points([rail], POLYGON), POLYGON)


@pytest.mark.parametrize(("label", "ru", "en"), [
    ("Sochiq quritgich", "Полотенцесушитель", "Heated towel rail"),
    ("Sochiq quritgich: Terminus Versal", "Полотенцесушитель: Terminus Versal", "Heated towel rail: Terminus Versal"),
    ("Ish: sochiq quritgichni o'rnatish", "Работа: установка полотенцесушителя", "Work: fitting the towel rail"),
])
def test_labels_read_in_russian_and_english(label, ru, en):
    assert (localize_label(label, "ru"), localize_label(label, "en")) == (ru, en)


def test_rail_and_fan_lines_are_in_the_estimate_outside_the_furniture_group():
    """The "repair only" view drops the furniture group alone: the rail and the fan stay in its total."""
    lines = compute_estimate(room(rails=[RAIL]), {}, {}, catalog={}).lines
    groups = {ln.label: group_key_for(ln.category) for ln in lines}
    assert groups["Sochiq quritgich (50×80)"] == "santexnika" and groups["Ish: sochiq quritgichni o'rnatish"] == "santexnika"
    fan = next(k for k in groups if k.startswith("Tortuvchi ventilyator"))  # named by its size (2026-11-14)
    assert groups[fan] == "elektr"
    assert "jihoz" not in {groups[k] for k in ("Sochiq quritgich (50×80)", fan)}


def test_a_room_priced_from_its_saved_geometry_keeps_the_pipe_run_sane():
    """Final review: with no geometry on the room row the studio's saved one (mm) is used; its
    vertices were left in mm, so a polygon wall read 1000 times too long and a rail past the wall's
    end gave a negative pipe line."""
    saved = {"walls": [{"id": str(i), "length": length, "elements": []} for i, length in enumerate((3000, 2000, 1803, 1803, 2000))],
             "vertices": [[0, 0], [3000, 0], [3000, 2000], [1500, 3000], [0, 2000]]}
    r = room(rails=[{"id": "r1", "wallId": "2", "positionMm": 99999, "heightMm": 1000}], geometry=None)
    r.state["geometry"] = saved
    got = by_label(_plumbing_lines(r, {}))
    pipe = got["Suv quvuri PPR Ø20"]
    assert 0 < pipe.qty < 30 and pipe.subtotal_uzs > 0
    same = by_label(_plumbing_lines(room(rails=[{"id": "r1", "wallId": "2", "positionMm": 99999, "heightMm": 1000}], geometry=POLYGON), {}))
    assert pipe.qty == pytest.approx(same["Suv quvuri PPR Ø20"].qty, abs=0.05)


# A rail's size and a picked shop product (spec 2026-11-15).
def _shop(key, price, name):
    return SimpleNamespace(id=uuid.uuid4(), name_uz=name, unit="dona", price_uzs=price, pack_qty=None, pack_unit=None,
                           smeta_key=key, is_active=True, store=SimpleNamespace(name="Santex"))


def test_with_no_shop_product_one_line_per_size_at_its_norm():
    got = by_label(_plumbing_lines(room([RAIL, {**RAIL2, "size": "600x1000"}, {**RAIL2, "id": "r3", "positionMm": 400, "size": "600x1000"}]), {}))
    a, b = got["Sochiq quritgich (50×80)"], got["Sochiq quritgich (60×100)"]
    assert (a.qty, a.unit_price_uzs, a.is_approximate, a.warning) == (1, 650_000, True, EXTRAS_NORM_NOTE)
    assert (b.qty, b.unit_price_uzs) == (2, 900_000)
    assert "Sochiq quritgich" not in got


@pytest.mark.parametrize(("size", "price"), [("500x500", 450_000), ("500x600", 520_000), ("500x800", 650_000), ("600x800", 750_000), ("600x1000", 900_000)])
def test_each_size_has_its_norm(size, price):
    label = "Sochiq quritgich ({}×{})".format(*(int(v) // 10 for v in size.split("x")))
    assert by_label(_plumbing_lines(room([{**RAIL, "size": size}]), {}))[label].unit_price_uzs == price


def test_an_unknown_size_is_priced_as_50_by_80():
    assert by_label(_plumbing_lines(room([{**RAIL, "size": "1x1"}]), {}))["Sochiq quritgich (50×80)"].unit_price_uzs == 650_000


def test_a_shop_product_prices_every_rail_in_one_line_whatever_its_size():
    got = by_label(_plumbing_lines(room([RAIL, {**RAIL2, "size": "600x1000"}]), {"sochiq_quritgich": _shop("sochiq_quritgich", 700_000, "Terminus 50x80")}))
    line = got["Sochiq quritgich: Terminus 50x80"]
    assert (line.qty, line.unit_price_uzs, line.is_approximate) == (2, 700_000, False)
    assert not any(k.startswith("Sochiq quritgich (") for k in got)


def test_the_users_picked_product_beats_the_cheapest():
    cheap, picked = _shop("sochiq_quritgich", 400_000, "Arzon"), _shop("sochiq_quritgich", 1_100_000, "Margroid 60x100")
    r = room([RAIL])
    r.surfaces = {"smeta:sochiq_quritgich": str(picked.id)}
    est = compute_estimate(r, {str(picked.id): picked}, {}, catalog={"sochiq_quritgich": cheap})
    line = next(ln for ln in est.lines if ln.label.startswith("Sochiq quritgich"))
    assert (line.label, line.unit_price_uzs) == ("Sochiq quritgich: Margroid 60x100", 1_100_000)


def test_a_pick_of_a_product_for_another_line_is_ignored():
    other = _shop("kabel", 9_000, "VVG")
    r = room([RAIL])
    r.surfaces = {"smeta:sochiq_quritgich": str(other.id)}
    est = compute_estimate(r, {str(other.id): other}, {}, catalog={})
    assert any(ln.label == "Sochiq quritgich (50×80)" for ln in est.lines)


def test_an_electric_rail_by_size_and_by_pick():
    el = {**RAIL, "kind": "electric", "size": "600x800"}
    assert by_label(_plumbing_lines(room([el]), {}))["Elektr sochiq quritgich (60×80)"].unit_price_uzs == 1_050_000
    picked = _shop("sochiq_quritgich_el", 1_300_000, "Laris 60x80")
    r = room([el])
    r.surfaces = {"smeta:sochiq_quritgich_el": str(picked.id)}
    est = compute_estimate(r, {str(picked.id): picked}, {}, catalog={})
    assert any(ln.label == "Elektr sochiq quritgich: Laris 60x80" and ln.unit_price_uzs == 1_300_000 for ln in est.lines)


@pytest.mark.parametrize(("label", "ru", "en"), [
    ("Sochiq quritgich (50×50)", "Полотенцесушитель (50×50)", "Heated towel rail (50×50)"),
    ("Sochiq quritgich (60×100)", "Полотенцесушитель (60×100)", "Heated towel rail (60×100)"),
    ("Elektr sochiq quritgich (50×80)", "Электрический полотенцесушитель (50×80)", "Electric towel rail (50×80)"),
])
def test_sized_labels_read_in_russian_and_english(label, ru, en):
    assert (localize_label(label, "ru"), localize_label(label, "en")) == (ru, en)
