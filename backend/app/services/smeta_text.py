"""The estimate's text in the reader's language, for the PDF.

``app.services.smeta`` writes every line's label, unit, warning and formula in Uzbek and the
saved estimate keeps them so. The web page translates them in
``frontend/src/lib/smetaLineText.ts``; this module is the same code for the PDF, which the
backend draws itself (the PDF route recomputes the estimate, so there is no page text to send).

One vocabulary, not two: the words come from the frontend's own locale files. ``smeta_locale.json``
next to this module is the part of ``frontend/src/i18n/locales/{uz,ru,en}.json`` these functions
use, copied verbatim (the Docker image is built from ``backend/`` alone, so it cannot read the
frontend's files at run time). ``tests/test_smeta_text.py`` fails when the copy and the frontend
differ; to refresh it run, from ``backend/``::

    python -m app.services.smeta_text ../frontend/src/i18n/locales

The patterns below mirror smetaLineText.ts one for one; change both together. Numbers are never
touched, and text that is not known is returned unchanged.
"""
from __future__ import annotations

import json
import math
import re
import sys
from collections.abc import Callable
from functools import lru_cache
from pathlib import Path

LANGUAGES = ("uz", "ru", "en")
DEFAULT_LANGUAGE = "uz"

_LOCALE_PATH = Path(__file__).with_name("smeta_locale.json")


# ---------------------------------------------------------------------------
# The copied locale part and i18next-style lookups
# ---------------------------------------------------------------------------

def extract_locale(locale: dict) -> dict:
    """The part of one frontend locale file the estimate text uses."""
    smeta = locale["smeta"]
    out = {key: smeta[key] for key in ("line", "unit", "formula", "warning", "toifa")}
    for key, value in smeta.items():
        if key in ("sarlavha", "dokon", "taqsimot") or key.startswith("qator_"):
            out[key] = value
    lights = locale["studio"]["lib"]["light"]
    out["light"] = {
        key: value["name"] for key, value in lights.items() if isinstance(value, dict) and "name" in value
    }
    return {"smeta": out}


@lru_cache(maxsize=1)
def _locales() -> dict[str, dict]:
    return json.loads(_LOCALE_PATH.read_text(encoding="utf-8"))


def _lang(lang: str | None) -> str:
    return lang if lang in LANGUAGES else DEFAULT_LANGUAGE


def _plural_form(lang: str, count: float) -> str:
    """CLDR plural category, as i18next picks it (Intl.PluralRules)."""
    if not (isinstance(count, (int, float)) and math.isfinite(count)) or count != int(count):
        return "other"  # a fraction is "other" in all three languages
    n = abs(int(count))
    if lang == "ru":
        if n % 10 == 1 and n % 100 != 11:
            return "one"
        if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
            return "few"
        return "many"
    return "one" if n == 1 else "other"


def _lookup(lang: str, path: str) -> str | None:
    node = _locales()[lang]["smeta"]
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, str) else None


def t(key: str, lang: str, count: float | None = None, **values: object) -> str:
    """``key`` (a dotted path under the locale's smeta part) in *lang*, i18next-style:
    ``{{name}}`` is filled from *values*, and *count* picks the plural form (and fills
    ``{{count}}``). A missing translation falls back to Uzbek, then to the key itself."""
    lang = _lang(lang)
    template = None
    for candidate_lang in (lang, DEFAULT_LANGUAGE):
        if count is not None:
            form = _plural_form(candidate_lang, count)
            template = _lookup(candidate_lang, f"{key}_{form}") or _lookup(candidate_lang, f"{key}_other")
        template = template or _lookup(candidate_lang, key)
        if template is not None:
            break
    if template is None:
        return key
    if count is not None:
        values = {"count": _format_count(count), **values}
    return re.sub(r"\{\{\s*(\w+)\s*\}\}", lambda m: str(values.get(m.group(1), m.group(0))), template)


