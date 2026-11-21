"""app.services.guest_account — a guest becomes (upgrade) or moves into
(merge) a real account (spec 2026-11-20 mehmon rejimi §1 "Merge algoritmi")."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.dialects import postgresql

from app.models.user import User
from app.services.guest_account import MergeResult, merge_guest_into, upgrade_guest


def _user(is_guest: bool) -> User:
    return User(
        id=uuid.uuid4(), is_guest=is_guest, is_active=True, is_admin=False,
        language="uz", created_at=datetime.now(timezone.utc),
    )


class _Res:
    def __init__(self, scalar=None, rowcount=0):
        self._scalar = scalar
        self.rowcount = rowcount

    def scalar_one_or_none(self):
        return self._scalar

    def scalar_one(self):
        return self._scalar

    def scalar(self):
        return self._scalar


class _RecordingDb:
    """Records every statement as Postgres SQL (bound values inlined) and
    answers by what the statement is, not by call order."""

    def __init__(self, guest, *, rooms=0, apartments=0, target_price_book=False):
        self.guest = guest
        self.rooms = rooms
        self.apartments = apartments
        self.target_price_book = target_price_book
        self.sql: list[str] = []
        self.deleted: list = []
        self.expunged: list = []
        self.flushed = 0

    async def execute(self, stmt):
        sql = str(stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
        self.sql.append(sql)
        if sql.startswith("SELECT") and "FROM users" in sql and "FOR UPDATE" in sql:
            return _Res(self.guest)
        if sql.startswith("SELECT count(rooms.id)"):
            return _Res(self.rooms)
        if sql.startswith("UPDATE apartments"):
            return _Res(rowcount=self.apartments)
        if sql.startswith("SELECT") and "FROM price_books" in sql:
            return _Res(object() if self.target_price_book else None)
        return _Res()

    async def delete(self, obj):
        self.deleted.append(obj)

    def expunge(self, obj):
        self.expunged.append(obj)

    async def flush(self):
        self.flushed += 1

    def find(self, prefix: str) -> list[int]:
        return [i for i, s in enumerate(self.sql) if s.startswith(prefix)]


def _hex(u: uuid.UUID) -> str:
    return str(u)


@pytest.mark.asyncio
async def test_merge_moves_apartments_and_counts_rooms():
    guest, target = _user(True), _user(False)
    db = _RecordingDb(guest, rooms=3, apartments=2)
    res = await merge_guest_into(db, guest.id, target)
    assert res == MergeResult(rooms=3, apartments=2)
    assert "FOR UPDATE" in db.sql[0]
    upd = db.sql[db.find("UPDATE apartments SET user_id")[0]]
    assert _hex(target.id) in upd and _hex(guest.id) in upd
    # rooms are counted while they still belong to the guest, live ones only
    count = db.sql[db.find("SELECT count(rooms.id)")[0]]
    assert _hex(guest.id) in count and "rooms.deleted = false" in count
    assert db.find("SELECT count(rooms.id)")[0] < db.find("UPDATE apartments")[0]
    # the guest row goes last, by a core DELETE (DB cascades the rest)
    assert db.sql[-1].startswith("DELETE FROM users WHERE users.id = ")
    assert _hex(guest.id) in db.sql[-1]


@pytest.mark.asyncio
async def test_merge_moves_every_owned_table():
    guest, target = _user(True), _user(False)
    db = _RecordingDb(guest)
    await merge_guest_into(db, guest.id, target)
    for table, col in [
        ("apartments", "user_id"), ("draft_rooms", "user_id"), ("furniture_projects", "user_id"),
        ("mebel_offcuts", "user_id"), ("media_jobs", "user_id"), ("room_renders", "user_id"),
        ("orders", "user_id"), ("leads", "user_id"), ("shop_inquiries", "user_id"),
        ("wallpapers", "uploaded_by"), ("user_models", "user_id"), ("content_reports", "reporter_id"),
    ]:
        hits = [s for s in db.sql if s.startswith(f"UPDATE {table} SET {col}=")]
        assert hits, table
        assert _hex(target.id) in hits[0] and _hex(guest.id) in hits[0], table


@pytest.mark.asyncio
async def test_merge_price_book_conflict_keeps_target():
    guest, target = _user(True), _user(False)
    db = _RecordingDb(guest, target_price_book=True)
    await merge_guest_into(db, guest.id, target)
    assert f"DELETE FROM price_books WHERE price_books.user_id = '{guest.id}'" in db.sql
    assert not [s for s in db.sql if s.startswith("UPDATE price_books")]


@pytest.mark.asyncio
async def test_merge_price_book_moves_when_target_has_none():
    guest, target = _user(True), _user(False)
    db = _RecordingDb(guest, target_price_book=False)
    await merge_guest_into(db, guest.id, target)
    upd = [s for s in db.sql if s.startswith("UPDATE price_books SET user_id=")]
    assert upd and _hex(target.id) in upd[0]
    assert not [s for s in db.sql if s.startswith("DELETE FROM price_books")]


@pytest.mark.asyncio
async def test_merge_user_models_duplicate_sha_dropped():
    guest, target = _user(True), _user(False)
    db = _RecordingDb(guest)
    await merge_guest_into(db, guest.id, target)
    dels = db.find("DELETE FROM user_models")
    upds = db.find("UPDATE user_models")
    assert dels and upds and dels[0] < upds[0]
    sql = db.sql[dels[0]]
    assert "user_models.sha256 IN (SELECT user_models.sha256" in sql
    assert _hex(target.id) in sql and _hex(guest.id) in sql


@pytest.mark.asyncio
async def test_merge_content_reports_conflict_dropped():
    guest, target = _user(True), _user(False)
    db = _RecordingDb(guest)
    await merge_guest_into(db, guest.id, target)
    dels = db.find("DELETE FROM content_reports")
    upds = db.find("UPDATE content_reports")
    assert dels and upds and dels[0] < upds[0]
    sql = db.sql[dels[0]]
    assert "EXISTS" in sql and "target_type" in sql and "target_id" in sql
    assert _hex(target.id) in sql and _hex(guest.id) in sql


@pytest.mark.asyncio
async def test_merge_drops_device_tokens():
    guest, target = _user(True), _user(False)
    db = _RecordingDb(guest)
    await merge_guest_into(db, guest.id, target)
    assert f"DELETE FROM device_tokens WHERE device_tokens.user_id = '{guest.id}'" in db.sql
    assert not [s for s in db.sql if s.startswith("UPDATE device_tokens")]


@pytest.mark.asyncio
async def test_merge_noop_when_guest_gone():
    target = _user(False)
    db = _RecordingDb(None)
    assert await merge_guest_into(db, uuid.uuid4(), target) is None
    assert len(db.sql) == 1 and not db.deleted


@pytest.mark.asyncio
async def test_merge_noop_when_already_upgraded():
    # A parallel sign-in upgraded the row first: this one is a plain login.
    row, target = _user(False), _user(False)
    db = _RecordingDb(row)
    assert await merge_guest_into(db, row.id, target) is None
    assert len(db.sql) == 1


@pytest.mark.asyncio
async def test_merge_into_self_is_noop():
    guest = _user(True)
    db = _RecordingDb(guest)
    assert await merge_guest_into(db, guest.id, guest) is None
    assert not [s for s in db.sql if not s.startswith("SELECT")]


@pytest.mark.asyncio
async def test_upgrade_sets_identity_and_registered_at():
    guest = _user(True)
    db = _RecordingDb(guest)
    u = await upgrade_guest(db, guest, phone="+998901234567")
    assert u is guest
    assert (u.is_guest, u.phone) == (False, "+998901234567")
    assert u.registered_at is not None
    assert db.flushed == 1


@pytest.mark.asyncio
async def test_upgrade_with_username_password_and_name():
    guest = _user(True)
    u = await upgrade_guest(_RecordingDb(guest), guest, username="ali", password_hash="h", name="Ali")
    assert (u.username, u.password_hash, u.name, u.is_guest) == ("ali", "h", "Ali", False)


@pytest.mark.asyncio
async def test_upgrade_rejects_unknown_field():
    guest = _user(True)
    with pytest.raises(TypeError):
        await upgrade_guest(_RecordingDb(guest), guest, is_admin=True)
