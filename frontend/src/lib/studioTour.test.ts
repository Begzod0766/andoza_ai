import { describe, expect, it } from "vitest";
import {
  STUDIO_TOUR_KEY,
  STUDIO_TOUR_STEPS,
  isStudioTourDone,
  markStudioTourDone,
  presentSteps,
  shouldStartStudioTour,
} from "./studioTour";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  };
}

function throwingStorage(): Storage {
  const boom = () => { throw new Error("denied"); };
  return { length: 0, clear: boom, getItem: boom, key: boom, removeItem: boom, setItem: boom };
}

describe("studioTour state", () => {
  it("is not done with an empty storage", () => {
    expect(isStudioTourDone(memoryStorage())).toBe(false);
  });

  it("marks both the tour and the tap hint as seen", () => {
    const s = memoryStorage();
    markStudioTourDone(s);
    expect(s.getItem(STUDIO_TOUR_KEY)).toBe("1");
    expect(s.getItem("studio.tapHint.seen")).toBe("1");
    expect(isStudioTourDone(s)).toBe(true);
  });

  it("survives a storage that throws", () => {
    const s = throwingStorage();
    expect(isStudioTourDone(s)).toBe(false);
    expect(() => markStudioTourDone(s)).not.toThrow();
  });

  it("survives a missing storage", () => {
    expect(isStudioTourDone(null)).toBe(false);
    expect(() => markStudioTourDone(null)).not.toThrow();
  });
});

describe("presentSteps", () => {
  it("drops steps whose target is absent", () => {
    const r = presentSteps(STUDIO_TOUR_STEPS, (t) => t !== "camera");
    expect(r).not.toContain("camera");
    expect(r).toHaveLength(STUDIO_TOUR_STEPS.length - 1);
  });
});

describe("shouldStartStudioTour", () => {
  it("starts only when not done, compact and in the editing view", () => {
    for (const done of [false, true]) for (const compact of [false, true]) for (const editingView of [false, true]) {
      expect(shouldStartStudioTour({ done, compact, editingView })).toBe(!done && compact && editingView);
    }
  });
});
