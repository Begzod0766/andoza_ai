"""The estimate's line text in uz/ru/en for the PDF (app.services.smeta_text).

The cases are frontend/src/lib/__tests__/smetaLineText.test.ts's, so the PDF and the web page
read the same; the last class pins the copied vocabulary to the frontend's locale files.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from app.services import smeta_text as st
from app.services.smeta_text import localize_formula, localize_label, localize_unit, localize_warning


class TestLabel:
    def test_translates_the_lines_name_and_keeps_the_shops_own_product_name(self):
        assert localize_label("Suvoq: VENTUM Гипсовая штукатурка (30 kg)", "en") == "Plaster: VENTUM Гипсовая штукатурка (30 kg)"
        assert localize_label("Grunt: Ceresit CT 17 (10 kg)", "en") == "Primer: Ceresit CT 17 (10 kg)"
        assert localize_label("Shpatlyovka: Knauf HP Start", "en") == "Putty: Knauf HP Start"
        assert localize_label("Bo'yoq: Dulux oq", "en") == "Paint: Dulux oq"
        assert localize_label("Suvoq: VENTUM", "ru") == "Штукатурка: VENTUM"
        assert localize_label("Bo'yoq: Dulux oq", "ru") == "Краска: Dulux oq"

    def test_translates_the_lines_the_estimate_names_on_its_own(self):
        assert localize_label("Suvoq (gips) 30 kg qop", "en") == "Plaster (gypsum), 30 kg bag"
        assert localize_label("Grunt (asosiy qatlam) 10 kg qop", "en") == "Primer (base coat), 10 kg bag"
        assert localize_label("Shpatlyovka 25 kg qop", "en") == "Putty, 25 kg bag"
        assert localize_label("Plintus (2.5 m dona)", "en") == "Skirting board (2.5 m piece)"
        assert localize_label("Oboy devor A: Erismann 1234", "en") == "Wallpaper, wall A: Erismann 1234"
        assert localize_label("Elektr kabel (taxminiy)", "en") == "Electrical cable (approximate)"
        assert localize_label("Bo'yoq: Bo'yoq (material tanlanmagan)", "en") == "Paint: Paint (no product chosen)"
        assert localize_label("Chiroq: Osma chiroq", "en") == "Light fixture: Pendant light"
        assert localize_label("Suvoq (gips) 30 kg qop", "ru") == "Штукатурка (гипсовая), мешок 30 кг"

    def test_leaves_uzbek_and_a_label_it_does_not_know_as_they_are(self):
        assert localize_label("Suvoq (gips) 30 kg qop", "uz") == "Suvoq (gips) 30 kg qop"
        assert localize_label("Suvoq: VENTUM", "uz") == "Suvoq: VENTUM"
        assert localize_label("Noma'lum ish", "en") == "Noma'lum ish"


class TestUnit:
    def test_names_the_unit_by_the_quantity(self):
        assert localize_unit("qop", 13, "en") == "bags"
        assert localize_unit("qop", 1, "en") == "bag"
        assert localize_unit("qop", 13, "ru") == "мешков"
        assert localize_unit("qop", 13, "uz") == "qop"
        assert localize_unit("dona", 4, "en") == "pcs"
        assert localize_unit("litr", 4, "en") == "L"
        assert localize_unit("rulon", 3, "en") == "rolls"
        assert localize_unit("quti", 2, "ru") == "коробки"
        assert localize_unit("m²", 12.5, "en") == "m²"
        assert localize_unit("to‘plam", 1, "en") == "to‘plam"

    @pytest.mark.parametrize("n, form", [(1, "рулон"), (21, "рулон"), (11, "рулонов"), (2, "рулона"),
                                         (4, "рулона"), (12, "рулонов"), (5, "рулонов"), (2.5, "рулона")])
    def test_russian_one_few_many(self, n, form):
        assert localize_unit("rulon", n, "ru") == form


class TestWarning:
    def test_translates_each_known_sentence_also_when_two_are_joined(self):
        assert localize_warning(
            "Mahsulot tanlanmagan — do'kondagi o'rtacha narx olindi. Aniq narx uchun o'zingiz mahsulot tanlang.", "en",
        ) == "No product is chosen: the shop's average price is used. Choose a product for an exact price."
        assert localize_warning(
            "Taxminiy hisob — karkas miqdorini ustaga tasdiqlang. Bu qism uchun aniq norma topilmadi — standart ko'rsatkich bo'yicha hisoblandi.", "en",
        ) == ("Approximate: confirm the amount of framing with a craftsman. No exact norm was found for this part: "
              "it is calculated with the standard rate.")
        assert localize_warning("Mahsulot tanlanmagan — do'kondagi o'rtacha narx olindi.", "ru") == (
            "Товар не выбран: взята средняя цена магазина.")
        assert localize_warning("Something the estimate never says", "en") == "Something the estimate never says"
        assert localize_warning("Mahsulot tanlanmagan — do'kondagi o'rtacha narx olindi.", "uz") == (
            "Mahsulot tanlanmagan — do'kondagi o'rtacha narx olindi.")


# Every formula shape smeta.py writes, as it is stored in a saved estimate.
FORMULAS = [
    "34.7 m² × 8.5 kg/m² = 295.1 kg → 13 qop",
    "11.5 m² (devor 2) × 2 qatlam ÷ 9.0 m²/litr = 3 litr",
    "20.0 m² (devor 1, 3) × 2 qatlam ÷ 9.0 m²/litr = 5 litr",
    "Devor 0: 5.50 m × 1.10 (isrof) ÷ 1.06 m = 6 polosa; 1 rulon (10 m) = 4 polosa → 2 rulon",
    "Devor A: 4.00 m × 1.10 (isrof) ÷ 1.06 m = 5 polosa; 1 rulon = 3 polosa → 2 rulon (teshiklar 1.89 m² polosaga ta'sir qilmaydi)",
    "16.22 m² × 1.07 (chiqindi) = 17.36 m² ÷ 2.13 m²/quti = 9 quti",
    "16.22 m² × 1.07 (chiqindi) = 17.36 m² ÷ 2.13 m²/quti = 9 quti = 19.17 m²",
    "Perimetr 16.90 m − eshiklar 1.54 m = 15.36 m → 7 dona",
    "Perimetr 16.90 m × 2 (yuqori/pastki karkas) = 34 m",
    "Perimetr 16.90 m ≈ 17 m lenta",
    "Perimetr 16.90 m ÷ 2 m → 9 dona",
    "12.0 m² × 1.10 (chiqindi) ÷ 3.0 m²/list = 5 list",
    "6 nuqta × 2.5 m × 1.15 (zaxira) = 18 m",
    "Joylashtirilgan sxema bo'yicha o'lchangan (12.34 m, zaxira bilan) = 13 m",
    "8.4 m² (devor B) — o'lchamiga qarab chop etiladi",
    "2 dona × 250 000 so'm",
]


class TestFormula:
    def test_translates_words_and_units_and_leaves_every_number(self):
        en = [localize_formula(f, "en") for f in FORMULAS]
        assert en[0] == "34.7 m² × 8.5 kg/m² = 295.1 kg → 13 bags"
        assert en[1] == "11.5 m² (wall 2) × 2 coats ÷ 9.0 m²/L = 3 L"
        assert en[2] == "20.0 m² (walls 1, 3) × 2 coats ÷ 9.0 m²/L = 5 L"
        assert en[3] == "Wall 0: 5.50 m × 1.10 (waste) ÷ 1.06 m = 6 strips; 1 roll (10 m) = 4 strips → 2 rolls"
        assert en[4] == ("Wall A: 4.00 m × 1.10 (waste) ÷ 1.06 m = 5 strips; 1 roll = 3 strips → 2 rolls "
                         "(openings of 1.89 m² do not change the strip count)")
        assert en[5] == "16.22 m² × 1.07 (waste) = 17.36 m² ÷ 2.13 m²/box = 9 boxes"
        assert en[7] == "Perimeter 16.90 m − doors 1.54 m = 15.36 m → 7 pcs"
        assert en[8] == "Perimeter 16.90 m × 2 (top and bottom frame) = 34 m"
        assert en[9] == "Perimeter 16.90 m ≈ 17 m of strip"
        assert en[11] == "12.0 m² × 1.10 (waste) ÷ 3.0 m²/sheet = 5 sheets"
        assert en[12] == "6 points × 2.5 m × 1.15 (reserve) = 18 m"
        assert en[13] == "Measured off the placed wiring plan (12.34 m, reserve included) = 13 m"
        assert en[14] == "8.4 m² (wall B) — printed to size"
        assert en[15] == "2 pcs × 250 000 UZS"

    def test_speaks_russian_with_russian_plurals_and_units(self):
        assert localize_formula(FORMULAS[0], "ru") == "34.7 м² × 8.5 кг/м² = 295.1 кг → 13 мешков"
        assert localize_formula(FORMULAS[1], "ru") == "11.5 м² (стена 2) × 2 слоя ÷ 9.0 м²/л = 3 л"
        assert localize_formula(FORMULAS[3], "ru") == (
            "Стена 0: 5.50 м × 1.10 (отходы) ÷ 1.06 м = 6 полос; 1 рулон (10 м) = 4 полосы → 2 рулона")
        assert localize_formula(FORMULAS[7], "ru") == "Периметр 16.90 м − двери 1.54 м = 15.36 м → 7 шт."

    def test_leaves_no_uzbek_formula_word_in_english_or_russian(self):
        uzbek = re.compile(
            r"(^|[^\w'])(qop|dona|rulon|quti|list|litr|polosa|qatlam|nuqta|devor|Devor|isrof|chiqindi|zaxira|"
            r"Perimetr|eshiklar|yuqori|pastki|karkas|lenta|teshiklar|o'lchangan|chop|so'm)(?![^\W\d_]|')"
        )
        for formula in FORMULAS:
            assert not uzbek.search(localize_formula(formula, "en")), formula
            assert not uzbek.search(localize_formula(formula, "ru")), formula

    def test_the_numbers_are_the_stored_ones(self):
        number = re.compile(r"[0-9]+(?:[.,][0-9]+)?")
        for formula in FORMULAS:
            for lang in ("ru", "en"):
                assert number.findall(localize_formula(formula, lang)) == number.findall(formula)

    def test_leaves_uzbek_and_an_unknown_formula_exactly_as_stored(self):
        for formula in FORMULAS:
            assert localize_formula(formula, "uz") == formula
        assert localize_formula("Something new from the server", "en") == "Something new from the server"

    def test_an_unknown_language_reads_as_uzbek(self):
        assert localize_formula(FORMULAS[0], "de") == FORMULAS[0]
        assert localize_label("Suvoq: VENTUM", None) == "Suvoq: VENTUM"


class TestPdfText:
    def test_every_fixed_text_has_all_three_languages(self):
        for key, by_lang in st.PDF_TEXT.items():
            assert set(by_lang) == set(st.LANGUAGES), key
            assert all(by_lang.values()), key

    def test_picks_the_language_and_falls_back_to_uzbek(self):
        assert st.pdf_text("col_item", "ru") == "Материал / Услуга"
        assert st.pdf_text("col_item", "xx") == "Material / Xizmat"
        assert st.pdf_text("group_total", "en", group="Ceiling") == "Total: Ceiling"


_FRONTEND_LOCALES = Path(__file__).resolve().parents[2] / "frontend" / "src" / "i18n" / "locales"


@pytest.mark.skipif(not _FRONTEND_LOCALES.is_dir(), reason="the frontend is not checked out next to the backend")
class TestSameVocabularyAsTheWebPage:
    def test_the_copied_locale_part_equals_the_frontends(self):
        shipped = json.loads(st._LOCALE_PATH.read_text(encoding="utf-8"))
        for lang in st.LANGUAGES:
            frontend = json.loads((_FRONTEND_LOCALES / f"{lang}.json").read_text(encoding="utf-8"))
            assert shipped[lang] == st.extract_locale(frontend), (
                f"backend/app/services/smeta_locale.json is out of date for {lang}: run "
                "`python -m app.services.smeta_text ../frontend/src/i18n/locales` from backend/"
            )
