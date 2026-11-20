"""Norms for a bathroom's heated towel rail and extractor fan (spec 2026-11-10)."""
from __future__ import annotations


def load_bathroom_extras_norms() -> dict:
    # The file laid over with the prices an admin set (spec 2026-11-15).
    from app.services.norm_overrides import merged

    return merged("bathroom_extras")