def _format_count(count: float) -> str:
    return str(int(count)) if count == int(count) else str(count)


# ---------------------------------------------------------------------------
# Labels
# ---------------------------------------------------------------------------

# "Suvoq: <product>" and the like: the line's name before the colon.
_LABEL_HEADS = {
    "Suvoq": "suvoq",
    "Grunt": "grunt",
    "Shpatlyovka": "shpatlyovka",
    "Bo'yoq": "boyoq",
    "Laminat": "laminat",
    "Parket": "parket",
    "Plitka": "plitka",
    "Plintus": "plintus",
    "Galtel": "galtel",
    "Jihoz": "jihoz",
    "Chiroq": "chiroq",
    "Shift": "shift",
    "Shift profili": "shift_profili",
    "LED lenta": "led_lenta",
    "Santexnika": "santexnika",
    # A shop's pipe: "Kanalizatsiya quvuri Ø50: <product>".
    "Kanalizatsiya quvuri Ø50": "pipe_drain_50",
    "Kanalizatsiya quvuri Ø110": "pipe_drain_110",
    "Suv quvuri PPR Ø20": "pipe_water_20",
    # Tile work (spec 2026-11-10): a shop's product follows the colon.
    "Devor plitkasi": "wall_tile",
    "Plitka yelimi": "tile_adhesive",
    "Zatirka": "grout",
    "Gidroizolyatsiya mastikasi": "wp_mastic",
    "Gidroizolyatsiya lentasi": "wp_tape",
    "Tortuvchi ventilyator": "fan",
    "Sochiq quritgich": "towel_rail",
}

# Labels the estimate writes in full, with no product name in them.
_WHOLE_LABELS = {
    "Devor foto-bosma (individual)": "foto_bosma",
    "Shift gipsokartoni": "shift_board",
    "Shift profili (karkas)": "shift_frame",
    "LED lenta (shift nishi)": "led_niche",
    "Elektr kabel": "kabel",
    "Elektr kabel (taxminiy)": "kabel_approx",
    "Bo'yoq (material tanlanmagan)": "boyoq_none",
    "Kanalizatsiya quvuri Ø50": "pipe_drain_50",
    "Kanalizatsiya quvuri Ø110": "pipe_drain_110",
    "Suv quvuri PPR Ø20": "pipe_water_20",
    "Fitinglar": "fittings",  # the set per point of estimates made before 2026-11-11
    "PPR troynik Ø20": "fit_tee_20",
    "PPR burchak Ø20": "fit_elbow_20",
    "Suv rozetkasi Ø20": "fit_outlet_20",
    "Sharli kran Ø20": "fit_valve_20",
    "Kanalizatsiya troynigi Ø50": "fit_tee_50",
    "Kanalizatsiya burchagi Ø50": "fit_elbow_50",
    "Kanalizatsiya troynigi Ø110/50": "fit_tee_110_50",
    "Kanalizatsiya burchagi Ø110": "fit_elbow_110",
    "Devor plitkasi": "wall_tile",
    "Pol plitkasi": "floor_tile",
    "Plitka yelimi": "tile_adhesive",
    "Zatirka": "grout",
    "Ish: pol plitkasini terish": "work_floor_tile",
    "Ish: devor plitkasini terish": "work_wall_tile",
    "Gidroizolyatsiya mastikasi": "wp_mastic",
    "Gidroizolyatsiya lentasi": "wp_tape",
    "Ish: gidroizolyatsiya": "work_wp",
    "Tortuvchi ventilyator": "fan",
    "Elektr kabel (ventilyator)": "fan_cable",
    "Ish: ventilyatorni o'rnatish": "work_fan",
    "Sochiq quritgich": "towel_rail",
    "Ish: sochiq quritgichni o'rnatish": "work_towel_rail",
    "Ish: nuqtani ulash": "work_point",
    "Ish: vanna o'rnatish": "work_bathtub",
    "Ish: rakovina o'rnatish": "work_sink",
    "Ish: unitaz o'rnatish": "work_toilet",
    "Ish: dush o'rnatish": "work_shower",
    "Ish: bide o'rnatish": "work_bidet",
}

