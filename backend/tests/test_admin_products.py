"""Admin products: materials and 3D models as one paged list, and a per-category overview."""
from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

from app.api.v1.deps import get_current_active_user
from app.database import get_db
from app.main import app
from app.models.furniture import Furniture
from app.models.material import Material
from app.models.store import Store

URL = "/api/v1/admin/products"


class _Result:
    def __init__(self, one=None, many=()):
        self._one, self._many = one, list(many)

    def scalar_one(self):
        return self._one

    def scalar_one_or_none(self):
        return self._one

    def scalars(self):
        return self

    def all(self):
        return self._many


def _user(is_admin=True):
    return SimpleNamespace(id=uuid.uuid4(), is_active=True, is_admin=is_admin)


def _as(user, *results):
    db = AsyncMock()
    db.info = {}
    db.execute = AsyncMock(side_effect=list(results))
    app.dependency_overrides[get_current_active_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db
    return db


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


def _sql(db, i):
    return db.execute.call_args_list[i].args[0].compile(dialect=postgresql.dialect())


def _row(kind="materials", **kw):
    d = dict(
        kind=kind, id=uuid.uuid4(), name="Laminat dub", store_id=uuid.uuid4(), store_name="MAFF",
        category="laminat", price_uzs=120_000, unit="m2" if kind == "materials" else None,
        image="https://img/x.jpg" if kind == "materials" else "furniture/thumbs/a.webp", is_active=True,
    )
    d.update(kw)
    return SimpleNamespace(**d)


class TestList:
    def test_unions_both_kinds_with_exact_paging(self, client):
        db = _as(_user(), _Result(one=30), _Result(many=[_row()]))
        r = client.get(f"{URL}?category=laminat&page=2")
        assert r.status_code == 200, r.text
        assert r.json()["total"] == 30 and len(r.json()["items"]) == 1
        rows = str(_sql(db, 1))
        assert "UNION ALL" in rows and "LIMIT" in rows and "OFFSET" in rows
        params = _sql(db, 1).params
        assert 25 in params.values() and "laminat" in params.values()

    def test_filters_reach_both_branches(self, client):
        store_id = uuid.uuid4()
        db = _as(_user(), _Result(one=0), _Result(many=[]))
        client.get(f"{URL}?category=laminat&store_id={store_id}&status=hidden&q=50%25_")
        compiled = _sql(db, 1)
        sql = str(compiled)
        assert sql.count("is_active IS false") == 2
        assert sql.count("ESCAPE") == 2
        assert list(compiled.params.values()).count("%50\\%\\_%") == 2
        assert list(compiled.params.values()).count(store_id) == 2

    def test_kind_limits_to_one_branch(self, client):
        db = _as(_user(), _Result(one=0), _Result(many=[]))
        client.get(f"{URL}?category=divan&kind=furniture")
        sql = str(_sql(db, 1))
        assert "furniture" in sql and "FROM materials" not in sql and "UNION" not in sql

    def test_rows_map_to_products(self, client):
        material = _row()
        model = _row("furniture", name="Divan Oslo", category="divan", price_uzs=None, store_id=None, store_name=None)
        _as(_user(), _Result(one=2), _Result(many=[material, model]))
        items = client.get(f"{URL}?category=x").json()["items"]
        assert items[0] == {
            "kind": "materials", "id": str(material.id), "name": "Laminat dub", "store_id": str(material.store_id),
            "store_name": "MAFF", "category": "laminat", "price_uzs": 120000, "unit": "m2",
            "image_url": "https://img/x.jpg", "is_active": True,
        }
        assert items[1]["unit"] is None and items[1]["price_uzs"] is None and items[1]["store_name"] is None
        assert items[1]["image_url"].startswith("http") and items[1]["image_url"].endswith("furniture/thumbs/a.webp")

    def test_unknown_kind_or_status_is_refused(self, client):
        _as(_user())
        assert client.get(f"{URL}?category=x&kind=chairs").status_code == 422
        assert client.get(f"{URL}?category=x&status=gone").status_code == 422


class TestOverview:
    def test_groups_five_per_category_in_one_query(self, client):
        # Totals ride on the rows (count over the category), so totals and rows come from one snapshot.
        # In the query's order: kind, then category.
        rows = [_row("furniture", category="divan", name="Divan", cat_total=1)] + [_row(name=f"L{i}", cat_total=12) for i in range(5)]
        db = _as(_user(), _Result(many=rows))
        r = client.get(f"{URL}/overview?q=a")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total"] == 13
        assert [(c["kind"], c["category"], c["total"], len(c["items"])) for c in body["categories"]] == [
            ("furniture", "divan", 1, 1), ("materials", "laminat", 12, 5),
        ]
        assert db.execute.call_count == 1
        sql = str(_sql(db, 0))
        assert "row_number() OVER (PARTITION BY" in sql and "count(*) OVER (PARTITION BY" in sql
        assert 5 in _sql(db, 0).params.values()

    def test_nothing_matches(self, client):
        _as(_user(), _Result(many=[]))
        assert client.get(f"{URL}/overview").json() == {"total": 0, "categories": []}


class TestSingle:
    def test_one_material_and_one_model(self, client):
        store = Store(name="MAFF")
        store.id = uuid.uuid4()
        m = Material(
            store_id=store.id, category="laminat", name_uz="Laminat dub", unit="m2", price_uzs=1, is_active=True,
        )
        m.id = uuid.uuid4()
        m.store = store
        _as(_user(), _Result(one=m))
        r = client.get(f"/api/v1/admin/materials/{m.id}")
        assert r.status_code == 200, r.text
        assert r.json()["name_uz"] == "Laminat dub" and r.json()["store_name"] == "MAFF"
        _as(_user(), _Result(one=None))
        assert client.get(f"/api/v1/admin/materials/{uuid.uuid4()}").status_code == 404
        _as(_user(), _Result(one=None))
        assert client.get(f"/api/v1/admin/furniture/{uuid.uuid4()}").status_code == 404


def test_endpoints_are_admin_only(client):
    _as(_user(is_admin=False))
    for path in (f"{URL}?category=x", f"{URL}/overview", f"/api/v1/admin/materials/{uuid.uuid4()}",
                 f"/api/v1/admin/furniture/{uuid.uuid4()}"):
        assert client.get(path).status_code == 403, path


def test_category_counts_is_gone(client):
    _as(_user())
    assert client.get("/api/v1/admin/category-counts").status_code in (404, 405)


_ = (Furniture,)  # imported so the model is registered for the furniture branch
