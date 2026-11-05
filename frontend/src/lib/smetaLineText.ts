import type { TFunction } from "i18next";

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
      return `${t(`smeta.line.${LABEL_HEADS[head]}`)}: ${localizeName(label.slice(colon + 2), t)}`;
    }
  }
  return label;
}

/** Units counted in whole things, which take the plural of the quantity. */
const COUNTED_UNITS = new Set(["qop", "dona", "rulon", "quti", "list", "komplekt"]);
const MEASURE_UNITS = { "litr": "litr", "m": "m", "m²": "m2", "m2": "m2", "kg": "kg" } as const;

export function localizeUnit(unit: string, quantity: number, t: TFunction): string {
  if (COUNTED_UNITS.has(unit)) {
    return t(`smeta.unit.${unit as "qop" | "dona" | "rulon" | "quti" | "list" | "komplekt"}`, { count: quantity });
  }
  if (has(MEASURE_UNITS, unit)) return t(`smeta.unit.${MEASURE_UNITS[unit]}`);
  return unit;
}

/** Every sentence the estimate's warnings are built from (smeta.py, smeta_ai.py). */
const WARNING_KEYS = [
  "norm_missing", "stand_in", "pick_for_exact", "paint_fallback", "pick_paint",
  "wallpaper_missing", "pick_material", "texture_pricing", "furniture_approx", "light_approx",
  "galtel_approx", "cable_measured", "cable_points", "cable_guess", "confirm_electrician",
  "ceiling_board", "ceiling_frame", "ceiling_strip", "ai_price",
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
