"""
Mebel workshop link: a per-project secret token that lets a part label's QR open
the project read-only, without an account.

What matters: only the owner creates or revokes it, the token is random and
stable until revoked, and the public read returns the construction data only,
with one identical 404 for every token that does not work. The DB session is
stubbed as in test_mebel.py.
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.v1.deps import get_current_active_user
from app.database import get_db
from app.main import app
from app.models.furniture_project import FurnitureProject


def _user():
    user = MagicMock()
    user.id = uuid.uuid4()
    user.is_active = True
    user.is_admin = False
    return user


class _Result:
    def __init__(self, one=None):
        self._one = one

    def scalar_one_or_none(self):
        return self._one


def _db(*results):
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=list(results) or [_Result()])
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    return db


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


def _as(user, db):
    if user is not None:
        app.dependency_overrides[get_current_active_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db


def _project(user_id, **kw):
    now = datetime.now(timezone.utc)
    data = {"schemaVersion": 1, "name": "Oshxona", "defaults": {"board": {"thickness": 18}}, "cabinets": []}
    values = dict(id=uuid.uuid4(), user_id=user_id, name="Oshxona", data=data, schema_version=1,
                  created_at=now, updated_at=now, cut_at=now, workshop_token=None)
    values.update(kw)
    return FurnitureProject(**values)


def _url(row):
    return f"/api/v1/mebel/projects/{row.id}/workshop-link"


# --- owner endpoints ---------------------------------------------------------

def test_post_creates_a_token_for_the_owner(client):
    user = _user()
    row = _project(user.id)
    # _own_project, then the collision check finds nothing
    db = _db(_Result(row), _Result(None))
    _as(user, db)

    r = client.post(_url(row))

    assert r.status_code == 200, r.text
    token = r.json()["token"]
    assert isinstance(token, str) and len(token) >= 30
    assert row.workshop_token == token
    db.flush.assert_awaited()


def test_post_returns_the_existing_token(client):
    user = _user()
    row = _project(user.id, workshop_token="tok-existing")
    _as(user, _db(_Result(row)))

    r = client.post(_url(row))

    assert r.status_code == 200
    assert r.json() == {"token": "tok-existing"}


def test_post_on_someone_elses_project_is_404(client):
    user = _user()
    row = _project(uuid.uuid4())
    _as(user, _db(_Result(row)))

    r = client.post(_url(row))

    assert r.status_code == 404
    # the app-wide 404 handler answers every 404 with one body
    assert r.json() == {"detail": "Not found"}
    assert row.workshop_token is None


def test_delete_clears_the_token(client):
    user = _user()
    row = _project(user.id, workshop_token="tok")
    _as(user, _db(_Result(row)))

    r = client.delete(_url(row))

    assert r.status_code == 204
    assert row.workshop_token is None


def test_delete_on_someone_elses_project_is_404(client):
    user = _user()
    row = _project(uuid.uuid4(), workshop_token="tok")
    _as(user, _db(_Result(row)))

    assert client.delete(_url(row)).status_code == 404
    assert row.workshop_token == "tok"


def test_a_new_token_after_revoke_differs(client):
    user = _user()
    row = _project(user.id)
    _as(user, _db(_Result(row), _Result(None), _Result(row), _Result(row), _Result(None)))

    first = client.post(_url(row)).json()["token"]
    assert client.delete(_url(row)).status_code == 204
    second = client.post(_url(row)).json()["token"]

    assert first != second


def test_project_out_says_whether_a_link_exists(client):
    user = _user()
    without = _project(user.id)
    with_link = _project(user.id, workshop_token="tok")
    _as(user, _db(_Result(without), _Result(with_link)))

    a = client.get(f"/api/v1/mebel/projects/{without.id}").json()
    b = client.get(f"/api/v1/mebel/projects/{with_link.id}").json()

    assert a["has_workshop_link"] is False
    assert b["has_workshop_link"] is True
    assert "workshop_token" not in a and "workshop_token" not in b


# --- public read -------------------------------------------------------------

from unittest.mock import patch  # noqa: E402


def _public(client, db, token, limit=None):
    """GET /public/mebel/{token} with no user override; the rate limit stubbed."""
    _as(None, db)
    limit = limit or AsyncMock()
    with patch("app.routers.mebel.get_redis", return_value=MagicMock()), \
            patch("app.routers.mebel._enforce_rate_limit", limit):
        return client.get(f"/api/v1/public/mebel/{token}")


def test_public_returns_name_and_data_only(client):
    row = _project(uuid.uuid4(), workshop_token="tok")
    r = _public(client, _db(_Result(row)), "tok")

    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"name", "data"}
    assert body["name"] == "Oshxona" and body["data"] == row.data


def test_public_404_is_identical_for_wrong_and_revoked(client):
    wrong = _public(client, _db(_Result(None)), "nope")
    revoked = _public(client, _db(_Result(None)), "was-revoked-token")

    assert wrong.status_code == revoked.status_code == 404
    assert wrong.json() == revoked.json()


def test_public_blank_token_is_404_without_a_query(client):
    db = _db()
    r = _public(client, db, "%20")

    assert r.status_code == 404
    db.execute.assert_not_awaited()


def test_public_is_rate_limited_per_ip(client):
    limit = AsyncMock(side_effect=HTTPException(status_code=429, detail="Juda ko'p so'rov"))
    db = _db()
    r = _public(client, db, "tok", limit=limit)

    assert r.status_code == 429
    assert limit.await_args.args[1].startswith("public_mebel_ip:")
    db.execute.assert_not_awaited()


def test_public_needs_no_auth(client):
    row = _project(uuid.uuid4(), workshop_token="tok")
    r = _public(client, _db(_Result(row)), "tok")

    assert get_current_active_user not in app.dependency_overrides
    assert r.status_code == 200
