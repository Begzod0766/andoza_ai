import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GROUP_COLOUR, type GroupKey, type LineGroup } from "@/lib/smetaGroups";

/**
 * The estimate's sections as one scrollable row under the sticky total: a long estimate was a
 * long scroll to reach, say, the furniture. Each link names the section and its subtotal; the
 * section being read is marked, and its link is kept in view as the row scrolls.
 */
export function SmetaSectionNav({ groups, active, onPick, fmt }: {
  groups: LineGroup[];
  active: GroupKey | null;
  onPick: (key: GroupKey) => void;
  fmt: (soum: number) => string;
}) {
  const { t } = useTranslation();
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active]);
  if (groups.length < 2) return null;
  return (
    <nav aria-label={t("smeta.bolimlar")} className="overflow-x-auto">
      <div className="flex gap-1.5 pb-0.5">
        {groups.map((g) => {
          const on = g.key === active;
          return (
            <button
              key={g.key}
              ref={on ? activeRef : undefined}
              type="button"
              aria-current={on ? "true" : undefined}
              onClick={() => onPick(g.key)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors ${
                on ? "border-accent bg-accent/10 text-ink" : "border-line text-ink-muted hover:border-brand-light hover:text-ink"
              }`}
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: GROUP_COLOUR[g.key] }} />
              <span className="font-semibold">{t(`smeta.toifa.${g.key}`)}</span>
              <span className="tabular-nums">{fmt(g.subtotal)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
