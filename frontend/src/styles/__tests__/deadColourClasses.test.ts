import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import config from "../../../tailwind.config";

// `theme.extend.colors` REPLACES a Tailwind default palette of the same name. This project sets
// `orange` to one colour, so `text-orange-500`, `bg-orange-50`, `border-orange-200` generate no
// CSS at all: the warning toast had no background and no border, and nothing failed. The scan
// below reads the config, so it holds for any colour the config defines, not just orange.
const SRC = join(__dirname, "..", "..");
const css = readFileSync(join(__dirname, "..", "global.css"), "utf8");
const colors = config.theme!.extend!.colors as Record<string, string | Record<string, string>>;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) ? [path] : [];
  });
}

/** `<utility>-<colour>-<shade>` where the config's colour has no such shade. */
function deadClasses(): string[] {
  const names = Object.keys(colors).sort((a, b) => b.length - a.length).join("|");
  const pattern = new RegExp(`(?<![\\w-])([a-z]+(?:-[a-z]+)*?)-(${names})-(\\d{2,3})(?![\\w-])`, "g");
  const found: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const name = relative(SRC, file).split("\\").join("/");
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      for (const m of line.matchAll(pattern)) {
        const value = colors[m[2]];
        const shades = typeof value === "string" ? [] : Object.keys(value);
        if (!shades.includes(m[3])) found.push(`${name}:${i + 1} ${m[0]}`);
      }
    });
  }
  return found;
}

type Rgb = [number, number, number];

function hex(value: string): Rgb {
  const h = value.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

/** The day value of a channel token is its first definition, the night value its second. */
function channels(token: string): { day: Rgb; night: Rgb } {
  const found = [...css.matchAll(new RegExp(`${token}:\\s*(\\d+) (\\d+) (\\d+);`, "g"))].map(
    (m) => [Number(m[1]), Number(m[2]), Number(m[3])] as Rgb,
  );
  expect(found.length, token).toBeGreaterThanOrEqual(2);
  return { day: found[0], night: found[1] };
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

/** `fg` at `alpha` over `bg`: what a `bg-warn/15` chip's ground comes out as. */
function over(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as Rgb;
}

const read = (name: string) => readFileSync(join(SRC, name), "utf8");

describe("colour classes the Tailwind config does not generate", () => {
  it("no source file uses a shade of a colour the config defines without that shade", () => {
    expect(deadClasses()).toEqual([]);
  });
});

describe("the orange surfaces that carry text", () => {
  // Both are fixed-light surfaces (the toast and the studio sidebar do not follow the night
  // theme), so one pair of config colours covers day and night.
  it("the warning toast has a ground, a border, and its icon and title in orange-cta", () => {
    const toast = read("components/ui/Toast.tsx");
    expect(toast).toMatch(/warning:\s*'bg-orange-tint border border-orange\/30 /);
    expect(toast.match(/warning: 'text-orange-cta'/g)).toHaveLength(2);
  });

  it("the socket-wire heading of the studio's measurements is orange-cta on orange-tint", () => {
    expect(read("pages/studio/placement/OlchamlarSidebar.tsx")).toMatch(/color="bg-orange-tint text-orange-cta"/);
  });

  it("orange-cta on orange-tint meets WCAG AA (4.5:1)", () => {
    expect(contrast(hex(colors["orange-cta"] as string), hex(colors["orange-tint"] as string))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the shop admin's tab count chip", () => {
  // A themed surface: the chip sits on a tab, on the card, and the tab turns `bg-ink/10` on hover.
  it("is ink on a 15% warn tint", () => {
    expect(read("pages/dokon/AdminCatalogPanel.tsx")).toMatch(/"bg-warn\/15 text-ink"/);
  });

  const warn = channels("--warn");
  const ink = channels("--ink");
  const card = channels("--card");
  for (const theme of ["day", "night"] as const) {
    it(`its text meets WCAG AA (4.5:1) on a resting and on a hovered tab by ${theme}`, () => {
      const hovered = over(ink[theme], card[theme], 0.1);
      for (const ground of [card[theme], hovered]) {
        expect(contrast(ink[theme], over(warn[theme], ground, 0.15))).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

describe("the orange glow of a projects-page link card", () => {
  it("uses the config's orange", () => {
    expect(read("pages/projects/ProjectsPage.tsx")).toMatch(/"bg-orange\/25"/);
  });
});
