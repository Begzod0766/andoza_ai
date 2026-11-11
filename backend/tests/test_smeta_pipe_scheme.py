"""The estimate's pipes and fittings from the pipe scheme (spec 2026-11-11): a trunk per pipe kind and a
branch to each point, not a run of its own from every point; fittings counted by type."""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services.pipe_scheme import pipe_scheme
from app.services.plumbing import load_plumbing_norms, riser_spot
from app.services.smeta import PLUMBING_FITTINGS_WARNING, _plumbing_lines, _round2
from app.services.smeta_text import localize_formula, localize_label

GEOMETRY = {"walls": [
    {"id": "A", "length": 2.5, "elements": []},
    {"id": "B", "length": 2.0, "elements": []},
    {"id": "C", "length": 2.5, "elements": []},
    {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "position": 0.5}]},
]}
FURNITURE = [
    {"id": "tub", "furniture_id": "vanna-1", "name": "Vanna Roca 170"},
    {"id": "wc", "furniture_id": "unitaz-1", "name": "Unitaz Cersanit"},
    {"id": "sink", "furniture_id": "rakovina-1", "name": "Rakovina 50"},
]


def _pt(fixture, kind, wall, pos, h, d):
    return {"id": f"{fixture}:{kind}", "kind": kind, "diameterMm": d, "wallId": wall, "positionMm": pos, "heightMm": h, "fixtureId": fixture}


PLUMBING = [
    _pt("tub", "drain", "A", 1250, 150, 50), _pt("tub", "cold", "A", 1150, 700, 20), _pt("tub", "hot", "A", 1350, 700, 20),
    _pt("wc", "drain", "B", 1000, 200, 110), _pt("wc", "cold", "B", 900, 200, 20),
    _pt("sink", "drain", "C", 800, 500, 50), _pt("sink", "cold", "C", 700, 550, 20), _pt("sink", "hot", "C", 900, 550, 20),
]
FITTINGS = [  # (scheme key, label, norm price)
    ("tee_20", "PPR troynik Ø20", 3000), ("elbow_20", "PPR burchak Ø20", 2500),
    ("outlet_20", "Suv rozetkasi Ø20", 12000), ("valve_20", "Sharli kran Ø20", 35000),
    ("tee_50", "Kanalizatsiya troynigi Ø50", 9000), ("elbow_50", "Kanalizatsiya burchagi Ø50", 6000),
    ("tee_110_50", "Kanalizatsiya troynigi Ø110/50", 22000), ("elbow_110", "Kanalizatsiya burchagi Ø110", 18000),
]
PIPES = {"water_20": "Suv quvuri PPR Ø20", "drain_50": "Kanalizatsiya quvuri Ø50", "drain_110": "Kanalizatsiya quvuri Ø110"}


def room(plumbing=PLUMBING, furniture=FURNITURE, rails=None, geometry=GEOMETRY):
    state: dict = {"furniture": list(furniture)}
    if plumbing is not None:
        state["plumbing"] = plumbing
    if rails is not None:
        state["towelRails"] = rails
    return SimpleNamespace(state=state, geometry=geometry)


def by_label(lines):
    return {ln.label: ln for ln in lines}


def scheme(points=PLUMBING):
    return pipe_scheme(GEOMETRY, riser_spot(GEOMETRY, None), points)


def test_pipe_lines_come_from_the_scheme():
    s = scheme()
    got = by_label(_plumbing_lines(room(), {}))
    for key, label in PIPES.items():
        p = s["pipes"][key]
        metres = _round2((p["trunkMm"] + p["branchMm"]) / 1000 * 1.15)
        assert got[label].qty == metres and got[label].unit == "m"
        total = (p["trunkMm"] + p["branchMm"]) / 1000
        assert got[label].formula == f"Magistral {p['trunkMm'] / 1000:.2f} m + tik bo'laklar {p['branchMm'] / 1000:.2f} m = {total:.2f} m × 1.15 = {metres:g} m"


def test_the_room_needs_less_pipe_than_a_run_per_point():
    got = by_label(_plumbing_lines(room(), {}))
    # A run of its own from each water point to the riser, as priced before 2026-11-11:
    # 3.85 + 4.05 + 3.8 + 2.35 + 2.15 m × 1.15 = 18.63 m.
    assert 0 < got["Suv quvuri PPR Ø20"].qty < 18.63


