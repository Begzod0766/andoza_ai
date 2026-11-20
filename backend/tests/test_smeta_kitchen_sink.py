"""A kitchen sink on a wall (kitchen QA 2026-11-18 K1): the catalog sells none, so it stands on a wall
like the machines. Its mixer, trap and hoses, the work to connect it, and its three points are priced;
the sink itself is the kitchen set's, as a machine is not priced."""
from __future__ import annotations

from types import SimpleNamespace

from app.services.smeta import _plumbing_lines

GEOMETRY = {"walls": [
    {"id": "A", "length": 3.5, "elements": []}, {"id": "B", "length": 3.0, "elements": []},
    {"id": "C", "length": 3.5, "elements": []}, {"id": "D", "length": 3.0, "elements": []},
]}
SINK = {"id": "s1", "wallId": "A", "positionMm": 1750, "kind": "kitchen_sink"}


def by_label(washers):
    room = SimpleNamespace(state={"furniture": [], "plumbing": [], "washers": washers}, geometry=GEOMETRY,
                           room_type="oshxona", name="Oshxona")
    return {ln.label: ln for ln in _plumbing_lines(room, {})}


def test_a_kitchen_sink_brings_its_mixer_trap_hoses_and_work():
    got = by_label([SINK])
    assert got["Oshxona smesiteli"].qty == 1
    assert got["Oshxona sifoni"].qty == 1
    assert got["Ulash shlangi (podvodka)"].qty == 2
    assert got["Ish: moyka o'rnatish"].qty == 1


def test_its_three_points_are_in_the_pipes():
    assert by_label([SINK])["Ish: nuqtani ulash"].qty == 3


def test_it_is_not_a_washing_machine():
    got = by_label([SINK])
    assert not any(k.startswith("Kir yuvish mashinasi") or "kir yuvish" in k for k in got)


def test_its_parts_are_counted_by_the_sink_it_is_mobile_qa_338():
    """#338 3: a kitchen sink's parts read "1 раковина" (a basin); a kitchen's is "мойка"."""
    from app.services.smeta_text import localize_formula
    formula = by_label([SINK])["Oshxona smesiteli"].formula
    assert "1 moyka" in formula and "rakovina" not in formula
    assert "1 мойка" in localize_formula(formula, "ru")
    assert "1 sink" in localize_formula(formula, "en")


def test_in_a_kitchen_the_work_and_the_silicone_name_the_sink_kitchen_recheck_r3():
    """Kitchen re-check 2026-11-19 R3: "Работа: установка раковины" and "1 раковина" in a kitchen."""
    from app.services.smeta_text import localize_formula, localize_label
    got = by_label([SINK])
    assert "Ish: rakovina o'rnatish" not in got
    work = got["Ish: moyka o'rnatish"]
    assert work.qty == 1
    assert localize_label(work.label, "ru") == "Работа: установка мойки"
    assert localize_label(work.label, "en") == "Work: installing the kitchen sink"
    silicone = got["Sanitariya silikoni"]
    assert "moyka" in silicone.formula and "rakovina" not in silicone.formula
    assert "1 мойка" in localize_formula(silicone.formula, "ru")
