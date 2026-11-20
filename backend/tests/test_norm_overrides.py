"""Prices in the admin panel (spec 2026-11-15): an admin's values laid over the three norm files."""
from __future__ import annotations

import pytest

from app.services import norm_overrides as no
from app.services.bathroom_extras import load_bathroom_extras_norms
from app.services.norm_catalog import CATALOG, UNUSED
from app.services.plumbing import load_plumbing_norms
from app.services.tile_work import load_tile_norms


@pytest.fixture(autouse=True)
def clean():
    no.set_overrides({})
    yield
    no.set_overrides({})


def test_with_no_overrides_the_files_as_they_are():
    assert load_plumbing_norms()["part_uzs"]["trap_pol"] == 450_000
    assert load_tile_norms()["adhesive_kg_m2"] == 5
    assert load_bathroom_extras_norms()["fan_uzs_by_size"]["125"] == 260_000


def test_an_override_is_laid_over_its_file_and_only_its_path():
    no.set_overrides({"plumbing": {"part_uzs.trap_pol": 380_000}, "tile": {"grout_kg_m2": 0.5}})
    p = load_plumbing_norms()
    assert p["part_uzs"]["trap_pol"] == 380_000 and isinstance(p["part_uzs"]["trap_pol"], int)
    assert p["part_uzs"]["kran_kir"] == 60_000
    assert load_tile_norms()["grout_kg_m2"] == 0.5
    no.set_overrides({})
    assert load_plumbing_norms()["part_uzs"]["trap_pol"] == 450_000


def test_the_file_itself_is_never_changed_by_an_override():
    no.set_overrides({"plumbing": {"work_point_uzs": 1}})
    load_plumbing_norms()
    assert no.base("plumbing")["work_point_uzs"] == 120_000


def test_a_path_no_longer_in_its_file_is_ignored():
    no.set_overrides({"plumbing": {"no_such.key": 5, "part_uzs.gone": 7}})
    assert "no_such" not in load_plumbing_norms() and "gone" not in load_plumbing_norms()["part_uzs"]


def test_every_number_in_the_three_files_has_a_name_unit_and_group():
    for file in no.FILES:
        missing = [p for p in no.leaf_paths(file) if p not in CATALOG[file] and p not in UNUSED.get(file, ())]
        assert missing == [], f"{file}: {missing}"
        for path, (label, unit, group) in CATALOG[file].items():
            assert path in no.leaf_paths(file), f"{file}: {path} is not in the file"
            assert label and unit and group


@pytest.mark.parametrize(("file", "path", "value", "problem"), [
    ("plumbing", "part_uzs.trap_pol", 380_000, None),
    ("tile", "grout_kg_m2", 0.45, None),
    ("plumbing", "part_uzs.trap_pol", 0, "0 dan katta bo'lishi kerak"),
    ("plumbing", "part_uzs.trap_pol", -5, "0 dan katta bo'lishi kerak"),
    ("plumbing", "part_uzs.trap_pol", 100_000_001, "juda katta"),
    ("plumbing", "part_uzs.trap_pol", 1500.5, "butun son bo'lishi kerak"),
    ("plumbing", "part_uzs.trap_pol", float("nan"), "son bo'lishi kerak"),
    ("plumbing", "nope", 5, "bunday narx yo'q"),
    ("nope", "x", 5, "bunday narx yo'q"),
    ("bathroom_extras", "fan_uzs", 5, "bunday narx yo'q"),  # unused: not offered
])
def test_validate(file, path, value, problem):
    got = no.validate(file, path, value)
    assert (got is None) if problem is None else (got is not None and problem in got)


@pytest.mark.parametrize("module", ["app.routers.estimate", "app.routers.ai", "app.routers.room_state"])
async def test_loading_an_estimates_norms_refreshes_the_admin_prices(module, monkeypatch):
    import importlib
    from unittest.mock import AsyncMock, MagicMock

    calls = []

    async def fake_refresh(db, force=False):
        calls.append(db)

    monkeypatch.setattr(no, "refresh", fake_refresh)
    db = MagicMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=result)
    await importlib.import_module(module)._load_norms(db)
    assert calls == [db]


async def test_refresh_reads_the_table_then_waits_its_ttl(monkeypatch):
    from decimal import Decimal
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, MagicMock

    no.set_overrides({})
    monkeypatch.setattr(no, "_loaded_at", 0.0)
    result = MagicMock()
    result.scalars.return_value.all.return_value = [SimpleNamespace(file="plumbing", path="part_uzs.trap_pol", value=Decimal(400000))]
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)
    await no.refresh(db)
    assert load_plumbing_norms()["part_uzs"]["trap_pol"] == 400000
    await no.refresh(db)  # within the TTL: not read again
    assert db.execute.await_count == 1


async def test_a_failed_read_keeps_what_the_process_had(monkeypatch):
    from unittest.mock import AsyncMock, MagicMock

    no.set_overrides({"plumbing": {"part_uzs.trap_pol": 410000}})
    db = MagicMock()
    db.execute = AsyncMock(side_effect=RuntimeError("db down"))
    await no.refresh(db, force=True)
    assert load_plumbing_norms()["part_uzs"]["trap_pol"] == 410000
