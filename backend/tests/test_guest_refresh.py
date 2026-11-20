"""POST /auth/refresh for guests (spec 2026-11-20 mehmon rejimi §1 "Mehmon tokenlari")."""
import time
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.core.security import create_refresh_token
from app.database import get_db
from app.main import app
from app.models.user import User

URL = "/api/v1/auth/refresh"
NATIVE = {"X-Client-Type": "mobile"}


class _Result:
    def __init__(self, scalar):
        self._scalar = scalar

    def scalar_one_or_none(self):
        return self._scalar


class _FakeDb:
    """The refresh route looks one user up by id; `user` is what it finds."""

    def __init__(self, user):
        self.user = user
        self.added = []

    async def execute(self, stmt):
        return _Result(self.user)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass


def _user(is_guest: bool) -> User:
    return User(
        id=uuid.uuid4(), is_guest=is_guest, is_active=True, language="uz",
        is_admin=False, created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def make_client():
    def _make(user):
        db = _FakeDb(user)
        app.dependency_overrides[get_db] = lambda: db
        return TestClient(app), db
    yield _make
    app.dependency_overrides.clear()


def _days_left(token: str) -> float:
    return (jwt.get_unverified_claims(token)["exp"] - time.time()) / 86400


def test_guest_refresh_is_90_days(make_client):
    guest = _user(is_guest=True)
    client, _ = make_client(guest)
    tok = create_refresh_token(str(guest.id), expires_days=90)
    r = client.post(URL, cookies={"refresh_token": tok}, headers=NATIVE)
    assert r.status_code == 200
    assert 89 < _days_left(r.json()["refresh_token"]) <= 90
    assert r.json()["user"]["is_guest"] is True
    assert guest.last_seen_at is not None


def test_registered_refresh_stays_30_days_and_sets_last_seen(make_client):
    user = _user(is_guest=False)
    client, _ = make_client(user)
    r = client.post(URL, cookies={"refresh_token": create_refresh_token(str(user.id))}, headers=NATIVE)
    assert r.status_code == 200
    assert 29 < _days_left(r.json()["refresh_token"]) <= 30
    assert user.last_seen_at is not None


def test_refresh_after_upgrade_gets_registered_ttl(make_client):
    # A 90-day token without the `guest` claim for a row that is registered
    # now gets the registered lifetime. (A token issued TO a guest carries
    # the claim and is refused after the upgrade: tests/test_guest_tokens.py.)
    user = _user(is_guest=False)
    client, _ = make_client(user)
    tok = create_refresh_token(str(user.id), expires_days=90)
    r = client.post(URL, cookies={"refresh_token": tok}, headers=NATIVE)
    assert r.status_code == 200
    assert 29 < _days_left(r.json()["refresh_token"]) <= 30
    assert r.json()["user"]["is_guest"] is False


def test_refresh_after_merge_is_401(make_client):
    # The guest row was merged away: the old refresh token must not mint
    # anything, least of all a new user.
    client, db = make_client(None)
    tok = create_refresh_token(str(uuid.uuid4()), expires_days=90)
    r = client.post(URL, cookies={"refresh_token": tok}, headers=NATIVE)
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid or expired refresh token."
    assert db.added == []
