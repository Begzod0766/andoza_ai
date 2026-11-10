"""Waterproofing areas for a bathroom (spec 2026-11-10).

What is sealed: the whole floor, the foot of every wall (0.2 m), and on each wall a bathtub or
shower touches a strip as long as the fixture's side there plus 0.3 m each way, up to 1.8 m. Pure
geometry on the room's walls as the plumbing code has them (``plumbing._room_walls``: metres,
room-centred, the frame placed furniture is stored in), so A–D rooms and scanned polygon rooms are
both covered.
"""
from __future__ import annotations

import math

from app.services.plumbing import _room_walls

BASE_H_M = 0.2        # the foot of the walls
WET_H_M = 1.8         # how high a wet-zone strip goes
WET_MARGIN_M = 0.3    # past each end of the fixture
TOUCH_M = 0.15        # a fixture this near a wall touches it
MIN_OVERLAP_M = 0.05  # it must run at least this far along the wall


def _round2(x: float) -> float:
    return math.floor(x * 100 + 0.5) / 100


def _corners(f: dict) -> list[tuple[float, float]]:
    """The fixture's four corners, metres. Its front faces (sin r, cos r), like placed furniture."""
    cx, cz = float(f.get("x") or 0) / 1000, float(f.get("y") or 0) / 1000
    r = float(f.get("rotation") or 0)
    hw, hd = float(f.get("w") or 0) / 2, float(f.get("d") or 0) / 2
    ax, az = math.cos(r), -math.sin(r)   # along its width
    fx, fz = math.sin(r), math.cos(r)    # its front
    return [(cx + sa * ax * hw + sf * fx * hd, cz + sa * az * hw + sf * fz * hd) for sa in (-1, 1) for sf in (-1, 1)]


def _merge(spans: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for a, b in sorted(spans):
        if out and a <= out[-1][1] + 1e-9:
            out[-1] = (out[-1][0], max(out[-1][1], b))
        else:
            out.append((a, b))
    return out


def waterproof_areas(geometry: dict | None, fixtures: list[dict], floor_m2: float, door_widths_m: float) -> dict:
    """``floor``, ``base``, ``wet`` and ``total`` in m² and ``tape_m`` in metres.

    ``fixtures``: the placed bathtubs and showers, each ``{"x", "y"`` (mm), ``"rotation"`` (rad),
    ``"w", "d"`` (metres)``}``. ``wet`` counts a strip from 0.2 m up, the lowest 0.2 m being in
    ``base`` already. Tape runs along the floor-to-wall joint and up each wet corner.
    """
    walls = _room_walls(geometry)
    floor = max(0.0, float(floor_m2 or 0))
    if not walls:
        return {"floor": _round2(floor), "base": 0, "wet": 0, "total": _round2(floor), "tape_m": 0}

    joint = max(0.0, sum(w["length"] for w in walls) - max(0.0, float(door_widths_m or 0)))
    strips: list[list[tuple[float, float]]] = []
    for w in walls:
        sx, sz = w["midX"] - w["dirX"] * w["length"] / 2, w["midZ"] - w["dirZ"] * w["length"] / 2
        spans = []
        for f in fixtures:
            pts = _corners(f)
            # Its nearest edge is at the wall's face: within TOUCH_M in front of it, or at most that
            # far through it. A fixture far BEHIND the face is on the wall's line only: across a
            # notch of a U-shaped room, or left outside after the room was resized.
            nearest = min((px - w["midX"]) * w["nx"] + (pz - w["midZ"]) * w["nz"] for px, pz in pts)
            if not -TOUCH_M <= nearest <= TOUCH_M:
                continue
            along = [(px - sx) * w["dirX"] + (pz - sz) * w["dirZ"] for px, pz in pts]
            lo, hi = min(along), max(along)
            if min(hi, w["length"]) - max(lo, 0.0) < MIN_OVERLAP_M:
                continue  # beside the wall, or only a sliver past its corner
            spans.append((max(0.0, lo - WET_MARGIN_M), min(w["length"], hi + WET_MARGIN_M)))
        strips.append(_merge(spans))

    wet = sum(b - a for spans in strips for a, b in spans) * (WET_H_M - BASE_H_M)

    # A corner both of whose walls are wet right up to it gets a vertical run of tape.
    def wet_ends(i: int) -> list[tuple[float, float]]:
        w, ends = walls[i], []
        for t in (0.0, w["length"]):
            if any(a - 1e-6 <= t <= b + 1e-6 for a, b in strips[i]):
                off = t - w["length"] / 2
                ends.append((w["midX"] + w["dirX"] * off, w["midZ"] + w["dirZ"] * off))
        return ends

    ends = [wet_ends(i) for i in range(len(walls))]
    wet_corners = sum(
        1
        for i in range(len(walls)) for j in range(i + 1, len(walls))
        for p in ends[i] for q in ends[j]
        if math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01
    )

    base = joint * BASE_H_M
    return {
        "floor": _round2(floor), "base": _round2(base), "wet": _round2(wet),
        "total": _round2(floor + base + wet), "tape_m": _round2(joint + WET_H_M * wet_corners),
    }
