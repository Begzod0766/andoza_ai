"""Prices the admin set over the three norm files (spec 2026-11-15).

The files (app/data/{plumbing,tile,bathroom_extras}_norms.json) stay the defaults; an admin's value is
kept in ``norm_overrides`` and laid over its file here. Each process holds the overrides in memory
and re-reads them at most every ``TTL_S`` seconds when an estimate's norms are loaded
(``refresh``); a save updates its own process at once (``set_one`` / ``clear_one``).
"""
from __future__ import annotations

import copy
import json
import math
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

_DATA = Path(__file__).resolve().parents[1] / "data"
FILES: dict[str, Path] = {
    "plumbing": _DATA / "plumbing_norms.json",
    "tile": _DATA / "tile_norms.json",
    "bathroom_extras": _DATA / "bathroom_extras_norms.json",
}
TTL_S = 30
MAX_VALUE = 100_000_000

_overrides: dict[str, dict[str, float]] = {}
_version = 0
_loaded_at = 0.0


@lru_cache(maxsize=None)
def _base(file: str) -> dict:
    return json.loads(FILES[file].read_text(encoding="utf-8"))


def base(file: str) -> dict:
    """The file's own values (a copy)."""
    return copy.deepcopy(_base(file))


def leaf_paths(file: str) -> dict[str, Any]:
    """{dotted path: default} for every number in the file (keys starting with "_" are notes)."""
    out: dict[str, Any] = {}

    def walk(o: Any, prefix: str) -> None:
        for k, v in o.items():
            if k.startswith("_"):
                continue
            p = f"{prefix}{k}"
            if isinstance(v, dict):
                walk(v, p + ".")
            elif isinstance(v, (int, float)) and not isinstance(v, bool):
                out[p] = v
    walk(_base(file), "")
    return out


@lru_cache(maxsize=16)
def _merged(file: str, version: int) -> dict:
    data = base(file)
    defaults = leaf_paths(file)
    for path, value in _overrides.get(file, {}).items():
        if path not in defaults:
            continue  # a norm since taken out of its file
        node = data
        *head, last = path.split(".")
        for k in head:
            node = node[k]
        node[last] = int(round(value)) if isinstance(defaults[path], int) else float(value)
    return data


def merged(file: str) -> dict:
    """The file laid over with the admin's values. Callers must not change what they get."""
    return _merged(file, _version)


def set_overrides(values: dict[str, dict[str, float]]) -> None:
    """Replace the overrides held by this process (from the table, or a test)."""
    global _overrides, _version, _loaded_at
    _overrides = {f: dict(v) for f, v in values.items()}
    _version += 1
    _loaded_at = time.monotonic()


def set_one(file: str, path: str, value: float) -> None:
    set_overrides({**_overrides, file: {**_overrides.get(file, {}), path: value}})


def clear_one(file: str, path: str) -> None:
    set_overrides({**_overrides, file: {p: v for p, v in _overrides.get(file, {}).items() if p != path}})


def current() -> dict[str, dict[str, float]]:
    return {f: dict(v) for f, v in _overrides.items()}


async def refresh(db: Any, force: bool = False) -> None:
    """Re-read the overrides from the table when they are older than TTL_S. A failed read keeps
    what this process had: an estimate must not fail because of this."""
    if not force and _loaded_at and time.monotonic() - _loaded_at < TTL_S:
        return
    from sqlalchemy import select

    from app.models.norm_override import NormOverride

    try:
        rows = (await db.execute(select(NormOverride))).scalars().all()
        values: dict[str, dict[str, float]] = {}
        for r in rows:
            if isinstance(r.file, str) and isinstance(r.path, str) and r.file in FILES:
                values.setdefault(r.file, {})[r.path] = float(r.value)
    except Exception:  # noqa: BLE001
        return
    set_overrides(values)


def validate(file: str, path: str, value: object) -> str | None:
    """Why `value` cannot be `file`'s `path`, in Uzbek; None when it can."""
    from app.services.norm_catalog import CATALOG

    if file not in FILES or path not in CATALOG.get(file, {}) or path not in leaf_paths(file):
        return "bunday narx yo'q"
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return "son bo'lishi kerak"
    if value <= 0:
        return "0 dan katta bo'lishi kerak"
    if value > MAX_VALUE:
        return "juda katta"
    if isinstance(leaf_paths(file)[path], int) and CATALOG[file][path][1].startswith("so'm") and value != int(value):
        return "butun son bo'lishi kerak"
    return None
