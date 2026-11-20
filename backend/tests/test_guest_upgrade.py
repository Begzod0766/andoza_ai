"""Sign-in with a guest token upgrades the guest or merges it into the
existing account (spec 2026-11-20 mehmon rejimi §1 "Upgrade va merge")."""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import bcrypt
import pytest
from fastapi.testclient import TestClient
from jose import jwt
from starlette.requests import Request

from app.api.v1.deps import get_current_active_user
from app.config import settings
from app.core.security import create_access_token
from app.database import get_db
from app.main import app
from app.models.user import User
from app.routers import auth as auth_router
from app.services.guest_account import MergeResult

NATIVE = {"X-Client-Type": "mobile"}
GOOGLE_AUD = "test-google-client"
APPLE_AUD = "uz.andozaai.app"


def _user(**kw) -> User:
    defaults = dict(
        id=uuid.uuid4(), is_guest=False, is_active=True, is_admin=False,
        language="uz", created_at=datetime.now(timezone.utc),
    )
    defaults.update(kw)
    return User(**defaults)


class _Result:
    def __init__(self, scalar):
        self._scalar = scalar

    def scalar_one_or_none(self):
        return self._scalar


class _FakeDb:
    """Users found by whichever column the route looks up (username, phone,
    google_sub, apple_sub or id)."""

    def __init__(self, *users: User):
        self.users = list(users)
        self.added: list[User] = []

    async def execute(self, stmt):
        params = stmt.compile().params
        (key, value), = params.items()
        col = key.rsplit("_", 1)[0]
        for u in self.users:
            if str(getattr(u, col, None)) == str(value):
                return _Result(u)
        return _Result(None)

    def add(self, obj):
        self.added.append(obj)
        self.users.append(obj)

    async def flush(self):
        pass

    async def refresh(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        if getattr(obj, "created_at", None) is None:
            obj.created_at = datetime.now(timezone.utc)
        if getattr(obj, "is_admin", None) is None:
            obj.is_admin = False
        if getattr(obj, "language", None) is None:
            obj.language = "uz"
        if getattr(obj, "is_active", None) is None:
            obj.is_active = True


@pytest.fixture
def guest():
    return _user(is_guest=True, language="ru")


@pytest.fixture
def spies(monkeypatch):
    async def _upgrade(db, g, **identity):
        for k, v in identity.items():
            setattr(g, k, v)
        g.is_guest = False
        return g

    upgrade = AsyncMock(side_effect=_upgrade)
    merge = AsyncMock(return_value=MergeResult(rooms=2, apartments=1))
    monkeypatch.setattr(auth_router, "upgrade_guest", upgrade)
    monkeypatch.setattr(auth_router, "merge_guest_into", merge)
    return upgrade, merge


@pytest.fixture
def make_client():
    def _make(db, guest=None):
        app.dependency_overrides[get_db] = lambda: db
        if guest is not None:
            app.dependency_overrides[auth_router.get_guest_caller] = lambda: guest
        return TestClient(app)
    yield _make
    app.dependency_overrides.clear()


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_IDS", GOOGLE_AUD)
    claims = {"iss": "accounts.google.com", "aud": GOOGLE_AUD, "sub": "g-1",
              "email": "ali@example.com", "email_verified": True, "name": "Ali"}
    monkeypatch.setattr(auth_router, "_verify_google_id_token", lambda t, ids: claims)


@pytest.fixture
def apple(monkeypatch):
    monkeypatch.setattr(settings, "APPLE_CLIENT_IDS", APPLE_AUD)
    claims = {"iss": "https://appleid.apple.com", "aud": APPLE_AUD, "sub": "a-1", "email": "x@privaterelay.appleid.com"}
    monkeypatch.setattr(auth_router, "_verify_apple_identity_token", lambda t, ids: claims)


@pytest.fixture
def otp_ok(monkeypatch):
    monkeypatch.setattr(auth_router, "verify_otp", AsyncMock(return_value=True))


# --- register ---------------------------------------------------------------

def test_register_upgrades_guest(make_client, guest, spies):
    upgrade, merge = spies
    db = _FakeDb(guest)
    r = make_client(db, guest).post(
        "/api/v1/auth/register", json={"username": "ali", "password": "secret1", "name": "Ali"}, headers=NATIVE
    )
    assert r.status_code == 201, r.text
    kw = upgrade.await_args.kwargs
    assert kw["username"] == "ali" and kw["name"] == "Ali"
    assert bcrypt.checkpw(b"secret1", kw["password_hash"].encode())
    assert "language" not in kw  # the guest keeps its own language
    assert r.json()["user"]["id"] == str(guest.id)
    assert r.json()["user"]["is_guest"] is False and r.json()["user"]["language"] == "ru"
    assert r.json()["guest_merged_rooms"] is None
    assert db.added == [] and not merge.await_count


def test_register_conflict_leaves_guest(make_client, guest, spies):
    upgrade, _ = spies
    db = _FakeDb(guest, _user(username="ali"))
    r = make_client(db, guest).post("/api/v1/auth/register", json={"username": "ali", "password": "secret1"})
    assert r.status_code == 409 and not upgrade.await_count
    assert guest.is_guest is True


def test_register_without_guest_sets_registered_at(make_client, spies):
    db = _FakeDb()
    r = make_client(db).post("/api/v1/auth/register", json={"username": "vali", "password": "secret1"})
    assert r.status_code == 201
    assert db.added[0].registered_at is not None and db.added[0].is_guest is not True


def test_upgraded_refresh_token_is_30_days(make_client, guest, spies):
    r = make_client(_FakeDb(guest), guest).post(
        "/api/v1/auth/register", json={"username": "ali", "password": "secret1"}, headers=NATIVE
    )
    days = (jwt.get_unverified_claims(r.json()["refresh_token"])["exp"] - time.time()) / 86400
    assert 29 < days <= 30


# --- OTP ----------------------------------------------------------------------

PHONE = "+998901234567"


def test_otp_new_phone_upgrades(make_client, guest, spies, otp_ok):
    upgrade, merge = spies
    db = _FakeDb(guest)
    r = make_client(db, guest).post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": "1234"})
    assert r.status_code == 200, r.text
    assert upgrade.await_args.kwargs == {"phone": PHONE}
    assert r.json()["user"]["id"] == str(guest.id) and db.added == []
    assert not merge.await_count


def test_otp_existing_phone_merges(make_client, guest, spies, otp_ok):
    upgrade, merge = spies
    existing = _user(phone=PHONE)
    r = make_client(_FakeDb(guest, existing), guest).post(
        "/api/v1/auth/otp/verify", json={"phone": PHONE, "code": "1234"}
    )
    assert r.status_code == 200, r.text
    assert merge.await_args.args[1:] == (guest.id, existing)
    assert r.json()["guest_merged_rooms"] == 2 and r.json()["user"]["id"] == str(existing.id)
    assert not upgrade.await_count


def test_otp_new_user_without_guest_sets_registered_at(make_client, spies, otp_ok):
    db = _FakeDb()
    r = make_client(db).post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": "1234"})
    assert r.status_code == 200 and db.added[0].registered_at is not None


# --- Google / Apple -----------------------------------------------------------

def test_google_new_sub_upgrades(make_client, guest, spies, google):
    upgrade, merge = spies
    r = make_client(_FakeDb(guest), guest).post("/api/v1/auth/google", json={"id_token": "t"})
    assert r.status_code == 200, r.text
    assert upgrade.await_args.kwargs == {"google_sub": "g-1", "email": "ali@example.com", "name": "Ali"}
    assert r.json()["user"]["id"] == str(guest.id) and not merge.await_count


def test_google_existing_sub_merges(make_client, guest, spies, google):
    upgrade, merge = spies
    existing = _user(google_sub="g-1")
    r = make_client(_FakeDb(guest, existing), guest).post("/api/v1/auth/google", json={"id_token": "t"})
    assert r.status_code == 200
    assert merge.await_args.args[1:] == (guest.id, existing)
    assert r.json()["guest_merged_rooms"] == 2 and r.json()["user"]["id"] == str(existing.id)
    assert not upgrade.await_count


def test_google_new_user_without_guest_sets_registered_at(make_client, spies, google):
    db = _FakeDb()
    r = make_client(db).post("/api/v1/auth/google", json={"id_token": "t"})
    assert r.status_code == 200 and db.added[0].registered_at is not None


def test_apple_new_sub_upgrades(make_client, guest, spies, apple):
    upgrade, _ = spies
    r = make_client(_FakeDb(guest), guest).post(
        "/api/v1/auth/apple", json={"identity_token": "t", "name": "Vali"}
    )
    assert r.status_code == 200, r.text
    assert upgrade.await_args.kwargs == {"apple_sub": "a-1", "email": "x@privaterelay.appleid.com", "name": "Vali"}
    assert r.json()["user"]["id"] == str(guest.id)


def test_apple_existing_sub_merges(make_client, guest, spies, apple):
    _, merge = spies
    existing = _user(apple_sub="a-1")
    r = make_client(_FakeDb(guest, existing), guest).post("/api/v1/auth/apple", json={"identity_token": "t"})
    assert r.status_code == 200
    assert merge.await_args.args[1:] == (guest.id, existing)
    assert r.json()["guest_merged_rooms"] == 2 and r.json()["user"]["id"] == str(existing.id)


def test_apple_new_user_without_guest_sets_registered_at(make_client, spies, apple):
    db = _FakeDb()
    r = make_client(db).post("/api/v1/auth/apple", json={"identity_token": "t"})
    assert r.status_code == 200 and db.added[0].registered_at is not None


def test_inactive_existing_account_is_not_merged(make_client, guest, spies, google):
    _, merge = spies
    existing = _user(google_sub="g-1", is_active=False)
    r = make_client(_FakeDb(guest, existing), guest).post("/api/v1/auth/google", json={"id_token": "t"})
    assert r.status_code == 401 and not merge.await_count


# --- password login -----------------------------------------------------------

def _pw_user():
    return _user(username="ali", password_hash=bcrypt.hashpw(b"secret1", bcrypt.gensalt()).decode())


def test_password_login_merges(make_client, guest, spies):
    _, merge = spies
    existing = _pw_user()
    r = make_client(_FakeDb(guest, existing), guest).post(
        "/api/v1/auth/login", json={"username": "ali", "password": "secret1"}
    )
    assert r.status_code == 200
    assert merge.await_args.args[1:] == (guest.id, existing)
    assert r.json()["guest_merged_rooms"] == 2 and r.json()["user"]["id"] == str(existing.id)


def test_wrong_password_does_not_merge(make_client, guest, spies):
    _, merge = spies
    r = make_client(_FakeDb(guest, _pw_user()), guest).post(
        "/api/v1/auth/login", json={"username": "ali", "password": "nope"}
    )
    assert r.status_code == 401 and not merge.await_count


def test_merge_noop_answers_like_a_plain_login(make_client, guest, spies):
    _, merge = spies
    merge.return_value = None  # a parallel sign-in got there first
    r = make_client(_FakeDb(guest, _pw_user()), guest).post(
        "/api/v1/auth/login", json={"username": "ali", "password": "secret1"}
    )
    assert r.status_code == 200 and r.json()["guest_merged_rooms"] is None


def test_login_without_guest_token_unchanged(make_client, spies):
    # An old app build: no guest, no token. Same answer as before plus only
    # guest_merged_rooms: null.
    upgrade, merge = spies
    r = make_client(_FakeDb(_pw_user())).post(
        "/api/v1/auth/login", json={"username": "ali", "password": "secret1"}, headers=NATIVE
    )
    assert r.status_code == 200
    assert set(r.json()) == {"user", "access_token", "refresh_token", "token_type", "guest_merged_rooms"}
    assert r.json()["guest_merged_rooms"] is None
    assert not upgrade.await_count and not merge.await_count


# --- get_guest_caller ---------------------------------------------------------

def _request(cookie: str | None = None) -> Request:
    headers = [(b"cookie", f"token={cookie}".encode())] if cookie else []
    return Request({"type": "http", "method": "POST", "path": "/", "headers": headers, "query_string": b""})


async def test_non_guest_token_is_ignored():
    user = _user()
    db = _FakeDb(user)
    assert await auth_router.get_guest_caller(_request(), db, create_access_token(str(user.id))) is None


async def test_no_token_is_none():
    assert await auth_router.get_guest_caller(_request(), _FakeDb(), None) is None


async def test_bad_token_is_none():
    assert await auth_router.get_guest_caller(_request("garbage"), _FakeDb(), "also-garbage") is None


async def test_inactive_guest_is_none():
    g = _user(is_guest=True, is_active=False)
    assert await auth_router.get_guest_caller(_request(), _FakeDb(g), create_access_token(str(g.id))) is None


async def test_get_guest_caller_prefers_bearer_over_cookie():
    from_bearer, from_cookie = _user(is_guest=True), _user(is_guest=True)
    db = _FakeDb(from_bearer, from_cookie)
    got = await auth_router.get_guest_caller(
        _request(create_access_token(str(from_cookie.id))), db, create_access_token(str(from_bearer.id))
    )
    assert got is from_bearer


async def test_cookie_guest_when_no_bearer():
    g = _user(is_guest=True)
    assert await auth_router.get_guest_caller(_request(create_access_token(str(g.id))), _FakeDb(g), None) is g


async def test_db_error_is_none():
    class _Broken(_FakeDb):
        async def execute(self, stmt):
            raise RuntimeError("db down")

    g = _user(is_guest=True)
    assert await auth_router.get_guest_caller(_request(), _Broken(), create_access_token(str(g.id))) is None


# --- delete account -----------------------------------------------------------

def test_guest_delete_account_needs_no_password(monkeypatch):
    import app.services.account_deletion as account_deletion

    guest = _user(is_guest=True)
    deleted = AsyncMock()
    monkeypatch.setattr(account_deletion, "delete_account", deleted)
    app.dependency_overrides[get_current_active_user] = lambda: guest
    app.dependency_overrides[get_db] = lambda: _FakeDb(guest)
    try:
        r = TestClient(app).post("/api/v1/auth/delete-account", json={})
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 204
    deleted.assert_awaited_once()
    assert deleted.await_args.args[1] is guest


# --- upgrade lost the race (row no longer a guest under the lock) -------------

@pytest.fixture
def upgrade_lost(spies):
    upgrade, merge = spies
    upgrade.side_effect = None
    upgrade.return_value = None
    return upgrade, merge


def test_register_falls_back_to_a_new_account_when_upgrade_lost(make_client, guest, upgrade_lost):
    db = _FakeDb(guest)
    r = make_client(db, guest).post("/api/v1/auth/register", json={"username": "ali2", "password": "secret1"})
    assert r.status_code == 201, r.text
    assert len(db.added) == 1 and db.added[0].username == "ali2"
    assert r.json()["user"]["id"] == str(db.added[0].id) != str(guest.id)


def test_otp_falls_back_to_a_new_account_when_upgrade_lost(make_client, guest, upgrade_lost, otp_ok):
    db = _FakeDb(guest)
    r = make_client(db, guest).post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": "1234"})
    assert r.status_code == 200 and db.added[0].phone == PHONE
    assert r.json()["user"]["id"] != str(guest.id)


def test_google_falls_back_to_a_new_account_when_upgrade_lost(make_client, guest, upgrade_lost, google):
    db = _FakeDb(guest)
    r = make_client(db, guest).post("/api/v1/auth/google", json={"id_token": "t"})
    assert r.status_code == 200 and db.added[0].google_sub == "g-1"


def test_apple_falls_back_to_a_new_account_when_upgrade_lost(make_client, guest, upgrade_lost, apple):
    db = _FakeDb(guest)
    r = make_client(db, guest).post("/api/v1/auth/apple", json={"identity_token": "t"})
    assert r.status_code == 200 and db.added[0].apple_sub == "a-1"


# --- review fixes: inactive login target, DB error rollback --------------------

def test_password_login_into_inactive_account_does_not_merge(make_client, guest, spies):
    _, merge = spies
    existing = _pw_user()
    existing.is_active = False
    make_client(_FakeDb(guest, existing), guest).post(
        "/api/v1/auth/login", json={"username": "ali", "password": "secret1"}
    )
    assert not merge.await_count


async def test_db_error_rolls_the_session_back():
    class _Broken(_FakeDb):
        rolled_back = False

        async def execute(self, stmt):
            raise RuntimeError("db down")

        async def rollback(self):
            self.rolled_back = True

    g = _user(is_guest=True)
    db = _Broken()
    assert await auth_router.get_guest_caller(_request(), db, create_access_token(str(g.id))) is None
    assert db.rolled_back is True
