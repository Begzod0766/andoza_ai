import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss, { type AtRule, type Rule } from "postcss";

// #184: focusing a field in the AI designer sheet made iOS zoom the page, and it stayed zoomed. iOS
// zooms onto any text field under 16px when it takes focus; the app's fields are text-sm (14px) and
// smaller. On a touch screen they must be at least 16px. The desktop look stays as it is, and user
// zoom stays on (no maximum-scale / user-scalable=no in the viewport: people need to pinch-zoom).
const root = postcss.parse(readFileSync(join(__dirname, "..", "global.css"), "utf8"));

function touchFieldRules(): Rule[] {
  const out: Rule[] = [];
  root.walkAtRules("media", (at: AtRule) => {
    if (!/pointer:\s*coarse/.test(at.params)) return;
    at.walkRules((rule) => out.push(rule));
  });
  return out;
}

describe("form fields are at least 16px on touch screens (#184, iOS focus zoom)", () => {
  it("a (pointer: coarse) rule sets input, select and textarea to 16px, over Tailwind's text-sm", () => {
    const rules = touchFieldRules();
    for (const tag of ["input", "select", "textarea"]) {
      const rule = rules.find((r) => r.selectors.some((s) => new RegExp(`(^|[\\s(,])${tag}\\b`).test(s)));
      expect(rule, tag).toBeDefined();
      const decl = rule!.nodes.find((n) => n.type === "decl" && n.prop === "font-size");
      expect(decl, `${tag} font-size`).toBeDefined();
      if (decl?.type !== "decl") continue;
      expect(decl.value).toMatch(/^16px$/);
      // text-sm and friends are utilities, which come later and would win without it.
      expect(decl.important).toBe(true);
    }
  });

  it("a field already larger than 16px keeps its size", () => {
    const sel = touchFieldRules().flatMap((r) => r.selectors).join(" ");
    for (const big of ["text-lg", "text-xl", "text-2xl"]) expect(sel).toContain(big);
  });

  it("is only for touch: no unconditional rule shrinks or grows fields on desktop", () => {
    root.walkRules((rule) => {
      const inMedia = rule.parent?.type === "atrule" && (rule.parent as AtRule).name === "media";
      if (inMedia) return;
      if (!rule.selectors.some((s) => /^(input|select|textarea)\b/.test(s.trim()))) return;
      expect(rule.nodes.some((n) => n.type === "decl" && n.prop === "font-size"), rule.selector).toBe(false);
    });
  });

  it("does not turn off pinch-zoom in the viewport meta", () => {
    const html = readFileSync(join(__dirname, "..", "..", "..", "index.html"), "utf8");
    const viewport = html.match(/<meta[^>]+name="viewport"[^>]*>/)?.[0] ?? "";
    expect(viewport).toContain("width=device-width");
    expect(viewport).not.toMatch(/maximum-scale|user-scalable\s*=\s*(no|0)/);
  });
});
