"""Materials and 3D models as one list, for the administrators' product tab.

The two tables are read as one ``UNION ALL`` with the same columns, so a page and its total
count both kinds together. The overview gives each category its total and its first rows.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, Request
from sqlalchemy import String, cast, func, literal, null, select, union_all

from app.api.v1.deps import AdminUser, DbSession
from app.core.storage import absolute_media_url
from app.models.furniture import Furniture
from app.models.material import Material
from app.models.store import Store
from app.routers.admin_catalog import _name_like
from app.schemas.admin_products import (
    AdminProductOut,
    AdminProductsPage,
    ProductCategoryBlock,
    ProductKind,
    ProductsOverview,
    ProductStatus,
)

router = APIRouter(prefix="/admin/products", tags=["admin-products"])

# Rows per category in the overview.
PREVIEW_ROWS = 5


def _branch(model, kind: str, unit, image, store_id, q, status, category):
    filters = []
    if store_id is not None:
        filters.append(model.store_id == store_id)
    if q:
        filters.append(_name_like(model.name_uz, q))
    if status is not None:
        filters.append(model.is_active.is_(status == "active"))
    if category is not None:
        filters.append(cast(model.category, String) == category)
    return (
        select(
            literal(kind).label("kind"),
            model.id.label("id"),
            model.name_uz.label("name"),
            model.store_id.label("store_id"),
            Store.name.label("store_name"),
            # Material categories are an enum type; both branches must agree on text.
            cast(model.category, String).label("category"),
            model.price_uzs.label("price_uzs"),
            unit.label("unit"),
            image.label("image"),
            model.is_active.label("is_active"),
        )
        .outerjoin(Store, Store.id == model.store_id)
        .where(*filters)
    )


def _products(kind: ProductKind | None, store_id, q, status, category=None):
    """Every matching product as one subquery (one branch when a kind is chosen)."""
    branches = []
    if kind in (None, "materials"):
        branches.append(_branch(Material, "materials", cast(Material.unit, String), Material.image_url,
                                store_id, q, status, category))
    if kind in (None, "furniture"):
        branches.append(_branch(Furniture, "furniture", cast(null(), String), Furniture.thumbnail_key,
                                store_id, q, status, category))
    query = branches[0] if len(branches) == 1 else union_all(*branches)
    return query.subquery("products")


def _order(sub):
    return (func.lower(sub.c.name), sub.c.kind, sub.c.id)


def _out(row, request: Request) -> AdminProductOut:
    # A model's picture is a storage key; a material's is already a URL.
    image = absolute_media_url(request, row.image) if row.kind == "furniture" else row.image
    return AdminProductOut(
        kind=row.kind, id=row.id, name=row.name, store_id=row.store_id, store_name=row.store_name,
        category=row.category, price_uzs=row.price_uzs, unit=row.unit, image_url=image, is_active=row.is_active,
    )


@router.get("", response_model=AdminProductsPage, summary="Materials and 3D models of one category, paged")
async def list_products(
    request: Request,
    admin: AdminUser,
    db: DbSession,
    category: str,
    kind: ProductKind | None = None,
    store_id: uuid.UUID | None = None,
    q: str | None = None,
    status: ProductStatus | None = None,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
) -> AdminProductsPage:
    sub = _products(kind, store_id, q, status, category)
    total = (await db.execute(select(func.count()).select_from(sub))).scalar_one()
    rows = (await db.execute(
        select(sub).order_by(*_order(sub)).offset((page - 1) * per_page).limit(per_page)
    )).all()
    return AdminProductsPage(items=[_out(r, request) for r in rows], total=total)


@router.get("/overview", response_model=ProductsOverview, summary="Each category's total and first products")
async def products_overview(
    request: Request,
    admin: AdminUser,
    db: DbSession,
    kind: ProductKind | None = None,
    store_id: uuid.UUID | None = None,
    q: str | None = None,
    status: ProductStatus | None = None,
) -> ProductsOverview:
    sub = _products(kind, store_id, q, status)
    per_category = (sub.c.kind, sub.c.category)
    rank = func.row_number().over(partition_by=per_category, order_by=_order(sub)).label("rn")
    # The category's total rides on each row, so totals and rows come from one snapshot.
    cat_total = func.count().over(partition_by=per_category).label("cat_total")
    ranked = select(sub, rank, cat_total).subquery("ranked")
    rows = (await db.execute(
        select(ranked).where(ranked.c.rn <= PREVIEW_ROWS).order_by(ranked.c.kind, ranked.c.category, ranked.c.rn)
    )).all()

    blocks: dict[tuple[str, str], ProductCategoryBlock] = {}
    for r in rows:
        block = blocks.setdefault(
            (r.kind, r.category), ProductCategoryBlock(kind=r.kind, category=r.category, total=r.cat_total, items=[]),
        )
        block.items.append(_out(r, request))
    categories = list(blocks.values())
    return ProductsOverview(total=sum(b.total for b in categories), categories=categories)
