import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { localizeFormula, localizeLabel, localizeUnit, localizeWarning } from "@/lib/smetaLineText";

const en = i18n.getFixedT("en");
const ru = i18n.getFixedT("ru");
const uz = i18n.getFixedT("uz");

describe("estimate line labels (QA #13)", () => {
  it("translates the line's name and keeps the shop's own product name", () => {
    expect(localizeLabel("Suvoq: VENTUM Гипсовая штукатурка (30 kg)", en)).toBe("Plaster: VENTUM Гипсовая штукатурка (30 kg)");
    expect(localizeLabel("Grunt: Ceresit CT 17 (10 kg)", en)).toBe("Primer: Ceresit CT 17 (10 kg)");
    expect(localizeLabel("Shpatlyovka: Knauf HP Start", en)).toBe("Putty: Knauf HP Start");
    expect(localizeLabel("Bo'yoq: Dulux oq", en)).toBe("Paint: Dulux oq");
    expect(localizeLabel("Suvoq: VENTUM", ru)).toBe("Штукатурка: VENTUM");
    expect(localizeLabel("Bo'yoq: Dulux oq", ru)).toBe("Краска: Dulux oq");
  });

  it("translates the lines the estimate names on its own", () => {
    expect(localizeLabel("Suvoq (gips) 30 kg qop", en)).toBe("Plaster (gypsum), 30 kg bag");
    expect(localizeLabel("Grunt (asosiy qatlam) 10 kg qop", en)).toBe("Primer (base coat), 10 kg bag");
    expect(localizeLabel("Shpatlyovka 25 kg qop", en)).toBe("Putty, 25 kg bag");
    expect(localizeLabel("Plintus (2.5 m dona)", en)).toBe("Skirting board (2.5 m piece)");
    expect(localizeLabel("Oboy devor A: Erismann 1234", en)).toBe("Wallpaper, wall A: Erismann 1234");
    expect(localizeLabel("Elektr kabel (taxminiy)", en)).toBe("Electrical cable (approximate)");
    expect(localizeLabel("Bo'yoq: Bo'yoq (material tanlanmagan)", en)).toBe("Paint: Paint (no product chosen)");
    expect(localizeLabel("Chiroq: Osma chiroq", en)).toBe("Light fixture: Pendant light");
  });

  it("leaves Uzbek, and a label it does not know, as they are", () => {
    expect(localizeLabel("Suvoq (gips) 30 kg qop", uz)).toBe("Suvoq (gips) 30 kg qop");
    expect(localizeLabel("Suvoq: VENTUM", uz)).toBe("Suvoq: VENTUM");
    expect(localizeLabel("Noma'lum ish", en)).toBe("Noma'lum ish");
  });
});

describe("estimate units (QA #13)", () => {
  it("names the unit in the UI language, by the quantity", () => {
    expect(localizeUnit("qop", 13, en)).toBe("bags");
    expect(localizeUnit("qop", 1, en)).toBe("bag");
    expect(localizeUnit("qop", 13, ru)).toBe("мешков");
    expect(localizeUnit("qop", 13, uz)).toBe("qop");
    expect(localizeUnit("dona", 4, en)).toBe("pcs");
    expect(localizeUnit("litr", 4, en)).toBe("L");
    expect(localizeUnit("rulon", 3, en)).toBe("rolls");
    expect(localizeUnit("quti", 2, ru)).toBe("коробки");
    expect(localizeUnit("m²", 12.5, en)).toBe("m²");
    expect(localizeUnit("to‘plam", 1, en)).toBe("to‘plam");
  });
});

describe("estimate warnings (QA #13)", () => {
  it("translates each known sentence, also when two are joined", () => {
    expect(localizeWarning(
      "Mahsulot tanlanmagan — do'kondagi o'rtacha narx olindi. Aniq narx uchun o'zingiz mahsulot tanlang.", en,
    )).toBe("No product is chosen: the shop's average price is used. Choose a product for an exact price.");
    expect(localizeWarning(
      "Taxminiy hisob — karkas miqdorini ustaga tasdiqlang. Bu qism uchun aniq norma topilmadi — standart ko'rsatkich bo'yicha hisoblandi.", en,
    )).toBe("Approximate: confirm the amount of framing with a craftsman. No exact norm was found for this part: it is calculated with the standard rate.");
    expect(localizeWarning("Something the estimate never says", en)).toBe("Something the estimate never says");
    expect(localizeWarning("Mahsulot tanlanmagan — do'kondagi o'rtacha narx olindi.", uz)).toBe("Mahsulot tanlanmagan — do'kondagi o'rtacha narx olindi.");
  });
});

