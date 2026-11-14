"""Tile work norms (spec 2026-11-10): consumption rates and fallback prices."""
from __future__ import annotations

from app.services.tile_work import load_tile_norms

KEYS = {
    "adhesive_kg_m2", "adhesive_bag_kg", "adhesive_bag_uzs", "grout_kg_m2", "grout_pack_kg", "grout_pack_uzs",
    "wall_tile_m2_uzs", "work_floor_m2_uzs", "work_wall_m2_uzs",
    "mastic_kg_m2", "mastic_kg_uzs", "tape_m_uzs", "work_waterproof_m2_uzs",
    "work_backsplash_m2_uzs", "skinali_m2_uzs", "work_skinali_m2_uzs",
}


def test_norms_have_every_key():
    norms = {k: v for k, v in load_tile_norms().items() if not k.startswith("_")}
    assert set(norms) == KEYS
    assert all(v > 0 for v in norms.values())
    assert norms["adhesive_kg_m2"] == 5 and norms["grout_kg_m2"] == 0.4 and norms["mastic_kg_m2"] == 1.5
