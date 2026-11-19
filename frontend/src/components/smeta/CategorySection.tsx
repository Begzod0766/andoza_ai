import { ChevronDown } from "lucide-react";
import { GROUP_COLOUR, formatShare, type LineGroup } from "@/lib/smetaGroups";
import { useTranslation } from "react-i18next";
import { GROUP_ICON } from "./groupIcon";
import { EstimateLineRow } from "./EstimateLineRow";

/**
 * One group of the estimate: a header that folds the group away (its name, how many lines, its
 * subtotal and share) and the lines under it. A line is a name with its working underneath
 * (quantity x unit price, then the formula in full: it used to be cut off at 200 px) and the
 * amount on the right, so it reads the same on a phone as on a desk.
 */
export function CategorySection({
  group,
  open,
  onToggle,
  fmt,
  highlighted,
}: {
  group: LineGroup;
  open: boolean;
  onToggle: () => void;
  fmt: (soum: number) => string;
  /** Line positions (as strings) the AI helper just pointed at. */
  highlighted: Set<string>;
}) {
  const { t } = useTranslation()
  const Icon = GROUP_ICON[group.key];
  const colour = GROUP_COLOUR[group.key];
  const panelId = `smeta-group-${group.key}`;

  return (
    <section id={`smeta-section-${group.key}`} className="scroll-mt-28 overflow-hidden rounded-2xl border border-line bg-card shadow-panel" data-group={group.key}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-card-soft sm:px-5"
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${colour}1F`, color: colour }}
          aria-hidden="true"
        >
          <Icon size={20} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{t(`smeta.toifa.${group.key}`)}</span>
          <span className="block text-xs text-ink-muted">
            {t("smeta.qator", { count: group.items.length })} · {formatShare(group.share)}
          </span>
        </span>
        <span className="text-right font-bold tabular-nums text-ink">{fmt(group.subtotal)}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul id={panelId} className="divide-y divide-line border-t border-line">
          {group.items.map(({ line, index }) => (
            <EstimateLineRow key={index} line={line} index={index} fmt={fmt} highlighted={highlighted.has(String(index))} />
          ))}
        </ul>
      )}
    </section>
  );
}
