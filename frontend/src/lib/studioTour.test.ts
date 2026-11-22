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

describe("STUDIO_TOUR_STEPS", () => {
  it("lists the eight steps in order", () => {
    expect(STUDIO_TOUR_STEPS.map((s) => s.id)).toEqual(
      ["surface", "furniture", "stage", "menu", "undo", "lock", "camera", "help"],
    );
  });

  it("has the do/show kinds and targets (shallow to deep)", () => {
    expect(STUDIO_TOUR_STEPS.map((s) => [s.id, s.kind, s.targets])).toEqual([
      ["surface", "do", ["scene"]],
      ["furniture", "do", ["arc-mebel", "arc-mebel-ring-0", "arc-mebel-ring-1"]],
      ["stage", "do", ["stage", "stage-list"]],
      ["menu", "show", ["menu"]],
      ["undo", "show", ["undo"]],
      ["lock", "show", ["lock"]],
      ["camera", "show", ["camera"]],
      ["help", "show", ["help"]],
    ]);
  });

  it("remembers under the v2 key and ignores the v1 one", () => {
    expect(STUDIO_TOUR_KEY).toBe("studio.tour.v2.done");
    const s = memoryStorage();
    s.setItem("studio.tour.v1.done", "1");
    expect(isStudioTourDone(s)).toBe(false);
  });
});

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
    const r = presentSteps(STUDIO_TOUR_STEPS, (t) => t !== "arc-mebel");
    expect(r.map((s) => s.id)).not.toContain("furniture");
    expect(r).toHaveLength(STUDIO_TOUR_STEPS.length - 1);
  });

  it("keeps a step when its first target is on screen", () => {
    expect(presentSteps(STUDIO_TOUR_STEPS, (t) => t === "scene").map((s) => s.id)).toEqual(["surface"]);
  });
});

describe("shouldStartStudioTour", () => {
  it("starts only when not done, compact and in the editing view", () => {
    for (const done of [false, true]) for (const compact of [false, true]) for (const editingView of [false, true]) {
      expect(shouldStartStudioTour({ done, compact, editingView })).toBe(!done && compact && editingView);
    }
  });
});
