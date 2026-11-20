import { ChevronDown, MapPin, Phone, Send, Store as StoreIcon, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { handOffExternal } from "@/lib/externalLink";
import { contactLinks } from "@/lib/storeContact";
import { NO_SHOP_KEY, mapLinks, shopSectionId, type ShopGroup } from "@/lib/smetaShops";
import { EstimateLineRow } from "./EstimateLineRow";

const pill =
  "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-brand-light hover:text-accent";

/**
 * One shop's part of the estimate: a header card (the shop, how many lines, what they come
 * to, where it is and how to reach it, and buttons that open the shop's point in Yandex or
 * Google Maps) and its lines. The last group has the lines no shop sells (labour, lines
 * priced at the shops' average).
 */
export function ShopSection({
  group,
  open,
  onToggle,
  fmt,
  highlighted,
}: {
  group: ShopGroup;
  open: boolean;
  onToggle: () => void;
  fmt: (soum: number) => string;
  highlighted: Set<string>;
}) {
  const { t } = useTranslation();
  const store = group.store;
  const none = group.key === NO_SHOP_KEY;
  const links = mapLinks(store);
  const contacts = contactLinks(store);
  const panelId = `${shopSectionId(group.key)}-lines`;
  const place = [store?.district, store?.address].filter(Boolean).join(", ");

  return (
    <section id={shopSectionId(group.key)} data-shop={group.key} className="scroll-mt-28 overflow-hidden rounded-2xl border border-line bg-card shadow-panel">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-card-soft sm:px-5"
      >
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${none ? "bg-card-soft text-ink-muted" : "bg-brand-light/15 text-accent"}`}
        >
          {none ? <Wrench size={20} strokeWidth={2.2} /> : <StoreIcon size={20} strokeWidth={2.2} />}
        </span>
        {/* The amount sits under the name, not beside it: on a phone a shop name needs the width. */}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug text-ink">{none ? t("smeta.shop.none") : group.name}</span>
          <span className="mt-0.5 flex items-baseline justify-between gap-3">
            <span className="text-xs text-ink-muted">{t("smeta.qator", { count: group.items.length })}</span>
            <span className="font-bold tabular-nums text-ink">{fmt(group.subtotal)}</span>
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {!none && (store || links) && (
        <div className="space-y-2.5 border-t border-line px-4 py-3 sm:px-5">
          {(place || store) && (
            <p className="flex items-start gap-1.5 text-sm text-ink-muted">
              <MapPin size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {place}
                {!links && (
                  <span className="text-xs">{place ? " · " : ""}{t("smeta.shop.no_point")}</span>
                )}
              </span>
            </p>
          )}
          {(contacts.length > 0 || links) && (
            <div className="flex flex-wrap gap-2">
              {contacts.map((c) => (
                <a
                  key={c.kind}
                  href={c.href}
                  className={pill}
                  {...(c.kind === "telegram"
                    ? { target: "_blank", rel: "noopener noreferrer", onClick: (e: React.MouseEvent) => handOffExternal(e, c.href) }
                    : {})}
                  aria-label={c.kind === "tel" ? t("studio.contact.call_aria", { label: c.label }) : t("studio.contact.telegram_aria", { label: c.label })}
                >
                  {c.kind === "tel" ? <Phone size={14} aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
                  {c.kind === "tel" ? c.label : "Telegram"}
                </a>
              ))}
              {links && (
                <>
                  <a href={links.yandex} target="_blank" rel="noopener noreferrer" className={pill}
                    onClick={(e) => handOffExternal(e, links.yandex)}
                    aria-label={`${t("smeta.shop.open_map")}: ${t("smeta.shop.yandex")}`}>
                    <MapPin size={14} aria-hidden="true" />
                    {t("smeta.shop.yandex")}
                  </a>
                  <a href={links.google} target="_blank" rel="noopener noreferrer" className={pill}
                    onClick={(e) => handOffExternal(e, links.google)}
                    aria-label={`${t("smeta.shop.open_map")}: ${t("smeta.shop.google")}`}>
                    <MapPin size={14} aria-hidden="true" />
                    {t("smeta.shop.google")}
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {open && (
        <ul id={panelId} className="divide-y divide-line border-t border-line">
          {group.items.map(({ line, index }) => (
            <EstimateLineRow key={index} line={line} index={index} fmt={fmt} highlighted={highlighted.has(String(index))} showStore={false} />
          ))}
        </ul>
      )}
    </section>
  );
}
