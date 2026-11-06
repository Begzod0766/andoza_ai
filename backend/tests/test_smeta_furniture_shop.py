"""Shop catalog pieces (Furniture rows with a UUID id) in the estimate: the line is priced
from the row itself, so it names the shop and carries today's price, not the price that
was snapshotted onto the placed entry when it was put in the room."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.services import estimate_catalog as ec
from app.services.smeta import _furniture_lines, compute_estimate, furniture_catalog_key


def _room(furniture: list[dict]) -> SimpleNamespace:
    return SimpleNamespace(state={"furniture": furniture})


def _piece(price=4_200_000, name="Divan Milano", store="Mebel Plaza", active=True):
    return SimpleNamespace(
        id=uuid.uuid4(), name_uz=name, price_uzs=price, is_active=active,
        store=SimpleNamespace(name=store) if store else None,
    )


def _catalog(*pieces):
    return {furniture_catalog_key(str(p.id)): p for p in pieces}


def test_a_shop_piece_gets_its_store_and_current_price_not_the_snapshot():
    piece = _piece()
    room = _room([
        {"furniture_id": str(piece.id), "name": "Eski nom", "unitPriceUzs": 3_000_000},
        {"furniture_id": str(piece.id), "name": "Eski nom", "unitPriceUzs": 3_000_000},
    ])

    [line] = _furniture_lines(room, _catalog(piece))

    assert line.store_name == "Mebel Plaza"
    assert line.unit_price_uzs == 4_200_000 and line.qty == 2
    assert line.subtotal_uzs == 8_400_000
    assert line.label == "Jihoz: Divan Milano"
    assert line.is_approximate is False and line.warning is None


def test_a_shop_piece_without_a_price_keeps_the_snapshot_but_names_the_store():
    piece = _piece(price=None)
    room = _room([{"furniture_id": str(piece.id), "name": "Divan", "unitPriceUzs": 3_000_000}])

    [line] = _furniture_lines(room, _catalog(piece))

    assert line.unit_price_uzs == 3_000_000 and line.store_name == "Mebel Plaza"


def test_a_shop_piece_of_a_shopless_row_has_no_store():
    piece = _piece(store=None)
    room = _room([{"furniture_id": str(piece.id)}])

    [line] = _furniture_lines(room, _catalog(piece))

    assert line.unit_price_uzs == 4_200_000 and line.store_name is None


def test_an_inactive_shop_piece_falls_back_to_the_snapshot():
    piece = _piece(active=False)
    room = _room([{"furniture_id": str(piece.id), "name": "Divan", "unitPriceUzs": 3_000_000}])

    [line] = _furniture_lines(room, _catalog(piece))

    assert line.unit_price_uzs == 3_000_000 and line.store_name is None
    assert line.label == "Jihoz: Divan"


def test_a_deleted_shop_piece_keeps_the_snapshot_and_no_store():
    room = _room([{"furniture_id": str(uuid.uuid4()), "name": "Divan", "unitPriceUzs": 3_000_000}])

    [line] = _furniture_lines(room, _catalog(_piece()))

    assert line.unit_price_uzs == 3_000_000 and line.store_name is None
    assert line.is_approximate is False


def test_a_user_model_is_unchanged_by_the_catalog():
    room = _room([{"furniture_id": "abc123", "name": "Mening stulim", "unitPriceUzs": 1_500_000}])

    [line] = _furniture_lines(room, _catalog(_piece()))

    assert (line.label, line.unit_price_uzs, line.store_name) == ("Jihoz: Mening stulim", 1_500_000, None)


def test_compute_estimate_hands_the_catalog_to_the_furniture_lines():
    piece = _piece()
    room = SimpleNamespace(
        net_wall_area=0.0, floor_area=0.0, perimeter=0.0, openings_count=0, ceiling_h=2.7,
        geometry={"walls": []}, surfaces={}, furniture_layout=[],
        state={"furniture": [{"furniture_id": str(piece.id), "unitPriceUzs": 1}]},
    )

    est = compute_estimate(room, {}, {}, catalog=_catalog(piece))

    [line] = [ln for ln in est.lines if ln.category == "jihoz"]
    assert line.store_name == "Mebel Plaza" and line.unit_price_uzs == 4_200_000


class _Res:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


class _CountingSession:
    def __init__(self, rows):
        self.rows, self.statements = rows, []

    async def execute(self, stmt):
        self.statements.append(stmt)
        return _Res(self.rows)


class _Down:
    async def execute(self, stmt):
        raise RuntimeError("db down")


class TestLoadFurnitureCatalog:
    async def test_one_query_for_every_placed_shop_piece(self):
        pieces = [_piece(name=f"Mebel {i}") for i in range(5)]
        room = _room(
            [{"furniture_id": str(p.id)} for p in pieces]
            + [{"furniture_id": str(pieces[0].id)}, {"furniture_id": "couch_84"}, {"furniture_id": "abc123"}]
        )
        db = _CountingSession(pieces)

        catalog = await ec.load_furniture_catalog(db, room)

        assert len(db.statements) == 1
        assert catalog == _catalog(*pieces)
        # Only the UUID ids are asked for; slugs and upload ids never reach the query.
        params = db.statements[0].compile().params
        asked = {v for vals in params.values() if isinstance(vals, (list, tuple)) for v in vals}
        assert asked == {p.id for p in pieces}

    async def test_no_shop_pieces_means_no_query(self):
        db = _CountingSession([])
        room = _room([{"furniture_id": "couch_84"}, {"furniture_id": "abc123"}])
        assert await ec.load_furniture_catalog(db, room) == {}
        assert db.statements == []

    async def test_a_failing_query_gives_an_empty_catalog(self):
        room = _room([{"furniture_id": str(uuid.uuid4())}])
        assert await ec.load_furniture_catalog(_Down(), room) == {}

    async def test_load_estimate_catalog_includes_the_rooms_pieces(self, monkeypatch):
        piece = _piece()

        async def fake_furniture(db, room):
            return _catalog(piece)

        monkeypatch.setattr(ec, "load_furniture_catalog", fake_furniture)
        room = _room([{"furniture_id": str(piece.id)}])
        assert await ec.load_estimate_catalog(_Down(), room) == _catalog(piece)

    async def test_load_estimate_catalog_without_a_room_does_not_look_up_furniture(self, monkeypatch):
        async def boom(db, room):
            raise AssertionError("should not be called")

        monkeypatch.setattr(ec, "load_furniture_catalog", boom)
        assert await ec.load_estimate_catalog(_Down()) == {}
