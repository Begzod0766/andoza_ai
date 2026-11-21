import { describe, expect, it, vi } from "vitest";
import { emitTourEvent, onTourEvent } from "../studioTourEvents";

describe("studioTourEvents", () => {
  it("calls a subscriber once per emit", () => {
    const cb = vi.fn();
    const off = onTourEvent("surface-picked", cb);
    emitTourEvent("surface-picked");
    expect(cb).toHaveBeenCalledTimes(1);
    off();
  });

  it("stops calling after unsubscribe", () => {
    const cb = vi.fn();
    const off = onTourEvent("surface-picked", cb);
    off();
    emitTourEvent("surface-picked");
    expect(cb).toHaveBeenCalledTimes(0);
  });

  it("does not mix events", () => {
    const cb = vi.fn();
    const off = onTourEvent("surface-picked", cb);
    emitTourEvent("restore-view");
    expect(cb).not.toHaveBeenCalled();
    off();
  });
});
