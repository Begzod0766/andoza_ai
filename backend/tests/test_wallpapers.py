"""
Wallpaper library tests.

The library is shared and permanent, so the rules that matter are: only images
get in, the same image never lands twice, and only an admin can take one out.

Storage and the DB session are stubbed — these cover the router's contract,
not Postgres.
"""
import io
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.api.v1.deps import get_current_active_user
from app.database import get_db
from app.main import app
from app.models.wallpaper import Wallpaper


def _user(is_admin: bool = False):
    user = MagicMock()
    user.id = uuid.uuid4()
    user.is_active = True
    user.is_admin = is_admin
    return user


class _Result:
    """Stands in for the object SQLAlchemy's execute() returns."""

    def __init__(self, one=None, many=()):
        self._one = one
        self._many = list(many)

    def scalar_one_or_none(self):
        return self._one

    def scalars(self):
        return self

    def all(self):
        return self._many


def _db(execute_result=None):
    db = AsyncMock()
    db.execute = AsyncMock(return_value=execute_result or _Result())
    db.flush = AsyncMock()
    db.delete = AsyncMock()
    db.add = MagicMock()

    async def _refresh(obj, attribute_names=None):
        # Stand in for the DB filling in its defaults — the id is a client-side
        # default and created_at a server default, both only readable after the
        # round trip the real session makes.
        if obj.id is None:
            obj.id = uuid.uuid4()
        if obj.created_at is None:
            obj.created_at = datetime.now(timezone.utc)

    db.refresh = AsyncMock(side_effect=_refresh)
    return db


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


