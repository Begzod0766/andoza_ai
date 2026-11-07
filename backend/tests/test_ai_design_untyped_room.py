"""A room with no type, Russian shop names, and armchairs filed under "divan".

Found on prod (2026-11-07): "Mening xonam" had no room type, so the designer offered only the
37 untyped pieces (tables, shelves, wardrobes) and a request for "kulrang divan, qora charm
kreslo" got neither. With the type set, the sofa came but the armchair did not: the shops file
armchairs under the "divan" category, and one-sofa-per-room went by category.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.routers.ai import _run_design
from app.services import ai_designer as ad
from app.services.ai_designer import DesignPlan

PLAN = DesignPlan(title="t", summary="s", walls={}, floor={}, lights=[], furniture=[])


@pytest.fixture(autouse=True)
def _keep_catalog_order(monkeypatch):
    monkeypatch.setattr("app.services.ai_designer.random.shuffle", lambda items: None)


# --- 1. the room type a request names, when the room has none ---

@pytest.mark.parametrize("prompt, expected", [
    ("Zamonaviy mehmonxona: kulrang divan va kreslo", "mehmonxona"),
    ("zalda katta divan bo'lsin", "mehmonxona"),
    ("Уютная гостиная в светлых тонах", "mehmonxona"),
    ("cozy living room", "mehmonxona"),
    ("Shinam yotoqxona", "yotoqxona"),
    ("спальня в скандинавском стиле", "yotoqxona"),
    ("bolalar xonasi, pastel ranglar", "bolalar"),
    ("oshxona plitka bilan", "oshxona"),
    ("ish xonasi, yozuv stoli bilan", "kabinet"),
])
def test_a_request_names_its_room_type(prompt, expected):
    assert ad.room_type_in_prompt(prompt) == expected


@pytest.mark.parametrize("prompt", [
    "go'zal va yorug' xona",  # go'zal (beautiful) is not a zal
    "goʻzal, sokin ranglar",
    "qorong'i, iliq atmosfera",
    "",
])
def test_a_request_without_a_room_names_no_type(prompt):
    assert ad.room_type_in_prompt(prompt) is None


async def _designed_room_type(prompt: str, request_type: str | None, stored_type: str | None) -> str | None:
    db = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock(scalars=lambda: MagicMock(all=lambda: [])))
    room = SimpleNamespace(name="Xona", ceiling_h=2.7, geometry=None, room_type=stored_type)
    design = AsyncMock(return_value=PLAN)
    with patch("app.routers.ai.design_room", new=design):
        await _run_design(room, prompt, request_type, db, "user-1")
    return design.await_args.args[1]["room_type"]


async def test_an_untyped_room_takes_the_type_its_request_names():
    assert await _designed_room_type("Zamonaviy mehmonxona, kulrang divan", None, None) == "mehmonxona"


async def test_the_rooms_own_type_wins_over_the_request():
    assert await _designed_room_type("mehmonxonadagidek divan", None, "yotoqxona") == "yotoqxona"


async def test_a_requested_type_wins_over_the_request_text():
    assert await _designed_room_type("mehmonxona uslubida", "kabinet", None) == "kabinet"


# --- 1b. a room of no known type is offered every room's pieces ---

def test_an_untyped_room_is_offered_every_rooms_pieces():
    untyped = [
        {"id": f"t{n}", "name_uz": f"Стол {n}", "category": "stol", "room_type": None, "placement": "pol"}
        for n in range(10)
    ]
    living = [
        {"id": "sofa", "name_uz": "Диван ERGO IZZY", "category": "divan", "room_type": "mehmonxona", "placement": "pol"},
        {"id": "chair", "name_uz": "Кресло ERGO Veloce Black", "category": "divan", "room_type": "mehmonxona", "placement": "pol"},
    ]
    _, by_label = ad.furniture_menu(untyped + living, None, "kulrang divan va qora kreslo")
    ids = {v["id"] for v in by_label.values()}
    assert {"sofa", "chair"} <= ids


# --- 2. one sofa per room, by what the piece is for, not its shop category ---

def _validate(furniture):
    by_label = {
        "F1": {"id": "sofa", "name": "Диван трехместный ERGO IZZY", "category": "divan"},
        "F2": {"id": "chair", "name": "Кресло ERGO Veloce Lounge Black", "category": "divan"},
        "F3": {"id": "sofa2", "name": "Диван Лофт", "category": "divan"},
    }
    data = {"walls": {"main": {"type": "paint", "color": "#ffffff"}}, "furniture": furniture}
    return ad.validate_plan(data, by_label, ["A", "B", "C", "D"])


def test_an_armchair_filed_under_divan_stays_beside_the_sofa():
    plan = _validate([{"id": "F1", "role": "sofa"}, {"id": "F2", "role": "armchair"}])
    assert [f["id"] for f in plan.furniture] == ["sofa", "chair"]


def test_an_armchair_without_a_role_is_known_by_its_name():
    plan = _validate([{"id": "F1"}, {"id": "F2"}])
    assert [(f["id"], f["role"]) for f in plan.furniture] == [("sofa", "sofa"), ("chair", "armchair")]


def test_a_second_sofa_is_still_dropped():
    plan = _validate([{"id": "F1", "role": "sofa"}, {"id": "F3", "role": "sofa"}, {"id": "F2", "role": "armchair"}])
    assert [f["id"] for f in plan.furniture] == ["sofa", "chair"]


# --- 3. Russian names in the study-shelf and light rules ---

def test_a_study_always_offers_a_russian_named_bookcase():
    living = [
        {"id": f"l{k}", "name_uz": f"Zal {k}", "category": "divan", "room_type": "mehmonxona", "placement": "pol"}
        for k in range(ad.MAX_CATALOG_IN_PROMPT + 5)
    ]
    shelves = [
        {"id": "aurora", "name_uz": "Стеллаж Aurora", "category": "shkaf", "room_type": None, "placement": "pol"},
        {"id": "books", "name_uz": "Шкаф для книг ERGO Middle-80", "category": "shkaf", "room_type": None, "placement": "pol"},
    ]
    offered = {i["id"] for i in ad.always_offered(living + shelves, "kabinet")}
    assert {"aurora", "books"} <= offered


@pytest.mark.parametrize("name", ["Люстра 407S BLACK", "Бра W98003", "Торшер Gold", "Светильник LED"])
def test_a_russian_named_light_is_not_offered_as_furniture(name):
    items = [
        {"id": "light", "name_uz": name, "category": "boshqa", "room_type": None, "placement": "pol"},
        {"id": "sofa", "name_uz": "Диван", "category": "divan", "room_type": None, "placement": "pol"},
    ]
    _, by_label = ad.furniture_menu(items, "mehmonxona")
    assert "light" not in {v["id"] for v in by_label.values()}
