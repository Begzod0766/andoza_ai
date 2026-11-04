import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppThemeAttribute } from "@/hooks/useAppThemeAttribute";
import { useWorkshopProject } from "@/features/mebel/useWorkshopProject";
import { partFingerprint } from "@/features/mebel/export/labels";
import { EdgeGlyph } from "@/features/mebel/ui/EdgeGlyph";
import { PartDrawing } from "@/features/mebel/ui/PartDrawing";
import { HoleTable } from "@/features/mebel/ui/HoleTable";
import { edgesSummary, formatMm, partName } from "@/features/mebel/ui/format";
import type { FurnitureProject, Part } from "@/features/mebel/engine";

/** A cabinet's label, or a free part's: what the part's label says it belongs to. */
function labelOf(project: FurnitureProject, cabinetId: string): string {
  return project.cabinets.find((c) => c.id === cabinetId)?.label
    ?? project.freeParts?.find((f) => f.id === cabinetId)?.label
    ?? "";
}

/**
 * /d/:token?p=<part id>&v=<fingerprint> — what a part label's QR opens on the
 * worker's phone, with no account: that part's size, material, bands and holes.
 * Read only: no prices, no sheets, nothing to edit.
 */
export default function WorkshopPartPage() {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const [search] = useSearchParams();
  // Outside the app shell: the page puts the chosen theme on <html> itself.
  useAppThemeAttribute();
  const w = useWorkshopProject(token);
  const partId = search.get("p");
  const printed = search.get("v");

  if (w.status === "loading") {
    return (
      <Shell>
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-card" />
        <div className="h-40 animate-pulse rounded-2xl bg-card" />
        <div className="h-56 animate-pulse rounded-2xl bg-card" />
      </Shell>
    );
  }
  if (w.status === "gone") {
    return <Shell><p role="alert" className="rounded-2xl border border-line bg-card p-4 text-sm text-ink">{t("mebel.workshop.gone")}</p></Shell>;
  }
  if (w.status === "error" || !w.project || !w.result) {
    return (
      <Shell>
        <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-4">
          <p className="text-sm text-ink">{t("mebel.workshop.load_failed")}</p>
          <button type="button" onClick={w.retry}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">
            {t("mebel.workshop.retry")}
          </button>
        </div>
      </Shell>
    );
  }

  const { project, result } = w;
  const part = partId ? result.parts.find((p) => p.id === partId) ?? null : null;
  const changed = part && printed ? printed !== partFingerprint(part, part.materialId ?? part.material) : false;

  return (
    <Shell>
      <header className="flex min-w-0 items-center gap-2">
        <h1 data-testid="workshop-name" className="min-w-0 flex-1 truncate text-lg font-bold text-ink">{w.name}</h1>
        <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
          {t("mebel.workshop.read_only")}
        </span>
      </header>

      {partId && !part && (
        <p role="status" className="rounded-2xl border border-line bg-card p-4 text-sm text-ink">{t("mebel.workshop.part_missing")}</p>
      )}
      {!partId && <p className="text-sm text-ink-muted">{t("mebel.workshop.pick_part")}</p>}

      {part && (
        <>
          {changed && (
            <p role="status" className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-ink">
              {t("mebel.workshop.changed")}
            </p>
          )}
          <PartCard part={part} cabinet={labelOf(project, part.cabinetId)} material={w.materialName(part)} />
          <section className="rounded-2xl border border-line bg-card p-3">
            <h2 className="mb-2 text-sm font-semibold text-ink">{t("mebel.workshop.holes")}</h2>
            {(part.holes?.length ?? 0) > 0 ? (
              <>
                <div className="overflow-x-auto"><PartDrawing part={part} /></div>
                <div className="mt-2 overflow-x-auto"><HoleTable part={part} /></div>
              </>
            ) : (
              <p className="text-sm text-ink-muted">{t("mebel.workshop.no_holes")}</p>
            )}
          </section>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-card-soft text-ink">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-4">{children}</div>
    </main>
  );
}

function PartCard({ part, cabinet, material }: { part: Part; cabinet: string; material: string }) {
  const { t } = useTranslation();
  return (
    <section data-testid="workshop-part" className="rounded-2xl border border-line bg-card p-4">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-bold text-ink">{partName(part.role, part.name)}</h2>
        <span className="shrink-0 text-sm font-semibold text-ink-muted">{cabinet}</span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">{part.id}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
        {`${formatMm(part.finished.length)} × ${formatMm(part.finished.width)} × ${formatMm(part.thickness)}`}
        <span className="ml-1 text-sm font-normal text-ink-muted">{t("mebel.mm")}</span>
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-ink-muted">{t("mebel.col.material")}</dt>
        <dd className="min-w-0 truncate text-ink">{material}</dd>
        <dt className="text-ink-muted">{t("mebel.col.grain")}</dt>
        <dd className="text-ink">{t(`mebel.grain.${part.grain}`)}</dd>
        <dt className="text-ink-muted">{t("mebel.col.edges")}</dt>
        <dd className="flex items-center gap-2 text-ink">
          <EdgeGlyph edges={part.edges} />
          <span className="tabular-nums">{edgesSummary(part.edges)}</span>
        </dd>
      </dl>
    </section>
  );
}
