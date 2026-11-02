import { useTranslation } from "react-i18next";
import type { CutGroup } from "@/features/mebel/engine";
import { Fragment } from "react";
import { edgesSummary, formatMm, groupName } from "./format";
import { EdgeGlyph, edgesText } from "./EdgeGlyph";

/** Lines of one material and thickness together, in the order the engine first lists them. */
function byBoard(groups: CutGroup[]): Array<{ key: string; groups: CutGroup[] }> {
  const out = new Map<string, CutGroup[]>();
  for (const g of groups) {
    const key = `${g.material}|${g.thickness}|${g.materialId ?? ""}`;
    out.set(key, [...(out.get(key) ?? []), g]);
  }
  return [...out].map(([key, gs]) => ({ key, groups: gs }));
}

/**
 * The grouped cut list: one row per set of identically cut parts. `showCut`
 * switches between the size the saw cuts and the finished, banded size.
 * Clicking a row selects its first part (and the 3D view highlights it).
 */
export function CutListTable({
  groups, showCut, selectedPartId, onSelect, materialName, grouped = true,
}: {
  groups: CutGroup[]
  showCut: boolean
  selectedPartId: string | null
  onSelect(partId: string): void
  materialName?: (g: CutGroup) => string
  /** Under one header per material and thickness (on screen); the printout keeps the flat list. */
  grouped?: boolean
}) {
  const { t } = useTranslation();
  const nameOf = (g: CutGroup) => (materialName ? materialName(g) : t(`mebel.material.${g.material}`));
  // Grouped, the material and thickness live in the header row; the printout keeps them as columns.
  const boardCol = grouped ? "hidden print:table-cell" : "hidden sm:table-cell print:table-cell";
  const sections = grouped ? byBoard(groups) : [{ key: "", groups }];
  return (
    <div className="overflow-x-auto lg:overflow-visible">
      <table aria-label={t("mebel.tab.parts")} className="w-full text-left text-sm sm:min-w-[640px]">
        <thead className="sticky top-0 z-10 bg-card text-xs text-ink-muted">
          <tr>
            <th className="hidden sm:table-cell print:table-cell px-2 py-2 font-medium">{t("mebel.col.id")}</th>
            <th className="px-2 py-2 font-medium">{t("mebel.col.part")}</th>
            <th className={`${boardCol} px-2 py-2 font-medium`}>{t("mebel.col.material")}</th>
            <th className={`${boardCol} px-2 py-2 text-right font-medium`}>{t("mebel.col.thickness")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("mebel.col.length")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("mebel.col.width")}</th>
            <th className="px-2 py-2 text-right font-medium">{t("mebel.col.qty")}</th>
            <th className="hidden sm:table-cell print:table-cell px-2 py-2 font-medium">{t("mebel.col.grain")}</th>
            <th className="px-2 py-2 font-medium">{t("mebel.col.edges")}</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.key}>
            {grouped && (
              <tr data-group={section.key} className="print:hidden">
                <th colSpan={9} scope="colgroup" className="bg-card-soft px-2 py-1.5 text-left text-xs font-bold text-ink">
                  {t("mebel.cut_group", {
                    name: nameOf(section.groups[0]),
                    thickness: section.groups[0].thickness,
                    qty: t("mebel.cut_group_qty", { n: section.groups.reduce((n, g) => n + g.qty, 0) }),
                  })}
                </th>
              </tr>
            )}
            {section.groups.map((g) => {
            const size = showCut ? g.cut : g.finished;
            const selected = selectedPartId != null && g.partIds.includes(selectedPartId);
            return (
              <tr
                key={g.key}
                data-key={g.key}
                aria-selected={selected}
                onClick={() => onSelect(g.partIds[0])}
                className={`cursor-pointer border-t border-line ${selected ? "bg-accent/15" : "hover:bg-card-soft"}`}
              >
                <td className="hidden sm:table-cell print:table-cell px-2 py-2 text-xs text-ink-muted">{g.partIds.join(", ")}</td>
                <td className="px-2 py-2 font-medium text-ink">{groupName(g)}</td>
                {(() => {
                  const name = nameOf(g);
                  // catalogue names run long: cut short on screen so the sizes stay in view;
                  // on a phone the id, material, thickness and grain columns give way to the sizes
                  return <td data-testid="material-cell" title={name}
                    className={`${boardCol} max-w-[9rem] truncate px-2 py-2 print:max-w-none print:whitespace-normal`}>{name}</td>;
                })()}
                <td className={`${boardCol} px-2 py-2 text-right tabular-nums`}>{g.thickness}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatMm(size.length)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatMm(size.width)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{g.qty}</td>
                <td className="hidden sm:table-cell print:table-cell px-2 py-2">{t(`mebel.grain.${g.grain}`)}</td>
                <td data-testid="edges-cell" title={edgesText(g.edges)} className="px-2 py-2 tabular-nums">
                  <span className="print:hidden"><EdgeGlyph edges={g.edges} /><span className="sr-only">{edgesText(g.edges)}</span></span>
                  <span className="hidden print:inline">{edgesSummary(g.edges)}</span>
                </td>
              </tr>
            );
            })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
