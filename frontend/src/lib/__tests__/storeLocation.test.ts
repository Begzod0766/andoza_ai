import { describe, expect, it } from "vitest";
import { parsePoint } from "@/lib/storeLocation";

describe("parsePoint", () => {
  it("accepts a point in Uzbekistan, with a comma decimal too", () => {
    expect(parsePoint("41.311081", "69.240562")).toEqual({ ok: true, point: { lat: 41.311081, lng: 69.240562 } });
    expect(parsePoint("41,3", " 69,2 ")).toEqual({ ok: true, point: { lat: 41.3, lng: 69.2 } });
  });

  it("two blanks clear the point", () => {
    expect(parsePoint("", " ")).toEqual({ ok: true, point: null });
  });

  it("one without the other is an error", () => {
    expect(parsePoint("41.3", "")).toEqual({ ok: false, error: "seller.location.pair" });
  });

  it("refuses points outside Uzbekistan, swapped pairs and junk", () => {
    expect(parsePoint("55.75", "37.62")).toEqual({ ok: false, error: "seller.location.outside" });
    expect(parsePoint("69.24", "41.31")).toEqual({ ok: false, error: "seller.location.outside" });
    expect(parsePoint("abc", "69")).toEqual({ ok: false, error: "seller.location.outside" });
  });

  it("rounds to 6 decimals", () => {
    expect(parsePoint("41.1234567891", "69.9876543219")).toEqual({ ok: true, point: { lat: 41.123457, lng: 69.987654 } });
  });
});
