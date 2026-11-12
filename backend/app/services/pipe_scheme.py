"""The room's pipe scheme (spec 2026-11-11): one trunk per pipe kind along the walls, a vertical
branch to each point, and the fittings that follow from them.

Never saved: the estimate works it out here and the studio in frontend/src/lib/pipeScheme.ts, by the
same rule over the same normalised input; both are pinned by
frontend/src/lib/__tests__/fixtures/pipeScheme.json. Change one, change the other.

Units: the room geometry is in metres (an element's ``position`` the 0–1 fraction of its middle along
the wall's own direction, its ``width`` in metres); points and the riser are in mm along the wall walk.
"""
from __future__ import annotations

import copy
import math

from app.services.plumbing import _js_round, _room_walls, _wall_walk

WATER_TRUNK_MM = 200
HOT_DRAWN_MM = 250  # the hot trunk is drawn above the cold one; lengths ignore it
EPS = 1e-6
KINDS = ("drain", "cold", "hot")


def _empty() -> dict:
    return {
        "pipes": {k: {"trunkMm": 0, "branchMm": 0} for k in ("water_20", "drain_50", "drain_110")},
        "fittings": {k: 0 for k in ("tee_20", "elbow_20", "outlet_20", "valve_20", "tee_50", "elbow_50", "tee_110_50", "elbow_110")},
        "why": {
            "tee_20": {"branches": 0, "riser": 0}, "elbow_20": {"corners": 0, "ends": 0}, "outlet_20": {"points": 0},
            "valve_20": {"lines": 0}, "tee_50": {"branches": 0}, "elbow_50": {"corners": 0, "ends": 0},
            "tee_110_50": {"joins": 0}, "elbow_110": {"toilets": 0, "corners": 0},
        },
        "lines": [],
        "branches": [],
    }


EMPTY_SCHEME = _empty()


def _number(v: object) -> float | None:
    """A finite number (JS Number.isFinite), else None."""
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) else None


def sound_point(p: object) -> bool:
    """A point the scheme can read: a known kind, a finite position and height (its wall is checked
    against the room's own). The estimate counts the plumber's work on these only."""
    return (isinstance(p, dict) and p.get("kind") in KINDS
            and _number(p.get("positionMm")) is not None and _number(p.get("heightMm")) is not None)


def _trunk(inp: dict, perimeter: float, points: list[dict], doors: list) -> dict:
    """The trunk that joins the riser to ``points``: the loop less its cut. ``doors`` are the doors it may
    not pass: a water trunk's are the room's; a drain trunk lies on the floor and passes under them (the
    owner's ruling, 2026-11-11), so it is handed none."""
    def norm(x: float) -> float:
        r = x % perimeter
        return 0.0 if perimeter - r < EPS else r

    distinct: list[float] = []
    for v in sorted(norm(x) for x in [inp["riserMm"], *(p["sMm"] for p in points)]):
        if not distinct or v - distinct[-1] > EPS:
            distinct.append(v)

    def snap(x: float) -> float:
        v = norm(x)
        return next((d for d in distinct if abs(v - d) <= EPS), v)

    # The cut: the largest gap that holds a door, else the largest gap; a tie keeps the first.
    n = len(distinct)
    cut, cut_len, cut_door = 0, -1.0, False
    for i, a in enumerate(distinct):
        length = perimeter if n == 1 else (distinct[i + 1] - a if i < n - 1 else perimeter - a + distinct[0])
        door = any(EPS < norm(d - a) < length - EPS for d in doors)
        if (door and not cut_door) or (door == cut_door and length > cut_len + EPS):
            cut, cut_len, cut_door = i, length, door
    start = distinct[(cut + 1) % n]
    length = perimeter - cut_len

    def t(x: float) -> float:
        return norm(snap(x) - start)

    riser_t = t(inp["riserMm"])
    left: list[tuple[dict, float]] = []
    right: list[tuple[dict, float]] = []
    at: list[tuple[dict, float]] = []
    for p in points:
        d = t(p["sMm"]) - riser_t
        if d < -EPS:
            left.append((p, -d))
        elif d > EPS:
            right.append((p, d))
        else:
            at.append((p, 0.0))
    # Points at the riser's own place join the right arm if it has points, else the left, else they are an arm of their own.
    if right or not left:
        right = at + right
    else:
        left = at + left
    # A corner the trunk passes. Not one at the riser itself: each arm leaves the riser along its own wall
    # (the riser's tee turns it), so there is no bend there (review minor 8, 2026-11-11).
    corners: list[float] = []
    corner = 0.0
    for w in inp["wallsMm"]:
        tc = norm(corner - start)
        if corner < perimeter - EPS and EPS < tc < length - EPS and abs(tc - riser_t) > EPS:
            corners.append(tc - riser_t)
        corner += w
    return {"start": start, "length": length, "riser_t": riser_t, "left": left, "right": right, "corners": corners}