# Uzbek light fixture names (smeta.py's LIGHT_TYPE_NAMES) -> the studio's light type.
_LIGHT_NAMES = {
    "Osma chiroq": "pendant",
    "Qandil": "chandelier",
    "Shift chirog'i": "ceiling",
    "Downlight": "downlight",
    "Spot chiroq": "spotlight",
    "IES spot": "ies",
    "LED panel": "led_panel",
    "LED chiziqli": "led_linear",
    "Trek (shina)": "track",
    "LED trek chirog'i": "led_track",
    "Bra": "bra",
    "Vanna chirog'i": "bath",
    "Torsher": "floor_lamp",
}


def _localize_name(name: str, lang: str) -> str:
    if name in _WHOLE_LABELS:
        return t(f"line.{_WHOLE_LABELS[name]}", lang)
    if name in _LIGHT_NAMES:
        return t(f"light.{_LIGHT_NAMES[name]}", lang)
    return name


# A plumbing fixture's own word in a shop name, by role (frontend/src/lib/fixtureName.ts).
_FIXTURE_WORD = {
    "bathtub": re.compile(r"\S*(?:ванна|vanna|bathtub)\S*", re.I),
    "sink": re.compile(r"\S*(?:rakovina|umivalnik|moyka|раковин|умывальник|мойк|sink|washbasin)\S*", re.I),
    "toilet": re.compile(r"\S*(?:unitaz|унитаз|toilet|\bwc\b)\S*", re.I),
    "shower": re.compile(r"\S*(?:dush|душ|shower)\S*", re.I),
    "bidet": re.compile(r"\S*(?:bide|биде|bidet)\S*", re.I),
}


def fixture_display_name(name: str, lang: str) -> str:
    """A fixture's shop name (Uzbek: "Vanna 1") in *lang*: the fixture word becomes what the piece
    is ("Bathtub 1", "Ванна 1"), the model kept. Uzbek, and a piece that is no fixture, unchanged."""
    lang = _lang(lang)
    if lang == DEFAULT_LANGUAGE:
        return name
    from app.services.ai_designer import infer_role  # ai_designer imports app.services.smeta

    role = infer_role(None, name)
    word = _FIXTURE_WORD.get(role)
    if word is None:
        return name
    rest = re.sub(r"\s+", " ", word.sub("", name, count=1)).strip()
    label = t(f"line.fixture_{role}", lang)
    return f"{label} {rest}" if rest else label


def localize_label(label: str, lang: str) -> str:
    if m := re.fullmatch(r"Suvoq \(gips\) (\S+) kg qop", label):
        return t("line.suvoq_bag", lang, kg=m[1])
    if m := re.fullmatch(r"Grunt \(asosiy qatlam\) (\S+) kg qop", label):
        return t("line.grunt_bag", lang, kg=m[1])
    if m := re.fullmatch(r"Shpatlyovka (\S+) kg qop", label):
        return t("line.putty_bag", lang, kg=m[1])
    if m := re.fullmatch(r"Plintus \((\S+) m dona\)", label):
        return t("line.plintus_piece", lang, m=m[1])
    if m := re.fullmatch(r"Galtel (.+) \((\S+) m dona\)", label, flags=re.DOTALL):
        return t("line.galtel_piece", lang, profile=m[1], m=m[2])
    # "Oboy devor A" or "Oboy devor A: <product>": the wall's letter is a value, not a word.
    if m := re.fullmatch(r"Oboy devor (\S+?)(?:: (.+))?", label, flags=re.DOTALL):
        return t("line.oboy_devor", lang, wall=m[1]) + (f": {m[2]}" if m[2] is not None else "")
    if label in _WHOLE_LABELS:
        return _localize_name(label, lang)
    # The head is everything before the first ": ", so "Shift profili: X" reads as "Shift profili".
    colon = label.find(": ")
    if colon > 0:
        head = label[:colon]
        if head in _LABEL_HEADS:
            name = label[colon + 2:]
            if head == "Santexnika":  # a fixture reads by what it is: "Rakovina 3" -> "Sink 3"
                return f"{t('line.santexnika', lang)}: {fixture_display_name(name, lang)}"
            return f"{t(f'line.{_LABEL_HEADS[head]}', lang)}: {_localize_name(name, lang)}"
    return label


