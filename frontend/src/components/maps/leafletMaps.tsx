/**
 * The two Leaflet maps (OpenStreetMap tiles: free, no key). Kept in this one module so the
 * Leaflet code and CSS load only when a map is shown: import it through ./lazyMaps.
 *
 * OSM tile usage policy: the standard tile URL, the "© OpenStreetMap contributors"
 * attribution always visible, no bulk or offline fetching, and the browser's own Referer —
 * a handful of tiles per page view is what the policy allows.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';
/** Tashkent, where a new point starts when none is set. */
export const DEFAULT_CENTER: [number, number] = [41.3111, 69.2797];
const BRAND = "#2F55D4";

function baseMap(el: HTMLElement, opts: L.MapOptions = {}): L.Map {
  const map = L.map(el, { scrollWheelZoom: false, ...opts });
  L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
  return map;
}

export interface MapShop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** The estimate's shops as markers; clicking one calls onPick with the shop's id. */
export function ShopsMap({ shops, onPick, label }: { shops: MapShop[]; onPick: (id: string) => void; label: string }) {
  const el = useRef<HTMLDivElement | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const key = shops.map((s) => `${s.id}:${s.lat}:${s.lng}`).join("|");

  useEffect(() => {
    if (!el.current || shops.length === 0) return;
    // One-finger drag would trap the page's scroll on a phone: there the map pans with two.
    const map = baseMap(el.current, { dragging: !L.Browser.mobile, touchZoom: true });
    const points: L.LatLngExpression[] = [];
    for (const s of shops) {
      const at: L.LatLngExpression = [s.lat, s.lng];
      points.push(at);
      L.circleMarker(at, { radius: 9, color: "#fff", weight: 2, fillColor: BRAND, fillOpacity: 1 })
        .bindTooltip(s.name, { direction: "top", offset: [0, -8] })
        .on("click", () => pick.current(s.id))
        .addTo(map);
    }
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 15 });
    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={el} role="region" aria-label={label} data-testid="shops-map" className="h-56 w-full sm:h-64" />;
}

/** A map to set one point: tap to place it, tap elsewhere to move it. */
export function PointPicker({
  value,
  onChange,
  label,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (point: { lat: number; lng: number }) => void;
  label: string;
}) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!el.current) return;
    const m = baseMap(el.current);
    m.setView(value ? [value.lat, value.lng] : DEFAULT_CENTER, value ? 16 : 11);
    m.on("click", (e: L.LeafletMouseEvent) => change.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const at: L.LatLngExpression = [value.lat, value.lng];
    if (marker.current) marker.current.setLatLng(at);
    else marker.current = L.circleMarker(at, { radius: 9, color: "#fff", weight: 2, fillColor: BRAND, fillOpacity: 1 }).addTo(m);
  }, [value]);

  return <div ref={el} role="application" aria-label={label} data-testid="point-picker" className="h-64 w-full rounded-xl border border-line" />;
}
