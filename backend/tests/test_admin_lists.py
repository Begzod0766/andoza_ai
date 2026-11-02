"""Admin list filters: orders by shop, period and search; furniture search; category counts."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

from app.main import app

from tests.test_order_cancellation import _Result, _as, _user


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


def _compiled(db, i=0):
    return db.execute.call_args_list[i].args[0].compile(dialect=postgresql.dialect())


def _sql(db, i=0):
    return str(db.execute.call_args_list[i].args[0].compile(compile_kwargs={"literal_binds": True}))


class TestOrderFilters:
    def test_store_and_since_reach_the_query(self, client):
        store_id = uuid.uuid4()
        db = _as(_user(is_admin=True), _Result(many=[]))
        r = client.get(f"/api/v1/admin/orders?store_id={store_id}&since=2026-11-01T00:00:00Z")
        assert r.status_code == 200, r.text
        sql = _sql(db)
        assert "orders.store_id = " in sql and store_id.hex in sql.replace("-", "")
        assert "orders.created_at >= '2026-11-01" in sql

    def test_a_hex_query_matches_an_id_prefix_and_digits_the_phone(self, client):
        db = _as(_user(is_admin=True), _Result(many=[]))
        client.get("/api/v1/admin/orders?q=9999CB")
        params = list(_compiled(db).params.values())
        assert "9999cb%" in params
        db = _as(_user(is_admin=True), _Result(many=[]))
        client.get("/api/v1/admin/orders?q=%2B90%20123")  # "+90 123"
        params = list(_compiled(db).params.values())
        assert "%90123%" in params
        assert not any(isinstance(p, str) and p.endswith("%") and not p.startswith("%") for p in params)

    def test_a_query_with_wildcards_matches_nothing_instead_of_everything(self, client):
        db = _as(_user(is_admin=True), _Result(many=[]))
        assert client.get("/api/v1/admin/orders?q=%25_").status_code == 200  # "%_"
        sql = _sql(db)
        assert "false" in sql.lower() and "'%%'" not in sql


class TestFurnitureSearch:
    def test_searches_names_with_wildcards_as_letters(self, client):
        db = _as(_user(is_admin=True), _Result(many=[]))
        assert client.get("/api/v1/admin/furniture?q=50%25_divan").status_code == 200
        compiled = _compiled(db)
        assert "%50\\%\\_divan%" in compiled.params.values()
        assert "ESCAPE" in str(compiled)


class TestCategoryCounts:
    def test_counts_both_kinds(self, client):
        db = _as(
            _user(is_admin=True),
            _Result(many=[("laminat", 2), ("ldsp", 1)]),
            _Result(many=[("divan", 1)]),
        )
        r = client.get("/api/v1/admin/category-counts")
        assert r.status_code == 200, r.text
        assert r.json() == {"materials": {"laminat": 2, "ldsp": 1}, "furniture": {"divan": 1}}
        assert "GROUP BY materials.category" in str(_compiled(db, 0))
        assert "GROUP BY furniture.category" in str(_compiled(db, 1))

    def test_shop_and_search_narrow_both_counts(self, client):
        store_id = uuid.uuid4()
        db = _as(_user(is_admin=True), _Result(many=[]), _Result(many=[]))
        r = client.get(f"/api/v1/admin/category-counts?store_id={store_id}&q=oslo")
        assert r.json() == {"materials": {}, "furniture": {}}
        for i in (0, 1):
            compiled = _compiled(db, i)
            assert "store_id" in str(compiled) and "%oslo%" in compiled.params.values()


def test_new_endpoints_are_admin_only(client):
    _as(_user(is_admin=False))
    assert client.get("/api/v1/admin/category-counts").status_code == 403
    assert client.get("/api/v1/admin/orders?q=abc").status_code == 403
    assert client.get("/api/v1/admin/furniture?q=abc").status_code == 403
