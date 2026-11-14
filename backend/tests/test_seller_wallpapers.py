"""A shop owner's own wallpapers: added pending, edited, removed.

What these pin: everything acts on the caller's own approved shop and nothing else
(a foreign id is a plain 404, an unapproved shop is a 403), a new oboy starts
pending, a duplicate image is a 409 that never touches the other row, the pending
queue is capped, and removing an approved oboy hides it instead of deleting it.
Storage and the DB session are stubbed.
"""
from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.wallpaper import Wallpaper
from tests.test_seller import JPEG, _R, _store, _user
from tests.test_seller import _as as _seller_as


class R(_R):
    def first(self):
        return self._one


URL = "/api/v1/seller/wallpapers"
PNG = b"\x89PNG" + b"y" * 32
UPLOAD = "app.routers.seller.upload_file"
FORM = {"name": "Gul", "price_uzs": "50000", "width_cm": "53", "total_length_m": "10"}


def _wp(store, status="approved", **kw):
    w = Wallpaper(
        id=uuid.uuid4(), name="Eski", kind="oboy", store_id=store.id if store else None,
        price_uzs=40000, width_cm=53, total_length_m=10, storage_key="wallpapers/old.jpg",
        content_type="image/jpeg", size_bytes=10, sha256="a" * 64, status=status,
        moderation_note="Rasm xira" if status == "rejected" else None,
        created_at=datetime.now(timezone.utc),
    )
    for k, v in kw.items():
        setattr(w, k, v)
    return w


def _as(user, results):
    db = _seller_as(user, results)

    async def _refresh(obj, attribute_names=None):
        # What the database fills in on insert.
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        if getattr(obj, "created_at", None) is None:
            obj.created_at = datetime.now(timezone.utc)

    db.refresh = AsyncMock(side_effect=_refresh)
    return db


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


def _post(client, data=JPEG, ctype="image/jpeg", **fields):
    return client.post(URL, data={**FORM, **fields}, files={"file": ("w.jpg", io.BytesIO(data), ctype)})


def _patch(client, wid, data=None, **fields):
    files = {"file": ("w.png", io.BytesIO(data), "image/png")} if data is not None else None
    return client.patch(f"{URL}/{wid}", data=fields, files=files)


class TestCreate:
    def test_create_is_pending_in_own_store(self, client):
        u = _user()
        own = _store(u)
        db = _as(u, [R(own), R(None), R(0)])
        with patch(UPLOAD, return_value="/media/x.jpg"):
            res = _post(client)
        assert res.status_code == 201, res.text
        w = db.add.call_args.args[0]
        assert (w.status, w.kind, w.store_id, w.uploaded_by) == ("pending", "oboy", own.id, u.id)
        assert w.storage_key.startswith("wallpapers/") and w.storage_key.endswith(".jpg")
        body = res.json()
        assert body["status"] == "pending" and body["store_id"] == str(own.id)
        assert (body["price_uzs"], body["width_cm"], body["total_length_m"]) == (50000, 53.0, 10.0)

    def test_create_requires_approved_store(self, client):
        u = _user()
        db = _as(u, [R(_store(u, "pending"))])
        assert _post(client).status_code == 403
        db.add.assert_not_called()

    def test_create_validates_ranges(self, client):
        u = _user()
        for bad in ({"price_uzs": "0"}, {"width_cm": "20"}, {"total_length_m": "60"}, {"name": ""}):
            db = _as(u, [R(_store(u)), R(None), R(0)])
            assert _post(client, **bad).status_code == 422, bad
            db.add.assert_not_called()

    def test_duplicate_own_image_409_edit_hint(self, client):
        u = _user()
        own = _store(u)
        existing = _wp(own)
        db = _as(u, [R(own), R(existing)])
        res = _post(client)
        assert res.status_code == 409
        assert res.json()["detail"] == "Bu oboy ro'yxatingizda bor, uni tahrirlang"
        db.add.assert_not_called()

    def test_duplicate_foreign_image_409(self, client):
        u = _user()
        foreign = _wp(_store(_user()), name="Begona", price_uzs=1)
        db = _as(u, [R(_store(u)), R(foreign)])
        res = _post(client)
        assert res.status_code == 409
        assert res.json()["detail"] == "Bu rasm kutubxonada allaqachon bor"
        assert (foreign.name, foreign.price_uzs, foreign.status) == ("Begona", 1, "approved")
        db.add.assert_not_called()

    def test_pending_cap_429(self, client):
        u = _user()
        db = _as(u, [R(_store(u)), R(None), R(50)])
        res = _post(client)
        assert res.status_code == 429
        assert res.json()["detail"] == "Tekshiruvni kutayotgan oboylar juda ko'p (50)"
        db.add.assert_not_called()

    def test_non_image_is_415(self, client):
        u = _user()
        _as(u, [R(_store(u))])
        assert _post(client, data=b"x", ctype="text/plain").status_code == 415


