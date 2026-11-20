"""The collector scheme in the estimate (2026-11-18): a line from the riser to each water point, a
collector per water kind (its outlets priced), the work of fitting it; no water tees."""
from __future__ import annotations

from types import SimpleNamespace

from app.services.smeta import _plumbing_lines
from app.services.smeta_keys import ALL_SMETA_KEYS
from app.services.smeta_text import localize_label

GEOMETRY = {"walls": [
    {"id": "A", "length": 2.5, "elements": []}, {"id": "B", "length": 2.0, "elements": []},
    {"id": "C", "length": 2.5, "elements": []},
    {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "position": 0.5}]},
]}
POINTS = [
    {"id": "c1", "kind": "cold", "diameterMm": 20, "wallId": "A", "positionMm": 1000, "heightMm": 550},
    {"id": "c2", "kind": "cold", "diameterMm": 20, "wallId": "B", "positionMm": 500, "heightMm": 1050},
    {"id": "h1", "kind": "hot", "diameterMm": 20, "wallId": "A", "positionMm": 1150, "heightMm": 550},
]
COLD, HOT, WORK, TEE = "Kollektor (sovuq suv)", "Kollektor (issiq suv)", "Ish: kollektorni yig'ish", "PPR troynik Ø20"


def room(scheme=None):
    ds = {"waterScheme": scheme} if scheme else {}
    state = {"furniture": [], "plumbing": POINTS, "plumbingRiser": {"wallId": "D", "positionMm": 0, "manual": True}, "designState": ds}
    return SimpleNamespace(state=state, geometry=GEOMETRY, room_type="hammom", name="Hammom")


def lines(r) -> dict:
    return {ln.label if ln.label.startswith("Ish:") else ln.label.split(":")[0]: ln for ln in _plumbing_lines(r, {})}


def test_a_collector_per_water_kind_priced_by_its_outlets_and_its_fitting():
    got = lines(room("collector"))
    assert (got[COLD].qty, got[COLD].unit_price_uzs) == (1, 150_000 + 2 * 60_000)
    assert got[COLD].formula == "150 000 so'm + 2 chiqish × 60 000 so'm = 270 000 so'm"
    assert (got[HOT].qty, got[HOT].unit_price_uzs) == (1, 150_000 + 60_000)
    assert (got[WORK].qty, got[WORK].unit_price_uzs) == (2, 150_000)
    assert {got[k].category for k in (COLD, HOT, WORK)} == {"santexnika"}
    assert TEE not in got


def test_more_pipe_than_with_tees():
    def water_m(r):
        return next(ln for ln in _plumbing_lines(r, {}) if ln.label.startswith("Suv quvuri PPR Ø20")).qty
    assert water_m(room("collector")) > water_m(room())


def test_the_tee_scheme_is_the_default_and_has_no_collector():
    got = lines(room())
    assert not {COLD, HOT, WORK} & set(got)
    assert lines(room("anything")).keys() == got.keys()


def test_key_and_translations():
    assert "kollektor" in ALL_SMETA_KEYS
    for label in (COLD, HOT, WORK):
        assert localize_label(label, "ru") != label
