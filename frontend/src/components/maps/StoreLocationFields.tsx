import { Suspense, useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/Input";
import { parsePoint } from "@/lib/storeLocation";
import { LazyPointPicker } from "./lazyMaps";

export interface LocationDraft {
  address: string;
  lat: string;
  lng: string;
}

export const locationDraft = (s: { address?: string | null; lat?: number | null; lng?: number | null }): LocationDraft => ({
  address: s.address ?? "",
  lat: s.lat != null ? String(s.lat) : "",
  lng: s.lng != null ? String(s.lng) : "",
});

/** The address and map-point part of a shop form: type lat/lng, or tap the point on a map. */
export function StoreLocationFields({ value, onChange }: { value: LocationDraft; onChange: (next: LocationDraft) => void }) {
  const { t } = useTranslation();
  const [mapOpen, setMapOpen] = useState(false);
  const parsed = parsePoint(value.lat, value.lng);
  const point = parsed.ok ? parsed.point : null;

  return (
    <fieldset className="space-y-3 rounded-2xl border border-line p-3">
      <legend className="px-1 text-xs font-semibold text-ink-muted">{t("seller.location.title")}</legend>
      <Input themed label={t("seller.location.address")} placeholder={t("seller.location.address_placeholder")}
        value={value.address} maxLength={300} onChange={(e) => onChange({ ...value, address: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <Input themed label={t("seller.location.lat")} inputMode="decimal" value={value.lat}
          onChange={(e) => onChange({ ...value, lat: e.target.value })} />
        <Input themed label={t("seller.location.lng")} inputMode="decimal" value={value.lng}
          onChange={(e) => onChange({ ...value, lng: e.target.value })} />
      </div>
      {!parsed.ok && <p role="alert" className="text-xs text-red-500">{t(parsed.error)}</p>}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button type="button" onClick={() => setMapOpen((o) => !o)}
          className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
          <MapPin size={14} aria-hidden="true" />
          {mapOpen ? t("seller.location.hide_map") : t("seller.location.pick")}
        </button>
        {(value.lat || value.lng) && (
          <button type="button" onClick={() => onChange({ ...value, lat: "", lng: "" })} className="font-semibold text-ink-muted hover:text-red-500">
            {t("seller.location.clear")}
          </button>
        )}
      </div>
      {mapOpen && (
        <div className="space-y-1">
          <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-xl bg-card-soft" />}>
            <LazyPointPicker
              value={point}
              label={t("seller.location.pick_hint")}
              onChange={(p) => onChange({ ...value, lat: String(Math.round(p.lat * 1e6) / 1e6), lng: String(Math.round(p.lng * 1e6) / 1e6) })}
            />
          </Suspense>
          <p className="text-xs text-ink-muted">{t("seller.location.pick_hint")}</p>
        </div>
      )}
      <p className="text-xs text-ink-muted">{t("seller.location.hint")}</p>
    </fieldset>
  );
}

/** The PATCH fields for a draft, or the error key when the point is not valid. */
export function locationPatch(d: LocationDraft): { address: string | null; lat: number | null; lng: number | null } | { error: string } {
  const parsed = parsePoint(d.lat, d.lng);
  if (!parsed.ok) return { error: parsed.error };
  return { address: d.address.trim() || null, lat: parsed.point?.lat ?? null, lng: parsed.point?.lng ?? null };
}
