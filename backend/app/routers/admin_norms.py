"""Admin: the prices in the three norm files, set over them or put back (spec 2026-11-15)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.api.v1.deps import AdminUser, DbSession
from app.models.norm_override import NormOverride, NormOverrideLog
from app.services import norm_overrides as no
from app.services.norm_catalog import CATALOG

router = APIRouter(prefix="/admin/norms", tags=["admin-norms"])


class NormValue(BaseModel):
    value: float


def _num(file: str, path: str, v: Any) -> int | float | None:
    """A stored value as the file holds it: a whole number where the file has one."""
    if v is None:
        return None
    return int(round(float(v))) if isinstance(no.leaf_paths(file)[path], int) else float(v)


def _entry(file: str, path: str, value: Any = None, updated_at: Any = None) -> dict:
    label, unit, group = CATALOG[file][path]
    default = no.leaf_paths(file)[path]
    return {
        "file": file, "path": path, "label": label, "unit": unit, "group": group, "default": default,
        "value": _num(file, path, value) if value is not None else default,
        "overridden": value is not None, "updated_at": updated_at,
    }


def _known(file: str, path: str) -> None:
    if file not in CATALOG or path not in CATALOG[file] or path not in no.leaf_paths(file):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="bunday narx yo'q")


@router.get("")
async def list_norms(_: AdminUser, db: DbSession) -> dict:
    rows = (await db.execute(select(NormOverride))).scalars().all()
    by = {(r.file, r.path): r for r in rows}
    entries = []
    for file, paths in CATALOG.items():
        for path in paths:
            if path not in no.leaf_paths(file):
                continue
            r = by.get((file, path))
            entries.append(_entry(file, path, r.value if r else None, r.updated_at if r else None))
    return {"entries": entries}


@router.get("/log")
async def norm_log(_: AdminUser, db: DbSession, limit: int = Query(50, ge=1, le=500)) -> dict:
    rows = (await db.execute(select(NormOverrideLog).order_by(NormOverrideLog.created_at.desc()).limit(limit))).scalars().all()
    items = []
    for r in rows:
        known = r.file in CATALOG and r.path in CATALOG[r.file] and r.path in no.leaf_paths(r.file)
        items.append({
            "file": r.file, "path": r.path, "label": CATALOG[r.file][r.path][0] if known else r.path,
            "old_value": _num(r.file, r.path, r.old_value) if known else r.old_value,
            "new_value": _num(r.file, r.path, r.new_value) if known else r.new_value,
            "user_id": str(r.user_id) if r.user_id else None, "created_at": r.created_at,
        })
    return {"items": items}


async def _row(db: Any, file: str, path: str) -> NormOverride | None:
    return (await db.execute(select(NormOverride).where(NormOverride.file == file, NormOverride.path == path))).scalar_one_or_none()


@router.put("/{file}/{path}")
async def set_norm(file: str, path: str, body: NormValue, user: AdminUser, db: DbSession) -> dict:
    _known(file, path)
    problem = no.validate(file, path, body.value)
    if problem:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=problem)
    value = _num(file, path, body.value)
    row = await _row(db, file, path)
    old = _num(file, path, row.value) if row else None
    if row:
        row.value = value
        row.updated_by = user.id
    else:
        row = NormOverride(file=file, path=path, value=value, updated_by=user.id)
        db.add(row)
    db.add(NormOverrideLog(file=file, path=path, old_value=old, new_value=value, user_id=user.id))
    await db.flush()
    no.set_one(file, path, value)
    return _entry(file, path, value, getattr(row, "updated_at", None))


@router.delete("/{file}/{path}")
async def reset_norm(file: str, path: str, user: AdminUser, db: DbSession) -> dict:
    _known(file, path)
    row = await _row(db, file, path)
    if row:
        db.add(NormOverrideLog(file=file, path=path, old_value=_num(file, path, row.value), new_value=None, user_id=user.id))
        await db.delete(row)
        await db.flush()
    no.clear_one(file, path)
    return _entry(file, path)
