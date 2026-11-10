"""Norms for a bathroom's heated towel rail and extractor fan (spec 2026-11-10)."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_NORMS = Path(__file__).resolve().parent.parent / "data" / "bathroom_extras_norms.json"


@lru_cache(maxsize=1)
def load_bathroom_extras_norms() -> dict:
    return json.loads(_NORMS.read_text(encoding="utf-8"))
