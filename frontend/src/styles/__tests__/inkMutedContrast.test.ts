import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The grey notes of the estimate (a line's formula, "Shop: ...", the group's line count) are
// `text-ink-muted` on a card, on the soft tile a hovered row turns, or straight on the app
// background. QA re-check R11 found them too faint: WCAG AA asks 4.5:1 for text this small.
const css = readFileSync(join(__dirname, "..", "global.css"), "utf8");

type Rgb = [number, number, number];

/** The day value of a channel token is its first definition, the night value its second. */
function channels(token: string): { day: Rgb; night: Rgb } {
  const found = [...css.matchAll(new RegExp(`${token}:\\s*(\\d+) (\\d+) (\\d+);`, "g"))].map(
    (m) => [Number(m[1]), Number(m[2]), Number(m[3])] as Rgb,
  );
  expect(found.length, token).toBeGreaterThanOrEqual(2);
  return { day: found[0], night: found[1] };
}

function hex(value: string): Rgb {
  const h = value.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

/** The app background: the day one first, the night one the last a night rule sets. */
function appBackground(): { day: Rgb; night: Rgb } {
  const day = /--color-app-bg:\s*(#[0-9a-f]{6})/i.exec(css)![1];
  const night = [...css.matchAll(/data-app-theme='night'\][^{]*\{[^}]*--color-app-bg:\s*(#[0-9a-f]{6})/gi)].pop()![1];
  return { day: hex(day), night: hex(night) };
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("muted text contrast (QA re-check R11)", () => {
  const muted = channels("--ink-muted");
  const backgrounds = {
    card: channels("--card"),
    "card-soft": channels("--card-soft"),
    "app background": appBackground(),
  };

  for (const theme of ["day", "night"] as const) {
    for (const [name, bg] of Object.entries(backgrounds)) {
      it(`ink-muted on ${name} meets WCAG AA (4.5:1) by ${theme}`, () => {
        expect(contrast(muted[theme], bg[theme])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
