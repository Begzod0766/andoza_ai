"""Guest merge / upgrade / cleanup against a real Postgres (spec 2026-11-20
mehmon rejimi). The rest of the suite stubs the DB; these run the real SQL.

They need a migrated database (`alembic upgrade head`): CI's DATABASE_URL, or
GUEST_PG_TEST_URL locally (e.g. a pgserver socket URL). Without one they skip.
Each test runs inside one outer transaction that is rolled back, so nothing
is left behind; sessions join it through savepoints, so the code's own
commits do not escape.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.models.apartment import Apartment
from app.models.content_report import ContentReport
from app.models.device_token import DeviceToken
from app.models.draft_room import DraftRoom
from app.models.furniture_project import FurnitureProject
from app.models.lead import Lead
from app.models.media_job import MediaJob
from app.models.mebel_offcut import MebelOffcut
from app.models.order import Order
from app.models.price_book import PriceBook
from app.models.room import Room
from app.models.room_render import RoomRender
from app.models.shop_inquiry import ShopInquiry
from app.models.store import Store
from app.models.user import User
from app.models.user_model import UserModel
from app.models.usta import Usta
from app.models.wallpaper import Wallpaper
from app.services.guest_account import MergeResult, merge_guest_into, upgrade_guest

_PLACEHOLDER = "postgresql+asyncpg://test:test@localhost/test"  # tests/conftest.py default


def _url() -> str | None:
    url = os.environ.get("GUEST_PG_TEST_URL")
    if url:
        return url
    url = os.environ.get("DATABASE_URL")
    return None if not url or url == _PLACEHOLDER else url


pytestmark = pytest.mark.skipif(_url() is None, reason="no Postgres (set GUEST_PG_TEST_URL or DATABASE_URL)")

NOW = datetime.now(timezone.utc)


@pytest.fixture
async def pg():
    engine = create_async_engine(_url(), poolclass=NullPool)
    try:
        conn = await engine.connect()
    except Exception as exc:  # noqa: BLE001
        await engine.dispose()
        pytest.skip(f"Postgres not reachable: {type(exc).__name__}")
    has_col = (await conn.execute(text(
        "SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_guest'"
    ))).scalar()
    await conn.rollback()
    if not has_col:
        await conn.close()
        await engine.dispose()
        pytest.skip("database is not migrated to head")
    trans = await conn.begin()
    Session = async_sessionmaker(
        bind=conn, class_=AsyncSession, expire_on_commit=False, join_transaction_mode="create_savepoint",
    )
    try:
        yield conn, Session
    finally:
        await trans.rollback()
        await conn.close()
        await engine.dispose()


def _u(**kw) -> User:
    kw.setdefault("is_guest", False)
    return User(id=uuid.uuid4(), language="uz", **kw)


async def _count(db, model, col, value) -> int:
    return (await db.execute(select(func.count()).select_from(model).where(col == value))).scalar_one()


async def _seed_guest_world(db, guest: User, target: User) -> dict:
    """A row in every table that points at users, for the guest; plus a
    price book, a same-sha user model and a same-target report for the target."""
    store = Store(name="Do'kon")
    usta = Usta(name="Usta", category="malyar", phone="+998900000000")
    db.add_all([store, usta])
    await db.flush()

    apt = Apartment(user_id=guest.id, name="Uy")
    db.add(apt)
    await db.flush()
    db.add_all([
        Room(apartment_id=apt.id, name="A"),
        Room(apartment_id=apt.id, name="B"),
        Room(apartment_id=apt.id, name="C", deleted=True),
        DraftRoom(user_id=guest.id),
        FurnitureProject(user_id=guest.id, name="Shkaf", data={}),
        MebelOffcut(user_id=guest.id, material="ldsp", thickness=16, length=100, width=50),
        MediaJob(id=f"job-{uuid.uuid4()}", user_id=guest.id),
        RoomRender(user_id=guest.id, key=f"renders/{uuid.uuid4()}.jpg", url="http://x/r.jpg", kind="render"),
        Order(user_id=guest.id, dealer_name="D", total_uzs=1),
        Lead(user_id=guest.id, usta_id=usta.id),
        ShopInquiry(user_id=guest.id, store_id=store.id),
        Wallpaper(name="W", storage_key=f"w/{uuid.uuid4()}", content_type="image/jpeg", size_bytes=1,
                  sha256=uuid.uuid4().hex, uploaded_by=guest.id),
        UserModel(user_id=guest.id, name="dup", storage_key="g/dup.glb", content_type="model/gltf-binary",
                  size_bytes=1, sha256="d" * 64),
        UserModel(user_id=guest.id, name="own", storage_key="g/own.glb", content_type="model/gltf-binary",
                  size_bytes=1, sha256="e" * 64),
        PriceBook(user_id=guest.id),
        ContentReport(reporter_id=guest.id, target_type="wallpaper", target_id="same", reason="other"),
        ContentReport(reporter_id=guest.id, target_type="wallpaper", target_id="only-guest", reason="other"),
        DeviceToken(user_id=guest.id, token=f"tok-{uuid.uuid4()}", platform="ios"),
        # the target's own
        PriceBook(user_id=target.id),
        UserModel(user_id=target.id, name="dup-target", storage_key="t/dup.glb", content_type="model/gltf-binary",
                  size_bytes=1, sha256="d" * 64),
        ContentReport(reporter_id=target.id, target_type="wallpaper", target_id="same", reason="spam"),
    ])
    await db.flush()
    return {"apartment": apt.id}


async def test_merge_moves_every_table_and_target_keeps_its_own(pg):
    conn, Session = pg
    async with Session() as db:
        guest, target = _u(is_guest=True), _u(username=f"t{uuid.uuid4().hex[:8]}")
        db.add_all([guest, target])
        await db.flush()
        seeded = await _seed_guest_world(db, guest, target)

        res = await merge_guest_into(db, guest.id, target)
        await db.flush()

        assert res == MergeResult(rooms=2, apartments=1)
        assert (await db.execute(select(User).where(User.id == guest.id))).scalar_one_or_none() is None
        assert (await db.get(Apartment, seeded["apartment"])).user_id == target.id
        for model in (Apartment, DraftRoom, FurnitureProject, MebelOffcut, MediaJob, RoomRender, Order, Lead,
                      ShopInquiry):
            assert await _count(db, model, model.user_id, target.id) == 1, model.__tablename__
            assert await _count(db, model, model.user_id, guest.id) == 0, model.__tablename__
        assert await _count(db, Wallpaper, Wallpaper.uploaded_by, target.id) == 1
        # rooms followed their apartment
        assert (await db.execute(
            select(func.count(Room.id)).join(Apartment).where(Apartment.user_id == target.id)
        )).scalar_one() == 3
        # user models: the duplicate sha is the target's own copy; the other moved
        names = set((await db.execute(select(UserModel.name).where(UserModel.user_id == target.id))).scalars())
        assert names == {"dup-target", "own"}
        # price book: the target's survives, the guest's is gone
        assert await _count(db, PriceBook, PriceBook.user_id, target.id) == 1
        # reports: the target's own report on "same" survives, the guest's other one moved
        reasons = dict((await db.execute(
            select(ContentReport.target_id, ContentReport.reason).where(ContentReport.reporter_id == target.id)
        )).all())
        assert reasons == {"same": "spam", "only-guest": "other"}
        assert await _count(db, DeviceToken, DeviceToken.user_id, target.id) == 0
        assert await _count(db, DeviceToken, DeviceToken.user_id, guest.id) == 0


async def test_merge_rereads_the_row_under_the_lock(pg):
    # The guest is already in the session (get_guest_caller loaded it) when a
    # concurrent register upgrades it. The locked read must see that, not the
    # cached is_guest=True, or the merge deletes the account just registered.
    conn, Session = pg
    async with Session() as db:
        guest, target = _u(is_guest=True), _u()
        db.add_all([guest, target])
        await db.flush()
        loaded = (await db.execute(select(User).where(User.id == guest.id))).scalar_one()
        assert loaded.is_guest is True
        await db.execute(text("UPDATE users SET is_guest = false, username = 'just_registered' WHERE id = :id"),
                         {"id": guest.id})

        assert await merge_guest_into(db, guest.id, target) is None
        row = (await db.execute(text("SELECT username FROM users WHERE id = :id"), {"id": guest.id})).one()
        assert row.username == "just_registered"


async def test_upgrade_rereads_the_row_under_the_lock(pg):
    # Two registers from one guest: the second finds the row already upgraded
    # and must not overwrite the first account's identity.
    conn, Session = pg
    async with Session() as db:
        guest = _u(is_guest=True)
        db.add(guest)
        await db.flush()
        await db.execute(text("UPDATE users SET is_guest = false, username = 'first' WHERE id = :id"),
                         {"id": guest.id})

        assert await upgrade_guest(db, guest, username="second") is None
        await db.flush()
        row = (await db.execute(text("SELECT username, is_guest FROM users WHERE id = :id"), {"id": guest.id})).one()
        assert (row.username, row.is_guest) == ("first", False)


async def test_upgrade_real_row(pg):
    conn, Session = pg
    async with Session() as db:
        guest = _u(is_guest=True)
        db.add(guest)
        await db.flush()
        u = await upgrade_guest(db, guest, phone="+998901112233")
        await db.flush()
        row = (await db.execute(text("SELECT phone, is_guest, registered_at FROM users WHERE id = :id"),
                                {"id": guest.id})).one()
        assert u is not None and row.phone == "+998901112233" and row.is_guest is False
        assert row.registered_at is not None


# --- cleanup ------------------------------------------------------------------

@pytest.fixture
def cleanup_on(pg, monkeypatch):
    from unittest.mock import AsyncMock

    from app.tasks import maintenance

    conn, Session = pg

    async def _open_session():
        return AsyncMock(), Session

    monkeypatch.setattr(maintenance, "_open_session", _open_session)
    return maintenance


async def _add_guest(db, idle_days: float, *, room: bool = False, is_guest: bool = True) -> uuid.UUID:
    seen = NOW - timedelta(days=idle_days)
    u = _u(is_guest=is_guest, last_seen_at=seen, created_at=seen)
    db.add(u)
    await db.flush()
    if room:
        apt = Apartment(user_id=u.id, name="Uy")
        db.add(apt)
        await db.flush()
        db.add(Room(apartment_id=apt.id, name="X"))
        await db.flush()
    return u.id


async def test_cleanup_deletes_only_stale_guests(pg, cleanup_on):
    conn, Session = pg
    async with Session() as db:
        keep = {
            "registered_old": await _add_guest(db, 400, is_guest=False),
            "fresh_guest": await _add_guest(db, 1),
            "guest_with_room_50d": await _add_guest(db, 50, room=True),
        }
        gone = {
            "empty_guest_20d": await _add_guest(db, 20),
            "guest_with_room_120d": await _add_guest(db, 120, room=True),
        }
        await db.commit()

    res = await cleanup_on.cleanup_stale_guests_async(NOW)
    assert res["deleted"] >= 2  # the shared CI database may hold other stale guests

    async with Session() as db:
        for name, uid in keep.items():
            assert await db.get(User, uid) is not None, name
        for name, uid in gone.items():
            assert (await db.execute(select(User.id).where(User.id == uid))).scalar_one_or_none() is None, name


async def test_cleanup_goes_past_one_batch(pg, cleanup_on, monkeypatch):
    conn, Session = pg
    monkeypatch.setattr(cleanup_on, "_BATCH", 2)
    async with Session() as db:
        ids = [await _add_guest(db, 30) for _ in range(5)]
        await db.commit()

    await cleanup_on.cleanup_stale_guests_async(NOW)

    async with Session() as db:
        left = (await db.execute(select(func.count()).select_from(User).where(User.id.in_(ids)))).scalar_one()
        assert left == 0