def build_scheme(inp: dict) -> dict:
    """The scheme of a normalised room: "The rule" of the plan (2026-11-11), step by step."""
    out = _empty()
    perimeter = float(sum(inp["wallsMm"]))
    if not perimeter > 0 or not inp["points"]:
        return out
    height = lambda p: max(0, p["heightMm"])  # noqa: E731
    pipes, why = out["pipes"], out["why"]

    for kind in ("cold", "hot"):
        points = [p for p in inp["points"] if p["kind"] == kind]
        if not points:
            continue
        tr = _trunk(inp, perimeter, points, inp["doorsMm"])
        ends = (1 if tr["left"] else 0) + (1 if tr["right"] else 0)
        pipes["water_20"]["trunkMm"] += _js_round(tr["length"])
        pipes["water_20"]["branchMm"] += _js_round(sum(abs(height(p) - WATER_TRUNK_MM) for p in points))
        why["tee_20"]["branches"] += len(points) - ends
        why["tee_20"]["riser"] += 1 if ends == 2 else 0
        why["elbow_20"]["corners"] += len(tr["corners"])
        why["elbow_20"]["ends"] += ends
        why["outlet_20"]["points"] += len(points)
        why["valve_20"]["lines"] += 1
        if tr["length"] > EPS:
            out["lines"].append({
                "kind": kind, "diameterMm": 20, "fromMm": _js_round(tr["start"]), "toMm": _js_round(tr["start"] + tr["length"]),
                "heightMm": HOT_DRAWN_MM if kind == "hot" else WATER_TRUNK_MM,
            })

    drains = [p for p in inp["points"] if p["kind"] == "drain"]
    if drains:
        tr = _trunk(inp, perimeter, drains, [])
        arms = [tr["left"], tr["right"]]
        # The Ø110 way on each arm: from the riser out to its farthest toilet.
        way = [max((d for p, d in arm if p["diameterMm"] == 110), default=0.0) for arm in arms]
        for i, arm in enumerate(arms):
            toilets = sum(1 for p, _ in arm if p["diameterMm"] == 110)
            narrow = [(p, d) for p, d in arm if p["diameterMm"] != 110]
            # Ø50 points beyond the Ø110 way (all of them, on an arm without a toilet) are a Ø50 run:
            # its farthest point takes the end, the others a tee each.
            tail = [(p, d) for p, d in narrow if d > way[i] + EPS] if toilets else narrow
            why["elbow_110"]["toilets"] += toilets
            if tail:
                why["elbow_50"]["ends"] += 1
                why["tee_50"]["branches"] += len(tail) - 1
            # On the Ø110 way each Ø50 point joins it by a tee, and so does the tail.
            if toilets:
                why["tee_110_50"]["joins"] += len(narrow) - len(tail) + (1 if tail else 0)
        for c in tr["corners"]:
            on_wide = -c < way[0] - EPS if c < 0 else c < way[1] - EPS
            why["elbow_110" if on_wide else "elbow_50"]["corners"] += 1
        total = _js_round(tr["length"])
        pipes["drain_110"]["trunkMm"] = _js_round(way[0] + way[1])
        pipes["drain_50"]["trunkMm"] = max(0, total - pipes["drain_110"]["trunkMm"])
        pipes["drain_110"]["branchMm"] = _js_round(sum(height(p) for p in drains if p["diameterMm"] == 110))
        pipes["drain_50"]["branchMm"] = _js_round(sum(height(p) for p in drains if p["diameterMm"] != 110))
        # The trunk as drawn: Ø50, the Ø110 way through the riser, Ø50.
        a, b = tr["riser_t"] - way[0], tr["riser_t"] + way[1]
        for diameter, lo, hi in ((50, 0.0, a), (110, a, b), (50, b, tr["length"])):
            if hi - lo > EPS:
                out["lines"].append({"kind": "drain", "diameterMm": diameter, "fromMm": _js_round(tr["start"] + lo),
                                     "toMm": _js_round(tr["start"] + hi), "heightMm": 0})

    out["fittings"] = {
        "tee_20": why["tee_20"]["branches"] + why["tee_20"]["riser"],
        "elbow_20": why["elbow_20"]["corners"] + why["elbow_20"]["ends"],
        "outlet_20": why["outlet_20"]["points"], "valve_20": why["valve_20"]["lines"],
        "tee_50": why["tee_50"]["branches"],
        "elbow_50": why["elbow_50"]["corners"] + why["elbow_50"]["ends"],
        "tee_110_50": why["tee_110_50"]["joins"],
        "elbow_110": why["elbow_110"]["toilets"] + why["elbow_110"]["corners"],
    }
    out["branches"] = [{
        "pointId": p["id"], "kind": p["kind"], "diameterMm": p["diameterMm"], "sMm": p["sMm"],
        "fromHeightMm": 0 if p["kind"] == "drain" else HOT_DRAWN_MM if p["kind"] == "hot" else WATER_TRUNK_MM,
        "toHeightMm": height(p),
    } for p in inp["points"]]
    return out


