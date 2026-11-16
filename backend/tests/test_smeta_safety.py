"""The lines every plumbing renovation has but the estimate lacked (2026-11-16): an RCD, equipotential
bonding, a pressure test, a revision hatch and sanitary silicone."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.smeta import EXTRAS_NORM_NOTE, _plumbing_lines
from app.services.smeta_keys import ALL_SMETA_KEYS, KEY_SALE_UNIT
from app.services.smeta_text import localize_formula, localize_label

GEOMETRY = {"walls": [
    {"id": "A", "length": 2.5, "elements": []}, {"id": "B", "length": 2.0, "elements": []},
    {"id": "C", "length": 2.5, "elements": []},
    {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "position": 0.5}]},
]}
COLD = {"id": "p1", "kind": "cold", "diameterMm": 20, "wallId": "B", "positionMm": 1000, "heightMm": 500}
UZO, KUP, BOND = "UZO (difavtomat 30 mA)", "Potensiallarni tenglash qutisi (KUP) va kabel", "Ish: potensiallarni tenglash"
TEST, HATCH, HATCH_W, SIL = "Ish: quvurlarni bosim bilan sinash (opressovka)", "Revizion lyuk (plitka ostiga)", "Ish: revizion lyuk o'rnatish", "Sanitariya silikoni"
ALL = (UZO, KUP, BOND, TEST, HATCH, HATCH_W, SIL)


def room(*names: str, room_type="hammom", name="Hammom", plumbing=(COLD,)):
    furniture = [{"id": f"f{i}", "furniture_id": f"slug-{i}", "name": n, "x": 0, "y": 0, "rotation": 0} for i, n in enumerate(names)]
    return SimpleNamespace(state={"furniture": furniture, "plumbing": list(plumbing)}, geometry=GEOMETRY, room_type=room_type, name=name)


def lines(r, catalog=None) -> dict:
    return {ln.label if ln.label.startswith("Ish:") else ln.label.split(":")[0]: ln for ln in _plumbing_lines(r, catalog or {})}


def test_a_bathroom_gets_all_seven():
    got = lines(room("Vanna 170", "Rakovina 3", "Unitaz"))
    assert (got[UZO].qty, got[UZO].unit_price_uzs, got[UZO].is_approximate, got[UZO].warning) == (1, 250_000, True, EXTRAS_NORM_NOTE)
    assert (got[KUP].qty, got[KUP].unit, got[KUP].unit_price_uzs) == (1, "komplekt", 150_000)
    assert (got[BOND].qty, got[BOND].unit_price_uzs) == (1, 150_000)
    assert (got[TEST].qty, got[TEST].unit, got[TEST].unit_price_uzs) == (1, "komplekt", 150_000)
    assert (got[HATCH].qty, got[HATCH].unit_price_uzs, got[HATCH_W].unit_price_uzs) == (1, 250_000, 100_000)
    assert (got[SIL].qty, got[SIL].unit_price_uzs) == (2, 45_000)
    assert got[SIL].formula == "1 vanna + 1 rakovina + 1 unitaz = 3 ÷ 2 → 2 dona × 45 000 so'm"
    assert {got[k].category for k in ALL} == {"santexnika"}


def test_a_kitchen_gets_the_rcd_the_test_and_silicone_not_the_bonding_or_hatch():
    got = lines(room("Rakovina 3", room_type="oshxona", name="Oshxona"))
    assert {UZO, TEST, SIL} <= set(got)
    assert not {KUP, BOND, HATCH, HATCH_W} & set(got)
    assert got[SIL].qty == 1   # at least one tube


def test_a_room_with_no_plumbing_gets_none():
    got = lines(room(room_type="yotoqxona", name="Yotoqxona", plumbing=()))
    assert not set(ALL) & set(got)


def test_a_bathroom_with_points_but_no_fixtures_still_one_tube_of_silicone():
    assert lines(room())[SIL].qty == 1


def test_tagged_shop_products_give_their_prices():
    def shop(key, price, name):
        return SimpleNamespace(id=uuid.uuid4(), name_uz=name, unit="dona", price_uzs=price, pack_qty=None, pack_unit=None,
                               smeta_key=key, is_active=True, store=SimpleNamespace(name="Elektr"))
    got = lines(room("Vanna 170"), {"uzo": shop("uzo", 320_000, "ABB DS201"), "lyuk": shop("lyuk", 280_000, "Lyuk 30x40"),
                                    "silikon": shop("silikon", 52_000, "Ceresit CS25")})
    assert (got[UZO].unit_price_uzs, got[HATCH].unit_price_uzs, got[SIL].unit_price_uzs) == (320_000, 280_000, 52_000)


def test_the_new_keys_are_sold_by_the_piece():
    for key in ("uzo", "lyuk", "silikon"):
        assert key in ALL_SMETA_KEYS and KEY_SALE_UNIT[key] == "dona"


def test_the_silicone_formula_reads_in_russian():
    assert localize_formula("1 vanna + 1 rakovina + 1 unitaz = 3 ÷ 2 → 2 dona × 45 000 so'm", "ru") != "1 vanna + 1 rakovina + 1 unitaz = 3 ÷ 2 → 2 dona × 45 000 so'm"


@pytest.mark.parametrize(("label", "ru", "en"), [
    (UZO, "УЗО (дифавтомат 30 мА)", "RCD (RCBO 30 mA)"),
    (KUP, "Коробка уравнивания потенциалов (КУП) и кабель", "Equipotential bonding box and cable"),
    (BOND, "Работа: уравнивание потенциалов", "Work: equipotential bonding"),
    (TEST, "Работа: опрессовка труб", "Work: pressure-testing the pipes"),
    (HATCH, "Ревизионный люк (под плитку)", "Revision hatch (tile-in)"),
    (HATCH_W, "Работа: установка ревизионного люка", "Work: fitting the revision hatch"),
    (SIL, "Санитарный силикон", "Sanitary silicone"),
])
def test_labels_read_in_russian_and_english(label, ru, en):
    assert (localize_label(label, "ru"), localize_label(label, "en")) == (ru, en)
