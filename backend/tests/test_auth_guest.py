"""POST /api/v1/auth/guest — a guest session without sign-up (spec 2026-11-20 mehmon rejimi §1)."""
import time
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.config import settings
from app.database import get_db
from app.main import app

URL = "/api/v1/auth/guest"
NATIVE = {"X-Client-Type": "mobile"}


class _FakeDb:
    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass

    async def refresh(self, obj):
        # Stand in for the server-side defaults Postgres would fill in.
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        if getattr(obj, "created_at", None) is None:
            obj.created_at = datetime.now(timezone.utc)
        if getattr(obj, "is_admin", None) is None:
            obj.is_admin = False
        if getattr(obj, "is_active", None) is None:
            obj.is_active = True


@pytest.fixture
def db():
    fake = _FakeDb()
    app.dependency_overrides[get_db] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


@pytest.fixture
def client(db):
    return TestClient(app)


@pytest.fixture
def guest_on(monkeypatch):
    monkeypatch.setattr(settings, "GUEST_MODE_ENABLED", True)


def test_off_by_default(client, db):
    assert settings.GUEST_MODE_ENABLED is False
    r = client.post(URL, json={}, headers=NATIVE)
    assert r.status_code == 503
    assert db.added == []


def test_creates_guest(client, db, guest_on):
    r = client.post(URL, json={"install_id": str(uuid.uuid4()), "language": "ru"}, headers=NATIVE)
    assert r.status_code == 201
    b = r.json()
    assert b["user"]["is_guest"] is True and b["user"]["language"] == "ru"
    assert b["user"]["phone"] is None and b["user"]["username"] is None
    assert b["access_token"] and b["refresh_token"]
    exp = jwt.get_unverified_claims(b["refresh_token"])["exp"]
    assert 89 * 86400 < exp - time.time() <= 90 * 86400
    added = db.added[0]
    assert added.is_guest is True
    assert added.phone is None and added.username is None
    assert added.google_sub is None and added.apple_sub is None and added.email is None
    assert added.last_seen_at is not None
    assert added.registered_at is None


def test_language_defaults_to_uz(client, db, guest_on):
    r = client.post(URL, json={}, headers=NATIVE)
    assert r.status_code == 201 and r.json()["user"]["language"] == "uz"


def test_guest_refresh_cookie_lives_90_days(client, guest_on):
    r = client.post(URL, json={}, headers=NATIVE)
    cookie = next(h for h in r.headers.get_list("set-cookie") if h.startswith("refresh_token="))
    assert f"Max-Age={90 * 86400}" in cookie


def test_ip_limit(client, guest_on):
    codes = [client.post(URL, json={}, headers=NATIVE).status_code for _ in range(31)]
    assert codes[:30] == [201] * 30 and codes[30] == 429


def test_install_limit(client, guest_on):
    iid = str(uuid.uuid4())
    codes = [client.post(URL, json={"install_id": iid}, headers=NATIVE).status_code for _ in range(4)]
    assert codes == [201, 201, 201, 429]
    # Another install from the same IP is not affected.
    assert client.post(URL, json={"install_id": str(uuid.uuid4())}, headers=NATIVE).status_code == 201


def test_global_limit(client, guest_on, monkeypatch):
    monkeypatch.setattr(settings, "GUEST_GLOBAL_DAILY_LIMIT", 2)
    codes = [client.post(URL, json={}, headers=NATIVE).status_code for _ in range(3)]
    assert codes == [201, 201, 429]


def test_bad_install_id_is_422(client, guest_on):
    assert client.post(URL, json={"install_id": "nope"}, headers=NATIVE).status_code == 422


def test_web_gets_cookies_not_body_tokens(client, guest_on):
    r = client.post(URL, json={})
    assert r.status_code == 201
    assert r.json()["access_token"] is None and r.json()["refresh_token"] is None
    assert "token" in r.cookies and "refresh_token" in r.cookies
