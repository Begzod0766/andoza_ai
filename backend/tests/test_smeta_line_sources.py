"""Every estimate line priced from a shop product says which shop (store_id) and shows the
product's photo (image_url), so the estimate page can group lines by shop and picture them."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.services.smeta import (
    WallpaperRoll,
    _furniture_lines,
    _shop,
    _shop_wallpaper_lines,
    furniture_catalog_key,
    wallpaper_catalog_key,
)

STORE_ID = uuid.uuid4()


def _store():
    return SimpleNamespace(id=STORE_ID, name="Mebel Plaza")


def test_shop_material_fields_carry_store_id_and_image():
    mat = SimpleNamespace(id=uuid.uuid4(), store=_store(), store_id=STORE_ID,
                          image_url="https://cdn.example/m.webp")
    fields = _shop(mat)
    assert fields["store_id"] == str(STORE_ID)
    assert fields["store_name"] == "Mebel Plaza"
    assert fields["image_url"] == "https://cdn.example/m.webp"


def test_material_without_a_store_has_no_store_id():
    mat = SimpleNamespace(id=uuid.uuid4(), store=None, store_id=None, image_url=None)
    fields = _shop(mat)
    assert fields["store_id"] is None and fields["image_url"] is None


def test_furniture_line_gets_store_id_and_thumbnail_url():
    piece = SimpleNamespace(
        id=uuid.uuid4(), name_uz="Divan", price_uzs=1_000_000, is_active=True,
        store=_store(), store_id=STORE_ID, thumbnail_key="furniture/divan.webp",
    )
    room = SimpleNamespace(state={"furniture": [{"furniture_id": str(piece.id)}]})

    [line] = _furniture_lines(room, {furniture_catalog_key(str(piece.id)): piece})

    assert line.store_id == str(STORE_ID)
    assert line.image_url and line.image_url.endswith("furniture/divan.webp")


def test_furniture_without_a_catalog_row_has_no_source():
    room = SimpleNamespace(state={"furniture": [{"furniture_id": "random", "unitPriceUzs": 5}]})
    [line] = _furniture_lines(room)
    assert line.store_id is None and line.image_url is None


def test_shop_wallpaper_line_gets_store_id_and_image():
    url = "https://cdn.example/wallpapers/a.webp"
    roll = WallpaperRoll(name="Oboy", price_uzs=100_000, roll_width_cm=53, roll_length_m=10,
                         store_name="Demo Oboy", store_id=str(STORE_ID), image_url=url)
    room = SimpleNamespace(
        ceiling_h=2.7, geometry={"walls": [{"id": "A", "length": 4.0}]},
        state={"wallCoverings": {"A": {"kind": "texture", "url": url}}},
    )
    [line], _ = _shop_wallpaper_lines(room, {wallpaper_catalog_key(url): roll})
    assert line.store_id == str(STORE_ID) and line.image_url == url
