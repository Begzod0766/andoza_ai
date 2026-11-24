"""plumbing_prices (spec 2026-11-24 D): the one source of the pipe money, read by the estimate's lines
and served to the studio, so its instant difference is the estimate's difference."""
from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services import norm_overrides as no
from app.services.plumbing import load_plumbing_norms
from app.services.smeta import PIPE_LABELS, PLUMBING_FITTING_LABELS, _plumbing_lines, plumbing_prices
from tests.test_estimate_router import _Result, _as, _room, _user, client  # noqa: F401
from tests.test_smeta_pipe_scheme import _fixture_room

FIXTURES = Path(__file__).resolve().parents[2] / "frontend/src/lib/__tests__/fixtures"
KEYS = {"reserve", "pipe_m_uzs", "fitting_uzs", "collector", "chase_m_uzs"}


@pytest.fixture(autouse=True)
def clean():
    no.set_overrides({})
    yield
    no.set_overrides({})


def _shop(unit, price, name="Shop"):
    return SimpleNamespace(unit=unit, price_uzs=price, name_uz=name, name_ru=name, name_en=name, id="x",
                           store=None, product_url=None, image_url=None, url=None)


def test_prices_are_what_the_estimate_uses():
    norms = load_plumbing_norms()
    p = plumbing_prices({}, norms)
    assert set(p) == KEYS and p["reserve"] == 1.15
    assert p["pipe_m_uzs"] == {k: int(v) for k, v in norms["pipe_m_uzs"].items() if k in ("water_20", "drain_50", "drain_110")}
    assert p["fitting_uzs"] == {k: int(v) for k, v in norms["fitting_uzs"].items()}
    assert p["collector"] == {"shop_uzs": None, "base_uzs": 150000, "outlet_uzs": 60000, "work_uzs": 150000}
    assert p["chase_m_uzs"] == {"water_20": 35000, "drain_50": 60000}


def test_a_shop_pipe_per_metre_wins_and_a_shop_collector_by_the_piece():
    from app.services.smeta import _price_per
    shop = _shop("m", 11_111)
    cat = {"pipe:water_20": shop, "kollektor": _shop("dona", 500_000)}
    p = plumbing_prices(cat, load_plumbing_norms())
    assert p["pipe_m_uzs"]["water_20"] == _price_per(shop, "m")
    assert p["collector"]["shop_uzs"] == 500_000
    # Not sold by the piece, or free: no shop price, never 0.
    assert plumbing_prices({"kollektor": _shop("m", 500_000)}, load_plumbing_norms())["collector"]["shop_uzs"] is None
    assert plumbing_prices({"kollektor": _shop("dona", 0)}, load_plumbing_norms())["collector"]["shop_uzs"] is None


def test_an_admin_override_is_the_price():
    no.set_overrides({"plumbing": {"pipe_m_uzs.water_20": 9_999, "work_chase_m_uzs.drain_50": 61_000}})
    p = plumbing_prices({}, load_plumbing_norms())
    assert p["pipe_m_uzs"]["water_20"] == 9_999 and p["chase_m_uzs"]["drain_50"] == 61_000


def test_money_fixture_matches_the_estimate(monkeypatch):
    import app.services.plumbing as plumbing
    fx = json.loads((FIXTURES / "pipeCost.json").read_text(encoding="utf-8"))
    real = load_plumbing_norms()
    pr = fx["prices"]
    norms = {**real, "pipe_m_uzs": pr["pipe_m_uzs"], "fitting_uzs": pr["fitting_uzs"],
             "collector": {**real["collector"], **{k: pr["collector"][k] for k in ("base_uzs", "outlet_uzs", "work_uzs")}},
             "work_chase_m_uzs": pr["chase_m_uzs"]}
    monkeypatch.setattr(plumbing, "load_plumbing_norms", lambda: norms)
    labels = set(PIPE_LABELS.values()) | set(PLUMBING_FITTING_LABELS.values())
    for case in fx["cases"]:
        design: dict = {"pipesInWall": case["pipesInWall"]}
        route = case.get("route") or {}
        if "avoid" in route:
            design["pipeAvoid"] = route["avoid"]
        if "waterTrunk" in route:
            design["waterTrunk"] = route["waterTrunk"]
        room, scheme_case = _fixture_room(case["caseName"], design)
        if case.get("collector") or scheme_case.get("collector"):  # the flag lives on the pipeScheme case
            room.state["designState"]["waterScheme"] = "collector"
        catalog = {"kollektor": _shop("dona", case["collectorShopUzs"], "Kollektor")} if case.get("collectorShopUzs") else {}
        total = sum(
            ln.subtotal_uzs for ln in _plumbing_lines(room, catalog)
            if ln.label.split(":")[0] in labels or ln.label.startswith(("Kollektor", "Ish: kollektorni yig'ish", "Ish: shtroba"))
        )
        assert total == case["expectedUzs"], case["name"]


def _priced_db(room):
    queue = [_Result(one=room), _Result(many=[]), _Result(many=[]), _Result(one=None)]
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=lambda *_a, **_k: queue.pop(0) if queue else _Result(many=[]))
    return db


def test_endpoint_serves_the_prices_to_the_owner(client):
    room = _room()
    _as(_user(), _priced_db(room))
    r = client.get(f"/api/v1/rooms/{room.id}/plumbing-prices")
    assert r.status_code == 200, r.text
    assert set(r.json()) == KEYS and r.json()["collector"]["shop_uzs"] is None


def test_endpoint_404_for_another_users_room(client):
    room = _room()
    _as(_user(), _priced_db(None))
    assert client.get(f"/api/v1/rooms/{room.id}/plumbing-prices").status_code == 404