# ---------------------------------------------------------------------------
# Units
# ---------------------------------------------------------------------------

# Units counted in whole things, which take the plural of the quantity.
_COUNTED_UNITS = {"qop", "dona", "rulon", "quti", "list", "komplekt", "nuqta"}
_MEASURE_UNITS = {"litr": "litr", "m": "m", "m²": "m2", "m2": "m2", "kg": "kg"}


def localize_unit(unit: str, quantity: float, lang: str) -> str:
    if unit in _COUNTED_UNITS:
        return t(f"unit.{unit}", lang, count=quantity)
    if unit in _MEASURE_UNITS:
        return t(f"unit.{_MEASURE_UNITS[unit]}", lang)
    return unit


# ---------------------------------------------------------------------------
# Formulas
# ---------------------------------------------------------------------------

# JavaScript's \p{L}: a letter (a word character that is neither a digit nor "_").
_LETTER = r"[^\W\d_]"

_FORMULA_PHRASES: list[tuple[re.Pattern[str], Callable[..., str]]] = [
    # Waterproofing (spec 2026-11-10): "Pol 5.00 m² + devor tagi … + ho'l zona …".
    (re.compile(r"\APol (?=\d)"), lambda lang: f"{t('formula.wp_floor', lang)} "),
    (re.compile(r" \+ devor tagi "), lambda lang: f" + {t('formula.wp_base', lang)} "),
    (re.compile(r" \+ ho'l zona "), lambda lang: f" + {t('formula.wp_wet', lang)} "),
    (re.compile(r"Joylashtirilgan sxema bo'yicha o'lchangan \((\S+) m, zaxira bilan\)"),
     lambda lang, m: t("formula.measured", lang, m=m)),
    (re.compile(r"\(teshiklar (\S+) m² polosaga ta'sir qilmaydi\)"),
     lambda lang, area: f"({t('formula.openings', lang, area=area)})"),
    (re.compile(r" — o'lchamiga qarab chop etiladi"),
     lambda lang: f" — {t('formula.printed', lang)}"),
    (re.compile(rf"(\S+) m lenta(?!{_LETTER}|')"),
     lambda lang, m: t("formula.strip", lang, m=m)),
    (re.compile(r"\(yuqori/pastki karkas\)"),
     lambda lang: f"({t('formula.frame', lang)})"),
    (re.compile(r"\((isrof|chiqindi|zaxira)\)"),
     lambda lang, word: f"({t(f'formula.{word}', lang)})"),
    # "Devor 0: ..." opens a wallpaper wall's working; "(devor 1, 3)" names the painted walls.
    (re.compile(r"\ADevor (\S+?):"),
     lambda lang, wall: f"{t('formula.wall_head', lang, wall=wall)}:"),
    (re.compile(r"\(devor ([^)]+)\)"),
     lambda lang, walls: f"({t('formula.walls', lang, count=len(walls.split(',')), walls=walls)})"),
    (re.compile(rf"(?<!{_LETTER})(?<!')Perimetr(?!{_LETTER}|')"),
     lambda lang: t("formula.perimeter", lang)),
    (re.compile(r" − eshiklar "),
     lambda lang: f" − {t('formula.doors', lang)} "),
    # The pipe scheme (spec 2026-11-11): "Magistral 6.00 m + tik 1.20 m = …".
    (re.compile(r"\AMagistral (?=\d)"), lambda lang: f"{t('formula.trunk', lang)} "),
    (re.compile(r" \+ tik (?=\d)"), lambda lang: f" + {t('formula.branch_pipes', lang)} "),
    (re.compile(r" so'm\Z"),
     lambda lang: f" {t('formula.som', lang)}"),
]

