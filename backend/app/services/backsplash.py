"""A kitchen backsplash on the server (spec 2026-11-14): the studio's rule (frontend lib/backsplash.ts),
by the same steps, pinned by frontend/src/lib/__tests__/fixtures/backsplashPieces.json. All in mm, in
the wall's own frame: x from the wall's start, as a door's left edge; y up from the floor."""
from __future__ import annotations

import math

MIN_SIDE_MM = 100
SLIVER_MM = 10
_NUMBERS = ("startMm", "lengthMm", "bottomMm", "topMm")


def _finite(v: object) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def valid_backsplashes(saved: object) -> list[dict]:
    """Backsplashes read from a saved room: anything that is not a sound one is left out."""
    if not isinstance(saved, list):
        return []
    return [
        b for b in saved
        if isinstance(b, dict) and isinstance(b.get("id"), str) and b["id"] != ""
        and isinstance(b.get("wallId"), str) and b["wallId"] != ""
        and b.get("material") in ("tile", "skinali") and all(_finite(b.get(k)) for k in _NUMBERS)
    ]


def _f(v: object) -> float:
    try:
        return float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


def studio_walls(room: object) -> list[dict]:
    """The room's walls in the studio's form (mm; an opening's left edge from the wall's start): the
    studio's saved geometry as it is, else the row's (metres, an opening's middle as a 0-1 fraction)
    turned into it."""
    from app.services.smeta import _to_metres

    state = getattr(room, "state", None) or {}
    saved = state.get("geometry") if isinstance(state, dict) else None
    if isinstance(saved, dict) and isinstance(saved.get("walls"), list) and saved["walls"]:
        return [w for w in saved["walls"] if isinstance(w, dict)]
    row = getattr(room, "geometry", None) or {}
    out = []
    for w in row.get("walls", []) or []:
        if not isinstance(w, dict):
            continue
        length = _to_metres(_f(w.get("length"))) * 1000
        elements = []
        for e in w.get("elements", []) or []:
            if not isinstance(e, dict):
                continue
            width = _to_metres(_f(e.get("width"))) * 1000
            elements.append({
                **e, "width": width, "height": _to_metres(_f(e.get("height"))) * 1000,
                "sill_height": _to_metres(_f(e.get("sill_height"))) * 1000,
                "position": _f(e.get("position")) * length - width / 2, "positionAuto": False,
            })
        out.append({**w, "length": length, "elements": elements})
    return out


def _clamped(b: dict, wall_len: float, ceiling: float) -> tuple[float, float, float, float] | None:
    x0 = min(wall_len, max(0.0, b["startMm"]))
    x1 = min(wall_len, x0 + max(0.0, b["lengthMm"]))
    y0 = max(0.0, b["bottomMm"])
    y1 = min(ceiling, b["topMm"])
    return (x0, x1, y0, y1) if x1 - x0 >= MIN_SIDE_MM and y1 - y0 >= MIN_SIDE_MM else None


def _cut(r: tuple, o: tuple) -> list[tuple]:
    """``r`` less the opening ``o``: left, below, above, right (lib/backsplash.ts cut)."""
    rx0, rx1, ry0, ry1 = r
    ox0, ox1, oy0, oy1 = o
    if ox1 <= rx0 or ox0 >= rx1 or oy1 <= ry0 or oy0 >= ry1:
        return [r]
    mx0, mx1 = max(rx0, ox0), min(rx1, ox1)
    out = []
    if ox0 > rx0:
        out.append((rx0, ox0, ry0, ry1))
    if oy0 > ry0:
        out.append((mx0, mx1, ry0, oy0))
    if oy1 < ry1:
        out.append((mx0, mx1, oy1, ry1))
    if ox1 < rx1:
        out.append((ox1, rx1, ry0, ry1))
    return out


def backsplash_pieces(b: dict, walls: list[dict], ceiling_mm: float) -> list[tuple[float, float, float, float]]:
    """(x0, x1, y0, y1) mm: the backsplash less every door and window on its wall, sorted; none on a
    wall the room does not have."""
    from app.services.smeta import _resolve_element_positions

    wall = next((w for w in walls if str(w.get("id")) == b.get("wallId")), None)
    if wall is None:
        return []
    wall_len = _f(wall.get("length"))
    r = _clamped(b, wall_len, ceiling_mm)
    if r is None:
        return []
    elements = [e for e in wall.get("elements", []) or [] if isinstance(e, dict)]
    pieces = [r]
    for e in _resolve_element_positions(elements, wall_len):
        pos, width, height, sill = _f(e.get("position")), _f(e.get("width")), _f(e.get("height")), _f(e.get("sill_height"))
        if width <= 0 or height <= 0:
            continue
        pieces = [q for p in pieces for q in _cut(p, (pos, pos + width, sill, sill + height))]
    pieces = [p for p in pieces if p[1] - p[0] >= SLIVER_MM and p[3] - p[2] >= SLIVER_MM]
    return sorted(pieces, key=lambda p: (p[0], p[2]))


def backsplash_area_m2(pieces: list[tuple[float, float, float, float]]) -> float:
    return sum((x1 - x0) * (y1 - y0) for x0, x1, y0, y1 in pieces) / 1e6
