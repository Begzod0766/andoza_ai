import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The page the host nginx shows for 502/503/504 (deploy/errors/, docs/WEB_PROD_DEPLOY.md §4).
const html = readFileSync(resolve(__dirname, "../../../deploy/errors/andoza-502.html"), "utf8");

describe("deploy/errors/andoza-502.html", () => {
  it("stands alone: no external script, style, font or image", () => {
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/(src|href)=["']https?:/i);
  });

  it("says it in uz, ru and en, retries by itself and has a retry button", () => {
    expect(html).toContain("Yangilanmoqda");
    expect(html).toContain("Обновляемся");
    expect(html).toContain("Updating");
    expect(html).toMatch(/<button[^>]*id="retry"/);
    expect(html).toMatch(/setTimeout\(/);
    expect(html).toMatch(/location\.reload\(\)/);
  });

  it("fits a phone", () => {
    expect(html).toMatch(/name="viewport"/);
    expect(html).toMatch(/charset="utf-8"/i);
  });
});
