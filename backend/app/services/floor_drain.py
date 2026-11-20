"""A tray-less shower's sloped zone (spec 2026-11-14): the shower's catalog footprint times its scale,
a missing side 90 cm. Mirrors the studio's lib/floorDrain (both pinned by
frontend/src/lib/__tests__/fixtures/floorDrainZones.json)."""
from __future__ import annotations

import math

SHOWER_ZONE_DEFAULT_CM = 90


def _side(cm: object) -> float:
    try:
        v = float(cm)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return SHOWER_ZONE_DEFAULT_CM
    return v if math.isfinite(v) and v > 0 else SHOWER_ZONE_DEFAULT_CM


def shower_zone_size(footprint_w: object, footprint_d: object, scale: object = None) -> tuple[float, float]:
    """(width, depth) in metres."""
    try:
        k = float(scale)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        k = 1.0
    if not (math.isfinite(k) and k > 0):
        k = 1.0
    return _side(footprint_w) / 100 * k, _side(footprint_d) / 100 * k


def shower_zones_area_m2(zones: list[tuple[float, float]]) -> float:
    return round(sum(w * d for w, d in zones), 2)