# Things counted in whole units: the word takes the plural of the number before it.
_FORMULA_COUNTED = {
    "qop": "unit.qop", "dona": "unit.dona", "rulon": "unit.rulon", "quti": "unit.quti",
    "list": "unit.list", "komplekt": "unit.komplekt", "polosa": "formula.polosa", "qatlam": "formula.qatlam", "nuqta": "formula.nuqta",
    # What a fitting's count is made of (spec 2026-11-11).
    "tarmoq": "formula.tarmoq", "stoyak": "formula.stoyak", "burchak": "formula.burchak", "uch": "formula.uch", "unitaz": "formula.unitaz", "liniya": "formula.liniya", "ulanish": "formula.ulanish",
}

# A unit right after a number. Longer units first, so "m²/litr" is never read as "m²".
_FORMULA_UNIT = re.compile(
    r"([0-9]+(?:\.[0-9]+)?) (kg/m²|m²/litr|m²/quti|m²/list|qop|dona|rulon|quti|list|komplekt|polosa|qatlam|nuqta|tarmoq|stoyak|burchak|uch|unitaz|liniya|ulanish|litr|m²|kg|m)"
    r"(?=\Z|[\s);,:])"
)


def _formula_unit(unit: str, count: float, lang: str) -> str:
    if unit in _FORMULA_COUNTED:
        return t(_FORMULA_COUNTED[unit], lang, count=count)

    def per(name: str) -> str:
        return t("unit.litr", lang) if name == "litr" else t(f"unit.{name}", lang, count=1)

    m2 = t("unit.m2", lang)
    return {
        "kg/m²": f"{t('unit.kg', lang)}/{m2}",
        "m²/litr": f"{m2}/{per('litr')}",
        "m²/quti": f"{m2}/{per('quti')}",
        "m²/list": f"{m2}/{per('list')}",
        "litr": t("unit.litr", lang),
        "m²": m2,
        "kg": t("unit.kg", lang),
        "m": t("unit.m", lang),
    }.get(unit, unit)


def localize_formula(formula: str, lang: str) -> str:
    """A line's formula in *lang*, its numbers as stored. Unknown words stay as they are."""
    out = formula
    for pattern, render in _FORMULA_PHRASES:
        out = pattern.sub(lambda m, render=render: render(lang, *(g for g in m.groups() if g is not None)), out)
    return _FORMULA_UNIT.sub(
        lambda m: f"{m[1]} {_formula_unit(m[2], float(m[1]), lang)}", out,
    )


# ---------------------------------------------------------------------------
# Warnings
# ---------------------------------------------------------------------------

def localize_warning(warning: str, lang: str) -> str:
    """A warning is one or more fixed sentences joined by spaces: each known one is translated."""
    keys = list(_locales()[DEFAULT_LANGUAGE]["smeta"]["warning"])
    # The longest first, so a sentence is never half-replaced by a shorter one inside it.
    keys.sort(key=lambda k: len(t(f"warning.{k}", DEFAULT_LANGUAGE)), reverse=True)
    out = warning
    for key in keys:
        source = t(f"warning.{key}", DEFAULT_LANGUAGE)
        if source in out:
            out = out.replace(source, t(f"warning.{key}", lang))
    return out


# ---------------------------------------------------------------------------
# The PDF's own fixed text (headers, totals, footer) — no web-page counterpart
# ---------------------------------------------------------------------------

