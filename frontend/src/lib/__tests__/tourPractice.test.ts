import { beforeEach, describe, it, expect } from "vitest";
import { newFurnitureIds, savePractice, loadPractice, clearPractice, practiceKey, PRACTICE_KEY } from "../tourPractice";

const throwing = {
  getItem() { throw new Error("denied"); },
  setItem() { throw new Error("denied"); },
  removeItem() { throw new Error("denied"); },
} as unknown as Storage;

beforeEach(() => localStorage.clear());

describe("newFurnitureIds", () => {
  it("returns ids missing from the baseline, in current order", () => {
    expect(newFurnitureIds(["a", "b"], [{ id: "a" }, { id: "c" }, { id: "b" }, { id: "d" }])).toEqual(["c", "d"]);
  });
  it("returns [] for empty current", () => {
    expect(newFurnitureIds(["a"], [])).toEqual([]);
  });
});

describe("practice record", () => {
  it("round-trips, under the room's own key", () => {
    savePractice({ roomId: "r1", ids: ["c"] });
    expect(loadPractice("r1")).toEqual({ roomId: "r1", ids: ["c"] });
    expect(practiceKey("r1")).toBe(`${PRACTICE_KEY}.r1`);
    expect(localStorage.getItem(`${PRACTICE_KEY}.r1`)).not.toBeNull();
  });
  it("keeps one record per room: saving or clearing one room leaves another's alone", () => {
    savePractice({ roomId: "A", ids: ["a1"] });
    savePractice({ roomId: "B", ids: ["b1"] });
    expect(loadPractice("A")).toEqual({ roomId: "A", ids: ["a1"] });
    savePractice({ roomId: "B", ids: [] });
    clearPractice("B");
    expect(loadPractice("B")).toBeNull();
    expect(loadPractice("A")).toEqual({ roomId: "A", ids: ["a1"] });
  });
  it("removes the record when ids is empty", () => {
    savePractice({ roomId: "r1", ids: ["c"] });
    savePractice({ roomId: "r1", ids: [] });
    expect(loadPractice("r1")).toBeNull();
    expect(localStorage.getItem(practiceKey("r1"))).toBeNull();
  });
  it("treats corrupt JSON, or a record of another room under this key, as no record", () => {
    localStorage.setItem(practiceKey("r1"), "{bad");
    expect(loadPractice("r1")).toBeNull();
    localStorage.setItem(practiceKey("r1"), JSON.stringify({ roomId: "r2", ids: ["x"] }));
    expect(loadPractice("r1")).toBeNull();
  });
  it("clearPractice removes it", () => {
    savePractice({ roomId: "r1", ids: ["c"] });
    clearPractice("r1");
    expect(loadPractice("r1")).toBeNull();
  });
  it("swallows storage errors", () => {
    expect(() => savePractice({ roomId: "r1", ids: ["c"] }, throwing)).not.toThrow();
    expect(() => savePractice({ roomId: "r1", ids: [] }, throwing)).not.toThrow();
    expect(loadPractice("r1", throwing)).toBeNull();
    expect(() => clearPractice("r1", throwing)).not.toThrow();
  });
});
