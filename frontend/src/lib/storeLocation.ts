/** A shop's map point as typed in the shop form. Mirrors the backend's check
 *  (app/schemas/store_location.py): both or neither, roughly inside Uzbekistan. */
export const UZ_LAT: [number, number] = [37.0, 45.8];
export const UZ_LNG: [number, number] = [55.8, 73.3];

export type PointResult =
  | { ok: true; point: { lat: number; lng: number } | null }
  | { ok: false; error: "seller.location.pair" | "seller.location.outside" };

const num = (raw: string) => Number(raw.trim().replace(",", "."));
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function insideUzbekistan(lat: number, lng: number): boolean {
  return lat >= UZ_LAT[0] && lat <= UZ_LAT[1] && lng >= UZ_LNG[0] && lng <= UZ_LNG[1];
}

export function parsePoint(latRaw: string, lngRaw: string): PointResult {
  const hasLat = latRaw.trim() !== "";
  const hasLng = lngRaw.trim() !== "";
  if (!hasLat && !hasLng) return { ok: true, point: null };
  if (hasLat !== hasLng) return { ok: false, error: "seller.location.pair" };
  const lat = num(latRaw);
  const lng = num(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !insideUzbekistan(lat, lng)) {
    return { ok: false, error: "seller.location.outside" };
  }
  return { ok: true, point: { lat: round6(lat), lng: round6(lng) } };
}