def test_each_fitting_is_a_line_with_its_count_price_and_working():
    s = scheme()
    got = by_label(_plumbing_lines(room(), {}))
    labels = [ln.label for ln in _plumbing_lines(room(), {})]
    w = s["why"]
    def terms(n, *parts):
        """The spec's working: only the parts that are not zero; "= n dona" when there are two."""
        shown = [f"{count} {word}" for count, word in parts if count]
        return " + ".join(shown) + (f" = {n} dona" if len(shown) > 1 else "")

    f = s["fittings"]
    formulas = {
        "tee_20": terms(f["tee_20"], (w["tee_20"]["branches"], "tarmoq"), (w["tee_20"]["riser"], "stoyak")),
        "elbow_20": terms(f["elbow_20"], (w["elbow_20"]["corners"], "xona burchagi"), (w["elbow_20"]["ends"], "magistral uchi")),
        "outlet_20": f"{w['outlet_20']['points']} nuqta", "valve_20": f"{w['valve_20']['lines']} liniya",
        "tee_50": f"{w['tee_50']['branches']} tarmoq",
        "elbow_50": terms(f["elbow_50"], (w["elbow_50"]["corners"], "xona burchagi"), (w["elbow_50"]["ends"], "magistral uchi")),
        "tee_110_50": f"{w['tee_110_50']['joins']} ulanish",
        "elbow_110": terms(f["elbow_110"], (w["elbow_110"]["toilets"], "unitaz"), (w["elbow_110"]["corners"], "xona burchagi")),
    }
    listed = [label for key, label, _ in FITTINGS if s["fittings"][key] > 0]
    assert len(listed) >= 6  # this room has toilet, sink and bath: most kinds are there
    assert [lb for lb in labels if lb in {f[1] for f in FITTINGS}] == listed  # in the order of the list
    norms = load_plumbing_norms()["fitting_uzs"]
    for key, label, price in FITTINGS:
        if s["fittings"][key] == 0:
            continue
        line = got[label]
        assert (line.qty, line.unit, line.unit_price_uzs, line.category) == (s["fittings"][key], "dona", price, "santexnika")
        assert norms[key] == price
        assert line.subtotal_uzs == s["fittings"][key] * price
        assert line.is_approximate is True and line.warning == PLUMBING_FITTINGS_WARNING
        assert line.formula == formulas[key], key


def test_the_set_per_point_line_is_gone():
    assert "Fitinglar" not in by_label(_plumbing_lines(room(), {}))
    assert "fitting_set_uzs" not in load_plumbing_norms()


def test_a_fitting_with_a_count_of_zero_is_not_listed():
    no_toilet = [p for p in PLUMBING if not p["id"].startswith("wc:")]
    got = by_label(_plumbing_lines(room(plumbing=no_toilet), {}))
    assert "Kanalizatsiya troynigi Ø110/50" not in got and "Kanalizatsiya burchagi Ø110" not in got
    assert "Kanalizatsiya quvuri Ø110" not in got
    assert "Kanalizatsiya burchagi Ø50" in got


def test_a_room_with_only_a_towel_rail():
    got = by_label(_plumbing_lines(room(plumbing=[], furniture=[], rails=[{"id": "r1", "wallId": "A", "positionMm": 600, "heightMm": 1000}]), {}))
    assert got["Suv quvuri PPR Ø20"].qty > 0
    assert got["Sharli kran Ø20"].qty == 1 and got["Suv rozetkasi Ø20"].qty == 2
    assert not any(label.startswith("Kanalizatsiya") for label in got)


def test_hand_added_and_derived_points_join_the_scheme():
    hand = {"id": "p1", "kind": "cold", "diameterMm": 20, "wallId": "B", "positionMm": 1500, "heightMm": 500}
    got = by_label(_plumbing_lines(room(plumbing=PLUMBING + [hand]), {}))
    assert got["Suv rozetkasi Ø20"].qty == 6
    assert got["Suv quvuri PPR Ø20"].qty == _round2(sum(scheme(PLUMBING + [hand])["pipes"]["water_20"].values()) / 1000 * 1.15)
    # A room saved before plumbing: its fixtures' points are derived, and they are in the scheme too.
    placed = [{**f, "x": x, "y": y, "rotation": r} for f, (x, y, r) in zip(FURNITURE, [(0, -600, 0), (900, 0, -1.5708), (0, 650, 3.1416)])]
    derived = by_label(_plumbing_lines(room(plumbing=None, furniture=placed), {}))
    assert derived["Suv rozetkasi Ø20"].qty == 5 and derived["Sharli kran Ø20"].qty == 2
    assert derived["Ish: nuqtani ulash"].qty == 8


def test_a_room_with_no_plumbing_is_unchanged():
    assert _plumbing_lines(room(plumbing=[], furniture=[]), {}) == []
    assert _plumbing_lines(room(plumbing=None, furniture=[]), {}) == []


@pytest.mark.parametrize("points", [
    [None, "x", 3, {"kind": "cold"}],
    [{"id": "z", "kind": "cold", "diameterMm": 20, "wallId": "Z", "positionMm": 100, "heightMm": 500}],
    [{"id": "far", "kind": "drain", "diameterMm": 50, "wallId": "A", "positionMm": 99999, "heightMm": -50},
     {"id": "c", "kind": "cold", "diameterMm": 20, "wallId": "B", "positionMm": -10, "heightMm": -5}],
])
def test_no_line_is_ever_negative(points):
    lines = _plumbing_lines(room(plumbing=points, furniture=[]), {})
    for ln in lines:
        assert ln.qty >= 0 and ln.subtotal_uzs >= 0, ln.label


