"""A tray-less shower's sloped zone (spec 2026-11-14), the same rule as the studio's lib/floorDrain."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.floor_drain import shower_zone_size, shower_zones_area_m2

SHARED = json.loads((Path(__file__).resolve().parents[2] / "frontend/src/lib/__tests__/fixtures/floorDrainZones.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", SHARED["sizes"], ids=lambda c: c["name"])
def test_zone_size(case):
    w, d = shower_zone_size(case["footprint_w"], case["footprint_d"], case["scale"])
    assert [round(w, 3), round(d, 3)] == case["expected"]


@pytest.mark.parametrize("case", SHARED["areas"], ids=lambda c: str(len(c["zones"])))
def test_zones_area(case):
    assert shower_zones_area_m2([tuple(z) for z in case["zones"]]) == case["expected"]
