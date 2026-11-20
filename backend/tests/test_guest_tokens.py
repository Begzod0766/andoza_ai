"""Guest-issued tokens carry `guest: true` and stop working once the row is
no longer a guest; the refresh lookup locks the row (review fixes 5 and 7)."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy.dialects import postgresql

from app.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.database import get_db
from app.main import app
from tests.test_guest_upgrade import NATIVE, _FakeDb, _user


@pytest.fixture
def world(monkeypatch):
    monkeypatch.setattr(settings, "GUEST_MODE_ENABLED", True)
    db = _FakeDb()
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app), db
    app.dependency_overrides.clear()


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}", **NATIVE}


def test_guest_tokens_carry_the_guest_claim(world):
    client, _ = world
    b = client.post("/api/v1/auth/guest", json={}, headers=NATIVE).json()
    assert jwt.get_unverified_claims(b["access_token"])["guest"] is True
    assert jwt.get_unverified_claims(b["refresh_token"])["guest"] is True


def test_registered_tokens_have_no_guest_claim():
    assert "guest" not in jwt.get_unverified_claims(create_access_token("x"))
    assert "guest" not in jwt.get_unverified_claims(create_refresh_token("x"))


def test_pre_upgrade_guest_tokens_die_and_upgrade_tokens_work(world):
    client, db = world
    g = client.post("/api/v1/auth/guest", json={}, headers=NATIVE).json()
    old_access, old_refresh = g["access_token"], g["refresh_token"]
    assert client.get("/api/v1/auth/me", headers=_bearer(old_access)).status_code == 200

    up = client.post(
        "/api/v1/auth/register", json={"username": "ali", "password": "secret1"}, headers=_bearer(old_access)
    )
    assert up.status_code == 201, up.text
    assert up.json()["user"]["id"] == g["user"]["id"] and up.json()["user"]["is_guest"] is False

    # the guest's own tokens: refused
    assert client.get("/api/v1/auth/me", headers=_bearer(old_access)).status_code == 401
    r = client.post("/api/v1/auth/refresh", cookies={"refresh_token": old_refresh}, headers=NATIVE)
    assert r.status_code == 401
    # the tokens the upgrade issued: fine
    me = client.get("/api/v1/auth/me", headers=_bearer(up.json()["access_token"]))
    assert me.status_code == 200 and me.json()["is_guest"] is False
    r = client.post("/api/v1/auth/refresh", cookies={"refresh_token": up.json()["refresh_token"]}, headers=NATIVE)
    assert r.status_code == 200


def test_guest_token_still_works_for_a_guest(world):
    client, _ = world
    g = client.post("/api/v1/auth/guest", json={}, headers=NATIVE).json()
    r = client.post("/api/v1/auth/refresh", cookies={"refresh_token": g["refresh_token"]}, headers=NATIVE)
    assert r.status_code == 200 and r.json()["user"]["is_guest"] is True


class _Recording(_FakeDb):
    def __init__(self, *users):
        super().__init__(*users)
        self.sql = []

    async def execute(self, stmt):
        self.sql.append(str(stmt.compile(dialect=postgresql.dialect())))
        return await super().execute(stmt)


def test_refresh_locks_and_rereads_the_row():
    # A merge deleting the row between this read and the commit made the
    # last_seen_at write fail with a 500 (StaleDataError). With the row locked
    # the merge waits for the refresh, or the refresh finds no row: 401.
    user = _user()
    db = _Recording(user)
    app.dependency_overrides[get_db] = lambda: db
    try:
        r = TestClient(app).post(
            "/api/v1/auth/refresh", cookies={"refresh_token": create_refresh_token(str(user.id))}, headers=NATIVE
        )
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 200
    lookup = [s for s in db.sql if "FROM users" in s]
    assert lookup and "FOR UPDATE" in lookup[0]


def test_refresh_whose_row_vanished_under_the_lock_is_401():
    db = _FakeDb()
    app.dependency_overrides[get_db] = lambda: db
    try:
        r = TestClient(app).post(
            "/api/v1/auth/refresh", cookies={"refresh_token": create_refresh_token(str(uuid.uuid4()))}, headers=NATIVE
        )
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 401