def _as(user, db):
    app.dependency_overrides[get_current_active_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db


PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


class TestUpload:
    def test_rejects_non_image(self, client):
        _as(_user(), _db())
        response = client.post(
            "/api/v1/wallpapers",
            files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert response.status_code == 415

    def test_rejects_empty_file(self, client):
        _as(_user(), _db())
        response = client.post(
            "/api/v1/wallpapers",
            files={"file": ("empty.png", io.BytesIO(b""), "image/png")},
        )
        assert response.status_code == 400

    def test_rejects_oversized_file(self, client):
        # The real limit is 15 MB (_MAX_FILE_SIZE_BYTES in app.routers.wallpapers);
        # the size check happens after `await file.read()`, so exercising it for
        # real would mean building and multipart-encoding a real ~15 MB payload
        # on every test run. Under `pytest --cov` that one file alone dominated
        # the whole suite's runtime (coverage.py's line tracing multiplies the
        # cost of whatever byte-level loop the multipart parser runs). Patching
        # the limit down lets a tiny payload exercise the exact same
        # `len(file_bytes) > _MAX_FILE_SIZE_BYTES` comparison and 413 response
        # without touching the production constant itself.
        _as(_user(), _db())
        with patch("app.routers.wallpapers._MAX_FILE_SIZE_BYTES", 1024):
            oversized = io.BytesIO(b"0" * 2048)
            response = client.post(
                "/api/v1/wallpapers",
                files={"file": ("big.png", oversized, "image/png")},
            )
        assert response.status_code == 413

    def test_stores_image_and_returns_absolute_url(self, client):
        db = _db()
        _as(_user(), db)
        with patch(
            "app.routers.wallpapers.upload_file",
            return_value="/media/wallpapers/abc.png",
        ) as stored:
            response = client.post(
                "/api/v1/wallpapers",
                files={"file": ("oboy.png", io.BytesIO(PNG), "image/png")},
            )

        assert response.status_code == 201
        body = response.json()
        # A relative path would break as a WebGL texture URL on the frontend
        assert body["url"].startswith("http://")
        # The URL is rebuilt from the stored key rather than echoing whatever
        # the storage backend returned, so S3 and local storage agree
        assert "/media/wallpapers/" in body["url"]
        assert body["url"].endswith(".png")
        assert body["name"] == "oboy.png"
        assert body["price_uzs"] is None
        assert body["description"] is None
        assert stored.call_args.args[1].startswith("wallpapers/")
        db.add.assert_called_once()

    def test_non_admin_cannot_set_metadata(self, client):
        db = _db()
        _as(_user(is_admin=False), db)
        response = client.post(
            "/api/v1/wallpapers",
            data={"price_uzs": "85000"},
            files={"file": ("oboy.png", io.BytesIO(PNG), "image/png")},
        )
        assert response.status_code == 403
        db.add.assert_not_called()

    def test_non_admin_cannot_hijack_existing_entry_via_reupload(self, client):
        # Same sha256-dedup path as test_reuploading_same_image_updates_metadata_
        # on_existing_entry below, but as a non-admin — must be refused, not
        # silently applied, since the sha256 is derivable from the public URL.
        existing = Wallpaper(
            id=uuid.uuid4(),
            status="approved",
            name="oboy.png",
            storage_key="wallpapers/existing.png",
            content_type="image/png",
            size_bytes=len(PNG),
            sha256="whatever",
        )
        existing.created_at = datetime.now(timezone.utc)
        db = _db(_Result(one=existing))
        _as(_user(is_admin=False), db)

        response = client.post(
            "/api/v1/wallpapers",
            data={"name": "Bosqinchi", "price_uzs": "1"},
            files={"file": ("oboy.png", io.BytesIO(PNG), "image/png")},
        )
        assert response.status_code == 403
        assert existing.name == "oboy.png"  # untouched
        assert existing.price_uzs is None

    def test_stores_name_price_and_description_when_given(self, client):
        db = _db()
        _as(_user(is_admin=True), db)
        with patch("app.routers.wallpapers.upload_file", return_value="/media/wallpapers/abc.png"):
            response = client.post(
                "/api/v1/wallpapers",
                data={"name": "Gulli oboy", "price_uzs": "85000", "description": "Yaponcha uslub"},
                files={"file": ("oboy.png", io.BytesIO(PNG), "image/png")},
            )

        assert response.status_code == 201
        body = response.json()
        assert body["name"] == "Gulli oboy"
        assert body["price_uzs"] == 85000
        assert body["description"] == "Yaponcha uslub"

    def test_rejects_negative_price(self, client):
        db = _db()
        _as(_user(is_admin=True), db)
        response = client.post(
            "/api/v1/wallpapers",
            data={"price_uzs": "-100"},
            files={"file": ("oboy.png", io.BytesIO(PNG), "image/png")},
        )
        assert response.status_code == 422

    def test_stores_roll_dimensions(self, client):
        db = _db()
        _as(_user(is_admin=True), db)
        with patch("app.routers.wallpapers.upload_file", return_value="/media/wallpapers/abc.png"):
            response = client.post(
                "/api/v1/wallpapers",
                data={"width_cm": "53", "total_length_m": "10.05"},
                files={"file": ("oboy.png", io.BytesIO(PNG), "image/png")},
            )

        assert response.status_code == 201
        body = response.json()
        assert body["width_cm"] == 53
        assert body["total_length_m"] == 10.05
        assert body["height_cm"] is None

    def test_stores_panel_dimensions(self, client):
        db = _db()
        _as(_user(is_admin=True), db)
        with patch("app.routers.wallpapers.upload_file", return_value="/media/wallpapers/abc.png"):
            response = client.post(
                "/api/v1/wallpapers",
                data={"width_cm": "300", "height_cm": "270"},
                files={"file": ("oboy.png", io.BytesIO(PNG), "image/png")},
            )

        assert response.status_code == 201
        body = response.json()
        assert body["width_cm"] == 300
        assert body["height_cm"] == 270
        assert body["total_length_m"] is None

    def test_rejects_non_positive_dimensions(self, client):
        db = _db()
        _as(_user(is_admin=True), db)
        response = client.post(
            "/api/v1/wallpapers",
            data={"width_cm": "0"},
            files={"file": ("oboy.png", io.BytesIO(PNG), "image/png")},
        )
        assert response.status_code == 422
        db.add.assert_not_called()
        db.add.assert_not_called()

    def test_reuploading_same_image_updates_metadata_on_existing_entry(self, client):
        existing = Wallpaper(
            id=uuid.uuid4(),
            status="approved",
            name="oboy.png",
            storage_key="wallpapers/existing.png",
            content_type="image/png",
            size_bytes=len(PNG),
            sha256="whatever",
        )
        existing.created_at = datetime.now(timezone.utc)
        db = _db(_Result(one=existing))
        _as(_user(is_admin=True), db)

        with patch("app.routers.wallpapers.upload_file") as stored:
            response = client.post(
                "/api/v1/wallpapers",
                data={"name": "Yangilangan nom", "price_uzs": "120000"},
                files={"file": ("oboy.png", io.BytesIO(PNG), "image/png")},
            )

        assert response.status_code == 201
        body = response.json()
        assert body["id"] == str(existing.id)
        assert body["name"] == "Yangilangan nom"
        assert body["price_uzs"] == 120000
        stored.assert_not_called()  # nothing re-uploaded to storage

    def test_same_image_twice_reuses_the_entry(self, client):
        existing = Wallpaper(
            id=uuid.uuid4(),
            status="approved",
            name="oboy.png",
            storage_key="wallpapers/existing.png",
            content_type="image/png",
            size_bytes=len(PNG),
            sha256="whatever",
        )
        existing.created_at = datetime.now(timezone.utc)
        db = _db(_Result(one=existing))
        _as(_user(), db)

        with patch("app.routers.wallpapers.upload_file") as stored:
            response = client.post(
                "/api/v1/wallpapers",
                files={"file": ("oboy.png", io.BytesIO(PNG), "image/png")},
            )

        assert response.status_code == 201
        assert response.json()["id"] == str(existing.id)
        stored.assert_not_called()  # nothing re-uploaded
        db.add.assert_not_called()  # and no duplicate row


class TestDelete:
    def test_non_admin_is_refused(self, client):
        db = _db()
        _as(_user(is_admin=False), db)
        response = client.delete(f"/api/v1/wallpapers/{uuid.uuid4()}")
        assert response.status_code == 403
        db.delete.assert_not_called()

    def test_admin_removes_row_and_file(self, client):
        wallpaper = Wallpaper(
            id=uuid.uuid4(),
            status="approved",
            name="oboy.png",
            storage_key="wallpapers/gone.png",
            content_type="image/png",
            size_bytes=10,
            sha256="hash",
        )
        db = _db(_Result(one=wallpaper))
        _as(_user(is_admin=True), db)

        with patch("app.routers.wallpapers.delete_file") as removed:
            response = client.delete(f"/api/v1/wallpapers/{wallpaper.id}")

        assert response.status_code == 204
        db.delete.assert_awaited_once()
        removed.assert_called_once_with("wallpapers/gone.png")

    def test_missing_wallpaper_is_404(self, client):
        _as(_user(is_admin=True), _db(_Result(one=None)))
        response = client.delete(f"/api/v1/wallpapers/{uuid.uuid4()}")
        assert response.status_code == 404


class TestUpdate:
    def test_refuses_non_admin(self, client):
        db = _db()
        _as(_user(is_admin=False), db)
        response = client.patch(f"/api/v1/wallpapers/{uuid.uuid4()}", json={"name": "X"})
        assert response.status_code == 403

    def test_partial_update_only_touches_given_fields(self, client):
        wallpaper = Wallpaper(
            id=uuid.uuid4(),
            status="approved",
            name="oboy.png",
            storage_key="wallpapers/a.png",
            content_type="image/png",
            size_bytes=10,
            sha256="hash",
        )
        wallpaper.store = None
        db = _db(_Result(one=wallpaper))
        _as(_user(is_admin=True), db)

        response = client.patch(
            f"/api/v1/wallpapers/{wallpaper.id}",
            json={"price_uzs": 90000},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["price_uzs"] == 90000
        assert body["name"] == "oboy.png"  # untouched

    def test_missing_wallpaper_is_404(self, client):
        db = _db(_Result(one=None))
        _as(_user(is_admin=True), db)
        response = client.patch(f"/api/v1/wallpapers/{uuid.uuid4()}", json={"name": "X"})
        assert response.status_code == 404

    def test_rejects_unknown_store(self, client):
        wallpaper = Wallpaper(
            id=uuid.uuid4(),
            status="approved",
            name="oboy.png",
            storage_key="wallpapers/a.png",
            content_type="image/png",
            size_bytes=10,
            sha256="hash",
        )
        wallpaper.store = None
        db = _db(_Result(one=wallpaper))
        _as(_user(is_admin=True), db)

        # First execute() returns the wallpaper; the second (store lookup)
        # needs to return None — _db only supports one canned result, so
        # swap it out after the fixture is built.
        store_lookup = _Result(one=None)
        calls = {"n": 0}

        async def _execute(*args, **kwargs):
            calls["n"] += 1
            return _Result(one=wallpaper) if calls["n"] == 1 else store_lookup

        db.execute = AsyncMock(side_effect=_execute)
        response = client.patch(
            f"/api/v1/wallpapers/{wallpaper.id}",
            json={"store_id": str(uuid.uuid4())},
        )
        assert response.status_code == 404


def _sql(db) -> str:
    stmt = db.execute.call_args.args[0]
    return str(stmt.compile(compile_kwargs={"literal_binds": True}))


def _row(**kw) -> Wallpaper:
    defaults = dict(
        id=uuid.uuid4(), name="Oboy", kind="oboy", store_id=None, price_uzs=None,
        description=None, width_cm=None, height_cm=None, total_length_m=None,
        storage_key="wallpapers/a.png", content_type="image/png", size_bytes=10,
        sha256="a" * 64, status="approved", moderation_note=None,
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(kw)
    w = Wallpaper(**defaults)
    w.store = None
    return w


class TestModerationVisibility:
    @pytest.mark.parametrize("qs", ["", "?kind=oboy", f"?store_id={uuid.uuid4()}",
                                    f"?kind=oboy&store_id={uuid.uuid4()}"])
    def test_public_list_hides_pending_and_rejected(self, client, qs):
        db = _db(_Result(many=[]))
        _as(_user(), db)
        response = client.get(f"/api/v1/wallpapers{qs}")
        assert response.status_code == 200
        assert "wallpapers.status = 'approved'" in _sql(db)

    def test_public_list_hides_closed_shops_but_keeps_global(self, client):
        db = _db(_Result(many=[]))
        _as(_user(), db)
        assert client.get("/api/v1/wallpapers").status_code == 200
        sql = _sql(db)
        assert "wallpapers.store_id IS NULL" in sql and "stores.is_active IS true" in sql

    def test_admin_all_does_not_filter_by_shop(self, client):
        db = _db(_Result(many=[]))
        _as(_user(is_admin=True), db)
        assert client.get("/api/v1/wallpapers/all").status_code == 200
        assert "stores.is_active" not in _sql(db)

    def test_public_list_needs_no_auth(self, client):
        app.dependency_overrides[get_db] = lambda: _db(_Result(many=[]))
        assert client.get("/api/v1/wallpapers").status_code == 200

    def test_admin_all_lists_every_status(self, client):
        db = _db(_Result(many=[_row(status="pending"), _row(status="rejected")]))
        _as(_user(is_admin=True), db)
        response = client.get("/api/v1/wallpapers/all?kind=oboy")
        assert response.status_code == 200
        sql = _sql(db)
        assert "wallpapers.status =" not in sql and "wallpapers.status !=" not in sql
        assert "wallpapers.kind = 'oboy'" in sql
        assert [w["status"] for w in response.json()] == ["pending", "rejected"]

    def test_plain_user_cannot_list_all(self, client):
        _as(_user(), _db())
        assert client.get("/api/v1/wallpapers/all").status_code == 403

    def test_wallpaper_out_has_status(self, client):
        db = _db(_Result(many=[_row(status="rejected", moderation_note="Xira")]))
        _as(_user(is_admin=True), db)
        body = client.get("/api/v1/wallpapers/all").json()[0]
        assert body["status"] == "rejected"
        assert body["moderation_note"] == "Xira"

    def test_plain_user_upload_is_approved(self, client):
        db = _db()
        _as(_user(), db)
        with patch("app.routers.wallpapers.upload_file", return_value="wallpapers/x.png"):
            response = client.post(
                "/api/v1/wallpapers",
                files={"file": ("oboy.png", io.BytesIO(PNG), "image/png")},
            )
        assert response.status_code == 201
        assert db.add.call_args.args[0].status == "approved"
        assert response.json()["status"] == "approved"

    @pytest.mark.parametrize("field,value", [
        ("name", "Mening oboyim"),
        ("store_id", str(uuid.uuid4())),
        ("price_uzs", "1000"),
        ("description", "izoh"),
        ("width_cm", "53"),
        ("total_length_m", "10"),
    ])
    def test_seller_cannot_set_catalog_fields_via_public_upload(self, client, field, value):
        _as(_user(), _db())
        response = client.post(
            "/api/v1/wallpapers",
            data={field: value},
            files={"file": ("oboy.png", io.BytesIO(PNG), "image/png")},
        )
        assert response.status_code == 403
