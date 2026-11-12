import type { TFunction } from "i18next";
import { fixtureDisplayName } from "@/lib/fixtureName";

/**
 * The estimate's lines in the UI language.
 *
 * The backend (app/services/smeta.py) writes every line's label, unit and warning in Uzbek,
 * and stores them so in the saved estimate's JSONB. Rather than change what is stored (old
 * estimates would stay Uzbek), the page translates the fixed parts here: the line's own name
 * ("Suvoq", "Grunt", ...), the labels the estimate makes up on its own ("Suvoq (gips) 30 kg
 * qop"), the unit and the warning sentences. A product's name after "Suvoq: " is the shop's
 * own and stays as the shop wrote it. Text this file does not know is shown unchanged, so a
 * new backend label is never lost, only left untranslated. Keep these in step with smeta.py.
 */

/** "Suvoq: <product>" and the like: the line's name before the colon. */
const LABEL_HEADS = {
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
  // A shop's pipe: "Kanalizatsiya quvuri Ø50: <product>".
  "Kanalizatsiya quvuri Ø50": "pipe_drain_50",
  "Kanalizatsiya quvuri Ø110": "pipe_drain_110",
  "Suv quvuri PPR Ø20": "pipe_water_20",
  // Tile work (spec 2026-11-10): a shop's product follows the colon.
  "Devor plitkasi": "wall_tile",
  "Plitka yelimi": "tile_adhesive",
  "Zatirka": "grout",
  "Gidroizolyatsiya mastikasi": "wp_mastic",
  "Gidroizolyatsiya lentasi": "wp_tape",
  "Tortuvchi ventilyator": "fan",
  "Sochiq quritgich": "towel_rail",
  // A fixture's own parts (2026-11-13): a shop's product follows the colon.
  "Rakovina smesiteli": "mixer_sink",
  "Oshxona smesiteli": "mixer_kitchen",
  "Vanna va dush smesiteli": "mixer_bath",
  "Dush smesiteli": "mixer_shower",
  "Gigiyenik smesitel": "mixer_bidet",
  "Rakovina sifoni": "trap_sink",
  "Oshxona sifoni": "trap_kitchen",
  "Vanna sifoni": "trap_bath",
  "Dush poddoni sifoni": "trap_shower",
  "Unitaz gofrasi": "toilet_gofra",
  "Ulash shlangi (podvodka)": "hose",
} as const;

/** Labels the estimate writes in full, with no product name in them. */
const WHOLE_LABELS = {
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
  "Fitinglar": "fittings",  // the set per point of estimates made before 2026-11-11
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
  "Tortuvchi ventilyator": "fan",
  "Elektr kabel (ventilyator)": "fan_cable",
  "Ish: ventilyatorni o'rnatish": "work_fan",
  "Sochiq quritgich": "towel_rail",
  "Ish: sochiq quritgichni o'rnatish": "work_towel_rail",
  "Ish: gidroizolyatsiya": "work_wp",
  "Ish: nuqtani ulash": "work_point",
  "Ish: vanna o'rnatish": "work_bathtub",
  "Ish: rakovina o'rnatish": "work_sink",
  "Ish: unitaz o'rnatish": "work_toilet",
  "Ish: dush o'rnatish": "work_shower",
  "Ish: bide o'rnatish": "work_bidet",
  "Rakovina smesiteli": "mixer_sink",
  "Oshxona smesiteli": "mixer_kitchen",
  "Vanna va dush smesiteli": "mixer_bath",
  "Dush smesiteli": "mixer_shower",
  "Gigiyenik smesitel": "mixer_bidet",
  "Rakovina sifoni": "trap_sink",
  "Oshxona sifoni": "trap_kitchen",
  "Vanna sifoni": "trap_bath",
  "Dush poddoni sifoni": "trap_shower",
  "Unitaz gofrasi": "toilet_gofra",
  "Ulash shlangi (podvodka)": "hose",
  "Ish: smesitel o'rnatish": "work_mixer",
} as const;

/** Uzbek light fixture names (smeta.py's LIGHT_TYPE_NAMES) -> the studio's light type. */
const LIGHT_NAMES = {
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
} as const;

const has = <T extends object>(table: T, key: string): key is Extract<keyof T, string> =>
  Object.prototype.hasOwnProperty.call(table, key);

/** A name the estimate made up itself (not a product's), translated; otherwise as it is. */
function localizeName(name: string, t: TFunction): string {
  if (has(WHOLE_LABELS, name)) return t(`smeta.line.${WHOLE_LABELS[name]}`);
  if (has(LIGHT_NAMES, name)) return t(`studio.lib.light.${LIGHT_NAMES[name]}.name`);
  return name;
}

