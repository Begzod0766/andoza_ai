"""Plumbing pipe runs and prices for the estimate (spec 2026-11-08).

Mirrors frontend/src/lib/plumbingRuns.ts so the studio's summary and the estimate give the same metres:
a run is the shorter way round the perimeter (walls in saved order) from the point to the riser, plus
the point's height. Saved geometry has wall lengths in metres; plumbing positions are in mm.
"""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

_NORMS = Path(__file__).resolve().parents[1] / "data" / "plumbing_norms.json"


def _walls(geometry: dict | None) -> list[dict]:
    walls = (geometry or {}).get("walls") or []
    return [w for w in walls if isinstance(w, dict)]


def riser_spot(geometry: dict | None, service_features: list | None = None) -> tuple[str, float]:
    """Where the pipes go: the start of the wall holding the first door, else the first wall's start.

    ``service_features`` (scanned risers) is accepted for the interface but not used yet: the studio
    places the riser the same way (it does not read scanned risers either), and the two must agree.
    """
    walls = _walls(geometry)
    for w in walls:
        if any(isinstance(e, dict) and e.get("type") == "eshik" for e in w.get("elements") or []):
            return (str(w.get("id")), 0.0)
    return (str(walls[0].get("id")) if walls else "A", 0.0)


def pipe_run_m(geometry: dict | None, point: dict, riser: tuple[str, float]) -> float:
    """Metres from ``point`` (wallId, positionMm, heightMm) to ``riser`` (wall id, position mm)."""
    cum: dict[str, float] = {}
    total = 0.0
    for w in _walls(geometry):
        cum[str(w.get("id"))] = total
        total += float(w.get("length") or 0) * 1000
    at = lambda wall_id, pos: cum.get(str(wall_id), 0.0) + float(pos or 0)  # noqa: E731
    height = float(point.get("heightMm") or 0)
    if total <= 0:  # no walls to walk: only the rise or drop
        return math.floor(height / 10 + 0.5) / 100
    gap = abs(at(point.get("wallId"), point.get("positionMm")) - at(riser[0], riser[1]))
    mm = min(gap, total - gap) + height
    return math.floor(mm / 10 + 0.5) / 100  # JS Math.round, not banker's rounding


# ─── Fixture points, derived as the studio derives them ─────────────────────────
# A room saved before plumbing existed has fixtures but no saved points; the estimate works them out
# with the studio's own rules (frontend/src/lib/plumbingPoints.ts fixturePoints, on lib/aiDesignLayout
# roomModel walls and lib/plumbingRuns wallWalk). tests/test_plumbing.py checks both against one file.

PLUMBING_NEEDS: dict[str, list[tuple[str, int, int]]] = {  # (kind, height mm, diameter mm)
    "bathtub": [("drain", 150, 50), ("cold", 700, 20), ("hot", 700, 20)],
    "sink": [("drain", 500, 50), ("cold", 550, 20), ("hot", 550, 20)],
    "toilet": [("drain", 200, 110), ("cold", 200, 20)],
    "shower": [("drain", 0, 50), ("cold", 1050, 20), ("hot", 1050, 20)],
    "bidet": [("drain", 200, 50), ("cold", 250, 20), ("hot", 250, 20)],
}
WATER_OFFSET_MM = 100
WALL_GAP_M = 0.04


def _js_round(v: float) -> int:
    return math.floor(v + 0.5)


