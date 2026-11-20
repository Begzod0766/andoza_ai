import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Mobile QA (2026-11-10 #5, 2026-11-11 #8): the estimate's amber notes ("Approximate price — …",
// "of which approximate: …", the "approximate" badge) could hardly be read on the night theme.
// They were classed `text-orange-500` / `bg-orange-500/15`, which this project's Tailwind config
// does not have: `orange` is one colour there, with no shades, so the classes made no CSS at all and
// the notes took whatever colour their parent had. They now use the `warn` token, which has a day and
// a night value.
const src = join(__dirname, "..", "..");
const css = readFileSync(join(__dirname, "..", "global.css"), "utf8");
const ESTIMATE_FILES = ["components/smeta/CategorySection.tsx", "pages/smeta/SmetaPage.tsx"];

type Rgb = [number, number, number];
function channels(token: string): { day: Rgb; night: Rgb } {
  const found = [...css.matchAll(new RegExp(`${token}:\\s*(\\d+) (\\d+) (\\d+);`, "g"))].map(
    (m) => [Number(m[1]), Number(m[2]), Number(m[3])] as Rgb,
  );
  expect(found.length, token).toBeGreaterThanOrEqual(2);
  return { day: found[0], night: found[1] };
}
function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** `fg` at `alpha` over `bg`: what a `bg-warn/15` badge's ground comes out as. */
const over = (fg: Rgb, bg: Rgb, alpha: number): Rgb => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as Rgb;

describe("the estimate's amber notes", () => {
  it.each(ESTIMATE_FILES)("%s uses no orange shade class (the config has none, so they draw nothing)", (file) => {
    const text = readFileSync(join(src, file), "utf8");
    expect(text.match(/\b(?:text|bg|border|ring)-orange-\d+/g) ?? []).toEqual([]);
  });

  it("the warning under a line, the badge and the 'of which approximate' line are in the warn colour", () => {
    const section = readFileSync(join(src, ESTIMATE_FILES[0]), "utf8");
    const page = readFileSync(join(src, ESTIMATE_FILES[1]), "utf8");
    expect(section).toMatch(/line\.warning && <p className="[^"]*\btext-warn\b/);
    expect(section).toMatch(/bg-warn\/15[^"]*\btext-ink\b/);
    expect(page).toMatch(/className="[^"]*\btext-warn\b[^"]*">\s*\{t\("smeta\.shundan_taxminiy"\)\}/);
  });

  const warn = channels("--warn");
  const ink = channels("--ink");
  const grounds = { card: channels("--card"), "card-soft": channels("--card-soft") };
  for (const theme of ["day", "night"] as const) {
    for (const [name, bg] of Object.entries(grounds)) {
      it(`warn text on ${name} meets WCAG AA (4.5:1) by ${theme}`, () => {
        expect(contrast(warn[theme], bg[theme])).toBeGreaterThanOrEqual(4.5);
      });
      it(`the badge's text (ink on a 15% warn tint) over ${name} meets WCAG AA by ${theme}`, () => {
        expect(contrast(ink[theme], over(warn[theme], bg[theme], 0.15))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
