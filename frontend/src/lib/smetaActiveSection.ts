/**
 * The estimate section being read: the last one whose top has passed under the sticky bar
 * (`barBottom`, px from the viewport top). Before any has, the first; at the very bottom of the
 * page, the last, which may never reach the bar because the page cannot scroll that far.
 *
 * Not "the first section still on screen": the previous section's tail often still shows at the
 * top while the next fills the screen, and that marked the wrong one (prod, 2026-11-07).
 */
export function activeSection<K extends string>(tops: Array<[K, number]>, barBottom: number, atEnd: boolean): K | null {
  if (tops.length === 0) return null;
  if (atEnd) return tops[tops.length - 1][0];
  let current = tops[0][0];
  for (const [key, top] of tops) {
    if (top <= barBottom + 8) current = key;
  }
  return current;
}