export function localizeLabel(label: string, t: TFunction): string {
  let m = /^Suvoq \(gips\) (\S+) kg qop$/.exec(label);
  if (m) return t("smeta.line.suvoq_bag", { kg: m[1] });
  m = /^Grunt \(asosiy qatlam\) (\S+) kg qop$/.exec(label);
  if (m) return t("smeta.line.grunt_bag", { kg: m[1] });
  m = /^Shpatlyovka (\S+) kg qop$/.exec(label);
  if (m) return t("smeta.line.putty_bag", { kg: m[1] });
  m = /^Plintus \((\S+) m dona\)$/.exec(label);
  if (m) return t("smeta.line.plintus_piece", { m: m[1] });
  m = /^Galtel (.+) \((\S+) m dona\)$/.exec(label);
  if (m) return t("smeta.line.galtel_piece", { profile: m[1], m: m[2] });
  // "Oboy devor A" or "Oboy devor A: <product>": the wall's letter is a value, not a word.
  m = /^Oboy devor (\S+?)(?:: (.+))?$/.exec(label);
  if (m) return t("smeta.line.oboy_devor", { wall: m[1] }) + (m[2] !== undefined ? `: ${m[2]}` : "");
  if (has(WHOLE_LABELS, label)) return localizeName(label, t);
  // The head is everything before the first ": ", so "Shift profili: X" reads as "Shift profili".
  const colon = label.indexOf(": ");
  if (colon > 0) {
    const head = label.slice(0, colon);
    if (has(LABEL_HEADS, head)) {
      const name = label.slice(colon + 2);
      // A fixture reads by what it is in en/ru: "Rakovina 3" → "Sink 3" (lib/fixtureName).
      if (head === "Santexnika") return `${t("smeta.line.santexnika")}: ${fixtureDisplayName(name, t)}`;
      return `${t(`smeta.line.${LABEL_HEADS[head]}`)}: ${localizeName(name, t)}`;
    }
  }
  return label;
}

/** Units counted in whole things, which take the plural of the quantity. */
const COUNTED_UNITS = new Set(["qop", "dona", "rulon", "quti", "list", "komplekt", "nuqta"]);
const MEASURE_UNITS = { "litr": "litr", "m": "m", "m²": "m2", "m2": "m2", "kg": "kg" } as const;

export function localizeUnit(unit: string, quantity: number, t: TFunction): string {
  if (COUNTED_UNITS.has(unit)) {
    return t(`smeta.unit.${unit as "qop" | "dona" | "rulon" | "quti" | "list" | "komplekt" | "nuqta"}`, { count: quantity });
  }
  if (has(MEASURE_UNITS, unit)) return t(`smeta.unit.${MEASURE_UNITS[unit]}`);
  return unit;
}

/**
 * The formula vocabulary: smeta.py writes the working under each line as Uzbek words around
 * numbers ("34.7 m² × 8.5 kg/m² = 295.1 kg → 13 qop", "Devor 0: ... = 6 polosa; ..."). The
 * numbers are the estimate's and stay exactly as stored; only the words and units around them
 * are put in the UI language. First the fixed phrases (some carry a value of their own), then
 * every unit that follows a number. Each Uzbek locale value equals the Uzbek source, so an
 * Uzbek reader sees the stored text unchanged. Keep these in step with smeta.py.
 */
