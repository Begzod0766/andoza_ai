/**
 * The number a person reads for a wall. Drawn and scanned rooms keep their walls under ids
 * "0", "1", … — a programmer's count — so a label shows one more: "Devor 1" is wall "0".
 * Lettered ids (the wizard's A–D, a scan's "W3") already read as names and stay as they are.
 * Every place that writes a wall's name goes through this, so the studio, the settings sheet
 * and the estimate always call a wall the same thing; the ids in the data do not change.
 */
export function wallNumber(id: string): string {
  return /^\d+$/.test(id) ? String(Number(id) + 1) : id;
}
