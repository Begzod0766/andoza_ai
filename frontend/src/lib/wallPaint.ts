/**
 * Whether a shop's "boyoq" product is a wall paint (kitchen QA 2026-11-18 K9): shops file alkyd enamels
 * (ПФ-115 and the like, for metal and wood) as paint, and the wall paint list showed them. The estimate's
 * stand-in wall paint leaves them out by the same words (backend app/services/estimate_catalog _ENAMEL).
 */
const ENAMEL = /enamel|emal|эмал|alkyd|алкид|пф-?\s?115|pf-?\s?115/i

export const isWallPaint = (name: string): boolean => !ENAMEL.test(name)