def _room_walls(geometry: dict | None) -> list[dict]:
    """The walls as the studio's room model has them (metres, room-centred): mid point, direction
    (the way an element position grows), inward normal and length, in saved order."""
    walls = _walls(geometry)
    ids = [str(w.get("id")) for w in walls]
    if len(walls) == 4 and {"A", "B", "C", "D"} <= set(ids):
        length = {str(w.get("id")): float(w.get("length") or 0) for w in walls}
        W = length["A"] if length["A"] > 0 else 4.0
        D = length["B"] if length["B"] > 0 else 3.0
        frames = {
            "A": (0.0, -D / 2, 1.0, 0.0, 0.0, 1.0, W), "C": (0.0, D / 2, 1.0, 0.0, 0.0, -1.0, W),
            "D": (-W / 2, 0.0, 0.0, 1.0, 1.0, 0.0, D), "B": (W / 2, 0.0, 0.0, 1.0, -1.0, 0.0, D),
        }
        return [dict(zip(("id", "midX", "midZ", "dirX", "dirZ", "nx", "nz", "length"), (i, *frames[i]))) for i in ids]
    verts = (geometry or {}).get("vertices") or []
    n = len(verts)
    if n < 3:
        return []
    cx = sum(float(v[0]) for v in verts) / n
    cz = sum(float(v[1]) for v in verts) / n
    centred = [(float(x) - cx, float(z) - cz) for x, z in verts]
    area = sum(centred[i][0] * centred[(i + 1) % n][1] - centred[(i + 1) % n][0] * centred[i][1] for i in range(n))
    sign = 1 if area >= 0 else -1
    defs: dict[str, dict] = {}
    for i in range(n):
        (x1, z1), (x2, z2) = centred[i], centred[(i + 1) % n]
        dx, dz = x2 - x1, z2 - z1
        length = math.hypot(dx, dz)
        if length < 0.01:
            continue
        wid = ids[i] if i < len(ids) else str(i)
        defs[wid] = {"id": wid, "midX": (x1 + x2) / 2, "midZ": (z1 + z2) / 2, "dirX": dx / length, "dirZ": dz / length,
                     "nx": -dz / length * sign, "nz": dx / length * sign, "length": length}
    return [defs[i] for i in ids if i in defs]


def _wall_walk(walls: list[dict]) -> dict[str, dict]:
    """Each wall from the corner where the walk round the room reaches it (lib/plumbingRuns wallWalk)."""
    ends = []
    for w in walls:
        hx, hz = w["dirX"] * w["length"] / 2, w["dirZ"] * w["length"] / 2
        ends.append((w, (w["midX"] - hx, w["midZ"] - hz), (w["midX"] + hx, w["midZ"] + hz)))
    d = lambda p, q: math.hypot(p[0] - q[0], p[1] - q[1])  # noqa: E731
    out: dict[str, dict] = {}
    prev_end = None
    for w, a, b in ends:
        if prev_end is not None:
            forward = d(a, prev_end) <= d(b, prev_end)
        else:
            _, la, lb = ends[-1]
            forward = min(d(a, la), d(a, lb)) <= min(d(b, la), d(b, lb))
        start = a if forward else b
        sgn = 1 if forward else -1
        out[w["id"]] = {"startX": start[0], "startZ": start[1], "dirX": w["dirX"] * sgn, "dirZ": w["dirZ"] * sgn}
        prev_end = b if forward else a
    return out


def fixture_points(fixture: dict, role: str, depth_m: float, geometry: dict | None) -> list[dict]:
    """The drain and water points a placed fixture brings (studio units: mm along the wall walk), or []
    for a piece that is no fixture. `fixture` is a placed-furniture entry (x, y mm; rotation rad)."""
    needs = PLUMBING_NEEDS.get(role)
    walls = _room_walls(geometry)
    if not needs or not walls:
        return []
    x, z = float(fixture.get("x") or 0) / 1000, float(fixture.get("y") or 0) / 1000
    rot = float(fixture.get("rotation") or 0)
    fx, fz = math.sin(rot), math.cos(rot)
    facing = [w for w in walls if w["nx"] * fx + w["nz"] * fz > math.sqrt(0.5)]
    dist = lambda w: abs((x - w["midX"]) * w["nx"] + (z - w["midZ"]) * w["nz"])  # noqa: E731
    wall = sorted(facing or walls, key=dist)[0]
    back = depth_m / 2 + WALL_GAP_M
    bx, bz = x - fx * back, z - fz * back
    walk = _wall_walk(walls)[wall["id"]]
    along = ((bx - walk["startX"]) * walk["dirX"] + (bz - walk["startZ"]) * walk["dirZ"]) * 1000
    length_mm = wall["length"] * 1000
    fid = fixture.get("id")
    out = []
    for kind, height, diameter in needs:
        offset = -WATER_OFFSET_MM if kind == "cold" else WATER_OFFSET_MM if kind == "hot" else 0
        out.append({"id": f"{fid}:{kind}", "kind": kind, "diameterMm": diameter, "wallId": wall["id"],
                    "positionMm": _js_round(min(length_mm, max(0.0, along + offset))), "heightMm": height, "fixtureId": fid})
    return out


@lru_cache(maxsize=1)
def load_plumbing_norms() -> dict:
    return json.loads(_NORMS.read_text(encoding="utf-8"))