const FORMULA_PHRASES: ReadonlyArray<[RegExp, (t: TFunction, ...groups: string[]) => string]> = [
  // Waterproofing (spec 2026-11-10): "Pol 5.00 m² + devor tagi … + ho'l zona …".
  [/^Pol (?=\d)/g, (t) => `${t("smeta.formula.wp_floor")} `],
  [/ \+ devor tagi /g, (t) => ` + ${t("smeta.formula.wp_base")} `],
  [/ \+ ho'l zona /g, (t) => ` + ${t("smeta.formula.wp_wet")} `],
  [/Joylashtirilgan sxema bo'yicha o'lchangan \((\S+) m, zaxira bilan\)/g, (t, m) => t("smeta.formula.measured", { m })],
  [/\(teshiklar (\S+) m² polosaga ta'sir qilmaydi\)/g, (t, area) => `(${t("smeta.formula.openings", { area })})`],
  [/ — o'lchamiga qarab chop etiladi/g, (t) => ` — ${t("smeta.formula.printed")}`],
  [/(\S+) m lenta(?![\p{L}'])/gu, (t, m) => t("smeta.formula.strip", { m })],
  [/\(yuqori\/pastki karkas\)/g, (t) => `(${t("smeta.formula.frame")})`],
  [/\((isrof|chiqindi|zaxira)\)/g, (t, word) => `(${t(`smeta.formula.${word as "isrof" | "chiqindi" | "zaxira"}`)})`],
  // "Devor 0: ..." opens a wallpaper wall's working; "(devor 1, 3)" names the painted walls.
  [/^Devor (\S+?):/g, (t, wall) => `${t("smeta.formula.wall_head", { wall })}:`],
  [/\(devor ([^)]+)\)/g, (t, walls) => `(${t("smeta.formula.walls", { walls, count: walls.split(",").length })})`],
  [/(?<![\p{L}'])Perimetr(?![\p{L}'])/gu, (t) => t("smeta.formula.perimeter")],
  [/ − eshiklar /g, (t) => ` − ${t("smeta.formula.doors")} `],
  // The pipe scheme (spec 2026-11-11): "Magistral 6.00 m + tik 1.20 m = …".
  [/^Magistral (?=\d)/g, (t) => `${t("smeta.formula.trunk")} `],
  [/ \+ tik bo'laklar (?=\d)/g, (t) => ` + ${t("smeta.formula.branch_pieces")} `],
  [/ \+ tik (?=\d)/g, (t) => ` + ${t("smeta.formula.branch_pipes")} `], // estimates saved on 2026-11-11
  [/ so'm$/g, (t) => ` ${t("smeta.formula.som")}`],
];

/** Things counted in whole units: the word takes the plural of the number before it. */
const FORMULA_COUNTED = {
  qop: "smeta.unit.qop", dona: "smeta.unit.dona", rulon: "smeta.unit.rulon", quti: "smeta.unit.quti",
  list: "smeta.unit.list", komplekt: "smeta.unit.komplekt", polosa: "smeta.formula.polosa", qatlam: "smeta.formula.qatlam", nuqta: "smeta.formula.nuqta",
  // What a fitting's count is made of (spec 2026-11-11).
  tarmoq: "smeta.formula.tarmoq", stoyak: "smeta.formula.stoyak", burchak: "smeta.formula.burchak", uch: "smeta.formula.uch", unitaz: "smeta.formula.unitaz", liniya: "smeta.formula.liniya", ulanish: "smeta.formula.ulanish",
  "xona burchagi": "smeta.formula.xona_burchagi", "magistral uchi": "smeta.formula.magistral_uchi",
  // What a fixture part's count is made of (2026-11-13).
  rakovina: "smeta.formula.rakovina", vanna: "smeta.formula.vanna", dush: "smeta.formula.dush", bide: "smeta.formula.bide", smesitel: "smeta.formula.smesitel",
} as const;

/** A unit right after a number. Longer units first, so "m²/litr" is never read as "m²". */
const FORMULA_UNIT = /(\d+(?:\.\d+)?) (kg\/m²|m²\/litr|m²\/quti|m²\/list|qop|dona|rulon|quti|list|komplekt|polosa|qatlam|nuqta|xona burchagi|magistral uchi|tarmoq|stoyak|burchak|uch|unitaz|liniya|ulanish|rakovina|vanna|dush|bide|smesitel|litr|m²|kg|m)(?=$|[\s);,:])/g;

function formulaUnit(unit: string, count: number, t: TFunction): string {
  if (has(FORMULA_COUNTED, unit)) return t(FORMULA_COUNTED[unit], { count });
  const per = (name: "litr" | "quti" | "list") =>
    name === "litr" ? t("smeta.unit.litr") : t(`smeta.unit.${name}`, { count: 1 });
  switch (unit) {
    case "kg/m²": return `${t("smeta.unit.kg")}/${t("smeta.unit.m2")}`;
    case "m²/litr": return `${t("smeta.unit.m2")}/${per("litr")}`;
    case "m²/quti": return `${t("smeta.unit.m2")}/${per("quti")}`;
    case "m²/list": return `${t("smeta.unit.m2")}/${per("list")}`;
    case "litr": return t("smeta.unit.litr");
    case "m²": return t("smeta.unit.m2");
    case "kg": return t("smeta.unit.kg");
    case "m": return t("smeta.unit.m");
    default: return unit;
  }
}

/** A line's formula in the UI language, its numbers as stored. Unknown words stay as they are. */
export function localizeFormula(formula: string, t: TFunction): string {
  let out = formula;
  for (const [pattern, render] of FORMULA_PHRASES) {
    out = out.replace(pattern, (_match, ...groups: unknown[]) =>
      render(t, ...groups.filter((g): g is string => typeof g === "string")));
  }
  return out.replace(FORMULA_UNIT, (_match, number: string, unit: string) =>
    `${number} ${formulaUnit(unit, Number(number), t)}`);
}

/** Every sentence the estimate's warnings are built from (smeta.py, smeta_ai.py). */
const WARNING_KEYS = [
  "norm_missing", "stand_in", "pick_for_exact", "paint_fallback", "pick_paint",
  "wallpaper_missing", "pick_material", "texture_pricing", "furniture_approx", "light_approx",
  "galtel_approx", "cable_measured", "cable_points", "cable_guess", "confirm_electrician",
  "ceiling_board", "ceiling_frame", "ceiling_strip", "ai_price", "plumbing_norm", "fittings_norm", "wall_tile_norm", "tile_norm",
  "extras_norm", "fan_cable_len",
] as const;

/** A warning is one or more fixed sentences joined by spaces: each known one is translated. */
export function localizeWarning(warning: string, t: TFunction): string {
  const uz = (key: (typeof WARNING_KEYS)[number]) => t(`smeta.warning.${key}`, { lng: "uz" });
  // The longest first, so a sentence is never half-replaced by a shorter one inside it.
  const keys = [...WARNING_KEYS].sort((a, b) => uz(b).length - uz(a).length);
  let out = warning;
  for (const key of keys) {
    const source = uz(key);
    if (out.includes(source)) out = out.split(source).join(t(`smeta.warning.${key}`));
  }
  return out;
}
