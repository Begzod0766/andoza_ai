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
    expect(localizeLabel('Santexnika: Vanna Roca 170', ru)).toBe('Сантехника: Ванна Roca 170')
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

  it('reads the pipe scheme\'s fittings and their working (spec 2026-11-11)', () => {
    const labels: Array<[string, string, string]> = [
      ['PPR troynik Ø20', 'Тройник PPR Ø20', 'PPR tee Ø20'],
      ['PPR burchak Ø20', 'Угол PPR Ø20', 'PPR elbow Ø20'],
      ['Suv rozetkasi Ø20', 'Водорозетка Ø20', 'Wall outlet Ø20'],
      ['Sharli kran Ø20', 'Шаровой кран Ø20', 'Ball valve Ø20'],
      ['Kanalizatsiya troynigi Ø50', 'Канализационный тройник Ø50', 'Drain tee Ø50'],
      ['Kanalizatsiya burchagi Ø50', 'Канализационный отвод Ø50', 'Drain elbow Ø50'],
      ['Kanalizatsiya troynigi Ø110/50', 'Канализационный тройник Ø110/50', 'Drain tee Ø110/50'],
      ['Kanalizatsiya burchagi Ø110', 'Канализационный отвод Ø110', 'Drain elbow Ø110'],
    ]
    for (const [label, r, e] of labels) {
      expect(localizeLabel(label, ru)).toBe(r)
      expect(localizeLabel(label, en)).toBe(e)
      expect(localizeLabel(label, uz)).toBe(label)
    }
    const formulas: Array<[string, string, string]> = [
      ['Magistral 6.00 m + tik 1.20 m = 7.20 m × 1.15 = 8.28 m', 'Магистраль 6.00 м + отводы 1.20 м = 7.20 м × 1.15 = 8.28 м', 'Trunk 6.00 m + branches 1.20 m = 7.20 m × 1.15 = 8.28 m'],
      ['5 tarmoq + 1 stoyak = 6 dona', '5 отводов + 1 стояк = 6 шт.', '5 branches + 1 riser = 6 pcs'],
      ['2 burchak + 1 uch = 3 dona', '2 угла + 1 конец = 3 шт.', '2 corners + 1 end = 3 pcs'],
      ['1 unitaz + 2 burchak = 3 dona', '1 унитаз + 2 угла = 3 шт.', '1 toilet + 2 corners = 3 pcs'],
      ['2 liniya', '2 линии', '2 lines'],
      ['3 ulanish', '3 врезки', '3 joins'],
      ['1 tarmoq', '1 отвод', '1 branch'],
      // The spec's own words (review minor 2, 2026-11-11); the shorter ones above stay for estimates saved before.
      ["Magistral 6.00 m + tik bo'laklar 1.20 m = 7.20 m × 1.15 = 8.28 m", 'Магистраль 6.00 м + отводы 1.20 м = 7.20 м × 1.15 = 8.28 м', 'Trunk 6.00 m + branches 1.20 m = 7.20 m × 1.15 = 8.28 m'],
      ['2 xona burchagi + 1 magistral uchi = 3 dona', '2 угла комнаты + 1 конец магистрали = 3 шт.', '2 room corners + 1 trunk end = 3 pcs'],
      ['5 xona burchagi', '5 углов комнаты', '5 room corners'],
      ['1 unitaz + 1 xona burchagi = 2 dona', '1 унитаз + 1 угол комнаты = 2 шт.', '1 toilet + 1 room corner = 2 pcs'],
      ['2 magistral uchi', '2 конца магистрали', '2 trunk ends'],
    ]
    for (const [formula, r, e] of formulas) {
      expect(localizeFormula(formula, ru)).toBe(r)
      expect(localizeFormula(formula, en)).toBe(e)
      expect(localizeFormula(formula, uz)).toBe(formula)
    }
  })
})

describe('plumbing formula and warning (prod check 2026-11-09)', () => {
  it('a count before a colon is translated', () => {
    expect(localizeFormula('3 nuqta: 3.4 + 4.05 + 3.25 m × 1.15 = 12.3 m', en)).toBe('3 points: 3.4 + 4.05 + 3.25 m × 1.15 = 12.3 m')
  })
  it('the pipe price warning is translated', () => {
    expect(localizeWarning("Narx taxminiy — do'konda bu quvur topilmadi, o'rtacha narx olindi.", en))
      .toBe('Approximate price — the shop has no such pipe, an average price was used.')
  })
})

