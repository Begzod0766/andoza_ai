"""A heated towel rail's plumbing points (spec 2026-11-10).

The studio keeps rails in the room state's ``towelRails`` and never saves their points: it works
them out (frontend lib/towelRail.ts) and so does the estimate, here, by the same rule. Both are
pinned by frontend/src/lib/__tests__/fixtures/towelRailPoints.json.
"""
from __future__ import annotations

import math

from app.services.plumbing import _js_round, _room_walls

RAIL_W_MM = 500
# The sizes a rail comes in, width × height mm (2026-11-15): the studio's RAIL_SIZES.
RAIL_SIZES = ("500x500", "500x600", "500x800", "600x800", "600x1000")
DEFAULT_SIZE = "500x800"


def rail_size(rail: dict) -> str:
    """The rail's size; absent or unknown reads as 500x800, as every rail saved before."""
    s = rail.get("size")
    return s if isinstance(s, str) and s in RAIL_SIZES else DEFAULT_SIZE


def rail_width_mm(rail: dict) -> int:
    return int(rail_size(rail).split("x")[0])


def _number(v: object) -> float | None:
    """A finite number (JS Number.isFinite), else None."""
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) else None


def valid_rails(rails: object, geometry: dict | None) -> list[dict]:
    """The rails that hang on a wall the room has. What counts as a rail is the studio's rule
    (frontend lib/towelRail saneRails): a string id and wall id, a finite position and height. The
    studio drops anything else when it loads the room, so the estimate does not price it either."""
    if not isinstance(rails, list):
        return []
    walls = {w["id"] for w in _room_walls(geometry)}
    return [
        r for r in rails
        if isinstance(r, dict) and isinstance(r.get("id"), str) and r["id"]
        and isinstance(r.get("wallId"), str) and r["wallId"] in walls
        and _number(r.get("positionMm")) is not None and _number(r.get("heightMm")) is not None
    ]


def towel_rail_points(rail: dict, wall_length_mm: float) -> list[dict]:
    """The feed and the return: half the rail's width either side of its centre, inside the wall."""
    pos = float(rail["positionMm"])
    height = rail["heightMm"]

    def point(end: str, offset: float) -> dict:
        return {"id": f"{rail['id']}:{end}", "kind": "hot", "diameterMm": 20, "wallId": str(rail["wallId"]),
                "positionMm": _js_round(min(wall_length_mm, max(0.0, pos + offset))), "heightMm": height, "railId": rail["id"]}

    half = rail_width_mm(rail) / 2
    return [point("feed", -half), point("return", half)]


def is_electric(rail: dict) -> bool:
    """An electric rail (2026-11-14): ``kind`` exactly "electric"; anything else is heated by water."""
    return rail.get("kind") == "electric"


def rail_points(rails: object, geometry: dict | None) -> list[dict]:
    """The points of every valid rail heated by water; an electric one has none."""
    length_mm = {w["id"]: w["length"] * 1000 for w in _room_walls(geometry)}
    return [p for r in valid_rails(rails, geometry) if not is_electric(r) for p in towel_rail_points(r, length_mm[str(r["wallId"])])]
