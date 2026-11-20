from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class EstimateLine(BaseModel):
    label: str
    formula: str
    quantity: float
    unit: str
    unit_price: int
    total_uzs: int
    is_approximate: bool = False
    store_id: UUID | None = None
    category: str = ""
    warning: str | None = None
    # "market" when the price came from a live shop page (see
    # app.services.market_prices); the page and the day it was read.
    price_source: str | None = None
    source_url: str | None = None
    store_name: str | None = None
    price_checked_at: str | None = None
    # The shop product's photo (absolute URL); None for a line with no product behind it.
    image_url: str | None = None


class EstimateStore(BaseModel):
    """One shop the estimate buys from, listed once however many lines it has: what the
    estimate page's shop card and map need. lat/lng are None until the shop sets its point."""

    id: UUID
    name: str
    district: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    phone: str | None = None
    telegram: str | None = None


class EstimateResponse(BaseModel):
    id: UUID
    room_id: UUID
    lines: list[EstimateLine]
    total_uzs: int
    # Split of total_uzs by line precision — added, never removes a field,
    # so an old persisted Estimate (from before this split existed) still
    # deserialises: GET /estimates/{id} recomputes both from the stored
    # lines JSONB rather than trusting a column that predates the split.
    total_exact_uzs: int = 0
    total_approx_uzs: int = 0
    total_min: int
    total_max: int
    currency: str = "UZS"
    status: str = "final"
    created_at: datetime
    has_electrical: bool
    # Whether has_electrical is backed by real placed point counts rather
    # than the ELEC_POINTS_DEFAULT fallback guess — see app.services.smeta.
    electrical_confirmed: bool = False
    # so'm-per-1-USD used to compute total_usd (see app.services.currency) —
    # returned alongside so the frontend can convert every line client-side
    # without a second round trip, and show the rate it priced against.
    usd_rate: float = 0.0
    total_usd: int = 0
    # Market-price lookup: whether this server can do it at all, and, on a
    # response that asked for it, how many lines were checked / repriced.
    market_prices_available: bool = False
    market_checked: int = 0
    market_updated: int = 0
    # The caller is a guest: the AI gap-fill and market prices were skipped,
    # so the prices are approximate (spec 2026-11-20 mehmon rejimi).
    prices_approximate_for_guest: bool = False
    # Every shop a line's store_id points to, once (see EstimateStore).
    stores: list[EstimateStore] = []


class EstimateSummary(BaseModel):
    """Lightweight row used by the paginated estimate-history endpoint."""

    id: UUID
    room_id: UUID
    total_uzs: int
    currency: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedEstimates(BaseModel):
    items: list[EstimateSummary]
    total: int
    limit: int
    offset: int
