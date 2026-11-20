"""Admins review shops' wallpapers: the pending queue, approve, reject."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.test_seller import _R, _store, _user
from tests.test_seller_wallpapers import _as, _wp

BASE = "/api/v1/admin/moderation"


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_pending_lists_wallpapers(client):
    store = _store(_user())
    w = _wp(store, "pending")
    w.store = store
    db = _as(_user(is_admin=True), [_R(many=[]), _R(many=[]), _R(many=[]), _R(many=[w])])
    res = client.get(f"{BASE}/pending")
    assert res.status_code == 200
    body = res.json()["wallpapers"]
    assert [x["id"] for x in body] == [str(w.id)]
    assert body[0]["store_name"] == store.name and body[0]["status"] == "pending"
    sql = str(db.execute.call_args_list[-1].args[0].compile(compile_kwargs={"literal_binds": True}))
    assert "status = 'pending'" in sql and "ORDER BY wallpapers.created_at" in sql


def test_approve_sets_approved_clears_note(client):
    w = _wp(_store(_user()), "pending", moderation_note="eski")
    _as(_user(is_admin=True), [_R(w)])
    assert client.post(f"{BASE}/wallpapers/{w.id}/approve").status_code == 204
    assert (w.status, w.moderation_note) == ("approved", None)


def test_reject_sets_note(client):
    w = _wp(_store(_user()), "pending")
    _as(_user(is_admin=True), [_R(w)])
    assert client.post(f"{BASE}/wallpapers/{w.id}/reject", json={"note": " Xira "}).status_code == 204
    assert (w.status, w.moderation_note) == ("rejected", "Xira")


@pytest.mark.parametrize("note", ["Do'kon olib tashladi", "  Do'kon olib tashladi "])
def test_reject_refuses_shop_removed_sentinel(client, note):
    w = _wp(_store(_user()), "pending")
    _as(_user(is_admin=True), [_R(w)])
    r = client.post(f"{BASE}/wallpapers/{w.id}/reject", json={"note": note})
    assert r.status_code == 422
    assert r.json()["detail"] == "Bu sabab matnini ishlatib bo'lmaydi"
    assert w.status == "pending"


def test_non_admin_403(client):
    _as(_user(), [])
    wid = uuid.uuid4()
    assert client.post(f"{BASE}/wallpapers/{wid}/approve").status_code == 403
    assert client.post(f"{BASE}/wallpapers/{wid}/reject", json={"note": "x"}).status_code == 403


def test_unknown_404(client):
    _as(_user(is_admin=True), [_R(None), _R(None)])
    wid = uuid.uuid4()
    r = client.post(f"{BASE}/wallpapers/{wid}/approve")
    assert r.status_code == 404  # detail is translated per request language
    assert client.post(f"{BASE}/wallpapers/{wid}/reject", json={"note": "x"}).status_code == 404


@pytest.mark.parametrize("state,note", [("approved", None), ("rejected", "Do'kon olib tashladi")])
def test_approve_non_pending_409(client, state, note):
    w = _wp(_store(_user()), state, moderation_note=note)
    _as(_user(is_admin=True), [_R(w)])
    assert client.post(f"{BASE}/wallpapers/{w.id}/approve").status_code == 409
    assert (w.status, w.moderation_note) == (state, note)


@pytest.mark.parametrize("state", ["approved", "rejected"])
def test_reject_non_pending_409(client, state):
    w = _wp(None, state)
    note = w.moderation_note
    _as(_user(is_admin=True), [_R(w)])
    assert client.post(f"{BASE}/wallpapers/{w.id}/reject", json={"note": "x"}).status_code == 409
    assert (w.status, w.moderation_note) == (state, note)
