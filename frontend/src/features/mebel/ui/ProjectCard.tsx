import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { MebelProjectSummary } from "@/lib/api";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { intlLocale } from "@/i18n";

/** A date and time to the minute, in the UI language. */
export const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString(intlLocale(), { dateStyle: "short", timeStyle: "short" });

/**
 * One project on the /mebel list: the whole card opens it; the counts and the cut date tell two
 * projects of one name apart; "⋯" holds the copy and delete.
 */
export function ProjectCard({ project: p, onCopy, onDelete }: {
  project: MebelProjectSummary;
  onCopy: (p: MebelProjectSummary) => void;
  onDelete: (p: MebelProjectSummary) => void;
}) {
  const { t } = useTranslation();
  const counts = [
    p.cabinets ? t("mebel.list.cabinets", { n: p.cabinets }) : null,
    p.free_parts ? t("mebel.list.free_parts", { n: p.free_parts }) : null,
  ].filter(Boolean).join(" · ");

  return (
    <li className="flex items-center gap-2 rounded-2xl bg-card pr-2 shadow-sm ring-1 ring-line transition-colors hover:ring-ink/30">
      <Link
        to={`/mebel/${p.id}`}
        className="min-w-0 flex-1 rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B84F5]/70"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-ink">{p.name}</span>
          {p.cut_at && (
            <span className="whitespace-nowrap rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-600">
              {t("mebel.list.cut", { date: new Date(p.cut_at).toLocaleDateString(intlLocale()) })}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-ink-muted">{counts || t("mebel.list.empty_project")}</span>
        <span className="mt-0.5 block text-xs text-ink-muted">{t("mebel.list.updated", { date: shortDateTime(p.updated_at) })}</span>
      </Link>
      <ActionMenu
        label={t("mebel.list.actions")}
        trigger={<MoreHorizontal size={18} aria-hidden="true" />}
        triggerClassName="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-ink/10 hover:text-ink"
        actions={[
          { label: t("mebel.list.copy"), onSelect: () => onCopy(p) },
          { label: t("mebel.list.delete"), onSelect: () => onDelete(p) },
        ]}
      />
    </li>
  );
}