describe('plumbing fixture names in the estimate (mobile QA 2026-11-09 #5)', () => {
  it('the fixture reads by its role in en and ru, as it is in uz', () => {
    expect(localizeLabel('Santexnika: Rakovina 3', en)).toBe('Plumbing: Sink 3')
    expect(localizeLabel('Santexnika: Rakovina 3', ru)).toBe('Сантехника: Раковина 3')
    expect(localizeLabel('Santexnika: Rakovina 3', uz)).toBe('Santexnika: Rakovina 3')
  })
})

describe('the fittings warning (review minor 2026-11-09)', () => {
  it('is translated', () => {
    expect(localizeWarning("Narx taxminiy — fitinglar uchun o'rtacha narx olindi.", en)).toBe('Approximate price — an average price is used for the fittings.')
  })
})

describe('tile work lines (spec 2026-11-10)', () => {
  it('translates the labels, with and without a shop product', () => {
    expect(localizeLabel('Devor plitkasi', en)).toBe('Wall tile')
    expect(localizeLabel('Devor plitkasi: Kafel 30x60', ru)).toBe('Настенная плитка: Kafel 30x60')
    expect(localizeLabel('Plitka yelimi', ru)).toBe('Плиточный клей')
    expect(localizeLabel('Plitka yelimi: Ceresit CM 11', en)).toBe('Tile adhesive: Ceresit CM 11')
    expect(localizeLabel('Zatirka', en)).toBe('Grout')
    expect(localizeLabel('Ish: pol plitkasini terish', en)).toBe('Work: laying floor tile')
    expect(localizeLabel('Ish: devor plitkasini terish', ru)).toBe('Работа: укладка настенной плитки')
  })
  it('translates the warnings and the formula', () => {
    expect(localizeWarning("Narx taxminiy — do'konda plitka topilmadi, o'rtacha narx olindi.", en)).toBe('Approximate price — the shop has no tile, an average price was used.')
    expect(localizeWarning("Narx taxminiy — do'konda bu mahsulot topilmadi, o'rtacha narx olindi.", en)).toBe('Approximate price — the shop has no such product, an average price was used.')
    expect(localizeFormula('25.00 m² × 5 kg/m² = 125.0 kg → 5 qop (25 kg)', en)).toBe('25.00 m² × 5 kg/m² = 125.0 kg → 5 bags (25 kg)')
    expect(localizeFormula('24.30 m² × 1.10 (chiqindi) = 26.73 m² (devor A, B)', en)).toBe('24.30 m² × 1.10 (waste) = 26.73 m² (walls A, B)')
  })
})

describe('waterproofing lines (spec 2026-11-10)', () => {
  it('translates the labels', () => {
    expect(localizeLabel('Gidroizolyatsiya mastikasi', en)).toBe('Waterproofing mastic')
    expect(localizeLabel('Gidroizolyatsiya mastikasi: Ceresit CL 51', ru)).toBe('Гидроизоляционная мастика: Ceresit CL 51')
    expect(localizeLabel('Gidroizolyatsiya lentasi', ru)).toBe('Гидроизоляционная лента')
    expect(localizeLabel('Ish: gidroizolyatsiya', en)).toBe('Work: waterproofing')
  })
  it('translates the working: floor, foot of the walls, wet zone', () => {
    const f = "Pol 5.00 m² + devor tagi 1.66 m² + ho'l zona 3.68 m² = 10.34 m² × 1.5 kg/m² = 15.5 kg"
    expect(localizeFormula(f, en)).toBe('Floor 5.00 m² + foot of the walls 1.66 m² + wet zone 3.68 m² = 10.34 m² × 1.5 kg/m² = 15.5 kg')
    expect(localizeFormula(f, ru)).toBe('Пол 5.00 м² + низ стен 1.66 м² + мокрая зона 3.68 м² = 10.34 м² × 1.5 кг/м² = 15.5 кг')
    expect(localizeFormula(f, uz)).toBe(f)
  })
})

