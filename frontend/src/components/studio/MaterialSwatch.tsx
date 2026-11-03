import type { Material } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { intlLocale } from "@/i18n";

interface MaterialSwatchProps {
  material: Material;
  isActive: boolean;
  onClick: () => void;
}

/**
 * "Here's a do'kon-managed material product, tap to select it" — the one shared visual for
 * every horizontal-scroll product strip (Bo'yoq, Oboy, and the mobile "+ Buyum qo'shish"
 * sheet's paint section). It shows the product's colour (or picture, or the name's first
 * letter when it has neither), its whole name — the code or shade is what tells two
 * "Краска Polisan" apart — and its price per unit.
 */
export function MaterialSwatch({ material, isActive, onClick }: MaterialSwatchProps) {
  const { t } = useTranslation();
  const price = t("common.price_per_unit", { price: material.price_uzs.toLocaleString(intlLocale()), unit: material.unit });
  return (
    <button
      title={`${material.name_uz} — ${price}`}
      onClick={onClick}
      aria-pressed={isActive}
      className="flex w-20 flex-shrink-0 flex-col items-center gap-1"
    >
      <div
        className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border-2 bg-card-soft text-sm font-bold text-ink-muted transition-all ${
          isActive ? "border-accent ring-2 ring-accent" : "border-line"
        }`}
        style={material.color_hex ? { backgroundColor: material.color_hex } : undefined}
      >
        {!material.color_hex && (material.image_url
          ? <img src={material.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          : material.name_uz.slice(0, 1).toUpperCase())}
      </div>
      <span className="line-clamp-2 text-center text-[10px] leading-tight text-ink">{material.name_uz}</span>
      <span className="text-center text-[10px] font-semibold leading-tight text-ink-muted">{price}</span>
    </button>
  );
}
