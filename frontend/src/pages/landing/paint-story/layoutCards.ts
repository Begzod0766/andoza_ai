/**
 * Fits the paint-story cards into the stage. The path anchors put them where the
 * roller passes, which on a narrow phone can push a card off the side or onto
 * another card. This keeps each card inside the stage (with `gap` to spare) and,
 * where two would touch, moves the lower one down (or up, if there is no room
 * below) just enough; if that still cannot part them, the cards are stacked.
 * Cards that already fit stay exactly where they were.
 */
export interface CardBox {
  /** top-left corner and size, in stage px */
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export function layoutCards(cards: CardBox[], stage: { width: number; height: number }, gap: number): CardBox[] {
  const out = cards.map((c) => ({
    ...c,
    x: clamp(c.x, gap, stage.width - c.w - gap),
    y: clamp(c.y, gap, stage.height - c.h - gap),
  }));
  const touches = (a: CardBox, b: CardBox) =>
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

  const order = out.map((_, i) => i).sort((a, b) => out[a].y - out[b].y);
  const placed: CardBox[] = [];
  for (const i of order) {
    const c = out[i];
    for (let tries = 0; tries < out.length; tries++) {
      const hit = placed.filter((p) => touches(c, p));
      if (!hit.length) break;
      const below = Math.max(...hit.map((p) => p.y + p.h + gap));
      c.y = below + c.h <= stage.height - gap ? below : Math.max(gap, Math.min(...hit.map((p) => p.y)) - gap - c.h);
    }
    placed.push(c);
  }

  // No room to part them where the path put them (narrow phone, long words):
  // stack the cards top to bottom in the same order, spread evenly over the stage.
  const clash = out.some((a, i) => out.some((b, j) => j > i && touches(a, b)));
  if (clash) {
    const total = order.reduce((sum, i) => sum + out[i].h, 0);
    // on the smallest screens the gaps give way before the cards spill off the stage
    const space = Math.max(4, (stage.height - total) / (out.length + 1));
    let y = space;
    for (const i of order) {
      out[i].y = y;
      y += out[i].h + space;
    }
  }
  return out;
}