// A fixture's own parts (2026-11-13), as smeta.py writes them; the PDF reads them the same (smeta_text.py).
describe('fixture parts', () => {
  it('each part reads in Russian and English, a shop product kept', () => {
    expect(localizeLabel('Rakovina smesiteli: Grohe Eurosmart', en)).toBe('Basin mixer: Grohe Eurosmart')
    expect(localizeLabel('Rakovina smesiteli', ru)).toBe('Смеситель для раковины')
    expect(localizeLabel('Vanna va dush smesiteli', en)).toBe('Bath and shower mixer')
    expect(localizeLabel('Dush poddoni sifoni', ru)).toBe('Сифон для душевого поддона')
    expect(localizeLabel('Unitaz gofrasi', en)).toBe('Toilet pan connector')
    expect(localizeLabel('Ulash shlangi (podvodka)', ru)).toBe('Гибкая подводка')
    expect(localizeLabel("Ish: smesitel o'rnatish", en)).toBe('Work: fitting a mixer')
  })
  it.each([
    ["2 rakovina + 1 bide = 3 dona × 60 000 so'm", '2 раковины + 1 биде = 3 шт. × 60 000 сум', '2 sinks + 1 bidet = 3 pcs × 60 000 UZS'],
    ["1 vanna + 1 dush = 2 dona × 650 000 so'm", '1 ванна + 1 душ = 2 шт. × 650 000 сум', '1 bathtub + 1 shower = 2 pcs × 650 000 UZS'],
    ["3 smesitel × 100 000 so'm", '3 смесителя × 100 000 сум', '3 mixers × 100 000 UZS'],
  ])('%s', (formula, ruText, enText) => {
    expect(localizeFormula(formula, ru)).toBe(ruText)
    expect(localizeFormula(formula, en)).toBe(enText)
  })
})

// Old plumbing out and wall chasing (2026-11-13); the PDF reads them the same (smeta_text.py).
describe('demolition and chasing', () => {
  it('the lines read in Russian and English', () => {
    expect(localizeLabel('Ish: eski santexnikani demontaj qilish', en)).toBe('Work: removing the old fixtures')
    expect(localizeLabel('Ish: eski quvurlarni demontaj qilish', ru)).toBe('Работа: демонтаж старых труб')
    expect(localizeLabel('Ish: shtroba (suv quvuri)', en)).toBe('Work: wall chasing (water pipe)')
    expect(localizeLabel('Ish: shtroba (kanalizatsiya Ø50)', ru)).toBe('Работа: штробление (канализация Ø50)')
  })
  it.each([
    ["1 vanna × 200 000 + 1 rakovina × 80 000 + 1 unitaz × 100 000 = 380 000 so'm",
      '1 ванна × 200 000 + 1 раковина × 80 000 + 1 унитаз × 100 000 = 380 000 сум',
      '1 bathtub × 200 000 + 1 sink × 80 000 + 1 toilet × 100 000 = 380 000 UZS'],
    ["Tik bo'laklar 1.20 m × 60 000 so'm", 'Отводы 1.20 м × 60 000 сум', 'Branches 1.20 m × 60 000 UZS'],
  ])('%s', (formula, ruText, enText) => {
    expect(localizeFormula(formula, ru)).toBe(ruText)
    expect(localizeFormula(formula, en)).toBe(enText)
  })
})

// A wall-hung toilet's frame and a water heater (2026-11-13).
describe('frame and water heater', () => {
  it('the lines read in Russian and English, a shop product kept', () => {
    expect(localizeLabel('Installyatsiya (osma unitaz uchun): Geberit Duofix', en)).toBe('Installation frame (wall-hung toilet): Geberit Duofix')
    expect(localizeLabel("Ish: installyatsiya o'rnatish", ru)).toBe('Работа: монтаж инсталляции')
    expect(localizeLabel('Suv isitgich (boyler): Ariston ABS 80', ru)).toBe('Водонагреватель (бойлер): Ariston ABS 80')
    expect(localizeLabel("Boyler ulash to'plami", en)).toBe('Water heater connection kit')
    expect(localizeLabel('Elektr kabel (boyler)', en)).toBe('Electric cable (water heater)')
    expect(localizeLabel("Ish: boyler o'rnatish", ru)).toBe('Работа: установка бойлера')
  })
})

