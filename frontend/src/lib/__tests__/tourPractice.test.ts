import { beforeEach, describe, it, expect } from "vitest";
import { newFurnitureIds, savePractice, loadPractice, clearPractice, PRACTICE_KEY } from "../tourPractice";

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
  it("round-trips", () => {
    savePractice({ roomId: "r1", ids: ["c"] });
    expect(loadPractice()).toEqual({ roomId: "r1", ids: ["c"] });
  });
  it("removes the record when ids is empty", () => {
    savePractice({ roomId: "r1", ids: ["c"] });
    savePractice({ roomId: "r1", ids: [] });
    expect(loadPractice()).toBeNull();
    expect(localStorage.getItem(PRACTICE_KEY)).toBeNull();
  });
  it("treats corrupt JSON as no record", () => {
    localStorage.setItem(PRACTICE_KEY, "{bad");
    expect(loadPractice()).toBeNull();
  });
  it("clearPractice removes it", () => {
    savePractice({ roomId: "r1", ids: ["c"] });
    clearPractice();
    expect(loadPractice()).toBeNull();
  });
  it("swallows storage errors", () => {
    expect(() => savePractice({ roomId: "r1", ids: ["c"] }, throwing)).not.toThrow();
    expect(() => savePractice({ roomId: "r1", ids: [] }, throwing)).not.toThrow();
    expect(loadPractice(throwing)).toBeNull();
    expect(() => clearPractice(throwing)).not.toThrow();
  });
});
