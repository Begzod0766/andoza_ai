"""A polygon room may have a short jog wall: when one room grows into another
the cut room gets a corner whose short side is as deep as the push, from a
few centimetres up. The schema used to refuse any wall of 0.5 m or less, so
the cut room's save failed while the growing room's went through."""
import pytest
from pydantic import ValidationError

from app.schemas.room import RoomGeometry, WallCreate


def _l_room(jog: float) -> RoomGeometry:
    pts = [(0.0, 0.0), (4.0, 0.0), (4.0, 3.0), (2.0, 3.0), (2.0, 3.0 - jog), (0.0, 3.0 - jog)]
    walls = []
    for i, (x1, z1) in enumerate(pts):
        x2, z2 = pts[(i + 1) % len(pts)]
        walls.append({"id": f"W{i + 1}", "length": round(abs(x2 - x1) + abs(z2 - z1), 3), "elements": []})
    return RoomGeometry(walls=walls, vertices=pts)


def test_a_short_jog_wall_is_kept():
    g = _l_room(0.2)
    assert min(w.length for w in g.walls) == pytest.approx(0.2)


def test_a_sliver_of_wall_is_still_refused():
    with pytest.raises(ValidationError):
        _l_room(0.04)


def test_a_wall_added_by_hand_keeps_its_half_metre_minimum():
    with pytest.raises(ValidationError):
        WallCreate(length=0.3)
