"""A fixture's own parts in the estimate (2026-11-13): its mixer, its trap and its hoses, by the piece,
from a tagged shop product or else the norm; and the work of fitting each mixer."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.smeta import EXTRAS_NORM_NOTE, _plumbing_lines
from app.services.smeta_keys import ALL_SMETA_KEYS, KEY_SALE_UNIT, smeta_key_problem
from app.services.smeta_text import localize_formula, localize_label

GEOMETRY = {"walls": [
    {"id": "A", "length": 2.5, "elements": []}, {"id": "B", "length": 2.0, "elements": []},
    {"id": "C", "length": 2.5, "elements": []},
    {"id": "D", "length": 2.0, "elements": [{"type": "eshik", "width": 0.7, "position": 0.5}]},
]}

MIXER = {
    "sink": "Rakovina smesiteli", "kitchen": "Oshxona smesiteli", "bathtub": "Vanna va dush smesiteli",
    "shower": "Dush smesiteli", "bidet": "Gigiyenik smesitel",
}
TRAP = {
    "sink": "Rakovina sifoni", "kitchen": "Oshxona sifoni", "bathtub": "Vanna sifoni", "shower": "Dush poddoni sifoni",
}
GOFRA = "Unitaz gofrasi"
HOSE = "Ulash shlangi (podvodka)"
WORK = "Ish: smesitel o'rnatish"
PART_LABELS = [*MIXER.values(), *TRAP.values(), GOFRA, HOSE, WORK]


def piece(name: str, i: int = 0) -> dict:
    return {"id": f"f{i}-{name}", "furniture_id": f"slug-{name}", "name": name, "x": 0, "y": 0, "rotation": 0}


def room(*names: str, room_type: str = "hammom") -> SimpleNamespace:
    return SimpleNamespace(
        state={"furniture": [piece(n, i) for i, n in enumerate(names)], "plumbing": []}, geometry=GEOMETRY,
        room_type=room_type, name="Hammom" if room_type == "hammom" else "Oshxona",
    )


def base(label: str) -> str:
    """A line's label without a shop product's name after it."""
    return label if label in PART_LABELS else label.split(":")[0]


def parts(r, catalog=None) -> dict:
    return {base(ln.label): ln for ln in _plumbing_lines(r, catalog or {}) if base(ln.label) in PART_LABELS}


def test_a_bathroom_sink_brings_its_mixer_trap_two_hoses_and_the_mixer_work():
    got = parts(room("Rakovina 3"))
    assert {k: v.qty for k, v in got.items()} == {MIXER["sink"]: 1, TRAP["sink"]: 1, HOSE: 2, WORK: 1}


def test_a_kitchen_sink_takes_the_kitchen_mixer_and_trap():
    got = parts(room("Moyka 1", room_type="oshxona"))
    assert {k: v.qty for k, v in got.items()} == {MIXER["kitchen"]: 1, TRAP["kitchen"]: 1, HOSE: 2, WORK: 1}


def test_a_bathtub_takes_a_bath_and_shower_mixer_and_its_trap_no_hose():
    got = parts(room("Vanna 1"))
    assert {k: v.qty for k, v in got.items()} == {MIXER["bathtub"]: 1, TRAP["bathtub"]: 1, WORK: 1}


def test_a_shower_tray_takes_a_shower_mixer_and_its_trap():
    got = parts(room("Dush poddoni 90"))
    assert {k: v.qty for k, v in got.items()} == {MIXER["shower"]: 1, TRAP["shower"]: 1, WORK: 1}


@pytest.mark.parametrize("name", ["Dush kabinasi 90x90", "Душевая кабина Niagara", "Dush paneli termostatli", "Shower cabin"])
def test_a_shower_cabin_or_panel_has_its_own_mixer_only_the_trap_is_added(name):
    got = parts(room(name))
    assert {k: v.qty for k, v in got.items()} == {TRAP["shower"]: 1}


def test_a_toilet_takes_its_gofra_and_one_hose_no_mixer():
    got = parts(room("Unitaz kompakt"))
    assert {k: v.qty for k, v in got.items()} == {GOFRA: 1, HOSE: 1}


def test_a_bidet_takes_a_hygiene_mixer_a_sink_trap_and_two_hoses():
    got = parts(room("Bide osma"))
    assert {k: v.qty for k, v in got.items()} == {MIXER["bidet"]: 1, TRAP["sink"]: 1, HOSE: 2, WORK: 1}


def test_counts_add_up_and_the_formula_says_what_from():
    got = parts(room("Rakovina 3", "Rakovina 3", "Unitaz kompakt", "Bide osma"))
    assert got[TRAP["sink"]].qty == 3
    assert got[TRAP["sink"]].formula == "2 rakovina + 1 bide = 3 dona × 60 000 so'm"
    assert got[HOSE].qty == 2 * 2 + 1 + 2
    assert got[HOSE].formula == "2 rakovina + 1 unitaz + 1 bide = 7 dona × 25 000 so'm"
    assert got[WORK].qty == 3 and got[WORK].formula == "3 smesitel × 100 000 so'm"


def test_with_no_shop_product_the_norm_prices_it_marked_approximate():
    line = parts(room("Rakovina 3"))[MIXER["sink"]]
    assert (line.unit_price_uzs, line.is_approximate, line.warning) == (450_000, True, EXTRAS_NORM_NOTE)
    assert line.category == "santexnika"


def test_a_tagged_shop_product_gives_its_price_name_and_shop():
    shop = SimpleNamespace(id=uuid.uuid4(), name_uz="Grohe Eurosmart", unit="dona", price_uzs=1_250_000, pack_qty=None, pack_unit=None,
                           smeta_key="smesitel_rakovina", is_active=True, store=SimpleNamespace(name="Santex Pro"))
    lines = {ln.label: ln for ln in _plumbing_lines(room("Rakovina 3"), {"smesitel_rakovina": shop})}
    line = lines["Rakovina smesiteli: Grohe Eurosmart"]
    assert (line.unit_price_uzs, line.store_name, line.is_approximate, line.warning) == (1_250_000, "Santex Pro", False, None)
    assert line.formula == "1 rakovina = 1 dona × 1 250 000 so'm"


def test_a_room_with_no_fixtures_gets_no_parts():
    assert parts(room()) == {}
    assert parts(room("Divan")) == {}


def test_the_new_keys_are_sold_by_the_piece():
    for key in ("smesitel_rakovina", "smesitel_oshxona", "smesitel_vanna", "smesitel_dush", "smesitel_bide",
                "sifon_rakovina", "sifon_oshxona", "sifon_vanna", "sifon_dush", "gofra_unitaz", "podvodka"):
        assert key in ALL_SMETA_KEYS and KEY_SALE_UNIT[key] == "dona"
        assert smeta_key_problem(key, "dona", None, None) is None
        assert smeta_key_problem(key, "m", None, None) is not None


@pytest.mark.parametrize("label", PART_LABELS)
def test_every_new_label_reads_in_russian_and_english(label):
    assert localize_label(label, "ru") != label
    assert localize_label(label, "en") != label
    assert localize_label(f"{label}: Grohe", "en").endswith(": Grohe") or label == WORK


@pytest.mark.parametrize("formula,ru,en", [
    ("2 rakovina + 1 bide = 3 dona × 60 000 so'm", "2 раковины + 1 биде = 3 шт. × 60 000 сум", "2 sinks + 1 bidet = 3 pcs × 60 000 UZS"),
    ("1 vanna + 1 dush = 2 dona × 650 000 so'm", "1 ванна + 1 душ = 2 шт. × 650 000 сум", "1 bathtub + 1 shower = 2 pcs × 650 000 UZS"),
    ("3 smesitel × 100 000 so'm", "3 смесителя × 100 000 сум", "3 mixers × 100 000 UZS"),
])
def test_the_formula_words_read_in_russian_and_english(formula, ru, en):
    assert localize_formula(formula, "ru") == ru
    assert localize_formula(formula, "en") == en
