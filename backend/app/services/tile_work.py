"""Tile work and waterproofing norms for the estimate (spec 2026-11-10)."""
from __future__ import annotations

import json


def load_tile_norms() -> dict:
    """Consumption rates and fallback prices (see tile_norms.json)."""
    # The file laid over with the prices an admin set (spec 2026-11-15).
    from app.services.norm_overrides import merged

    return merged("tile")
