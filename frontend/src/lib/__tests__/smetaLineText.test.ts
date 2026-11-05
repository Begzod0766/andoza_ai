import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { localizeLabel, localizeUnit, localizeWarning } from "@/lib/smetaLineText";

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
