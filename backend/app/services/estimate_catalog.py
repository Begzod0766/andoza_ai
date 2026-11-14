"""The shop products the estimate prices its own lines from.

A few lines of an estimate are not something the user picks: the plaster, primer and
putty under a wall finish, the skirting, the cable, the ceiling board, the light fittings.
Each shop product that is the price for one of them carries a ``smeta_key`` (and, for a
bag or a strip, ``pack_qty``/``pack_unit``: what one pack holds). This module loads them and
keeps the cheapest per key (and, under "finish:<category>", the median floor, wallpaper
and paint, see FINISH_UNITS), so the engine (app.services.smeta.compute_estimate, which does
no I/O) is handed a plain dict.
"""
from __future__ import annotations

import re
import uuid
from typing import Any, Iterable

import structlog
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload, selectinload

from app.models.furniture import Furniture
from app.models.material import Material
from app.models.wallpaper import Wallpaper
from app.services.smeta import WallpaperRoll, _price_per, furniture_catalog_key, wallpaper_catalog_key

log = structlog.get_logger(__name__)


# The estimate keys sold and priced by the piece (app.services.smeta_keys KEY_SALE_UNIT).
_PIECE_KEYS = frozenset({
    "ventilyator", "sochiq_quritgich", "sochiq_quritgich_el", "rozetka_ip44",
    # A fixture's own parts (2026-11-13); listed here, not imported: smeta_keys imports smeta.
    "smesitel_rakovina", "smesitel_oshxona", "smesitel_vanna", "smesitel_dush", "smesitel_bide",
    "sifon_rakovina", "sifon_oshxona", "sifon_vanna", "sifon_dush", "gofra_unitaz", "podvodka",
    "installyatsiya", "boyler", "kran_kir", "sifon_kir", "trap_pol",
    "hisoblagich_suv", "filtr_suv", "reduktor", "klapan_teskari", "gipsokarton_nam",
})


def unit_cost(material: Material) -> float:
    """What a product costs per unit of what it holds, so a 30 kg bag and a 25 kg bag
    compare fairly. A product without a pack size compares by its own price."""
    # Something bought by the piece (a fan, a towel rail) is priced by the piece in the estimate
    # whatever pack its row names: divided by a pack, a dearer one looked the cheapest.
    if material.smeta_key in _PIECE_KEYS:
        return float(material.price_uzs)
    pack = float(material.pack_qty) if material.pack_qty else 0.0
    return material.price_uzs / pack if pack > 0 else float(material.price_uzs)


def pick_cheapest(materials: Iterable[Material]) -> dict[str, Material]:
    """{smeta_key: the cheapest active product for it}."""
    best: dict[str, Material] = {}
    for m in materials:
        if not m.smeta_key or not m.is_active:
            continue
        if m.smeta_key not in best or unit_cost(m) < unit_cost(best[m.smeta_key]):
            best[m.smeta_key] = m
    return best


# Finishes the studio can put in a room without naming a product (the AI designer and the
# ready-made styles set a floor type, a wallpaper pattern, a paint colour), and the selling
# unit a product must have to price one: a floor by the m², a wallpaper by the roll.
FINISH_UNITS: dict[str, set[str]] = {
    "laminat": {"m2"}, "parket": {"m2"}, "plitka": {"m2"}, "oboy": {"rulon"}, "boyoq": {"litr"},
}


