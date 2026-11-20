"""Periodic housekeeping run by Celery beat (celery_app.beat_schedule).

cleanup_stale_guests — guest accounts (spec 2026-11-20 mehmon rejimi) that
nobody uses any more: a guest with no live room idle GUEST_CLEANUP_EMPTY_DAYS
(14), any guest idle GUEST_CLEANUP_IDLE_DAYS (100; longer than the 90-day guest
refresh token, so a guest that can still come back is never deleted). Idle =
coalesce(last_seen_at, created_at). Deleted through account_deletion, so the
storage files go too.
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import Select, and_, exists, func, or_, select

from app.config import settings
from app.database import _run_after_commit_hooks
from app.models.apartment import Apartment
from app.models.room import Room
from app.models.user import User
from celery_app import app

logger = structlog.get_logger(__name__)

_BATCH = 200
# One run's cap: 50 batches (10 000 guests) or 10 minutes, whichever first;
# the next day's run carries on.
_MAX_BATCHES = 50
_TIME_BUDGET_S = 600


async def delete_account(db, user: User) -> None:
    # Imported on use: account_deletion pulls in the routers package, which a
    # beat process importing this module does not need.
    from app.services.account_deletion import delete_account as _delete_account

    await _delete_account(db, user)


async def _open_session():
    """An engine of this task's own (asyncio.run gives every run a new loop)."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    engine = create_async_engine(settings.DATABASE_URL)
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def _stale_condition(now: datetime):
    idle = func.coalesce(User.last_seen_at, User.created_at)
    live_room = exists(
        select(Room.id)
        .join(Apartment, Room.apartment_id == Apartment.id)
        .where(Apartment.user_id == User.id, Room.deleted == False)  # noqa: E712
    )
    return and_(
        User.is_guest == True,  # noqa: E712
        or_(
            and_(idle < now - timedelta(days=settings.GUEST_CLEANUP_EMPTY_DAYS), ~live_room),
            idle < now - timedelta(days=settings.GUEST_CLEANUP_IDLE_DAYS),
        ),
    )


def stale_guests_query(now: datetime, after_id: uuid.UUID | None = None) -> Select:
    """Ids of up to 200 guests due for deletion at *now*, in id order after
    *after_id* (keyset paging: a guest that fails to delete is passed over,
    not read again in every batch)."""
    query = select(User.id).where(_stale_condition(now))
    if after_id is not None:
        query = query.where(User.id > after_id)
    return query.order_by(User.id).limit(_BATCH)


async def cleanup_stale_guests_async(now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    engine, Session = await _open_session()
    deleted = 0
    started = time.monotonic()
    last_id: uuid.UUID | None = None
    try:
        for _ in range(_MAX_BATCHES):
            if time.monotonic() - started > _TIME_BUDGET_S:
                break
            async with Session() as db:
                ids: list[uuid.UUID] = list(
                    (await db.execute(stale_guests_query(now, after_id=last_id))).scalars().all()
                )
            deleted += await _delete_batch(Session, ids, now)
            if len(ids) < _BATCH:
                break
            last_id = ids[-1]
    finally:
        await engine.dispose()
    logger.info("guest_cleaned", count=deleted)
    return {"deleted": deleted}


async def _delete_batch(Session, ids: list[uuid.UUID], now: datetime) -> int:
    deleted = 0
    for user_id in ids:
        # Its own transaction per guest. The row is locked and the rule
        # checked again: a guest that signed up (or came back) since the
        # list was read survives.
        async with Session() as db:
            try:
                user = (
                    await db.execute(
                        select(User)
                        .where(User.id == user_id, _stale_condition(now))
                        .with_for_update()
                    )
                ).scalar_one_or_none()
                if user is None:
                    continue
                await delete_account(db, user)
                await db.commit()
            except Exception as exc:  # one bad row must not stop the rest
                await db.rollback()
                logger.error("guest_cleanup_failed", user_id=str(user_id), error=type(exc).__name__)
                continue
            deleted += 1
            # The storage deletes delete_account queued for after the commit.
            await _run_after_commit_hooks(db)
    return deleted


@app.task(name="app.tasks.maintenance.cleanup_stale_guests")
def cleanup_stale_guests() -> dict:
    import asyncio

    return asyncio.run(cleanup_stale_guests_async())