PDF_TEXT: dict[str, dict[str, str]] = {
    "room": {"uz": "Xona", "ru": "Комната", "en": "Room"},
    "date": {"uz": "Sana", "ru": "Дата", "en": "Date"},
    "category": {"uz": "Toifa", "ru": "Категория", "en": "Category"},
    "share": {"uz": "Ulushi", "ru": "Доля", "en": "Share"},
    "amount_uzs": {"uz": "Summa (UZS)", "ru": "Сумма (UZS)", "en": "Amount (UZS)"},
    "col_item": {"uz": "Material / Xizmat", "ru": "Материал / Услуга", "en": "Material / Service"},
    "col_formula": {"uz": "Formula", "ru": "Формула", "en": "Formula"},
    "col_qty": {"uz": "Miqdor", "ru": "Кол-во", "en": "Qty"},
    "col_unit": {"uz": "Birlik", "ru": "Ед.", "en": "Unit"},
    "col_price": {"uz": "Narx (UZS)", "ru": "Цена (UZS)", "en": "Price (UZS)"},
    "col_total": {"uz": "Jami (UZS)", "ru": "Итого (UZS)", "en": "Total (UZS)"},
    "market_price": {"uz": "Bozor narxi", "ru": "Рыночная цена", "en": "Market price"},
    "group_total": {"uz": "Jami: {group}", "ru": "Итого: {group}", "en": "Total: {group}"},
    "total": {"uz": "Taxminiy xarajat (jami):", "ru": "Ориентировочные расходы (итого):",
              "en": "Estimated cost (total):"},
    "total_min": {"uz": "Minimal variant (−10%):", "ru": "Минимальный вариант (−10%):",
                  "en": "Minimum option (−10%):"},
    "total_max": {"uz": "Maksimal variant (taxminiy qismlar uchun kengroq):",
                  "ru": "Максимальный вариант (шире для ориентировочных частей):",
                  "en": "Maximum option (wider for the approximate parts):"},
    "total_approx": {"uz": "   shundan ~taxminiy:", "ru": "   из них ~ориентировочно:",
                     "en": "   of which ~approximate:"},
    "disclaimer": {
        "uz": "Bu taxminiy hisob. Yakuniy narx material tanlovi, bozor o'zgarishi "
              "va ishchi haqiga qarab farq qilishi mumkin. "
              "\"~taxminiy\" belgili qatorlar jami summaga kiritilgan, lekin "
              "ularning narxi aniq emas — final xarajat farq qilishi mumkin.",
        "ru": "Это ориентировочный расчёт. Итоговая цена может отличаться в зависимости от выбора "
              "материалов, изменения рынка и оплаты работы. "
              "Строки с пометкой \"~ориентировочно\" включены в общую сумму, но их цена "
              "не точная — итоговые расходы могут отличаться.",
        "en": "This is an approximate estimate. The final price can differ with the choice of "
              "materials, market changes and labour costs. "
              "Lines marked \"~approximate\" are included in the total, but their price "
              "is not exact — the final cost can differ.",
    },
    "electrical_warning": {
        "uz": "Elektr ishlari narxi taxminiy — elektrik ustasi bilan tasdiqlang.",
        "ru": "Стоимость электромонтажа ориентировочная — согласуйте с мастером-электриком.",
        "en": "The electrical work price is approximate — confirm it with an electrician.",
    },
    "made_by": {"uz": "Tuzilgan", "ru": "Составлено", "en": "Made by"},
}


def pdf_text(key: str, lang: str, **values: object) -> str:
    """One of the PDF's fixed texts in *lang* (Uzbek when *lang* is not supported)."""
    text = PDF_TEXT[key][_lang(lang)]
    return text.format(**values) if values else text


def _main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: python -m app.services.smeta_text <frontend/src/i18n/locales>", file=sys.stderr)
        return 2
    src = Path(argv[1])
    data = {
        lang: extract_locale(json.loads((src / f"{lang}.json").read_text(encoding="utf-8")))
        for lang in LANGUAGES
    }
    _LOCALE_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {_LOCALE_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv))
