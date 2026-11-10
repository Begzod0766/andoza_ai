"""Tile work and waterproofing norms for the estimate (spec 2026-11-10)."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_NORMS = Path(__file__).resolve().parents[1] / "data" / "tile_norms.json"


@lru_cache(maxsize=1)
def load_tile_norms() -> dict:
    """Consumption rates and fallback prices (see tile_norms.json)."""
    return json.loads(_NORMS.read_text(encoding="utf-8"))
