"""A guest's estimate: no AI gap-fill, no market prices, and it says so
(spec 2026-11-20 mehmon rejimi §1 "Mehmon smetasi", §8.4)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from reportlab.platypus import Paragraph, Table

from app.models.estimate import Estimate
from app.routers import estimate as router
from app.services.smeta_text import PDF_TEXT
from tests.test_estimate_pdf_language import _estimate
from tests.test_estimate_router import _Result, _as, _material, _norm, _room, _user, client  # noqa: F401


def _db(*results: _Result) -> AsyncMock:
    """Scripted execute() results in the router's call order, then empty
    results for whatever else runs (the shop catalog loaders), so the tests
    do not depend on what an earlier test left cached."""
    queue = list(results)
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=lambda *_a, **_k: queue.pop(0) if queue else _Result(many=[]))
    return db

NOTE = {
    "uz": "Narxlar taxminiy. Ro'yxatdan o'tsangiz, aniqlashtiriladi.",
    "ru": "Цены ориентировочные. После регистрации они будут уточнены.",
    "en": "Prices are approximate. Sign up to get them refined.",
}


def _caller(is_guest: bool):
    user = _user()
    user.is_guest = is_guest
    user.language = None
    return user


def _priced_room_db():
    mat = _material(price_uzs=25_000)
    room = _room(surfaces={"ALL": str(mat.id)})
    db = _db(
        _Result(one=room),          # _load_room_for_user
        _Result(many=[]),           # room_finishes
        _Result(many=[mat]),        # _load_materials
        _Result(one=None),          # _load_wiring_meters
        _Result(many=[_norm()]),    # _load_norms
        _Result(one=None),          # _load_stage
    )
    return room, db


@pytest.fixture
def paid():
    """fill_ai_price_gaps and the market repricing, as spies that pass the estimate through."""
    fill = AsyncMock(side_effect=lambda computed, user_id: computed)
    market = AsyncMock(side_effect=lambda computed, user_id: (computed, 1, 0))
    with patch.object(router, "fill_ai_price_gaps", fill), \
         patch.object(router, "apply_market_prices", market), \
         patch.object(router, "market_prices_available", return_value=True):
        yield fill, market


def test_guest_preview_skips_ai_and_market(client, paid):
    fill, market = paid
    room, db = _priced_room_db()
    _as(_caller(is_guest=True), db)
    r = client.post(f"/api/v1/rooms/{room.id}/estimate/preview?market=true")
    assert r.status_code == 200, r.text
    assert r.json()["prices_approximate_for_guest"] is True
    assert r.json()["market_checked"] == 0
    fill.assert_not_awaited()
    market.assert_not_awaited()


def test_registered_preview_flag_false(client, paid):
    fill, market = paid
    room, db = _priced_room_db()
    _as(_caller(is_guest=False), db)
    r = client.post(f"/api/v1/rooms/{room.id}/estimate/preview?market=true")
    assert r.status_code == 200, r.text
    assert r.json()["prices_approximate_for_guest"] is False
    assert r.json()["market_checked"] == 1
    fill.assert_awaited_once()
    market.assert_awaited_once()


def test_old_style_user_without_is_guest_is_registered(client, paid):
    # MagicMock users (and anything that is not literally True) are registered.
    fill, _ = paid
    room, db = _priced_room_db()
    _as(_user(), db)
    r = client.post(f"/api/v1/rooms/{room.id}/estimate/preview")
    assert r.status_code == 200 and r.json()["prices_approximate_for_guest"] is False
    fill.assert_awaited_once()


def test_guest_create_skips_ai(client, paid):
    fill, _ = paid
    room, db = _priced_room_db()

    async def _refresh(obj):
        obj.id = uuid.uuid4()
        obj.created_at = datetime.now(timezone.utc)

    db.refresh = AsyncMock(side_effect=_refresh)
    db.add = lambda _obj: None
    _as(_caller(is_guest=True), db)
    r = client.post(f"/api/v1/rooms/{room.id}/estimate")
    assert r.status_code == 200, r.text
    assert r.json()["prices_approximate_for_guest"] is True
    fill.assert_not_awaited()


@pytest.mark.parametrize(("is_guest", "flag"), [(True, True), (False, False)])
def test_get_estimate_flag(client, is_guest, flag):
    estimate = Estimate(
        id=uuid.uuid4(), room_id=uuid.uuid4(), lines=[], total_uzs=0,
        currency="UZS", status="final", created_at=datetime.now(timezone.utc),
    )
    _as(_caller(is_guest=is_guest), _db(_Result(one=estimate)))
    r = client.get(f"/api/v1/estimates/{estimate.id}")
    assert r.status_code == 200 and r.json()["prices_approximate_for_guest"] is flag


@pytest.mark.parametrize("path", ["estimate/pdf", "estimate.pdf"])
def test_guest_pdf(client, paid, path):
    fill, market = paid
    room, db = _priced_room_db()
    _as(_caller(is_guest=True), db)
    r = client.get(f"/api/v1/rooms/{room.id}/{path}?market=true")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    fill.assert_not_awaited()
    market.assert_not_awaited()


@pytest.mark.parametrize(("is_guest", "note"), [(True, True), (False, False)])
def test_pdf_route_passes_guest_note(client, paid, is_guest, note):
    room, db = _priced_room_db()
    _as(_caller(is_guest=is_guest), db)
    with patch.object(router, "_build_pdf", return_value=b"%PDF-1.4 stub") as build:
        r = client.get(f"/api/v1/rooms/{room.id}/estimate/pdf")
    assert r.status_code == 200
    assert build.call_args.kwargs["guest_note"] is note


def _text(story) -> str:
    parts: list[str] = []

    def walk(item) -> None:
        if isinstance(item, Paragraph):
            parts.append(item.text)
        elif isinstance(item, Table):
            for row in item._cellvalues:
                for cell in row:
                    walk(cell)

    for flowable in story:
        walk(flowable)
    return "\n".join(parts)


@pytest.mark.parametrize("lang", ["uz", "ru", "en"])
def test_pdf_note_only_for_guest(lang):
    room = SimpleNamespace(name="Xona 1")
    fonts = router._FALLBACK_FONTS
    with_note = _text(router._pdf_story(room, _estimate(), lang, fonts, guest_note=True))
    without = _text(router._pdf_story(room, _estimate(), lang, fonts))
    # Paragraph text is XML-escaped; the uz note has an apostrophe.
    assert NOTE[lang].replace("'", "&#x27;") in with_note or NOTE[lang] in with_note
    assert NOTE[lang] not in without and NOTE[lang].replace("'", "&#x27;") not in without


def test_note_wording():
    assert PDF_TEXT["guest_prices_note"] == NOTE
