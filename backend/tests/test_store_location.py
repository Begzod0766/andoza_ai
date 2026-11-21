"""A shop's address and map point (stores.address / lat / lng): the seller and the admin can
set them, a point must be roughly inside Uzbekistan and come as a pair, and the migration
adds the columns as nullable so existing shops keep working with no point."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.models.store import Store
from app.schemas.admin_catalog import StoreAdminOut, StoreCreate, StoreUpdate
from app.schemas.catalog import StoreOut
from app.schemas.seller import SellerStoreOut, SellerStoreUpdate, StoreApply
from tests.test_seller import _R, _as, _store, _user, client  # noqa: F401  (fixture)

TASHKENT = {"lat": 41.311081, "lng": 69.240562}


def test_model_has_nullable_location_columns():
    cols = Store.__table__.c
    for name in ("address", "lat", "lng"):
        assert name in cols and cols[name].nullable


@pytest.mark.parametrize("schema", [StoreCreate, StoreUpdate, StoreApply, SellerStoreUpdate])
def test_a_point_in_uzbekistan_is_accepted(schema):
    body = schema(name="Do'kon", address="Chilonzor 9", **TASHKENT)
    assert (body.lat, body.lng, body.address) == (41.311081, 69.240562, "Chilonzor 9")


@pytest.mark.parametrize("schema", [StoreCreate, StoreUpdate, StoreApply, SellerStoreUpdate])
@pytest.mark.parametrize("point", [
    {"lat": 55.75, "lng": 37.62},   # Moscow
    {"lat": 0, "lng": 0},
    {"lat": 69.24, "lng": 41.31},   # swapped
])
def test_a_point_outside_uzbekistan_is_refused(schema, point):
    with pytest.raises(ValidationError):
        schema(name="Do'kon", **point)


@pytest.mark.parametrize("schema", [StoreCreate, StoreUpdate, StoreApply, SellerStoreUpdate])
def test_lat_without_lng_is_refused(schema):
    with pytest.raises(ValidationError):
        schema(name="Do'kon", lat=41.3)


def test_a_point_can_be_cleared_with_both_nulls():
    body = SellerStoreUpdate(lat=None, lng=None)
    assert body.model_dump(exclude_unset=True) == {"lat": None, "lng": None}


@pytest.mark.parametrize("schema", [StoreAdminOut, SellerStoreOut, StoreOut])
def test_outputs_carry_the_location(schema):
    assert {"address", "lat", "lng"} <= set(schema.model_fields)


def test_seller_can_set_the_shop_point(client):  # noqa: F811
    u = _user()
    store = _store(u)
    _as(u, [_R(store)])
    res = client.patch("/api/v1/seller/store", json={"address": " Yunusobod 4-kv ", **TASHKENT})
    assert res.status_code == 200, res.text
    assert store.address == "Yunusobod 4-kv"
    assert float(store.lat) == 41.311081 and float(store.lng) == 69.240562
    assert res.json()["lat"] == 41.311081


def test_migration_adds_the_columns():
    path = next(Path(__file__).resolve().parents[1].joinpath("alembic", "versions").glob("*_store_location.py"))
    spec = importlib.util.spec_from_file_location("m", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.down_revision == "1786000051"

    added: list[str] = []

    class _Op:
        def add_column(self, table, col):
            assert table == "stores" and col.nullable
            added.append(col.name)

        def drop_column(self, table, name):
            added.remove(name)

    mod.op = _Op()
    mod.upgrade()
    assert sorted(added) == ["address", "lat", "lng"]
    mod.downgrade()
    assert added == []