class TestList:
    def test_list_only_own_store(self, client):
        u = _user()
        own = _store(u)
        _as(u, [R(own), R(many=[_wp(own, "pending"), _wp(own, "rejected")])])
        res = client.get(URL)
        assert res.status_code == 200
        assert [r["status"] for r in res.json()] == ["pending", "rejected"]
        assert {r["store_id"] for r in res.json()} == {str(own.id)}


class TestEdit:
    def test_patch_foreign_404(self, client):
        u = _user()
        foreign = _wp(_store(_user()))
        _as(u, [R(_store(u)), R(foreign)])
        assert _patch(client, foreign.id, name="Hack").status_code == 404
        assert foreign.name == "Eski"

    def test_patch_missing_404(self, client):
        u = _user()
        _as(u, [R(_store(u)), R(None)])
        assert _patch(client, uuid.uuid4(), name="X").status_code == 404

    def test_patch_requires_approved_store(self, client):
        u = _user()
        _as(u, [R(_store(u, "rejected"))])
        assert _patch(client, uuid.uuid4(), name="X").status_code == 403

    def test_patch_rejected_resubmits(self, client):
        u = _user()
        own = _store(u)
        w = _wp(own, "rejected")
        _as(u, [R(own), R(w), R(3)])
        res = _patch(client, w.id, name="Yangi")
        assert res.status_code == 200, res.text
        assert (w.name, w.status, w.moderation_note) == ("Yangi", "pending", None)

    def test_patch_approved_name_price_stays_approved(self, client):
        u = _user()
        own = _store(u)
        w = _wp(own)
        _as(u, [R(own), R(w)])
        res = _patch(client, w.id, name="Yangi", price_uzs="60000")
        assert res.status_code == 200, res.text
        assert (w.name, w.price_uzs, w.status) == ("Yangi", 60000, "approved")

    def test_patch_validates_ranges(self, client):
        u = _user()
        own = _store(u)
        w = _wp(own)
        _as(u, [R(own), R(w)])
        assert _patch(client, w.id, width_cm="200").status_code == 422
        assert w.width_cm == 53

    def test_patch_file_on_approved_409(self, client):
        u = _user()
        own = _store(u)
        w = _wp(own)
        _as(u, [R(own), R(w)])
        with patch(UPLOAD) as up:
            res = _patch(client, w.id, data=PNG)
        assert res.status_code == 409
        up.assert_not_called()
        assert w.storage_key == "wallpapers/old.jpg"

    def test_patch_file_on_pending_replaces(self, client):
        u = _user()
        own = _store(u)
        w = _wp(own, "pending")
        _as(u, [R(own), R(w), R(None)])
        with patch(UPLOAD, return_value="/media/x.png"):
            res = _patch(client, w.id, data=PNG)
        assert res.status_code == 200, res.text
        assert w.storage_key != "wallpapers/old.jpg" and w.storage_key.endswith(".png")
        assert w.sha256 != "a" * 64 and w.content_type == "image/png" and w.size_bytes == len(PNG)
        assert w.status == "pending"

    def test_patch_file_duplicate_409(self, client):
        u = _user()
        own = _store(u)
        w = _wp(own, "pending")
        other = _wp(_store(_user()), name="Begona")
        _as(u, [R(own), R(w), R(other)])
        with patch(UPLOAD) as up:
            res = _patch(client, w.id, data=PNG)
        assert res.status_code == 409
        up.assert_not_called()
        assert w.storage_key == "wallpapers/old.jpg" and other.name == "Begona"


class TestDelete:
    def test_delete_foreign_404(self, client):
        u = _user()
        foreign = _wp(_store(_user()))
        db = _as(u, [R(_store(u)), R(foreign)])
        assert client.delete(f"{URL}/{foreign.id}").status_code == 404
        db.delete.assert_not_called()
        assert foreign.status == "approved"

    def test_delete_pending_removes_row(self, client):
        u = _user()
        own = _store(u)
        w = _wp(own, "pending")
        db = _as(u, [R(own), R(w)])
        assert client.delete(f"{URL}/{w.id}").status_code == 204
        db.delete.assert_awaited_once_with(w)

    def test_delete_rejected_removes_row(self, client):
        u = _user()
        own = _store(u)
        w = _wp(own, "rejected")
        db = _as(u, [R(own), R(w)])
        assert client.delete(f"{URL}/{w.id}").status_code == 204
        db.delete.assert_awaited_once_with(w)

    def test_delete_approved_hides(self, client):
        u = _user()
        own = _store(u)
        w = _wp(own)
        db = _as(u, [R(own), R(w)])
        assert client.delete(f"{URL}/{w.id}").status_code == 204
        db.delete.assert_not_called()
        assert (w.status, w.moderation_note) == ("rejected", "Do'kon olib tashladi")