def pick_median_finishes(materials: Iterable[Material]) -> dict[str, Material]:
    """{"finish:<category>": the median-priced active product of that finish}, the stand-in
    price for a finish nobody picked a product for (the line says so). Products compare by
    unit cost; with an even count the lower of the two middle ones is kept."""
    groups: dict[str, list[Material]] = {}
    for m in materials:
        units = FINISH_UNITS.get(str(m.category))
        if not units or str(m.unit) not in units or not m.is_active:
            continue
        groups.setdefault(f"finish:{m.category}", []).append(m)
    return {
        key: sorted(items, key=unit_cost)[(len(items) - 1) // 2]
        for key, items in groups.items()
    }


# A shop's plumbing pipe, told apart by its name (shops do not tag pipes with a smeta_key): the
# estimate's "pipe:<kind>" lines (app.services.smeta._plumbing_lines).
_PIPE_NAMES: dict[str, re.Pattern[str]] = {
    # Drains: the size not followed by another digit (Ø500 is not Ø50), and not a PPR water pipe.
    "pipe:drain_110": re.compile(r"^(?!.*(?:PPR|ППР)).*(?:(?:Ø|ф|d)\s*110(?!\d)|\b110\s*(?:мм|mm)\b)", re.I),
    "pipe:drain_50": re.compile(r"^(?!.*(?:PPR|ППР)).*(?:(?:Ø|ф|d)\s*50(?!\d)|\b50\s*(?:мм|mm)\b)", re.I),
    # Water: a PPR pipe whose DIAMETER is 20 ("PN 20" is its pressure rating, not its size).
    "pipe:water_20": re.compile(r"^(?=.*(?:PPR|ППР)).*(?:(?:Ø|ф|d)\s*20(?!\d)|\b20\s*(?:мм|mm)\b)", re.I),
}


def pick_pipes(materials: Iterable[Material]) -> dict[str, Material]:
    """{"pipe:<kind>": the cheapest active santexnika pipe of that kind per metre}. A product
    whose metre price cannot be told (no metre unit, no pack length) is left out."""
    best: dict[str, tuple[int, Material]] = {}
    for m in materials:
        if not m.is_active or str(m.category) != "santexnika":
            continue
        per_m = _price_per(m, "m")
        if not per_m:
            continue
        for key, pattern in _PIPE_NAMES.items():
            if pattern.search(m.name_uz or ""):
                if key not in best or per_m < best[key][0]:
                    best[key] = (per_m, m)
                break
    return {key: m for key, (_, m) in best.items()}


async def _shop_wallpapers(db: Any) -> dict[str, WallpaperRoll]:
    """Library wallpapers a shop sells by the roll (width, length and price all known), keyed
    by their storage key: the studio puts one on a wall by its image URL. Empty if they
    cannot be read, so the shop products above still price their lines."""
    try:
        result = await db.execute(
            select(Wallpaper)
            .options(selectinload(Wallpaper.store))
            .where(
                Wallpaper.kind == "oboy",
                Wallpaper.price_uzs.is_not(None),
                Wallpaper.width_cm.is_not(None),
                Wallpaper.total_length_m.is_not(None),
            )
        )
        out: dict[str, WallpaperRoll] = {}
        for w in result.scalars().all():
            if not (w.price_uzs and w.width_cm and w.total_length_m):
                continue
            out[wallpaper_catalog_key(w.storage_key)] = WallpaperRoll(
                name=w.name, price_uzs=int(w.price_uzs), roll_width_cm=float(w.width_cm),
                roll_length_m=float(w.total_length_m), store_name=w.store.name if w.store else None,
            )
        return out
    except Exception as exc:
        log.warning("estimate_catalog.wallpapers_failed", error=str(exc))
        return {}


def _placed_furniture_uuids(room: Any) -> set[uuid.UUID]:
    """The ids of the room's placed furniture that can be shop Furniture rows (UUIDs);
    built-in slugs ("couch_84") and a user's own uploads are not looked up."""
    state = getattr(room, "state", None) or {}
    placed = state.get("furniture") if isinstance(state, dict) else None
    out: set[uuid.UUID] = set()
    for item in placed or []:
        fid = item.get("furniture_id") if isinstance(item, dict) else None
        if not isinstance(fid, str):
            continue
        try:
            out.add(uuid.UUID(fid))
        except ValueError:
            continue
    return out


async def load_furniture_catalog(db: Any, room: Any) -> dict[str, Furniture]:
    """{furniture_catalog_key(id): the active shop Furniture row} for every shop piece
    placed in *room*, in one query (store joined in). A piece that is gone or inactive is
    simply absent, and the engine prices it as before; empty if the rows cannot be read."""
    ids = _placed_furniture_uuids(room)
    if not ids:
        return {}
    try:
        result = await db.execute(
            select(Furniture)
            .options(joinedload(Furniture.store))
            .where(Furniture.id.in_(ids), Furniture.is_active.is_(True))
        )
        return {furniture_catalog_key(str(f.id)): f for f in result.scalars().all()}
    except Exception as exc:
        log.warning("estimate_catalog.furniture_failed", error=str(exc))
        return {}


async def load_estimate_catalog(db: Any, room: Any = None) -> dict[str, Any]:
    """Load the estimate's shop products (and, given *room*, the shop furniture placed in
    it, see load_furniture_catalog). An empty dict (the engine's old constants) when
    there are none, or if they cannot be read: this enrichment must not take the estimate
    down with it."""
    furniture = await load_furniture_catalog(db, room) if room is not None else {}
    try:
        result = await db.execute(
            select(Material)
            .options(selectinload(Material.store))
            .where(
                Material.is_active.is_(True),
                or_(Material.smeta_key.is_not(None), Material.category.in_([*FINISH_UNITS, "santexnika"])),
            )
        )
        rows = result.scalars().all()
        return {
            **pick_cheapest(rows), **pick_median_finishes(rows), **pick_pipes(rows),
            **await _shop_wallpapers(db), **furniture,
        }
    except Exception as exc:
        log.warning("estimate_catalog.load_failed", error=str(exc))
        return dict(furniture)
