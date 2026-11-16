"""A washing machine's plumbing points (spec 2026-11-13).

The studio keeps machines in the room state's ``washers`` and never saves their points: it works
them out (frontend lib/washer.ts) and so does the estimate, here, by the same rule. Both are pinned
by frontend/src/lib/__tests__/fixtures/washerPoints.json.
"""
from __future__ import annotations

from app.services.plumbing import _js_round, _room_walls
from app.services.towel_rail import _number

TAP_OFFSET_MM = 150
COLD_HEIGHT_MM = 900
DRAIN_HEIGHT_MM = 600
# A dishwasher (2026-11-16): both points 500 mm high, 150 mm either side (100 for a 450 one).
DISHWASHER_WIDTHS = (600, 450)
DISHWASHER_POINT_HEIGHT_MM = 500


def is_dishwasher(m: dict) -> bool:
    """``kind`` exactly "dishwasher"; anything else is a washing machine (lib/washer isDishwasher)."""
    return m.get("kind") == "dishwasher"


def dishwasher_width(m: dict) -> int:
    w = m.get("widthMm")
    return w if isinstance(w, int) and not isinstance(w, bool) and w in DISHWASHER_WIDTHS else 600


def valid_washers(washers: object, geometry: dict | None) -> list[dict]:
    """The machines that stand on a wall the room has, by the studio's rule (lib/washer saneWashers):
    a string id and wall id and a finite position."""
    if not isinstance(washers, list):
        return []
    walls = {w["id"] for w in _room_walls(geometry)}
    return [
        m for m in washers
        if isinstance(m, dict) and isinstance(m.get("id"), str) and m["id"]
        and isinstance(m.get("wallId"), str) and m["wallId"] in walls
        and _number(m.get("positionMm")) is not None
    ]


def _points(m: dict, wall_length_mm: float) -> list[dict]:
    pos = float(m["positionMm"])

    def at(offset: float) -> int:
        return _js_round(min(wall_length_mm, max(0.0, pos + offset)))

    wall = str(m["wallId"])
    dish = is_dishwasher(m)
    offset = (100 if dishwasher_width(m) == 450 else 150) if dish else TAP_OFFSET_MM
    cold = DISHWASHER_POINT_HEIGHT_MM if dish else COLD_HEIGHT_MM
    drain = DISHWASHER_POINT_HEIGHT_MM if dish else DRAIN_HEIGHT_MM
    return [
        {"id": f"{m['id']}:cold", "kind": "cold", "diameterMm": 20, "wallId": wall,
         "positionMm": at(offset), "heightMm": cold, "washerId": m["id"]},
        {"id": f"{m['id']}:drain", "kind": "drain", "diameterMm": 50, "wallId": wall,
         "positionMm": at(-offset), "heightMm": drain, "washerId": m["id"]},
    ]


def washer_points(washers: object, geometry: dict | None) -> list[dict]:
    """The cold tap and the drain of every valid machine."""
    length_mm = {w["id"]: w["length"] * 1000 for w in _room_walls(geometry)}
    return [p for m in valid_washers(washers, geometry) for p in _points(m, length_mm[str(m["wallId"])])]
