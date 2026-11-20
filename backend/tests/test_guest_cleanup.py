"""Daily cleanup of stale guests (spec 2026-11-20 mehmon rejimi §1 "Tozalash")."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from celery.schedules import crontab
from sqlalchemy.dialects import postgresql

import celery_app
from app.models.user import User
from app.tasks import maintenance

NOW = datetime(2026, 11, 20, 4, 0, tzinfo=timezone.utc)


def _sql(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


def test_query_thresholds():
    sql = _sql(maintenance.stale_guests_query(NOW))
    assert "users.is_guest" in sql
    assert "coalesce(users.last_seen_at, users.created_at)" in sql
    assert "2026-11-06" in sql and "2026-08-12" in sql   # NOW −14 d, −100 d
    assert "NOT (EXISTS" in sql and "rooms.deleted = false" in sql
    assert "LIMIT 200" in sql


def test_query_follows_settings(monkeypatch):
    monkeypatch.setattr(maintenance.settings, "GUEST_CLEANUP_EMPTY_DAYS", 1)
    monkeypatch.setattr(maintenance.settings, "GUEST_CLEANUP_IDLE_DAYS", 2)
    sql = _sql(maintenance.stale_guests_query(NOW))
    assert "2026-11-19" in sql and "2026-11-18" in sql


class _Res:
    def __init__(self, value):
        self._value = value

    def scalars(self):
        return self

    def all(self):
        return self._value

    def scalar_one_or_none(self):
        return self._value


class _Session:
    """One fake session. The first statement of the run lists ids; every
    other session answers the locked re-select with `rows[id]`."""

    def __init__(self, store):
        self.store = store
        self.committed = False
        self.info = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def execute(self, stmt):
        sql = _sql(stmt)
        self.store["sql"].append(sql)
        if "FOR UPDATE" not in sql:
            batches = self.store.get("batches")
            if batches is None:  # one short batch: everything at once
                return _Res(self.store["ids"])
            return _Res(batches.pop(0) if batches else [])
        uid = next(i for i in self.store["rows"] if str(i) in sql)
        return _Res(self.store["rows"].get(uid))

    async def commit(self):
        self.committed = True
        self.store["commits"] += 1

    async def rollback(self):
        pass


@pytest.fixture
def fake(monkeypatch):
    ids = [uuid.uuid4(), uuid.uuid4()]
    store = {
        "ids": ids,
        "rows": {i: User(id=i, is_guest=True) for i in ids},
        "sql": [],
        "commits": 0,
    }
    engine = AsyncMock()

    async def _open_session():
        return engine, lambda: _Session(store)

    monkeypatch.setattr(maintenance, "_open_session", _open_session)
    deleted = AsyncMock()
    monkeypatch.setattr(maintenance, "delete_account", deleted)
    store["deleted"] = deleted
    store["engine"] = engine
    return store


async def test_deletes_through_account_deletion(fake):
    res = await maintenance.cleanup_stale_guests_async(NOW)
    assert res == {"deleted": 2}
    assert fake["deleted"].await_count == 2
    assert [c.args[1].id for c in fake["deleted"].await_args_list] == fake["ids"]
    assert fake["commits"] == 2  # one transaction per guest
    fake["engine"].dispose.assert_awaited_once()


async def test_cleanup_rechecks_is_guest_before_delete(fake):
    # One guest upgraded (or came back) after the list was read: the locked
    # re-select no longer finds it, and it survives.
    fake["rows"][fake["ids"][0]] = None
    res = await maintenance.cleanup_stale_guests_async(NOW)
    assert res == {"deleted": 1}
    assert fake["deleted"].await_args.args[1].id == fake["ids"][1]
    locked = [s for s in fake["sql"] if "FOR UPDATE" in s]
    assert len(locked) == 2 and all("users.is_guest" in s for s in locked)
    # the re-select applies the same staleness rule, so a guest that
    # refreshed meanwhile is not deleted either
    assert all("2026-08-12" in s for s in locked)


async def test_one_failure_does_not_stop_the_rest(fake):
    fake["deleted"].side_effect = [RuntimeError("boom"), None]
    res = await maintenance.cleanup_stale_guests_async(NOW)
    assert res == {"deleted": 1}


async def test_nothing_stale(fake):
    fake["ids"].clear()
    assert await maintenance.cleanup_stale_guests_async(NOW) == {"deleted": 0}
    fake["deleted"].assert_not_awaited()


async def test_after_commit_hooks_run(fake, monkeypatch):
    # delete_account queues the storage deletes as after-commit hooks.
    ran = []

    async def _delete(db, user):
        from app.database import run_after_commit

        async def hook():
            ran.append(user.id)

        run_after_commit(db, hook)

    monkeypatch.setattr(maintenance, "delete_account", _delete)
    await maintenance.cleanup_stale_guests_async(NOW)
    assert ran == fake["ids"]


def test_task_is_registered_and_routed_to_default():
    name = "app.tasks.maintenance.cleanup_stale_guests"
    assert maintenance.cleanup_stale_guests.name == name
    assert name in celery_app.app.tasks
    assert celery_app.app.amqp.router.route({}, name)["queue"].name == "default"


def test_beat_schedule():
    e = celery_app.app.conf.beat_schedule["cleanup-stale-guests"]
    assert e["task"] == "app.tasks.maintenance.cleanup_stale_guests"
    assert e["schedule"] == crontab(hour=4, minute=0)


def test_query_pages_by_id():
    after = uuid.uuid4()
    sql = _sql(maintenance.stale_guests_query(NOW, after_id=after))
    assert f"users.id > '{after}'" in sql and "ORDER BY users.id" in sql


async def test_cleanup_pages_past_full_batches_and_failures(fake, monkeypatch):
    monkeypatch.setattr(maintenance, "_BATCH", 2)
    a, b, c = sorted([uuid.uuid4() for _ in range(3)])
    fake["rows"] = {i: User(id=i, is_guest=True) for i in (a, b, c)}
    fake["batches"] = [[a, b], [c]]
    # a keeps failing: it must not stop the run or hold the next page back

    async def _del(db, user):
        if user.id == a:
            raise RuntimeError("x")

    fake["deleted"].side_effect = _del
    res = await maintenance.cleanup_stale_guests_async(NOW)
    assert res == {"deleted": 2}
    lists = [s for s in fake["sql"] if "FOR UPDATE" not in s]
    assert len(lists) == 2
    assert f"users.id > '{b}'" in lists[1]


async def test_cleanup_stops_at_the_batch_cap(fake, monkeypatch):
    monkeypatch.setattr(maintenance, "_BATCH", 1)
    monkeypatch.setattr(maintenance, "_MAX_BATCHES", 2)
    ids = sorted(uuid.uuid4() for _ in range(5))
    fake["rows"] = {i: User(id=i, is_guest=True) for i in ids}
    fake["batches"] = [[i] for i in ids]
    res = await maintenance.cleanup_stale_guests_async(NOW)
    assert res == {"deleted": 2}
