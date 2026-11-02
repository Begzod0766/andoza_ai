"""Materials and 3D models as one admin product list (Do'kon admin, "Tovarlar")."""
from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel

ProductKind = Literal["materials", "furniture"]
ProductStatus = Literal["active", "hidden"]


class AdminProductOut(BaseModel):
    kind: ProductKind
    id: UUID
    name: str
    store_id: UUID | None = None
    store_name: str | None = None
    category: str
    price_uzs: int | None = None
    unit: str | None = None
    image_url: str | None = None
    is_active: bool


class AdminProductsPage(BaseModel):
    items: list[AdminProductOut]
    total: int


class ProductCategoryBlock(BaseModel):
    kind: ProductKind
    category: str
    total: int
    items: list[AdminProductOut]


class ProductsOverview(BaseModel):
    total: int
    categories: list[ProductCategoryBlock]
