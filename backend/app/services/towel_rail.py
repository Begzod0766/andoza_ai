"""A heated towel rail's plumbing points (spec 2026-11-10).

The studio keeps rails in the room state's ``towelRails`` and never saves their points: it works
them out (frontend lib/towelRail.ts) and so does the estimate, here, by the same rule. Both are
pinned by frontend/src/lib/__tests__/fixtures/towelRailPoints.json.
"""
from __future__ import annotations

from app.services.plumbing import _js_round, _room_walls

RAIL_W_MM = 500
RAIL_HEIGHT_MM = 1000   # a rail's bottom edge above the floor, when it says none


def _number(v: object) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def valid_rails(rails: object, geometry: dict | None) -> list[dict]:
    """The rails that hang on a wall the room has, each with a sound id and position."""
    if not isinstance(rails, list):
        return []
    walls = {w["id"] for w in _room_walls(geometry)}
    return [
        r for r in rails
        if isinstance(r, dict) and r.get("id") and str(r.get("wallId")) in walls and _number(r.get("positionMm")) is not None
    ]


def towel_rail_points(rail: dict, wall_length_mm: float) -> list[dict]:
    """The feed and the return: half the rail's width either side of its centre, inside the wall."""
    pos = float(rail["positionMm"])
    height = _number(rail.get("heightMm"))
    height = RAIL_HEIGHT_MM if height is None else height

    def point(end: str, offset: float) -> dict:
        return {"id": f"{rail['id']}:{end}", "kind": "hot", "diameterMm": 20, "wallId": str(rail["wallId"]),
                "positionMm": _js_round(min(wall_length_mm, max(0.0, pos + offset))), "heightMm": height, "railId": rail["id"]}

    return [point("feed", -RAIL_W_MM / 2), point("return", RAIL_W_MM / 2)]


def rail_points(rails: object, geometry: dict | None) -> list[dict]:
    """The points of every valid rail."""
    length_mm = {w["id"]: w["length"] * 1000 for w in _room_walls(geometry)}
    return [p for r in valid_rails(rails, geometry) for p in towel_rail_points(r, length_mm[str(r["wallId"])])]
