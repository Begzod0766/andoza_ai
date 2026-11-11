"""The estimate PDF in the reader's language: the route picks it, the PDF's text follows it,
and the font can draw Cyrillic."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from reportlab.platypus import Paragraph, Table

from app.routers import estimate as router
from app.services.smeta import ComputedEstimate, ComputedLine
from tests.test_estimate_router import _Result, _as, _db, _material, _norm, _room, _user, client  # noqa: F401


def _line(**kw) -> ComputedLine:
    defaults = dict(
        label="Suvoq (gips) 30 kg qop",
        formula="34.7 m² × 8.5 kg/m² = 295.1 kg → 13 qop",
        qty=13, unit="qop", unit_price_uzs=65_000, subtotal_uzs=845_000, category="suvoq",
        is_approximate=True,
        warning="Mahsulot tanlanmagan — do'kondagi o'rtacha narx olindi.",
        store_name="Stroy Master",
    )
    defaults.update(kw)
    return ComputedLine(**defaults)


def _estimate() -> ComputedEstimate:
    return ComputedEstimate(lines=[_line()], total_uzs=845_000, total_min=760_500, total_max=1_014_000,
                            total_approx_uzs=845_000)


def _story_text(lang: str) -> str:
    """Every string the PDF draws, in order: the paragraphs and the table cells."""
    parts: list[str] = []

    def walk(item) -> None:
        if isinstance(item, Paragraph):
            parts.append(item.text)
        elif isinstance(item, Table):
            for row in item._cellvalues:
                for cell in row:
                    walk(cell)
        elif isinstance(item, str):
            parts.append(item)

    for flowable in router._pdf_story(SimpleNamespace(name="Xona 1"), _estimate(), lang, router._FALLBACK_FONTS):
        walk(flowable)
    return "\n".join(parts)


class TestPdfText:
    def test_russian(self):
        text = _story_text("ru")
        for expected in ("Смета", "Материал / Услуга", "Формула", "Кол-во", "Цена (UZS)", "Итого (UZS)",
                         "Распределение расходов", "Подготовка стен", "Итого: Подготовка стен",
                         "Штукатурка (гипсовая), мешок 30 кг", "мешков",
                         "34.7 м² × 8.5 кг/м² = 295.1 кг → 13 мешков",
                         "Товар не выбран: взята средняя цена магазина.", "Магазин: Stroy Master",
                         "Ориентировочные расходы (итого):", "1 строка"):
            assert expected in text, expected
        assert "Material / Xizmat" not in text and "qop" not in text and "Taxminiy xarajat" not in text

    def test_english(self):
        text = _story_text("en")
        for expected in ("Estimate", "Material / Service", "Qty", "Unit", "Price (UZS)", "Total (UZS)",
                         "Cost breakdown", "Wall preparation", "Plaster (gypsum), 30 kg bag", "bags",
                         "34.7 m² × 8.5 kg/m² = 295.1 kg → 13 bags",
                         "No product is chosen: the shop's average price is used.", "Shop: Stroy Master",
                         "Estimated cost (total):", "1 line"):
            assert expected in text, expected

    def test_uzbek_is_the_stored_text_and_the_old_headers(self):
        text = _story_text("uz")
        for expected in ("Smeta", "Material / Xizmat", "Miqdor", "Narx (UZS)", "Jami (UZS)", "Xarajat taqsimoti",
                         "Jami: Devorni tayyorlash", "Suvoq (gips) 30 kg qop",
                         "34.7 m² × 8.5 kg/m² = 295.1 kg → 13 qop", "Do'kon: Stroy Master",
                         "Taxminiy xarajat (jami):", "1 ta qator"):
            assert expected in text, expected

    @pytest.mark.parametrize("lang", ["uz", "ru", "en"])
    def test_numbers_do_not_change(self, lang):
        text = _story_text(lang)
        for number in ("845 000", "65 000", "760 500", "1 014 000", "≈ 845 000"):
            assert number in text, (lang, number)


class TestRoutePicksTheLanguage:
    def _get(self, client, headers=None, user_language=None):
        mat = _material(price_uzs=25_000)
        room = _room(surfaces={"ALL": str(mat.id)})
        user = _user()
        user.language = user_language
        _as(user, _db(_Result(one=room), _Result(many=[]), _Result(many=[mat]), _Result(one=None),
                      _Result(many=[_norm()]), _Result(one=None)))
        with patch.object(router, "_build_pdf", return_value=b"%PDF-1.4 stub") as build:
            r = client.get(f"/api/v1/rooms/{room.id}/estimate/pdf", headers=headers or {})
        assert r.status_code == 200, r.text
        return build.call_args

    def test_russian_from_accept_language(self, client):
        assert self._get(client, {"Accept-Language": "ru"}).kwargs["lang"] == "ru"

    def test_english_from_accept_language(self, client):
        assert self._get(client, {"Accept-Language": "en-US,en;q=0.9"}).kwargs["lang"] == "en"

    def test_the_dotted_path_too(self, client):
        mat = _material(price_uzs=25_000)
        room = _room(surfaces={"ALL": str(mat.id)})
        _as(_user(), _db(_Result(one=room), _Result(many=[]), _Result(many=[mat]), _Result(one=None),
                         _Result(many=[_norm()]), _Result(one=None)))
        with patch.object(router, "_build_pdf", return_value=b"%PDF-1.4 stub") as build:
            r = client.get(f"/api/v1/rooms/{room.id}/estimate.pdf", headers={"Accept-Language": "ru"})
        assert r.status_code == 200 and build.call_args.kwargs["lang"] == "ru"

    def test_without_a_header_the_users_own_language(self, client):
        assert self._get(client, user_language="en").kwargs["lang"] == "en"

    def test_uzbek_by_default(self, client):
        assert self._get(client).kwargs["lang"] == "uz"
        assert self._get(client, {"Accept-Language": "de"}).kwargs["lang"] == "uz"


class TestCyrillicFont:
    def test_the_fallback_is_the_old_built_in_font(self):
        assert router._FALLBACK_FONTS == ("Helvetica", "Helvetica-Bold")

    def test_a_found_font_covers_cyrillic_and_is_embedded(self):
        from reportlab.pdfbase import pdfmetrics

        regular, bold = router._pdf_fonts()
        if regular == "Helvetica":
            pytest.skip("no TrueType font with Cyrillic on this machine (the Docker image installs DejaVu)")
        for name in (regular, bold):
            face = pdfmetrics.getFont(name).face
            assert all(ord(ch) in face.charToGlyph for ch in "СметаШтукатуркамешков"), name
        pdf = router._build_pdf(SimpleNamespace(name="Комната"), _estimate(), lang="ru")
        assert pdf.startswith(b"%PDF") and b"/FontFile2" in pdf  # a TrueType font is embedded

    def test_no_font_on_disk_falls_back_without_failing(self, monkeypatch):
        monkeypatch.setattr(router, "_FONT_CANDIDATES", ())
        router._pdf_fonts.cache_clear()
        try:
            assert router._pdf_fonts() == router._FALLBACK_FONTS
            assert router._build_pdf(SimpleNamespace(name="Xona"), _estimate(), lang="en").startswith(b"%PDF")
        finally:
            router._pdf_fonts.cache_clear()


# ─── Quantities and units in the lines table (mobile QA 2026-11-11 #5, #6) ───

@pytest.mark.parametrize(("qty", "shown"), [
    (29.92, "29.92"), (5.94, "5.94"), (15.27, "15.27"), (2.9, "2.9"), (13, "13"), (13.0, "13"),
    (1234.5, "1 234.5"), (0.4, "0.4"), (7.999, "8"), (2.004, "2"),
])
def test_a_quantity_keeps_its_decimals(qty, shown):
    """The PDF cut 29.92 m to "29": the table disagreed with its own formula and total."""
    assert router._fmt_qty(qty) == shown


def test_the_lines_table_shows_the_quantity_the_formula_ends_in():
    est = ComputedEstimate(
        lines=[_line(label="Suv quvuri PPR Ø20", formula="2 nuqta: 13 + 13.02 m × 1.15 = 29.92 m", qty=29.92, unit="m",
                     unit_price_uzs=9_000, subtotal_uzs=269_280, category="santexnika", is_approximate=False, warning=None, store_name=None)],
        total_uzs=269_280, total_min=242_352, total_max=323_136, total_approx_uzs=0,
    )
    story = router._pdf_story(_room(), est, "en", router._pdf_fonts())
    cells = [c for item in story if isinstance(item, Table) for row in item._cellvalues for c in row if isinstance(c, str)]
    assert "29.92" in cells and "29" not in cells


def test_every_unit_fits_its_column_in_every_language():
    """«комплектов» ran over the quantity beside it in the Russian PDF."""
    from reportlab.pdfbase.pdfmetrics import stringWidth

    from app.services.smeta_text import _COUNTED_UNITS, _MEASURE_UNITS, localize_unit

    font, _bold = router._pdf_fonts()
    room_pt = router._PDF_COL_WIDTHS[3] - 12   # reportlab's 6 pt of padding each side
    for lang in ("uz", "ru", "en"):
        for unit in [*_COUNTED_UNITS, *_MEASURE_UNITS]:
            for qty in (1, 2, 5, 13, 21):
                text = localize_unit(unit, qty, lang)
                assert stringWidth(text, font, 8) <= room_pt, (lang, text)
    assert sum(router._PDF_COL_WIDTHS) == pytest.approx(17 * 28.3465, abs=0.5)
