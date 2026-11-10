"""Waterproofing in a bathroom's estimate (spec 2026-11-10): mastic, tape and work, automatically."""
from __future__ import annotations

import math
import uuid
from types import SimpleNamespace

import pytest

from app.services.smeta import TILE_NORM_NOTE, _waterproofing_lines, compute_estimate, furniture_catalog_key
from app.services.smeta_text import localize_formula, localize_label
from app.services.waterproofing import waterproof_areas

WALLS = [{"id": "A", "length": 2.5, "elements": []}, {"id": "B", "length": 2.0, "elements": []},
         {"id": "C", "length": 2.5, "elements": []},
         {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "height": 2.05, "position": 0.5}]}]
TUB_ROW = SimpleNamespace(id="vanna-1", name_uz="Vanna 1", category="boshqa", footprint_w=170, footprint_d=70,
                          price_uzs=4_500_000, is_active=True, store=None)
TUB = {"id": "tub", "furniture_id": "vanna-1", "name": "Vanna 1", "x": 0, "y": -610, "rotation": 0}
CATALOG = {furniture_catalog_key("vanna-1"): TUB_ROW}


def room(room_type="hammom", name="Hammom", furniture=(TUB,), coverings=None):
    return SimpleNamespace(
        net_wall_area=24.3, floor_area=5.0, perimeter=9.0, openings_count=1, ceiling_h=2.7, room_type=room_type, name=name,
        geometry={"walls": WALLS}, surfaces={}, furniture_layout=[], room_scan=None,
        state={"furniture": list(furniture), "designState": {"wallCoverings": coverings or {"ALL": {"kind": "plaster"}}}},
    )


def by_label(lines):
    return {ln.label: ln for ln in lines}


def expected():
    return waterproof_areas({"walls": WALLS}, [{"x": 0, "y": -610, "rotation": 0, "w": 1.7, "d": 0.7}], 5.0, 0.7)


def test_a_bathroom_with_a_bathtub():
    got = by_label(_waterproofing_lines(room(), CATALOG))
    a = expected()
    assert a["wet"] == pytest.approx((1.7 + 0.6) * 1.6)
    mastic = got["Gidroizolyatsiya mastikasi"]
    assert (mastic.qty, mastic.unit, mastic.unit_price_uzs) == (math.ceil(a["total"] * 1.5), "kg", 28_000)
    assert mastic.is_approximate and mastic.warning == TILE_NORM_NOTE
    for part in (f"Pol {a['floor']:.2f} m²", f"devor tagi {a['base']:.2f} m²", f"ho'l zona {a['wet']:.2f} m²", "1.5 kg/m²"):
        assert part in mastic.formula
    tape = got["Gidroizolyatsiya lentasi"]
    assert (tape.qty, tape.unit, tape.unit_price_uzs) == (math.ceil(a["tape_m"]), "m", 7_000)
    work = got["Ish: gidroizolyatsiya"]
    assert (work.qty, work.unit, work.subtotal_uzs) == (a["total"], "m²", round(a["total"] * 25_000))
    assert all(ln.category == "plitka_ish" for ln in got.values())


@pytest.mark.parametrize(("room_type", "name", "sealed"), [
    ("hammom", "Xona 1", True),
    (None, "Hammom", True),       # no type set: read from the name
    ("mehmonxona", "Hammom", False),  # a set type wins over the name
    (None, "Zal", False),
])
def test_only_a_bathroom_is_sealed(room_type, name, sealed):
    assert bool(_waterproofing_lines(room(room_type, name), CATALOG)) is sealed


def test_a_bathroom_with_no_fixtures_seals_the_floor_and_the_foot_of_the_walls():
    mastic = by_label(_waterproofing_lines(room(furniture=()), {}))["Gidroizolyatsiya mastikasi"]
    assert mastic.qty == math.ceil((5.0 + 1.66) * 1.5)


def test_a_sink_or_toilet_gives_no_wet_zone():
    sink = {"id": "s", "furniture_id": "rak", "name": "Rakovina 3", "x": 0, "y": -650, "rotation": 0}
    mastic = by_label(_waterproofing_lines(room(furniture=(sink,)), {}))["Gidroizolyatsiya mastikasi"]
    assert mastic.qty == math.ceil((5.0 + 1.66) * 1.5)


def test_a_bathroom_without_any_tile_is_still_sealed_and_gets_no_adhesive():
    got = by_label(ln for ln in compute_estimate(room(), {}, {}, catalog=CATALOG).lines if ln.category == "plitka_ish")
    assert set(got) == {"Gidroizolyatsiya mastikasi", "Gidroizolyatsiya lentasi", "Ish: gidroizolyatsiya"}


def test_a_shop_mastic_is_bought_in_its_own_buckets():
    bucket = SimpleNamespace(id=uuid.uuid4(), name_uz="Ceresit CL 51 5 kg", unit="dona", price_uzs=130_000, pack_qty=5, pack_unit="kg",
                             smeta_key="gidro_mastika", is_active=True, store=SimpleNamespace(name="Stroy Master"))
    line = by_label(_waterproofing_lines(room(), {**CATALOG, "gidro_mastika": bucket}))["Gidroizolyatsiya mastikasi: Ceresit CL 51 5 kg"]
    kg = expected()["total"] * 1.5
    assert (line.qty, line.unit, line.unit_price_uzs) == (math.ceil(kg / 5), "dona", 130_000)
    assert line.store_name == "Stroy Master" and line.is_approximate is False


