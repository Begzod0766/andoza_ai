"""A kitchen set is made to measure and sold by the running metre (prod e2e 2026-11-18): the
estimate prices the length the studio fitted to the wall, not the catalog's whole set."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.services.smeta import _furniture_lines, furniture_catalog_key


def _set(price=10_000_000, w=400, name="Oshxona to'plami 2"):
    return SimpleNamespace(
        id=uuid.uuid4(), name_uz=name, price_uzs=price, is_active=True, category="boshqa",
        footprint_w=w, footprint_d=63, store=SimpleNamespace(name="Mebel Plaza"),
    )


def _lines(row, items):
    room = SimpleNamespace(state={"furniture": items})
    return _furniture_lines(room, {furniture_catalog_key(str(row.id)): row})


def test_a_kitchen_set_cut_to_the_wall_is_priced_per_running_metre():
    row = _set()
    [line] = _lines(row, [{"furniture_id": str(row.id), "lengthCm": 342}])

    assert line.unit == "m" and line.qty == 3.42
    assert line.unit_price_uzs == 2_500_000
    assert line.subtotal_uzs == 8_550_000
    assert "10 000 000 so'm ÷ 4.00 m" in line.formula and "× 3.42 m" in line.formula
    assert line.store_name == "Mebel Plaza"


def test_a_kitchen_set_at_its_full_length_costs_the_catalog_price():
    row = _set()
    [line] = _lines(row, [{"furniture_id": str(row.id)}])

    assert line.qty == 4.0 and line.subtotal_uzs == 10_000_000


def test_two_kitchen_sets_are_two_lines_each_at_its_own_length():
    row = _set()
    lines = _lines(row, [{"furniture_id": str(row.id), "lengthCm": 300}, {"furniture_id": str(row.id), "lengthCm": 200}])

    assert sorted(l.qty for l in lines) == [2.0, 3.0]
    assert sum(l.subtotal_uzs for l in lines) == 12_500_000


def test_an_ordinary_piece_is_still_priced_by_the_piece():
    row = _set(name="Divan Milano", price=4_200_000, w=210)
    [line] = _lines(row, [{"furniture_id": str(row.id), "lengthCm": 150}])

    assert line.unit == "dona" and line.subtotal_uzs == 4_200_000
