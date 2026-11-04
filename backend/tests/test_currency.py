"""Tests for app.services.currency — the CBU USD/UZS rate fetch + cache.

Uses respx to mock the outbound CBU HTTP call; no real network access.
"""
from __future__ import annotations

import httpx
import pytest
import respx

from app.services import currency


@pytest.fixture(autouse=True)
def _reset_cache():
    """Every test starts from a clean, never-fetched cache."""
    currency._cache.rate = None
    currency._cache.fetched_at = 0.0
    currency._cache.failed_at = None
    yield
    currency._cache.rate = None
    currency._cache.fetched_at = 0.0
    currency._cache.failed_at = None


@pytest.mark.asyncio
@respx.mock
async def test_get_usd_rate_parses_cbu_response():
    respx.get(currency.CBU_USD_RATE_URL).mock(
        return_value=httpx.Response(200, json=[{"Ccy": "USD", "Rate": "12345.67"}])
    )
    rate = await currency.get_usd_rate()
    assert rate == pytest.approx(12345.67)


@pytest.mark.asyncio
@respx.mock
async def test_get_usd_rate_uses_cache_on_second_call():
    route = respx.get(currency.CBU_USD_RATE_URL).mock(
        return_value=httpx.Response(200, json=[{"Ccy": "USD", "Rate": "11000.0"}])
    )
    first = await currency.get_usd_rate()
    second = await currency.get_usd_rate()
    assert first == second == pytest.approx(11000.0)
    assert route.call_count == 1  # second call served from cache, no re-fetch


@pytest.mark.asyncio
@respx.mock
async def test_get_usd_rate_falls_back_when_cbu_unreachable():
    respx.get(currency.CBU_USD_RATE_URL).mock(side_effect=httpx.ConnectError("no network"))
    rate = await currency.get_usd_rate()
    assert rate == currency.FALLBACK_USD_RATE


@pytest.mark.asyncio
@respx.mock
async def test_get_usd_rate_falls_back_to_last_known_good_on_later_failure():
    respx.get(currency.CBU_USD_RATE_URL).mock(
        return_value=httpx.Response(200, json=[{"Ccy": "USD", "Rate": "9999.0"}])
    )
    good_rate = await currency.get_usd_rate()
    assert good_rate == pytest.approx(9999.0)

    # Force the cache stale, then make the upstream fail — should keep the
    # last known-good rate rather than fall all the way back to the constant.
    currency._cache.fetched_at -= currency.CACHE_TTL_SECONDS + 1
    respx.get(currency.CBU_USD_RATE_URL).mock(side_effect=httpx.ConnectError("down"))
    rate = await currency.get_usd_rate()
    assert rate == pytest.approx(9999.0)


@pytest.mark.asyncio
@respx.mock
async def test_a_failed_fetch_is_not_retried_on_every_request():
    # The server could not reach CBU: every smeta waited the full timeout (8 s on prod).
    route = respx.get(currency.CBU_USD_RATE_URL).mock(side_effect=httpx.ConnectTimeout("slow"))
    assert await currency.get_usd_rate() == currency.FALLBACK_USD_RATE
    assert await currency.get_usd_rate() == currency.FALLBACK_USD_RATE
    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_a_failed_fetch_is_retried_after_the_backoff():
    route = respx.get(currency.CBU_USD_RATE_URL).mock(side_effect=httpx.ConnectError("down"))
    await currency.get_usd_rate()
    currency._cache.failed_at -= currency.RETRY_AFTER_FAILURE_SECONDS + 1
    route.mock(return_value=httpx.Response(200, json=[{"Ccy": "USD", "Rate": "12100.0"}]))
    assert await currency.get_usd_rate() == pytest.approx(12100.0)
    assert route.call_count == 2


def test_the_rate_fetch_never_holds_a_smeta_for_long():
    assert currency.FETCH_TIMEOUT_SECONDS <= 3.0


def test_uzs_to_usd_basic_conversion():
    assert currency.uzs_to_usd(1_000_000, 10_000.0) == pytest.approx(100.0)


def test_uzs_to_usd_guards_against_zero_rate():
    assert currency.uzs_to_usd(1_000_000, 0.0) == 0.0