def test_a_shop_tape_by_the_metre():
    tape = SimpleNamespace(id=uuid.uuid4(), name_uz="Lenta 120 mm", unit="m", price_uzs=9_000, pack_qty=None, pack_unit=None,
                           smeta_key="gidro_lenta", is_active=True, store=SimpleNamespace(name="Stroy Master"))
    line = by_label(_waterproofing_lines(room(), {**CATALOG, "gidro_lenta": tape}))["Gidroizolyatsiya lentasi: Lenta 120 mm"]
    assert line.unit_price_uzs == 9_000 and line.is_approximate is False


@pytest.mark.parametrize(("label", "ru", "en"), [
    ("Gidroizolyatsiya mastikasi", "Гидроизоляционная мастика", "Waterproofing mastic"),
    ("Gidroizolyatsiya mastikasi: Ceresit CL 51", "Гидроизоляционная мастика: Ceresit CL 51", "Waterproofing mastic: Ceresit CL 51"),
    ("Gidroizolyatsiya lentasi", "Гидроизоляционная лента", "Waterproofing tape"),
    ("Ish: gidroizolyatsiya", "Работа: гидроизоляция", "Work: waterproofing"),
])
def test_labels_are_translated(label, ru, en):
    assert localize_label(label, "ru") == ru
    assert localize_label(label, "en") == en


def test_the_formula_reads_in_english_and_russian():
    f = "Pol 5.00 m² + devor tagi 1.66 m² + ho'l zona 3.68 m² = 10.34 m² × 1.5 kg/m² = 15.5 kg"
    assert localize_formula(f, "en") == "Floor 5.00 m² + foot of the walls 1.66 m² + wet zone 3.68 m² = 10.34 m² × 1.5 kg/m² = 15.5 kg"
    assert localize_formula(f, "ru") == "Пол 5.00 м² + низ стен 1.66 м² + мокрая зона 3.68 м² = 10.34 м² × 1.5 кг/м² = 15.5 кг"


def test_a_bathroom_whose_floor_is_finished_is_not_sealed_again():
    """Waterproofing lies under the floor finish: a finished floor needs none (final review)."""
    got = [ln for ln in compute_estimate(room(), {}, {}, catalog=CATALOG, floor_state="tayyor").lines if ln.label.startswith(("Gidro", "Ish: gidro"))]
    assert got == []
    still = [ln for ln in compute_estimate(room(), {}, {}, catalog=CATALOG).lines if ln.label.startswith("Gidro")]
    assert len(still) == 2


def test_a_shop_tape_by_the_roll_is_bought_in_whole_rolls():
    """A 5 m roll is not sold by the metre: the joint takes whole rolls."""
    roll = SimpleNamespace(id=uuid.uuid4(), name_uz="Lenta 120 mm 5 m", unit="rulon", price_uzs=60_000, pack_qty=5, pack_unit="m",
                           smeta_key="gidro_lenta", is_active=True, store=SimpleNamespace(name="Stroy Master"))
    line = by_label(_waterproofing_lines(room(), {**CATALOG, "gidro_lenta": roll}))["Gidroizolyatsiya lentasi: Lenta 120 mm 5 m"]
    rolls = math.ceil(expected()["tape_m"] / 5)
    assert rolls >= 2
    assert (line.qty, line.unit, line.unit_price_uzs, line.subtotal_uzs) == (rolls, "rulon", 60_000, rolls * 60_000)
    assert line.formula == f"{expected()['tape_m']:.2f} m ÷ 5 m → {rolls} rulon"
    assert line.store_name == "Stroy Master" and line.is_approximate is False
    assert localize_formula(line.formula, "en") == f"{expected()['tape_m']:.2f} m ÷ 5 m → {rolls} roll" + ("s" if rolls != 1 else "")


def test_a_bathtub_with_no_footprint_is_read_as_a_bathtub_not_a_stool():
    """A catalog row without a footprint used to count as 60 × 60 cm: a third of a bathtub's wet zone."""
    bare = SimpleNamespace(id="vanna-1", name_uz="Vanna 1", category="boshqa", footprint_w=None, footprint_d=None,
                           price_uzs=4_500_000, is_active=True, store=None)
    tub = {**TUB, "y": -650}   # back against wall A either way
    got = _waterproofing_lines(room(furniture=(tub,)), {furniture_catalog_key("vanna-1"): bare})
    want = waterproof_areas({"walls": WALLS}, [{"x": 0, "y": -650, "rotation": 0, "w": 1.7, "d": 0.7}], 5.0, 0.7)
    assert want["wet"] == pytest.approx((1.7 + 0.6) * 1.6)
    assert by_label(got)["Ish: gidroizolyatsiya"].qty == want["total"]