@pytest.mark.parametrize("label,ru,en", [
    ("PPR troynik Ø20", "Тройник PPR Ø20", "PPR tee Ø20"),
    ("PPR burchak Ø20", "Угол PPR Ø20", "PPR elbow Ø20"),
    ("Suv rozetkasi Ø20", "Водорозетка Ø20", "Wall outlet Ø20"),
    ("Sharli kran Ø20", "Шаровой кран Ø20", "Ball valve Ø20"),
    ("Kanalizatsiya troynigi Ø50", "Канализационный тройник Ø50", "Drain tee Ø50"),
    ("Kanalizatsiya burchagi Ø50", "Канализационный отвод Ø50", "Drain elbow Ø50"),
    ("Kanalizatsiya troynigi Ø110/50", "Канализационный тройник Ø110/50", "Drain tee Ø110/50"),
    ("Kanalizatsiya burchagi Ø110", "Канализационный отвод Ø110", "Drain elbow Ø110"),
])
def test_labels_read_in_russian_and_english(label, ru, en):
    assert localize_label(label, "ru") == ru
    assert localize_label(label, "en") == en
    assert localize_label(label, "uz") == label


@pytest.mark.parametrize("formula,ru,en", [
    ("Magistral 6.00 m + tik 1.20 m = 7.20 m × 1.15 = 8.28 m",
     "Магистраль 6.00 м + отводы 1.20 м = 7.20 м × 1.15 = 8.28 м", "Trunk 6.00 m + branches 1.20 m = 7.20 m × 1.15 = 8.28 m"),
    ("5 tarmoq + 1 stoyak = 6 dona", "5 отводов + 1 стояк = 6 шт.", "5 branches + 1 riser = 6 pcs"),
    ("2 burchak + 1 uch = 3 dona", "2 угла + 1 конец = 3 шт.", "2 corners + 1 end = 3 pcs"),
    ("1 unitaz + 2 burchak = 3 dona", "1 унитаз + 2 угла = 3 шт.", "1 toilet + 2 corners = 3 pcs"),
    ("2 liniya", "2 линии", "2 lines"),
    ("3 ulanish", "3 врезки", "3 joins"),
    ("1 tarmoq", "1 отвод", "1 branch"),
    # The spec's own words (review minor 2); the shorter ones above stay for estimates saved before.
    ("Magistral 6.00 m + tik bo'laklar 1.20 m = 7.20 m × 1.15 = 8.28 m",
     "Магистраль 6.00 м + отводы 1.20 м = 7.20 м × 1.15 = 8.28 м", "Trunk 6.00 m + branches 1.20 m = 7.20 m × 1.15 = 8.28 m"),
    ("2 xona burchagi + 1 magistral uchi = 3 dona", "2 угла комнаты + 1 конец магистрали = 3 шт.", "2 room corners + 1 trunk end = 3 pcs"),
    ("5 xona burchagi", "5 углов комнаты", "5 room corners"),
    ("1 unitaz + 1 xona burchagi = 2 dona", "1 унитаз + 1 угол комнаты = 2 шт.", "1 toilet + 1 room corner = 2 pcs"),
    ("2 magistral uchi", "2 конца магистрали", "2 trunk ends"),
])
def test_formulas_read_in_russian_and_english(formula, ru, en):
    assert localize_formula(formula, "ru") == ru
    assert localize_formula(formula, "en") == en
    assert localize_formula(formula, "uz") == formula


# ─── Review minors (2026-11-11) ──────────────────────────────────────────────

def test_a_formula_leaves_out_a_count_of_zero():
    """One point beside the riser: the trunk passes no corner, so the elbow reads "1 magistral uchi"."""
    one = [{"id": "c", "kind": "cold", "diameterMm": 20, "wallId": "C", "positionMm": 2000, "heightMm": 500}]
    got = by_label(_plumbing_lines(room(plumbing=one, furniture=[]), {}))
    assert got["PPR burchak Ø20"].formula == "1 magistral uchi"
    import re
    assert not [ln.formula for ln in got.values() if re.search(r"(?:^|\+ )0 [a-z]", ln.formula)]  # no "0 xona burchagi"


def test_a_point_the_scheme_cannot_read_is_not_charged_as_work_either():
    bad = [{"id": "x", "kind": "cold", "diameterMm": 20, "wallId": "A", "positionMm": 500},          # no height
           {"id": "y", "kind": "cold", "diameterMm": 20, "wallId": "A", "positionMm": "far", "heightMm": 500},
           {"id": "z", "kind": "steam", "diameterMm": 20, "wallId": "A", "positionMm": 500, "heightMm": 500}]
    got = by_label(_plumbing_lines(room(plumbing=PLUMBING + bad), {}))
    assert got["Ish: nuqtani ulash"].qty == 8
    assert got["Suv rozetkasi Ø20"].qty == 5
