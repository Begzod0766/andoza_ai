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
    gap = abs(at(point.get("wallId"), point.get("positionMm")) - at(riser[0], riser[1]))
    mm = min(gap, total - gap) + float(point.get("heightMm") or 0)
    return math.floor(mm / 10 + 0.5) / 100  # JS Math.round, not banker's rounding


@lru_cache(maxsize=1)
def load_plumbing_norms() -> dict:
    return json.loads(_NORMS.read_text(encoding="utf-8"))