// A washing machine (spec 2026-11-13).
describe('washing machine lines', () => {
  it('read in Russian and English, a shop product kept', () => {
    expect(localizeLabel('Kir yuvish mashinasi krani: Vieir', en)).toBe('Washing machine valve: Vieir')
    expect(localizeLabel('Kir yuvish mashinasi sifoni', ru)).toBe('Сифон для стиральной машины')
    expect(localizeLabel('Ish: kir yuvish mashinasini ulash', en)).toBe('Work: connecting the washing machine')
    expect(localizeFormula("2 mashina = 2 dona × 60 000 so'm", ru)).toBe('2 машины = 2 шт. × 60 000 сум')
  })
})

// A floor drain (spec 2026-11-13).
describe('floor drain lines', () => {
  it('read in Russian and English', () => {
    expect(localizeLabel('Pol trapi: Трап кафель 300 мм', en)).toBe('Floor drain: Трап кафель 300 мм')
    expect(localizeLabel("Ish: trap o'rnatish", ru)).toBe('Работа: установка трапа')
  })
})

// The water inlet unit (2026-11-14).
describe('water inlet lines', () => {
  it('read in Russian and English, a shop product kept', () => {
    expect(localizeLabel('Suv hisoblagichi: Valtec', ru)).toBe('Счётчик воды: Valtec')
    expect(localizeLabel("Dag'al filtr", en)).toBe('Coarse water filter')
    expect(localizeLabel('Bosim reduktori', ru)).toBe('Редуктор давления')
    expect(localizeLabel('Teskari klapan', en)).toBe('Check valve')
    expect(localizeLabel("Ish: suv kirish uzelini yig'ish", ru)).toBe('Работа: сборка узла ввода воды')
    expect(localizeFormula("2 liniya = 2 dona × 180 000 so'm", ru)).toBe('2 линии = 2 шт. × 180 000 сум')
  })
})

// The drywall box around a wall-hung toilet's frame (2026-11-14).
describe('frame box lines', () => {
  it('read in Russian and English, a shop product kept', () => {
    expect(localizeLabel('Namga chidamli gipsokarton (quti): Knauf GKLV', ru)).toBe('Влагостойкий гипсокартон (короб): Knauf GKLV')
    expect(localizeLabel('Quti profili (karkas)', en)).toBe('Box profile (frame)')
    expect(localizeLabel("Ish: gipsokarton quti yig'ish", ru)).toBe('Работа: сборка короба из гипсокартона')
    expect(localizeFormula('2 unitaz × 6 m = 12 m', ru)).toBe('2 унитаза × 6 м = 12 м')
  })
})

// A kitchen backsplash (spec 2026-11-14).
describe('backsplash lines', () => {
  it('read in Russian and English, a shop product kept', () => {
    expect(localizeLabel('Fartuk plitkasi: Kerama 10x10', ru)).toBe('Плитка фартука: Kerama 10x10')
    expect(localizeLabel('Skinali (shisha fartuk)', en)).toBe('Skinali (glass backsplash)')
    expect(localizeLabel('Ish: fartuk plitkasini terish', ru)).toBe('Работа: укладка плитки фартука')
    expect(localizeLabel("Ish: skinali o'rnatish", en)).toBe('Work: fitting the skinali')
  })
})

// An electric towel rail (2026-11-14).
describe('electric towel rail lines', () => {
  it('read in Russian and English', () => {
    expect(localizeLabel('Elektr sochiq quritgich: Terminus', ru)).toBe('Электрический полотенцесушитель: Terminus')
    expect(localizeLabel('Namga chidamli rozetka (IP44)', en)).toBe('Moisture-proof socket (IP44)')
    expect(localizeLabel('Elektr kabel (sochiq quritgich)', ru)).toBe('Электрокабель (полотенцесушитель)')
    expect(localizeLabel("Ish: elektr sochiq quritgichni o'rnatish", en)).toBe('Work: fitting the electric towel rail')
  })
})
