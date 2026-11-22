/**
 * "How it works" replays the hero's room timeline as three chapters, one per
 * step: the plan is traced (scan), the room is built and furnished (design),
 * the prices pin on (estimate). Times are seconds on the same timeline.
 */
import { END } from "./roomTimeline";

export const STEP_SPANS: [number, number][] = [
  [0, 1.25],
  [1.25, 4.75],
  [4.75, END],
];

const LINE_FILL = 0.45; // s the connector after a step takes to fill

/** What step `i` shows at moment `t`: its own frame, whether it is lit, and how full the line after it is. */
export function stepView(t: number, i: number) {
  const [a, b] = STEP_SPANS[i];
  return {
    // before its turn a step is an empty sheet, so it gives nothing away
    t: t < a ? 0 : Math.min(t, b),
    lit: t >= a,
    line: Math.min(1, Math.max(0, (t - b) / LINE_FILL)),
  };
}
