"""Currency service — live USD/UZS exchange rate.

Source: the Central Bank of Uzbekistan's public rate API (no auth, published
once daily). Rates are cached in-process so a spike in smeta requests never
turns into a spike in outbound CBU requests.
"""
from __future__ import annotations

import time
from dataclasses import dataclass

import httpx
import structlog

logger = structlog.get_logger(__name__)

CBU_USD_RATE_URL = "https://cbu.uz/en/arkhiv-kursov-valyut/json/USD/"
# Second source when CBU does not answer (the prod server could not reach cbu.uz):
# a free, keyless, daily-updated market rate — close to CBU's, far closer than the constant.
ER_API_USD_URL = "https://open.er-api.com/v6/latest/USD"
CACHE_TTL_SECONDS = 3600  # CBU publishes once a day — hourly refresh is plenty
FALLBACK_USD_RATE = 12_700.0  # so'm per 1 USD, used only if CBU is unreachable
# and nothing has ever been fetched successfully in this process.
# The rate is fetched on the smeta request path: a CBU that does not answer must cost
# that request little, and only once in a while — not the full timeout every time.
FETCH_TIMEOUT_SECONDS = 3.0
RETRY_AFTER_FAILURE_SECONDS = 600


@dataclass
class _Cache:
    rate: float | None = None
    fetched_at: float = 0.0
    failed_at: float | None = None


_cache = _Cache()


async def get_usd_rate() -> float:
    """Return so'm-per-1-USD: from cache when fresh, else refetched from CBU (or, when
    CBU does not answer, from open.er-api.com).

    Never raises. A fetch failure logs a warning and falls back to the last
    known-good rate (or FALLBACK_USD_RATE if none was ever fetched) — a
    currency-API hiccup must never break the smeta page.
    """
    now = time.monotonic()
    if _cache.rate is not None and (now - _cache.fetched_at) < CACHE_TTL_SECONDS:
        return _cache.rate
    if _cache.failed_at is not None and (now - _cache.failed_at) < RETRY_AFTER_FAILURE_SECONDS:
        return _cache.rate if _cache.rate is not None else FALLBACK_USD_RATE

    async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS) as client:
        for source, fetch in (("cbu", _fetch_cbu), ("er_api", _fetch_er_api)):
            try:
                rate = await fetch(client)
            except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as e:
                logger.warning("currency.usd_rate_fetch_failed", source=source, error=str(e))
                continue
            _cache.rate = rate
            _cache.fetched_at = now
            _cache.failed_at = None
            return rate
    _cache.failed_at = now
    return _cache.rate if _cache.rate is not None else FALLBACK_USD_RATE


def _sane(rate: float) -> float:
    """A so'm-per-dollar figure, or ValueError for one no source should give (0, a typo'd scale)."""
    if not 1_000 < rate < 100_000:
        raise ValueError(f"implausible USD rate {rate}")
    return rate


async def _fetch_cbu(client: httpx.AsyncClient) -> float:
    resp = await client.get(CBU_USD_RATE_URL)
    resp.raise_for_status()
    return _sane(float(resp.json()[0]["Rate"]))


async def _fetch_er_api(client: httpx.AsyncClient) -> float:
    resp = await client.get(ER_API_USD_URL)
    resp.raise_for_status()
    data = resp.json()
    if data.get("result") != "success":
        raise ValueError(f"er-api result {data.get('result')!r}")
    return _sane(float(data["rates"]["UZS"]))


def uzs_to_usd(uzs: int, usd_rate: float) -> float:
    """Convert a so'm amount to USD at *usd_rate* so'm-per-dollar."""
    if usd_rate <= 0:
        return 0.0
    return uzs / usd_rate
