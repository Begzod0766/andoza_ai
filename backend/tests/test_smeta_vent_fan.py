"""The extractor fan in a bathroom's estimate (spec 2026-11-10): the fan, its cable and the work."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.smeta import EXTRAS_NORM_NOTE, FAN_CABLE_NOTE, _fan_lines, compute_estimate
from app.services.smeta_groups import group_key_for
from app.services.smeta_keys import smeta_key_problem
from app.services.smeta_text import localize_formula, localize_label, localize_warning

WALLS = [{"id": w, "length": length, "elements": []} for w, length in zip("ABCD", (2.5, 2.0, 2.5, 2.0))]
STORE = SimpleNamespace(name="Stroy Master")
NO_KEY = object()


def room(room_type="hammom", name="Hammom", vent_fan=NO_KEY):
    design = {"wallCoverings": {"ALL": {"kind": "plaster"}}}
    if vent_fan is not NO_KEY:
        design["ventFan"] = vent_fan
    return SimpleNamespace(
        net_wall_area=24.3, floor_area=5.0, perimeter=9.0, openings_count=0, ceiling_h=2.7, room_type=room_type, name=name,
        geometry={"walls": WALLS}, surfaces={}, furniture_layout=[], room_scan=None, state={"designState": design},
    )


def by_label(lines):
    return {ln.label: ln for ln in lines}


def test_a_bathroom_gets_a_fan_its_cable_and_the_work():
    got = by_label(_fan_lines(room(), {}, {}))
    fan = got["Tortuvchi ventilyator"]
    assert (fan.qty, fan.unit, fan.unit_price_uzs, fan.category) == (1, "dona", 180_000, "ventilyatsiya")
    assert fan.is_approximate and fan.warning == EXTRAS_NORM_NOTE
    cable = got["Elektr kabel (ventilyator)"]
    assert (cable.qty, cable.unit, cable.category) == (3, "m", "ventilyatsiya")
    assert cable.is_approximate and cable.warning == FAN_CABLE_NOTE
    assert cable.subtotal_uzs == 3 * cable.unit_price_uzs > 0
    work = got["Ish: ventilyatorni o'rnatish"]
    assert (work.qty, work.unit, work.unit_price_uzs, work.category) == (1, "dona", 100_000, "ventilyatsiya")
    assert len(got) == 3


@pytest.mark.parametrize(("room_type", "name", "fan"), [
    ("hammom", "Xona 1", True), (None, "Hammom", True), ("mehmonxona", "Hammom", False), (None, "Zal", False),
])
def test_only_a_bathroom_gets_a_fan(room_type, name, fan):
    assert bool(_fan_lines(room(room_type, name), {}, {})) is fan


@pytest.mark.parametrize(("value", "fan"), [(False, False), (True, True), (None, True), (0, True), ("false", True), (NO_KEY, True)])
def test_the_fan_is_off_only_when_ventFan_is_false(value, fan):
    assert bool(_fan_lines(room(vent_fan=value), {}, {})) is fan


def test_a_room_with_no_design_state_gets_the_fan():
    r = room()
    r.state = None
    assert len(_fan_lines(r, {}, {})) == 3


def test_a_tagged_shop_fan_gives_its_price_name_and_shop():
    shop = SimpleNamespace(id=uuid.uuid4(), name_uz="Era 100 mm", unit="dona", price_uzs=145_000, pack_qty=None, pack_unit=None,
                           smeta_key="ventilyator", is_active=True, store=STORE)
    fan = by_label(_fan_lines(room(), {"ventilyator": shop}, {}))["Tortuvchi ventilyator: Era 100 mm"]
    assert (fan.unit_price_uzs, fan.store_name, fan.is_approximate, fan.warning) == (145_000, "Stroy Master", False, None)


def test_a_shop_cable_prices_the_fan_cable():
    cable = SimpleNamespace(id=uuid.uuid4(), name_uz="VVG 3x1.5", unit="m", price_uzs=6_500, pack_qty=None, pack_unit=None,
                            smeta_key="kabel", is_active=True, store=STORE)
    line = by_label(_fan_lines(room(), {"kabel": cable}, {}))["Elektr kabel (ventilyator)"]
    assert (line.unit_price_uzs, line.subtotal_uzs, line.store_name) == (6_500, 19_500, "Stroy Master")
    assert line.is_approximate   # the length is still a guess


def test_the_fan_is_in_the_estimate_and_does_not_switch_on_the_wiring_notice():
    est = compute_estimate(room(), {}, {}, catalog={})
    assert {"Tortuvchi ventilyator", "Elektr kabel (ventilyator)", "Ish: ventilyatorni o'rnatish"} <= {ln.label for ln in est.lines}
    # Every room already carries a cable line; the fan adds no "elektr" line of its own to the wiring plan.
    without = compute_estimate(room(vent_fan=False), {}, {}, catalog={})
    assert [ln.label for ln in est.lines if ln.category == "elektr"] == [ln.label for ln in without.lines if ln.category == "elektr"]
    assert (est.has_electrical, est.electrical_confirmed) == (without.has_electrical, without.electrical_confirmed)
    assert not any(ln.label.startswith("Tortuvchi") for ln in compute_estimate(room("mehmonxona", "Zal"), {}, {}, catalog={}).lines)


def test_the_fan_lines_sit_in_the_electrics_group():
    assert {group_key_for(ln.category) for ln in _fan_lines(room(), {}, {})} == {"elektr"}


@pytest.mark.parametrize(("label", "ru", "en"), [
    ("Tortuvchi ventilyator", "Вытяжной вентилятор", "Extractor fan"),
    ("Tortuvchi ventilyator: Era 100 mm", "Вытяжной вентилятор: Era 100 mm", "Extractor fan: Era 100 mm"),
    ("Elektr kabel (ventilyator)", "Электрокабель (вентилятор)", "Electric cable (fan)"),
    ("Ish: ventilyatorni o'rnatish", "Работа: установка вентилятора", "Work: fitting the extractor fan"),
])
def test_labels_read_in_russian_and_english(label, ru, en):
    assert (localize_label(label, "ru"), localize_label(label, "en")) == (ru, en)


def test_warnings_and_formulas_read_in_english():
    for ln in _fan_lines(room(), {}, {}):
        assert "so'm" not in localize_formula(ln.formula, "en")
        if ln.warning:
            assert localize_warning(ln.warning, "en") != ln.warning
            assert localize_warning(ln.warning, "ru") != ln.warning


@pytest.mark.parametrize("key", ["ventilyator", "sochiq_quritgich"])
def test_the_new_keys_are_sold_by_the_piece(key):
    assert smeta_key_problem(key, "dona", None, None) is None
    assert smeta_key_problem(key, "m", None, None) is not None
    assert smeta_key_problem(key, "qop", 25, "kg") is not None