def scheme_input(geometry: dict | None, riser: tuple[str, float], points: list | None) -> dict:
    """The room as the rule wants it, rounded to whole mm as the studio rounds it (lib/pipeScheme schemeInput)."""
    walls = _room_walls(geometry)
    walk = _wall_walk(walls)
    walls_mm = [_js_round(w["length"] * 1000) for w in walls]
    at: dict[str, tuple[int, int]] = {}
    total = 0
    for w, mm in zip(walls, walls_mm):
        at[w["id"]] = (total, mm)
        total += mm

    def place(wall_id: object, position_mm: object) -> int | None:
        wall = at.get(str(wall_id))
        pos = _number(position_mm)
        if wall is None or pos is None:
            return None
        # Snapped to a millionth of a mm first: a door's middle worked out of a fraction can land a hair
        # under a half millimetre the studio rounds up (review minor 5).
        return wall[0] + min(wall[1], max(0, _js_round(_js_round(pos * 1e6) / 1e6)))

    raw = {str(w.get("id")): w for w in (geometry or {}).get("walls") or [] if isinstance(w, dict)}
    doors: list[int] = []
    for w in walls:
        way = walk[w["id"]]
        # An element is measured from the wall's own start; the walk may run the other way.
        forward = way["dirX"] * w["dirX"] + way["dirZ"] * w["dirZ"] > 0
        saved_length_mm = (_number(raw.get(w["id"], {}).get("length")) or 0) * 1000
        for e in raw.get(w["id"], {}).get("elements") or []:
            frac = _number(e.get("position")) if isinstance(e, dict) else None
            if not isinstance(e, dict) or e.get("type") != "eshik" or frac is None or _number(e.get("width")) is None:
                continue
            middle = frac * saved_length_mm
            s = place(w["id"], middle if forward else w["length"] * 1000 - middle)
            if s is not None:
                doors.append(s)

    out: list[dict] = []
    for p in points or []:
        if not sound_point(p):
            continue
        s = place(p.get("wallId"), p.get("positionMm"))
        if s is None:
            continue
        h = _number(p.get("heightMm"))
        kind = p["kind"]
        out.append({"id": p.get("id"), "kind": kind, "diameterMm": 20 if kind != "drain" else 110 if p.get("diameterMm") == 110 else 50,
                    "sMm": s, "heightMm": max(0, _js_round(h))})
    riser_at = place(riser[0], riser[1]) if riser else None
    return {"wallsMm": walls_mm, "doorsMm": doors, "riserMm": riser_at if riser_at is not None else 0, "points": out}


def pipe_scheme(geometry: dict | None, riser: tuple[str, float], points: list | None) -> dict:
    """The scheme of a room as the estimate holds it."""
    return build_scheme(scheme_input(geometry, riser, points)) if _room_walls(geometry) else copy.deepcopy(EMPTY_SCHEME)
