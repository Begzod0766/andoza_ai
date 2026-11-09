"""The estimate's "Santexnika" section (spec 2026-11-08): the fixtures, the pipes to the riser, the
fittings and the plumber's work, all under category "santexnika"."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.plumbing import load_plumbing_norms, pipe_run_m, riser_spot
from app.services.smeta import _furniture_lines, _plumbing_lines, _round2
from app.services.smeta_text import localize_label

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
    {"id": "sofa", "furniture_id": "divan-1", "name": "Divan"},
]


def _pt(fixture, kind, wall, pos, h, d):
    return {"id": f"{fixture}:{kind}", "kind": kind, "diameterMm": d, "wallId": wall, "positionMm": pos, "heightMm": h, "fixtureId": fixture}


PLUMBING = [
    _pt("tub", "drain", "A", 1250, 150, 50), _pt("tub", "cold", "A", 1150, 700, 20), _pt("tub", "hot", "A", 1350, 700, 20),
    _pt("wc", "drain", "B", 1000, 200, 110), _pt("wc", "cold", "B", 900, 200, 20),
    _pt("sink", "drain", "C", 800, 500, 50), _pt("sink", "cold", "C", 700, 550, 20), _pt("sink", "hot", "C", 900, 550, 20),
]


def _room(plumbing=PLUMBING):
    state = {"furniture": FURNITURE}
    if plumbing is not None:
        state["plumbing"] = plumbing
    return SimpleNamespace(state=state, geometry=GEOMETRY)


def _runs(pred):
    riser = riser_spot(GEOMETRY, None)
    return _round2(sum(pipe_run_m(GEOMETRY, p, riser) for p in PLUMBING if pred(p)) * 1.15)


def _by_label(lines):
    return {ln.label: ln for ln in lines}


def test_fixtures_are_listed_under_santexnika_not_jihoz():
    jihoz = {ln.label for ln in _furniture_lines(_room())}
    assert jihoz == {"Jihoz: Divan"}
    lines = _by_label(_plumbing_lines(_room()))
    for name in ("Vanna Roca 170", "Unitaz Cersanit", "Rakovina 50"):
        assert lines[f"Santexnika: {name}"].category == "santexnika"
    assert all(ln.category == "santexnika" for ln in lines.values())


def test_pipe_metres_are_the_runs_to_the_riser_with_the_reserve():
    lines = _by_label(_plumbing_lines(_room()))
    assert lines["Kanalizatsiya quvuri Ø50"].qty == pytest.approx(_runs(lambda p: p["kind"] == "drain" and p["diameterMm"] == 50))
    assert lines["Kanalizatsiya quvuri Ø110"].qty == pytest.approx(_runs(lambda p: p["diameterMm"] == 110))
    assert lines["Suv quvuri PPR Ø20"].qty == pytest.approx(_runs(lambda p: p["kind"] != "drain"))
    assert lines["Kanalizatsiya quvuri Ø50"].unit == "m"
    assert "× 1.15" in lines["Kanalizatsiya quvuri Ø50"].formula


def test_fittings_and_work_follow_the_points_and_fixtures():
    norms = load_plumbing_norms()
    lines = _by_label(_plumbing_lines(_room()))
    assert lines["Fitinglar"].qty == 8 and lines["Fitinglar"].unit_price_uzs == norms["fitting_set_uzs"]
    assert lines["Ish: nuqtani ulash"].qty == 8
    assert lines["Ish: nuqtani ulash"].subtotal_uzs == 8 * norms["work_point_uzs"]
    work = norms["work_fixture_uzs"]
    assert lines["Ish: vanna o'rnatish"].subtotal_uzs == work["bathtub"]
    assert lines["Ish: unitaz o'rnatish"].subtotal_uzs == work["toilet"]
    assert lines["Ish: rakovina o'rnatish"].subtotal_uzs == work["sink"]


def test_without_a_shop_pipe_the_norm_price_is_used_and_flagged():
    norms = load_plumbing_norms()
    line = _by_label(_plumbing_lines(_room()))["Kanalizatsiya quvuri Ø110"]
    assert line.is_approximate is True and line.unit_price_uzs == norms["pipe_m_uzs"]["drain_110"]
    assert line.warning


def test_a_shop_pipe_gives_its_price_and_name():
    pipe = SimpleNamespace(id=uuid.uuid4(), name_uz="Kanalizatsiya quvuri Ø50 Valtec", price_uzs=21000, unit="m",
                           pack_qty=None, pack_unit=None, store=SimpleNamespace(name="Santex Plaza"))
    lines = _plumbing_lines(_room(), {"pipe:drain_50": pipe})
    line = next(ln for ln in lines if ln.label.startswith("Kanalizatsiya quvuri Ø50"))
    assert line.label == "Kanalizatsiya quvuri Ø50: Kanalizatsiya quvuri Ø50 Valtec"
    assert line.unit_price_uzs == 21000 and line.store_name == "Santex Plaza" and line.is_approximate is False


def test_a_room_saved_before_plumbing_lists_its_fixtures_and_no_pipes():
    labels = {ln.label for ln in _plumbing_lines(_room(plumbing=None))}
    assert "Santexnika: Vanna Roca 170" in labels
    assert not any("quvuri" in label or label == "Fitinglar" for label in labels)


def test_a_room_with_no_fixtures_and_no_points_has_no_section():
    assert _plumbing_lines(SimpleNamespace(state={"furniture": [FURNITURE[3]]}, geometry=GEOMETRY)) == []


@pytest.mark.parametrize("label,ru,en", [
    ("Santexnika: Vanna Roca 170", "Сантехника: Ванна Roca 170", "Plumbing: Bathtub Roca 170"),
    ("Santexnika: Rakovina 3", "Сантехника: Раковина 3", "Plumbing: Sink 3"),
    ("Santexnika: Divan Milano", "Сантехника: Divan Milano", "Plumbing: Divan Milano"),
    ("Kanalizatsiya quvuri Ø50", "Канализационная труба Ø50", "Drain pipe Ø50"),
    ("Suv quvuri PPR Ø20", "Водопроводная труба PPR Ø20", "PPR water pipe Ø20"),
    ("Fitinglar", "Фитинги", "Fittings"),
    ("Ish: nuqtani ulash", "Работа: подключение точки", "Work: connecting a point"),
    ("Ish: vanna o'rnatish", "Работа: установка ванны", "Work: installing the bathtub"),
])
def test_labels_are_translated(label, ru, en):
    assert localize_label(label, "ru") == ru
    assert localize_label(label, "en") == en


def _mat(name, price, unit="m", active=True, category="santexnika", pack_qty=None, pack_unit=None):
    return SimpleNamespace(id=uuid.uuid4(), name_uz=name, price_uzs=price, unit=unit, is_active=active,
                           category=category, pack_qty=pack_qty, pack_unit=pack_unit, smeta_key=None)


def test_the_shop_pipes_are_found_by_name_cheapest_per_metre():
    from app.services.estimate_catalog import pick_pipes
    rows = [
        _mat("Kanalizatsiya quvuri Ø50 1 m", 20000), _mat("Труба канализационная 50 мм", 17000),
        _mat("Kanalizatsiya quvuri Ø110", 45000), _mat("PPR quvur 20 mm", 9500),
        _mat("PPR quvur 20 mm 4 m", 32000, unit="dona", pack_qty=4, pack_unit="m"),
        _mat("Kanalizatsiya quvuri Ø50 eski", 1000, active=False), _mat("Unitaz", 900000, unit="dona"),
        _mat("Kabel Ø50", 100, category="elektr_mat"),
    ]
    pipes = pick_pipes(rows)
    assert pipes["pipe:drain_50"].name_uz == "Труба канализационная 50 мм"
    assert pipes["pipe:drain_110"].name_uz == "Kanalizatsiya quvuri Ø110"
    assert pipes["pipe:water_20"].name_uz == "PPR quvur 20 mm 4 m"  # 8 000 a metre


def test_the_riser_the_studio_saved_is_the_one_the_estimate_measures_from():
    room = _room()
    room.state["plumbingRiser"] = {"wallId": "B", "positionMm": 2000}
    line = _by_label(_plumbing_lines(room))["Kanalizatsiya quvuri Ø110"]
    wc = next(p for p in PLUMBING if p["diameterMm"] == 110)
    assert line.qty == pytest.approx(_round2(pipe_run_m(GEOMETRY, wc, ("B", 2000)) * 1.15))
    room.state["plumbingRiser"] = {"wallId": "nope", "positionMm": 5}  # a wall the room no longer has
    line = _by_label(_plumbing_lines(room))["Kanalizatsiya quvuri Ø110"]
    assert line.qty == pytest.approx(_runs(lambda p: p["diameterMm"] == 110))


def test_a_point_whose_fixture_is_gone_is_not_priced():
    orphan = _pt("gone", "drain", "A", 500, 200, 110)
    lines = _by_label(_plumbing_lines(_room(plumbing=PLUMBING + [orphan])))
    assert lines["Fitinglar"].qty == 8
    assert lines["Kanalizatsiya quvuri Ø110"].qty == pytest.approx(_runs(lambda p: p["diameterMm"] == 110))


def test_the_formula_and_warning_read_in_english():
    from app.services.smeta_text import localize_formula, localize_warning
    assert localize_formula("3 nuqta: 3.4 + 4.05 + 3.25 m × 1.15 = 12.3 m", "en") == "3 points: 3.4 + 4.05 + 3.25 m × 1.15 = 12.3 m"
    assert localize_warning("Narx taxminiy — do'konda bu quvur topilmadi, o'rtacha narx olindi.", "en") == \
        "Approximate price — the shop has no such pipe, an average price was used."


def test_uzbek_fixture_names_stay_as_they_are():
    assert localize_label("Santexnika: Rakovina 3", "uz") == "Santexnika: Rakovina 3"


# ─── Deferred review minors (2026-11-09) ───────────────────────────────────────

def test_fittings_are_an_average_price_and_say_so():
    line = _by_label(_plumbing_lines(_room()))["Fitinglar"]
    assert line.is_approximate is True and line.warning


def test_shop_pipe_names_do_not_match_a_bigger_size_or_the_wrong_kind():
    from app.services.estimate_catalog import pick_pipes
    pipes = pick_pipes([
        _mat("Kanalizatsiya quvuri Ø500", 1000), _mat("Труба d1100", 1000),  # not 50 / 110
        _mat("PPR quvur Ø50", 1000),  # a 50 mm PPR water pipe is not a drain
        _mat("PPR Ø25 PN 20", 1000),  # a 25 mm pipe rated PN 20 is not a Ø20
    ])
    assert pipes == {}
    pipes = pick_pipes([_mat("PPR quvur Ø20 PN20", 9000), _mat("Kanalizatsiya Ø50", 18000), _mat("Труба ф110", 40000)])
    assert set(pipes) == {"pipe:water_20", "pipe:drain_50", "pipe:drain_110"}


def test_a_room_with_points_but_no_walls_has_no_negative_run():
    assert pipe_run_m({"walls": []}, {"wallId": "A", "positionMm": 500, "heightMm": 700}, ("A", 0.0)) == 0.7


def test_the_reserve_rounds_half_up_like_the_studio():
    from app.services.smeta import _round2
    # JS Math.round(x * 100) / 100: an exact half goes up (Python round(0.125, 2) gives 0.12)
    assert _round2(0.125) == 0.13 and _round2(0.375) == 0.38
