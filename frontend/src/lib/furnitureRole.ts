/**
 * What a piece of furniture is FOR. The studio lays pieces out by role (a sofa with a coffee table
 * in front, chairs around the dining table...), grouped lounge / dining / sleep / work / storage /
 * extra. Mirrors `infer_role` in backend/app/services/ai_designer.py: keep the two in step.
 */

export type FurnitureRole =
  | 'sofa' | 'armchair' | 'coffee_table' | 'tv_unit'
  | 'dining_table' | 'dining_chair'
  | 'bed' | 'nightstand'
  | 'desk' | 'desk_chair'
  | 'wardrobe' | 'shelf'
  | 'decor' | 'rug'
  | 'bathtub' | 'sink' | 'toilet' | 'shower' | 'bidet'

export type GroupId = 'lounge' | 'dining' | 'sleep' | 'work' | 'storage' | 'extra' | 'plumbing'

export const ROLE_GROUP: Record<FurnitureRole, GroupId> = {
  sofa: 'lounge', armchair: 'lounge', coffee_table: 'lounge', tv_unit: 'lounge',
  dining_table: 'dining', dining_chair: 'dining',
  bed: 'sleep', nightstand: 'sleep',
  desk: 'work', desk_chair: 'work',
  wardrobe: 'storage', shelf: 'storage',
  decor: 'extra', rug: 'extra',
  bathtub: 'plumbing', sink: 'plumbing', toilet: 'plumbing', shower: 'plumbing', bidet: 'plumbing',
}

export function isRole(v: unknown): v is FurnitureRole {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ROLE_GROUP, v)
}

// Name rules, first match wins; Latin, Uzbek and Russian names. Cyrillic "тв" is matched with
// lookarounds, not \b: JavaScript's \b knows only ASCII letters. "tumbochka" is a bedside table, so it must not reach "tumba" (a TV stand).
// "ish" must start a word: "ovqatlanish stuli" is a dining chair, not a desk chair.
// A Russian name that is just "Стол <model>" is an office shop's desk: a dining table says
// "обеденный" or "кухонный", and "Стол-книжка" / "Стол-трансформер" are folding tables.
// Plumbing fixtures first: the shop files them under "boshqa", and "Ванна" must reach no later rule.
// Only the word itself ("ванна", not "ванной"): a "Шкаф для ванной" is a cabinet.
const ROLE_BY_NAME: Array<[RegExp, FurnitureRole]> = [
  [/^(?!.*(?:shkaf|шкаф|cabinet|tumb|тумб|polka|полк|javon|oyna|зеркал|mirror|parda|штор|curtain|gilam|коврик|qopqo|крышк|[её]ршик|brush|holder|держател|boshi|лейк)).*(?:(?<![а-яё])ванна(?![а-яё])|\bvanna\b(?!\s+xona)|bathtub)/i, 'bathtub'],
  [/^(?!.*(?:shkaf|шкаф|cabinet|tumb|тумб|polka|полк|javon|oyna|зеркал|mirror|parda|штор|curtain|gilam|коврик|qopqo|крышк|[её]ршик|brush|holder|держател|boshi|лейк)).*(?:rakovina|umivalnik|moyka|раковин|умывальник|мойк|\bsink\b|washbasin)/i, 'sink'],
  [/^(?!.*(?:shkaf|шкаф|cabinet|tumb|тумб|polka|полк|javon|oyna|зеркал|mirror|parda|штор|curtain|gilam|коврик|qopqo|крышк|[её]ршик|brush|holder|держател|boshi|лейк)).*(?:unitaz|унитаз|\btoilet\b|\bwc\b)/i, 'toilet'],
  [/^(?!.*(?:shkaf|шкаф|cabinet|tumb|тумб|polka|полк|javon|oyna|зеркал|mirror|parda|штор|curtain|gilam|коврик|qopqo|крышк|[её]ршик|brush|holder|держател|boshi|лейк)).*(?:\bdush(?!anba)|(?<![а-яё])душ(?!ист)|shower)/i, 'shower'],
  [/^(?!.*(?:shkaf|шкаф|cabinet|tumb|тумб|polka|полк|javon|oyna|зеркал|mirror|parda|штор|curtain|gilam|коврик|qopqo|крышк|[её]ршик|brush|holder|держател|boshi|лейк)).*(?:\bbide\b|(?<![а-яё])биде(?![а-яё])|bidet)/i, 'bidet'],
  [/gilam|rug|carpet|kovrolin|ков[её]р|ковр|палас/i, 'rug'],
  [/jurnal|kofe|coffee|журнальн|кофейн/i, 'coffee_table'],
  [/tumbochka|nightstand|prikrovat|тумбочк|прикроватн/i, 'nightstand'],
  [/\btv\b|televizor|tumba|(?<![а-яё])тв(?![а-яё])|телевизор|тумб/i, 'tv_unit'],
  [/\bish stuli|ofis stuli|kompyuter stuli|kreslo-kompyuter|office chair|desk chair|(офисн|компьютерн)\S*\s+(стул|кресл)/i, 'desk_chair'],
  [/yozuv|kompyuter|desk|\bish stoli|(компьютерн|письменн|офисн|рабоч)\S*\s+стол|^\s*стол(?![-а-яё])(?!.*(?:обеден|кухон))/i, 'desk'],
  [/kreslo|armchair|кресл/i, 'armchair'],
  [/shkaf|garderob|wardrobe|шкаф|гардероб/i, 'wardrobe'],
  [/javon|komod|stellaj|vitrina|bookcase|стеллаж|комод|витрин/i, 'shelf'],
]
// The admin's "shkaf" holds wardrobes and open shelving alike; one whose name says neither
// ("LOFT", "Quadro") is read as a shelf: a shelf stands anywhere, a wardrobe in a living room or
// study does not. A bedroom's wardrobe is picked by name (`WARDROBE_NAME`), not by this.
const ROLE_BY_CATEGORY: Record<string, FurnitureRole> = {
  divan: 'sofa', karavot: 'bed', stol: 'dining_table', stul: 'dining_chair', shkaf: 'shelf',
}

/**
 * A wardrobe for clothes, by name. "Shkaf" alone names any cupboard (a bookcase, a bathroom cabinet),
 * which `inferRole` reads as a wardrobe too; only one named like this stands in for a wardrobe or is
 * worth a wardrobe's weight in a bedroom.
 */
export const WARDROBE_NAME = /kiyim shkaf|garderob|wardrobe|шкаф для одежды|гардероб/i

/** The role of a catalog piece from its name, then its category; anything else is decor. */
export function inferRole(category: string | null | undefined, name: string): FurnitureRole {
  for (const [pattern, role] of ROLE_BY_NAME) if (pattern.test(name || '')) return role
  return ROLE_BY_CATEGORY[category ?? ''] ?? 'decor'
}
