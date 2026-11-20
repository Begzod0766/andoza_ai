import { afterEach, describe, expect, it, vi } from "vitest";
import { handOffExternal } from "@/lib/externalLink";

afterEach(() => {
  delete (window as unknown as { AndozaExternalLink?: unknown }).AndozaExternalLink;
});

describe("handOffExternal", () => {
  it("lets the browser follow the link when there is no app channel", () => {
    const preventDefault = vi.fn();
    handOffExternal({ preventDefault }, "https://yandex.uz/maps/?pt=1,2");
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("hands an https link to the mobile app's channel", () => {
    const postMessage = vi.fn();
    (window as unknown as { AndozaExternalLink: unknown }).AndozaExternalLink = { postMessage };
    const preventDefault = vi.fn();
    handOffExternal({ preventDefault }, "https://www.google.com/maps/search/?api=1&query=1%2C2");
    expect(preventDefault).toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith("https://www.google.com/maps/search/?api=1&query=1%2C2");
  });

  it("never hands over a non-http link", () => {
    const postMessage = vi.fn();
    (window as unknown as { AndozaExternalLink: unknown }).AndozaExternalLink = { postMessage };
    handOffExternal({ preventDefault: vi.fn() }, "javascript:alert(1)");
    expect(postMessage).not.toHaveBeenCalled();
  });
});
