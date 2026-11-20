import { useState } from "react";
import { useTranslation } from "react-i18next";
import { intlLocale } from "@/i18n";
import type { EstimateLine } from "@/lib/api";
import { GROUP_COLOUR, formatQuantity, groupKeyFor } from "@/lib/smetaGroups";
import { localizeFormula, localizeLabel, localizeUnit, localizeWarning } from "@/lib/smetaLineText";
import { GROUP_ICON } from "./groupIcon";

const digits = (text: string) => text.replace(/\D/g, "");

/** "2 dona × 250 000 so'm" under a line that already says "2 dona × 250 000 so'm" adds nothing. */
function repeatsQuantityLine(line: EstimateLine): boolean {
  return digits(line.formula) === digits(`${formatQuantity(line.quantity)}${line.unit_price}`);
}

/** The shop product's photo, at a fixed size so the list does not jump as photos arrive;
 *  the line's section icon when there is no photo or it fails to load. */
export function LinePhoto({ line, label }: { line: EstimateLine; label: string }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const key = groupKeyFor(line.category);
  const Icon = GROUP_ICON[key];
  const colour = GROUP_COLOUR[key];
  const src = line.image_url && /^https?:\/\//i.test(line.image_url) ? line.image_url : null;
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={t("smeta.shop.photo_alt", { name: label })}
        width={48}
        height={48}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        data-testid="line-photo"
        className="h-12 w-12 shrink-0 rounded-xl border border-line bg-card-soft object-cover"
      />
    );
  }
  return (
    <span
      data-testid="line-icon"
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
      style={{ backgroundColor: `${colour}1F`, color: colour }}
    >
      <Icon size={20} strokeWidth={2.2} />
    </span>
  );
}

/**
 * One line of the estimate: its photo (or section icon), the name with the working underneath
 * (quantity x unit price, then the formula in full) and the amount on the right, so it reads
 * the same on a phone as on a desk. Under a shop's own header the shop name would repeat on
 * every line, so it can be left off (``showStore``).
 */
export function EstimateLineRow({
  line,
  index,
  fmt,
  highlighted,
  showStore = true,
}: {
  line: EstimateLine;
  index: number;
  fmt: (soum: number) => string;
  highlighted: boolean;
  showStore?: boolean;
}) {
  const { t } = useTranslation();
  const label = localizeLabel(line.label, t);
  return (
    <li
      data-line-index={index}
      className={[
        "flex items-start gap-3 px-4 py-3.5 transition-colors sm:px-5",
        highlighted ? "bg-yellow-400/15 ring-1 ring-inset ring-yellow-400/50" : "",
      ].join(" ")}
    >
      <LinePhoto line={line} label={label} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          {label}
          {line.price_source === "market" && (
            <span className="ml-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-500">
              {t("smeta.bozor_belgi")}
            </span>
          )}
          {line.is_approximate && (
            // An amber tint with the page's own text colour on it: the `warn` amber as text on its own tint falls under 4.5:1 by day.
            <span className="ml-2 inline-block rounded-full bg-warn/15 px-2 py-0.5 align-middle text-[11px] font-medium text-ink">
              {t("smeta.taxminiy")}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-sm tabular-nums text-ink-muted">
          {formatQuantity(line.quantity)} {localizeUnit(line.unit, line.quantity, t)} × {fmt(line.unit_price)}
        </p>
        {line.price_source === "market" && (
          <p className="mt-0.5 text-xs leading-snug text-emerald-500">
            {line.store_name}
            {line.price_checked_at && ` · ${new Date(line.price_checked_at).toLocaleDateString(intlLocale())}`}
            {line.source_url && /^https?:\/\//i.test(line.source_url) && (
              <>
                {" · "}
                <a href={line.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                  {t("smeta.bozor_manba")}
                </a>
              </>
            )}
          </p>
        )}
        {showStore && line.price_source !== "market" && line.store_name && (
          <p className="mt-0.5 text-xs leading-snug text-ink-muted">
            {t("smeta.dokon")}: {line.store_name}
          </p>
        )}
        {line.formula && !repeatsQuantityLine(line) && (
          <p className="mt-0.5 text-xs leading-snug text-ink-muted">{localizeFormula(line.formula, t)}</p>
        )}
        {line.warning && <p className="mt-1 text-xs leading-snug text-warn">{localizeWarning(line.warning, t)}</p>}
      </div>
      <p className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-ink">{fmt(line.total_uzs)}</p>
    </li>
  );
}
