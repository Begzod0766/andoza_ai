"""The drywall box around a wall-hung toilet's frame (2026-11-14): every frame is closed in, so a
wall-hung toilet brings, per frame, one moisture-resistant drywall sheet, 6 m of profile and the
work of building the box. No switch: a frame is never left open.
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.smeta import EXTRAS_NORM_NOTE, PROFILE_PRICE_PER_M_UZS, _plumbing_lines
from app.services.smeta_keys import ALL_SMETA_KEYS, KEY_SALE_UNIT
from app.services.smeta_text import localize_formula, localize_label

GEOMETRY = {"walls": [
    {"id": "A", "length": 2.5, "elements": []}, {"id": "B", "length": 2.0, "elements": []},
    {"id": "C", "length": 2.5, "elements": []},
    {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "position": 0.5}]},
]}
BOARD = "Namga chidamli gipsokarton (quti)"
PROFILE = "Quti profili (karkas)"
WORK = "Ish: gipsokarton quti yig'ish"
NEW = (BOARD, PROFILE, WORK)


def piece(name: str, i: int = 0) -> dict:
    return {"id": f"f{i}", "furniture_id": f"slug-{i}", "name": name, "x": 0, "y": 0, "rotation": 0}


def room(*names: str):
    state = {"furniture": [piece(n, i) for i, n in enumerate(names)], "plumbing": []}
    return SimpleNamespace(state=state, geometry=GEOMETRY, room_type="hammom", name="Hammom")


def lines(r, catalog=None) -> dict:
    return {(ln.label if ln.label in NEW else ln.label.split(":")[0]): ln for ln in _plumbing_lines(r, catalog or {})}


def test_a_floor_toilet_has_no_box():
    assert not set(NEW) & set(lines(room("Unitaz kompakt")))


def test_a_wall_hung_toilet_brings_a_sheet_profile_and_work():
    got = lines(room("Osma unitaz Geberit"))
    b, p, w = got[BOARD], got[PROFILE], got[WORK]
    assert (b.qty, b.unit, b.unit_price_uzs, b.is_approximate, b.warning) == (1, "dona", 95_000, True, EXTRAS_NORM_NOTE)
    assert b.formula == "1 unitaz = 1 dona × 95 000 so'm"
    assert (p.qty, p.unit, p.unit_price_uzs, p.is_approximate) == (6, "m", PROFILE_PRICE_PER_M_UZS, True)
    assert p.formula == "1 unitaz × 6 m = 6 m"
    assert (w.qty, w.unit, w.unit_price_uzs, w.is_approximate) == (1, "dona", 300_000, False)
    assert w.formula == "1 unitaz = 1 dona × 300 000 so'm"
    assert {b.category, p.category, w.category} == {"santexnika"}


def test_two_wall_hung_toilets_two_boxes():
    got = lines(room("Osma unitaz", "Подвесной унитаз", "Unitaz kompakt"))
    assert (got[BOARD].qty, got[PROFILE].qty, got[WORK].qty) == (2, 12, 2)
    assert got[PROFILE].formula == "2 unitaz × 6 m = 12 m"


def shop(key: str, unit: str, price: int, name: str):
    return SimpleNamespace(id=uuid.uuid4(), name_uz=name, unit=unit, price_uzs=price, pack_qty=None, pack_unit=None,
                           smeta_key=key, is_active=True, store=SimpleNamespace(name="Qurilish"))


def test_tagged_shop_sheet_and_profile_give_their_prices():
    catalog = {"gipsokarton_nam": shop("gipsokarton_nam", "dona", 120_000, "Knauf GKLV 12.5"),
               "profil": shop("profil", "m", 14_000, "CD 60")}
    by = {ln.label: ln for ln in _plumbing_lines(room("Osma unitaz"), catalog)}
    assert (by[f"{BOARD}: Knauf GKLV 12.5"].unit_price_uzs, by[f"{BOARD}: Knauf GKLV 12.5"].is_approximate) == (120_000, False)
    assert (by[f"{PROFILE}: CD 60"].unit_price_uzs, by[f"{PROFILE}: CD 60"].is_approximate) == (14_000, False)


def test_the_new_key_is_sold_by_the_piece():
    assert "gipsokarton_nam" in ALL_SMETA_KEYS and KEY_SALE_UNIT["gipsokarton_nam"] == "dona"


@pytest.mark.parametrize(("label", "ru", "en"), [
    (BOARD, "Влагостойкий гипсокартон (короб)", "Moisture-resistant drywall (box)"),
    (PROFILE, "Профиль короба (каркас)", "Box profile (frame)"),
    (WORK, "Работа: сборка короба из гипсокартона", "Work: building the drywall box"),
])
def test_every_new_label_reads_in_russian_and_english(label, ru, en):
    assert localize_label(label, "ru") == ru
    assert localize_label(label, "en") == en
    if label != WORK:  # a work line never carries a shop's name
        assert localize_label(f"{label}: Knauf", "ru") == f"{ru}: Knauf"


def test_the_profile_formula_reads_in_russian():
    assert localize_formula("2 unitaz × 6 m = 12 m", "ru") == "2 унитаза × 6 м = 12 м"