describe("estimate formulas (QA re-check R10)", () => {
  // Every formula shape smeta.py writes, as it is stored in a saved estimate.
  const FORMULAS = [
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
  ];

  it("translates the formula's words and units and leaves every number as it is", () => {
    expect(localizeFormula(FORMULAS[0], en)).toBe("34.7 m² × 8.5 kg/m² = 295.1 kg → 13 bags");
    expect(localizeFormula(FORMULAS[1], en)).toBe("11.5 m² (wall 2) × 2 coats ÷ 9.0 m²/L = 3 L");
    expect(localizeFormula(FORMULAS[2], en)).toBe("20.0 m² (walls 1, 3) × 2 coats ÷ 9.0 m²/L = 5 L");
    expect(localizeFormula(FORMULAS[3], en)).toBe(
      "Wall 0: 5.50 m × 1.10 (waste) ÷ 1.06 m = 6 strips; 1 roll (10 m) = 4 strips → 2 rolls",
    );
    expect(localizeFormula(FORMULAS[4], en)).toBe(
      "Wall A: 4.00 m × 1.10 (waste) ÷ 1.06 m = 5 strips; 1 roll = 3 strips → 2 rolls (openings of 1.89 m² do not change the strip count)",
    );
    expect(localizeFormula(FORMULAS[5], en)).toBe("16.22 m² × 1.07 (waste) = 17.36 m² ÷ 2.13 m²/box = 9 boxes");
    expect(localizeFormula(FORMULAS[7], en)).toBe("Perimeter 16.90 m − doors 1.54 m = 15.36 m → 7 pcs");
    expect(localizeFormula(FORMULAS[8], en)).toBe("Perimeter 16.90 m × 2 (top and bottom frame) = 34 m");
    expect(localizeFormula(FORMULAS[9], en)).toBe("Perimeter 16.90 m ≈ 17 m of strip");
    expect(localizeFormula(FORMULAS[11], en)).toBe("12.0 m² × 1.10 (waste) ÷ 3.0 m²/sheet = 5 sheets");
    expect(localizeFormula(FORMULAS[12], en)).toBe("6 points × 2.5 m × 1.15 (reserve) = 18 m");
    expect(localizeFormula(FORMULAS[13], en)).toBe("Measured off the placed wiring plan (12.34 m, reserve included) = 13 m");
    expect(localizeFormula(FORMULAS[14], en)).toBe("8.4 m² (wall B) — printed to size");
    expect(localizeFormula(FORMULAS[15], en)).toBe("2 pcs × 250 000 UZS");
  });

  it("speaks Russian with Russian plurals and units", () => {
    expect(localizeFormula(FORMULAS[0], ru)).toBe("34.7 м² × 8.5 кг/м² = 295.1 кг → 13 мешков");
    expect(localizeFormula(FORMULAS[1], ru)).toBe("11.5 м² (стена 2) × 2 слоя ÷ 9.0 м²/л = 3 л");
    expect(localizeFormula(FORMULAS[3], ru)).toBe(
      "Стена 0: 5.50 м × 1.10 (отходы) ÷ 1.06 м = 6 полос; 1 рулон (10 м) = 4 полосы → 2 рулона",
    );
    expect(localizeFormula(FORMULAS[7], ru)).toBe("Периметр 16.90 м − двери 1.54 м = 15.36 м → 7 шт.");
  });

  it("leaves no Uzbek formula word in English or Russian", () => {
    const UZBEK = /(^|[^\p{L}'])(qop|dona|rulon|quti|list|litr|polosa|qatlam|nuqta|devor|Devor|isrof|chiqindi|zaxira|Perimetr|eshiklar|yuqori|pastki|karkas|lenta|teshiklar|o'lchangan|chop|so'm)(?![\p{L}'])/u;
    for (const formula of FORMULAS) {
      expect(localizeFormula(formula, en)).not.toMatch(UZBEK);
      expect(localizeFormula(formula, ru)).not.toMatch(UZBEK);
    }
  });

  it("leaves an Uzbek formula, and one it does not know, exactly as stored", () => {
    for (const formula of FORMULAS) expect(localizeFormula(formula, uz)).toBe(formula);
    expect(localizeFormula("Something new from the server", en)).toBe("Something new from the server");
  });
});

describe('plumbing lines (spec 2026-11-08)', () => {
  it('translates the fixtures, pipes, fittings and work', () => {
    expect(localizeLabel('Santexnika: Vanna Roca 170', ru)).toBe('Сантехника: Vanna Roca 170')
    expect(localizeLabel('Kanalizatsiya quvuri Ø50', en)).toBe('Drain pipe Ø50')
    expect(localizeLabel('Kanalizatsiya quvuri Ø110: Valtec', ru)).toBe('Канализационная труба Ø110: Valtec')
    expect(localizeLabel('Suv quvuri PPR Ø20', en)).toBe('PPR water pipe Ø20')
    expect(localizeLabel('Fitinglar', ru)).toBe('Фитинги')
    expect(localizeLabel('Ish: nuqtani ulash', en)).toBe('Work: connecting a point')
    expect(localizeLabel("Ish: unitaz o'rnatish", ru)).toBe('Работа: установка унитаза')
  })

  it('counts points and fitting sets in the reader\'s language', () => {
    expect(localizeUnit('nuqta', 5, ru)).toBe('точек')
    expect(localizeUnit('nuqta', 1, en)).toBe('point')
    expect(localizeFormula('8 nuqta × 1 komplekt', en)).toBe('8 points × 1 set')
  })
})
