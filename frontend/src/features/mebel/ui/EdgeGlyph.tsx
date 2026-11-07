import type { Part } from "@/features/mebel/engine";
import { formatBand } from "./format";

const SIDES = ["L1", "L2", "W1", "W2"] as const;

/** "L1 2 mm · L2 — · W1 0.4 mm · W2 —": the banding of each side, in words. */
export function edgesText(edges: Part["edges"]): string {
  return SIDES.map((s) => {
    const band = formatBand(edges[s]);
    return `${s} ${band === "—" ? "—" : `${band} mm`}`;
  }).join(" · ");
}

/**
 * A part's banding as a small rectangle: L1 along the top, L2 the bottom, W1 the left, W2 the
 * right. A banded side is drawn thick (faded for a hidden band), a bare side as a hairline.
 */
export function EdgeGlyph({ edges }: { edges: Part["edges"] }) {
  const w = 28, h = 18, p = 2;
  const lines = {
    L1: [p, p, w - p, p], L2: [p, h - p, w - p, h - p], W1: [p, p, p, h - p], W2: [w - p, p, w - p, h - p],
  } as const;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="text-ink">
      {SIDES.map((s) => {
        const side = edges[s];
        const [x1, y1, x2, y2] = lines[s];
        return (
          <line key={s} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeLinecap="round"
            strokeWidth={side ? 3 : 0.75} opacity={side ? (side.band === "hidden" ? 0.5 : 1) : 0.45} />
        );
      })}
    </svg>
  );
}
