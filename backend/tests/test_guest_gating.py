"""Guests are refused every paid and identity endpoint with one fixed 403
(spec 2026-11-20 mehmon rejimi, tables A and B)."""
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from app.api.v1.deps import get_current_active_user
from app.config import settings
from app.database import get_db
from app.main import app
from app.models.user import User

_UZ_MESSAGE = "Bu imkoniyat uchun ro'yxatdan o'ting."
R = uuid.uuid4()

# Spec table A — paid external APIs.
PAID = [
    ("POST", f"/api/v1/rooms/{R}/ai-design", "ai_design"),
    ("POST", f"/api/v1/rooms/{R}/ai-design/image", "ai_design"),
    ("POST", f"/api/v1/rooms/{R}/ai-design/pin", "ai_design"),
    ("POST", f"/api/v1/rooms/{R}/ai-build", "ai_build"),
    ("POST", f"/api/v1/rooms/{R}/smeta/ask", "smeta_ask"),
    ("POST", "/api/v1/render", "render"),
    ("POST", "/api/v1/render/relight", "render"),
    ("POST", "/api/v1/render/upscale", "render"),
    ("POST", "/api/v1/models/from-photo", "photo_model"),
    ("GET", "/api/v1/models/from-photo/glb", "photo_model"),
    ("POST", "/api/v1/mebel/ai/suggest", "mebel_ai"),
]

# (method, route path template) -> feature, for the inventory checks.
GATED_ROUTES: dict[tuple[str, str], str] = {
    ("POST", "/api/v1/rooms/{room_id}/ai-design"): "ai_design",
    ("POST", "/api/v1/rooms/{room_id}/ai-design/image"): "ai_design",
    ("POST", "/api/v1/rooms/{room_id}/ai-design/pin"): "ai_design",
    ("POST", "/api/v1/rooms/{room_id}/ai-build"): "ai_build",
    ("POST", "/api/v1/rooms/{room_id}/smeta/ask"): "smeta_ask",
    ("POST", "/api/v1/render"): "render",
    ("POST", "/api/v1/render/relight"): "render",
    ("POST", "/api/v1/render/upscale"): "render",
    ("POST", "/api/v1/models/from-photo"): "photo_model",
    ("GET", "/api/v1/models/from-photo/glb"): "photo_model",
    ("POST", "/api/v1/mebel/ai/suggest"): "mebel_ai",
}


def _user(is_guest: bool) -> User:
    return User(
        id=uuid.uuid4(), is_guest=is_guest, is_active=True, is_admin=False,
        language="uz", created_at=datetime.now(timezone.utc),
    )


class _EmptyDb:
    """Every lookup finds nothing, so a registered caller gets a plain 404/422/503."""

    async def execute(self, *_a, **_k):
        res = MagicMock()
        res.scalar_one_or_none.return_value = None
        res.scalar.return_value = None
        res.scalars.return_value.all.return_value = []
        res.all.return_value = []
        return res

    async def get(self, *_a, **_k):
        return None

    def add(self, *_a):
        pass

    async def flush(self):
        pass

    async def commit(self):
        pass

    async def rollback(self):
        pass


def _as(user):
    app.dependency_overrides[get_current_active_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: _EmptyDb()
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def as_guest():
    yield from _as(_user(is_guest=True))


@pytest.fixture
def as_registered():
    yield from _as(_user(is_guest=False))


def _is_guest_403(r) -> bool:
    if r.status_code != 403:
        return False
    detail = r.json().get("detail")
    return isinstance(detail, dict) and detail.get("code") == "registration_required"


@pytest.mark.parametrize(("method", "path", "feature"), PAID)
def test_guest_gets_registration_required(as_guest, method, path, feature):
    r = as_guest.request(method, path, json={})
    assert r.status_code == 403
    detail = r.json()["detail"]
    assert detail["code"] == "registration_required" and detail["feature"] == feature
    assert detail["message"] == _UZ_MESSAGE


@pytest.mark.parametrize(("method", "path", "feature"), PAID)
def test_registered_user_not_gated(as_registered, method, path, feature):
    r = as_registered.request(method, path, json={})
    assert not _is_guest_403(r)


def test_ai_build_stream_rejects_guest_before_stream(as_guest, monkeypatch):
    for flag in (False, True):
        monkeypatch.setattr(settings, "AI_FEATURES_ENABLED", flag)
        r = as_guest.post(f"/api/v1/rooms/{uuid.uuid4()}/ai-build", json={"prompt": "x"})
        assert r.status_code == 403
        assert r.headers["content-type"].startswith("application/json")
        assert r.json()["detail"]["feature"] == "ai_build"


@pytest.mark.parametrize(("lang", "text"), [
    ("ru", "Для этой функции нужно зарегистрироваться."),
    ("en", "Sign up to use this feature."),
    ("uz", _UZ_MESSAGE),
])
def test_message_is_localized(as_guest, lang, text):
    r = as_guest.post(
        "/api/v1/render", headers={"Accept-Language": lang},
        files={"file": ("a.jpg", b"x", "image/jpeg")},
    )
    assert r.status_code == 403
    assert r.json()["detail"]["message"] == text


def test_inactive_guest_is_still_inactive(monkeypatch):
    # registered_user sits on top of get_current_active_user: an inactive
    # account keeps getting "Inactive user account", not the guest dict.
    from app.api.v1.deps import get_current_user

    guest = _user(is_guest=True)
    guest.is_active = False
    app.dependency_overrides[get_current_user] = lambda: guest
    try:
        r = TestClient(app).post("/api/v1/render/relight", json={})
        assert r.status_code == 403 and r.json()["detail"] == "Inactive user account"
    finally:
        app.dependency_overrides.clear()


PAID_MODULES = {"app.routers.ai", "app.routers.render", "app.routers.photo_model"}
UNGATED_OK = {
    ("GET", "/api/v1/renders"),
    ("GET", "/api/v1/renders/all"),
    ("DELETE", "/api/v1/renders/{render_id}"),
}


def _is_gate(call) -> bool:
    return getattr(call, "__qualname__", "").startswith("registered_user")


def _walk(routes, prefix="", include_deps=()):
    """(path, route, include-level dependency calls) for every APIRoute.
    FastAPI >= 0.13x wraps included routers in _IncludedRouter instead of
    copying their routes into app.routes; older versions list APIRoutes."""
    for r in routes:
        original = getattr(r, "original_router", None)
        if original is not None:
            ctx = r.include_context
            deps = tuple(d.dependency for d in getattr(ctx, "dependencies", []) or [])
            yield from _walk(original.routes, prefix + (ctx.prefix or ""), include_deps + deps)
        elif isinstance(r, APIRoute):
            yield prefix + r.path, r, include_deps


def _routes():
    for path, r, include_deps in _walk(app.routes):
        gated = any(_is_gate(d.call) for d in r.dependant.dependencies) or any(map(_is_gate, include_deps))
        for m in r.methods:
            yield (m, path), r, gated


def test_every_paid_route_is_gated():
    # Inventory: a new route in a paid module fails here until it is gated
    # or listed in UNGATED_OK.
    seen = set()
    for key, r, gated in _routes():
        if (r.endpoint.__module__ in PAID_MODULES and key not in UNGATED_OK) or key in GATED_ROUTES:
            assert gated, key
            seen.add(key)
    assert set(GATED_ROUTES) <= seen
