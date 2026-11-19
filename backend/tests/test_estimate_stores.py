"""The estimate API names each shop once (``stores``) with what its card and map need, and
every line priced from a shop product carries that shop's id and the product's photo.
A saved estimate from before store_id existed still groups: its lines are matched to a
shop by name."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.models.estimate import Estimate
from app.models.store import Store
from tests.test_estimate_router import (  # noqa: F401  (fixtures)
    _as, _db, _material, _norm, _prime_currency_cache, _Result, _room, _user, client,
)


def _shop(**kw) -> Store:
    d = dict(id=uuid.uuid4(), name="Bo'yoq Markazi", district="Chilonzor", address="Chilonzor 9-kv",
             lat=41.285, lng=69.204, phone="+998901112233", telegram="@boyoq", partner_tier="standard",
             is_active=True)
    d.update(kw)
    return Store(**d)


def _line(**kw) -> dict:
    d = {"label": "Bo'yoq", "formula": "...", "qty": 2, "unit": "litr", "unit_price_uzs": 50_000,
         "subtotal_uzs": 100_000, "category": "boyoq", "material_id": None, "store_name": None,
         "is_approximate": False, "warning": None}
    d.update(kw)
    return d


def _saved(lines) -> Estimate:
    return Estimate(id=uuid.uuid4(), room_id=uuid.uuid4(), lines=lines, total_uzs=0, currency="UZS",
                    status="final", created_at=datetime.now(timezone.utc))


def test_preview_lines_carry_store_id_image_and_the_store_once(client, monkeypatch):
    # The norm-override refresh reads the db at most every 30 s: keep it out of the script.
    from unittest.mock import AsyncMock

    monkeypatch.setattr("app.services.norm_overrides.refresh", AsyncMock())
    shop = _shop()
    paint = _material(price_uzs=25_000, image_url="/media/materials/oq.webp")
    paint.store = shop
    room = _room(surfaces={"ALL": str(paint.id)})
    db = _db(_Result(one=room), _Result(many=[]), _Result(many=[paint]), _Result(one=None),
             _Result(many=[_norm()]), _Result(one=None))
    _as(_user(), db)

    body = client.post(f"/api/v1/rooms/{room.id}/estimate/preview").json()

    paint_lines = [ln for ln in body["lines"] if ln["category"] == "boyoq"]
    assert paint_lines and all(ln["store_id"] == str(shop.id) for ln in paint_lines)
    # A relative media path is made absolute: the mobile app's WebView has no web origin.
    assert paint_lines[0]["image_url"].startswith("http") and paint_lines[0]["image_url"].endswith("/media/materials/oq.webp")
    assert body["stores"] == [{
        "id": str(shop.id), "name": "Bo'yoq Markazi", "district": "Chilonzor", "address": "Chilonzor 9-kv",
        "lat": 41.285, "lng": 69.204, "phone": "+998901112233", "telegram": "@boyoq",
    }]


def test_saved_estimate_returns_its_stores_from_the_db(client):
    shop = _shop()
    est = _saved([_line(store_id=str(shop.id), store_name=shop.name, image_url="https://cdn/x.webp"),
                  _line(store_id=str(shop.id), store_name=shop.name)])
    _as(_user(), _db(_Result(one=est), _Result(many=[shop])))

    body = client.get(f"/api/v1/estimates/{est.id}").json()

    assert [s["id"] for s in body["stores"]] == [str(shop.id)]
    assert body["lines"][0]["image_url"] == "https://cdn/x.webp"
    assert body["lines"][1]["image_url"] is None


def test_an_old_saved_estimate_is_matched_to_its_shop_by_name(client):
    shop = _shop()
    est = _saved([_line(store_name=shop.name), _line(label="Ish haqi", category="ish")])
    _as(_user(), _db(_Result(one=est), _Result(many=[shop])))

    body = client.get(f"/api/v1/estimates/{est.id}").json()

    assert body["lines"][0]["store_id"] == str(shop.id)
    assert body["lines"][1]["store_id"] is None
    assert body["stores"][0]["name"] == shop.name


def test_an_estimate_with_no_shop_lines_asks_the_db_nothing_more(client):
    est = _saved([_line()])
    _as(_user(), _db(_Result(one=est)))  # a second execute() would raise StopAsyncIteration

    body = client.get(f"/api/v1/estimates/{est.id}").json()

    assert body["stores"] == [] and body["lines"][0]["store_id"] is None
