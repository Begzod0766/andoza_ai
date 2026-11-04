import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { intlLocale, type TKey } from "@/i18n";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMebelProject } from "@/features/mebel/useMebelProject";
import { useAppThemeAttribute } from "@/hooks/useAppThemeAttribute";
import { ParamsPanel } from "@/features/mebel/ui/ParamsPanel";
import { AiSuggest } from "@/features/mebel/ui/AiSuggest";
import { CutListTable } from "@/features/mebel/ui/CutListTable";
import { EdgeTable } from "@/features/mebel/ui/EdgeTable";
import { BomPanel } from "@/features/mebel/ui/BomPanel";
import { WarningsList } from "@/features/mebel/ui/WarningsList";
import { PriceBookDialog } from "@/features/mebel/ui/PriceBookDialog";
import { CabinetView } from "@/features/mebel/three/CabinetView";
import { NestingPanel } from "@/features/mebel/ui/NestingPanel";
import { DrillingPanel } from "@/features/mebel/ui/DrillingPanel";
import { FacadeOrder } from "@/features/mebel/ui/FacadeOrder";
import { facadeOrderCsv } from "@/features/mebel/export/facadeCsv";
import { cutListCsv, downloadCsv } from "@/features/mebel/export/csv";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { createWorkshopLink, cutMebelProject, errorMessage, revokeWorkshopLink } from "@/lib/api";
import { producedOffcuts, usedStockIds } from "@/features/mebel/engine";
import { PrintView } from "@/features/mebel/export/PrintView";
import { LabelsPrintView } from "@/features/mebel/export/LabelsPrintView";
import { partLabels, type LabelFormat } from "@/features/mebel/export/labels";
import { groupName } from "@/features/mebel/ui/format";
import { ERROR_FIELD } from "@/features/mebel/ui/ParamsPanel";
import { EditableTitle } from "@/features/mebel/ui/EditableTitle";
import { SummaryBar } from "@/features/mebel/ui/SummaryBar";
import { summarize } from "@/features/mebel/ui/summary";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ResizableSplit, useStoredHeight, useViewportHeight } from "@/features/mebel/ui/ResizableSplit";
import { ChevronDown, Settings } from "lucide-react";
import { FREE_ERROR_FIELD } from "@/features/mebel/ui/FreePartsPanel";

type Tab = "parts" | "nesting" | "drilling" | "edges" | "bom" | "warnings";
const TABS: Tab[] = ["parts", "nesting", "drilling", "edges", "bom", "warnings"];

/** /mebel/:id — one cabinet project: parameters, 3D, cut list, banding, price. */
export default function MebelProjectPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const m = useMebelProject(id);
  // A full-screen page outside AppShell: it puts the chosen theme on <html> itself.
  useAppThemeAttribute();
  const [tab, setTab] = useState<Tab>("parts");
  const [pane, setPane] = useState<"params" | "result">("params");
  const [show3d, setShow3d] = useState(true);
  // The 3D view's height: dragged by the bar under it, remembered on this device.
  const viewport = useViewportHeight();
  const maxView = Math.round(viewport * 0.7);
  const [viewHeight, setViewHeight, saveViewHeight] = useStoredHeight("mebel.view3dHeight", Math.round(viewport * 0.34));
  const [showCut, setShowCut] = useState(true);
  const [priceBookOpen, setPriceBookOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  // What the next print holds: the PDF, or a sheet of part labels.
  const [printing, setPrinting] = useState<"pdf" | LabelFormat>("pdf");
  const confirm = useConfirm();
  const { toast } = useToast();
  const [workshopToken, setWorkshopToken] = useState<string | null>(null);
  const printingLabels = useRef(false);
  const [cutting, setCutting] = useState(false);
  const [cutError, setCutError] = useState("");
  const cutAt = m.cutAt;
  // A label's QR code opens ?part=<id>: show that part's drilling map.
  const [search] = useSearchParams();
  const linkedPart = search.get("part");
  const { result: loaded, setSelectedPartId } = m;
  useEffect(() => {
    if (!linkedPart || !loaded?.parts.some((p) => p.id === linkedPart)) return;
    setSelectedPartId(linkedPart);
    // a part with no holes (a free part) has no drilling map: show it in the cut list
    setTab(loaded.parts.find((p) => p.id === linkedPart)?.holes?.length ? "drilling" : "parts");
    setPane("result");
    // once, when the project has loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedPart, !!loaded]);

  if (m.isError) {
    return (
      <div className="p-6 text-sm text-red-500">
        {t("mebel.load_failed")} <Link to="/mebel" className="underline">{t("mebel.back_to_list")}</Link>
      </div>
    );
  }
  if (!m.project || !m.result) return <div className="m-6 h-40 animate-pulse rounded-2xl bg-card-soft" />;

  const { project, result } = m;
  const materialName = (mid: string | null) => (mid ? m.catalog[mid]?.name ?? null : null);
  // a free part's parts carry its id where a cabinet's carry the cabinet's
  const labelOf = (cabId?: string) =>
    project.cabinets.find((c) => c.id === cabId)?.label ?? project.freeParts?.find((f) => f.id === cabId)?.label ?? null;
  const used = [
    project.defaults.board.materialId, project.defaults.back.materialId ?? null,
    project.defaults.edge.visible.materialId, project.defaults.edge.hidden.materialId,
    project.defaults.facade?.materialId ?? null,
  ].filter((x): x is string => !!x);
  const failed = result.errors.length > 0;

  // A wall cabinet hangs with its bottom at 1400 mm, above the worktop.
  const wallLift = (cabId: string) => (project.cabinets.find((c) => c.id === cabId)?.type === "wall" ? 1400 : 0);
  const exportFacadeCsv = () =>
    downloadCsv(`${project.name} — ${t("mebel.facade")}`, facadeOrderCsv(result.facadeOrder, {
      cabinet: (id) => labelOf(id) ?? id,
      material: (id) => materialName(id) ?? t("mebel.bom.facade_mdf"),
    }));
  const exportCsv = () =>
    downloadCsv(project.name, cutListCsv(result.groups, {
      part: (g) => groupName(g),
      material: (g) => materialName(g.materialId) ?? t(`mebel.material.${g.material}`),
      grain: (gr) => (gr === "none" ? "" : t(`mebel.grain.${gr}`)),
    }));
  const exportPdf = () => {
    // The 3D picture goes into the printout; the canvas keeps its buffer for this.
    const canvas = viewRef.current?.querySelector("canvas");
    let image: string | null = null;
    try { image = canvas?.toDataURL("image/png") ?? null; } catch { image = null; }
    flushSync(() => { setSnapshot(image); setPrinting("pdf"); });
    window.print();
  };
  // "Kesildi": the offcuts this layout cut from leave the store, the ones it leaves arrive
  const markCut = async () => {
    const used = usedStockIds(result.nesting);
    const produced = producedOffcuts(result.nesting);
    if (!(await confirm({
      title: t("mebel.offcuts.cut_confirm", { used: used.length, made: produced.length }),
      description: t("mebel.header.cut_irreversible"),
      confirmLabel: t("mebel.offcuts.cut"),
    }))) return;
    setCutting(true);
    setCutError("");
    try {
      const saved = await cutMebelProject(id, { used, produced });
      m.markCutLocally(saved.cut_at ?? new Date().toISOString());
    } catch (e) {
      setCutError(errorMessage(e));
    } finally {
      setCutting(false);
      void m.refetchOffcuts();
    }
  };
  // A label's QR opens the part on the workshop page by the project's workshop token:
  // without one, nothing prints (a QR that leads nowhere is worse than none).
  // The worker's phone computes from the saved project, so a label must never
  // carry an edit the server does not have: save first, or do not print.
  const printLabels = async (format: LabelFormat) => {
    if (printingLabels.current) return;
    printingLabels.current = true;
    try {
      if (!(await m.saveNow())) {
        toast({ variant: "error", title: t("mebel.workshop.save_first") });
        return;
      }
      let token: string;
      try {
        ({ token } = await createWorkshopLink(id));
      } catch {
        toast({ variant: "error", title: t("mebel.workshop.link_failed") });
        return;
      }
      flushSync(() => { setWorkshopToken(token); setPrinting(format); });
      m.setHasWorkshopLink(true);
      window.print();
    } finally {
      printingLabels.current = false;
    }
  };
  const revokeLink = async () => {
    if (!(await confirm({
      title: t("mebel.workshop.revoke"),
      description: t("mebel.workshop.revoke_desc"),
      confirmLabel: t("mebel.workshop.revoke"),
      destructive: true,
    }))) return;
    try {
      await revokeWorkshopLink(id);
      m.setHasWorkshopLink(false);
      setWorkshopToken(null);
    } catch {
      toast({ variant: "error", title: t("mebel.workshop.revoke_failed") });
    }
  };

  return (
    <>
    {/* On a wide screen the page itself does not scroll: the settings and the result
        each scroll in their own column, under a header that stays put. */}
    <div data-testid="mebel-editor" className="flex min-h-screen flex-col bg-card-soft text-ink print:hidden lg:h-screen lg:overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-card px-4 py-3">
        <Link to="/mebel" className="shrink-0 text-sm font-semibold text-accent">← {t("mebel.back_to_list")}</Link>
        <EditableTitle name={project.name} onRename={(name) => m.setProject((p) => ({ ...p, name }))} />
        <span className={`text-xs ${m.saveState === "error" || m.saveState === "invalid" ? "text-red-500" : "text-ink-muted"}`} role="status">
          {t(({ saving: "mebel.saving", error: "mebel.save_failed", invalid: "mebel.not_saved_invalid", saved: "mebel.saved" } as const)[m.saveState])}
        </span>
        <button type="button" onClick={() => setPriceBookOpen(true)} aria-label={t("mebel.price_book")} title={t("mebel.price_book")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-ink/10 hover:text-ink">
          <Settings size={18} aria-hidden="true" />
        </button>
        {cutAt ? (
          <span data-testid="cut-at" className="text-xs font-semibold text-ok">
            {t("mebel.offcuts.cut_at", { date: new Date(cutAt).toLocaleDateString(intlLocale()) })}
          </span>
        ) : (
          <button type="button" onClick={() => void markCut()} disabled={failed || cutting || !m.offcutsReady || result.nesting.some((n) => n.unplaced.length > 0)}
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-ink/10 disabled:opacity-50">
            {t("mebel.offcuts.cut")}
          </button>
        )}
        {cutError && <span role="alert" className="text-xs text-red-500">{cutError}</span>}
        {!failed && (
          <ActionMenu
            label={t("mebel.header.export")}
            trigger={<><span>{t("mebel.header.export")}</span><ChevronDown size={14} aria-hidden="true" /></>}
            triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#5B84F5] px-4 text-sm font-semibold text-white hover:bg-[#4a73e4]"
            actions={[
              { label: t("mebel.export_pdf"), onSelect: exportPdf },
              { label: t("mebel.export_csv"), onSelect: exportCsv },
              { label: t("mebel.labels.a4"), onSelect: () => void printLabels("a4") },
              { label: t("mebel.labels.roll"), onSelect: () => void printLabels("roll") },
              ...(m.hasWorkshopLink ? [{ label: t("mebel.workshop.revoke"), onSelect: () => void revokeLink() }] : []),
            ]}
          />
        )}
      </header>
      {!failed && <SummaryBar summary={summarize(result)} priceReady={m.priceBookReady} onOpen={(k) => { setTab(k); setPane("result"); }} />}

      {/* On a phone the settings and the result take turns; a wide screen shows both. */}
      <div className="flex gap-1 px-4 pt-3 lg:hidden">
        {(["params", "result"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={pane === k} onClick={() => setPane(k)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold ${pane === k ? "bg-ink text-card" : "bg-card text-ink-muted"}`}>
            {t(`mebel.pane.${k}`)}
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-4 p-4 lg:min-h-0 lg:grid-cols-[360px_1fr]">
        <aside data-testid="mebel-params"
          className={`${pane === "params" ? "" : "hidden "}scroll-visible rounded-2xl bg-card p-4 shadow-sm lg:block lg:min-h-0 lg:overflow-y-auto`}>
          <AiSuggest update={m.setProject} cabinetCount={project.cabinets.length} />
          <div className="h-3" />
          <ParamsPanel project={project} update={m.setProject} errors={result.errors} catalog={m.options} offcutCount={m.offcutCount}
            focusCabinetId={result.parts.find((p) => p.id === m.selectedPartId)?.cabinetId ?? null} />
        </aside>

        <main data-testid="mebel-result" className={`${pane === "result" ? "flex" : "hidden"} min-w-0 flex-col gap-3 lg:flex lg:min-h-0`}>
          {show3d ? (
            <>
            <div ref={viewRef} style={{ height: Math.min(maxView, Math.max(160, viewHeight)) }}
              className="relative shrink-0 overflow-hidden rounded-2xl bg-card shadow-sm" aria-label={t("mebel.view3d")}>
              <CabinetView parts={result.parts} selectedPartId={m.selectedPartId} onSelect={m.setSelectedPartId} wallLift={wallLift} />
              {/* on the view itself, so the tabs keep the whole row */}
              <button type="button" onClick={() => setShow3d(false)}
                className="absolute right-3 top-3 rounded-full bg-card/90 px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-card">
                {t("mebel.view_hide")}
              </button>
            </div>
            <ResizableSplit height={Math.min(maxView, Math.max(160, viewHeight))} onHeight={setViewHeight} onCommit={saveViewHeight} min={160} max={maxView}
              label={t("mebel.view3d_height")} />
            </>
          ) : (
            <button type="button" onClick={() => setShow3d(true)}
              className="self-end rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-card-soft">
              {t("mebel.view_show")}
            </button>
          )}

          <section className="flex flex-col rounded-2xl bg-card p-4 shadow-sm lg:min-h-0 lg:flex-1">
            {failed ? (
              <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-500">
                <p className="font-semibold">{t("mebel.errors_title")}</p>
                {result.errors.filter((e) => !e.cabinetId || !(ERROR_FIELD[e.code] || FREE_ERROR_FIELD[e.code])).map((e) => (
                  <p key={`${e.code}|${e.cabinetId ?? ""}`}>{t(`mebel.error.${e.code}` as TKey, e.params)}</p>
                ))}
              </div>
            ) : (
              <>
                <div role="tablist" className="mb-3 flex gap-1 overflow-x-auto">
                  {TABS.map((k) => (
                    <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${tab === k ? "bg-ink text-card" : "text-ink-muted hover:bg-card-soft"}`}>
                      {t(`mebel.tab.${k}`)}
                      {k === "warnings" && result.warnings.length > 0 && (
                        <span data-testid="warnings-count" className="ml-1.5 rounded-full bg-warn/15 px-1.5 text-[11px] font-bold text-warn">
                          {result.warnings.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {/* the tab's content scrolls under the tabs; table headers stick to its top */}
                <div className="scroll-visible lg:min-h-0 lg:flex-1 lg:overflow-auto">
                {tab === "parts" && (
                  <>
                    <div className="mb-2 flex gap-1">
                      <button type="button" aria-pressed={showCut} onClick={() => setShowCut(true)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${showCut ? "bg-accent/15 text-accent" : "text-ink-muted"}`}>
                        {t("mebel.show_cut")}
                      </button>
                      <button type="button" aria-pressed={!showCut} onClick={() => setShowCut(false)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${!showCut ? "bg-accent/15 text-accent" : "text-ink-muted"}`}>
                        {t("mebel.show_finished")}
                      </button>
                    </div>
                    <CutListTable groups={result.groups} showCut={showCut} selectedPartId={m.selectedPartId}
                      onSelect={m.setSelectedPartId}
                      materialName={(g) => materialName(g.materialId) ?? t(`mebel.material.${g.material}`)} />
                  </>
                )}
                {tab === "nesting" && (
                  <NestingPanel nesting={result.nesting} trim={project.defaults.trim ?? 10} selectedPartId={m.selectedPartId}
                    onSelect={m.setSelectedPartId} materialName={materialName} />
                )}
                {tab === "drilling" && <DrillingPanel parts={result.parts} cabinets={project.cabinets} selectedPartId={m.selectedPartId} />}
                {tab === "edges" && <EdgeTable totals={result.edgeTotals} materialName={materialName} />}
                {tab === "bom" && (
                  <div className="flex flex-col gap-6">
                    <BomPanel bom={result.bom} total={result.total} hasUnpriced={result.hasUnpriced}
                      nesting={result.nesting} materialName={materialName} />
                    {result.facadeOrder.length > 0 && (
                      <>
                        <FacadeOrder lines={result.facadeOrder} labelOf={(id) => labelOf(id) ?? id} materialName={materialName} />
                        <button type="button" onClick={exportFacadeCsv}
                          className="self-start rounded-full bg-card-soft px-3 py-1.5 text-xs font-semibold text-ink hover:bg-ink/10">
                          {t("mebel.export_facade_csv")}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {tab === "warnings" && <WarningsList warnings={result.warnings} labelOf={labelOf} />}
                </div>
              </>
            )}
          </section>
        </main>
      </div>

      <PriceBookDialog open={priceBookOpen} onOpenChange={setPriceBookOpen} priceBook={m.priceBook} ready={m.priceBookReady}
        usedMaterials={used} catalog={m.catalog} />
    </div>
    {!failed && printing !== "pdf" && workshopToken && (
      <LabelsPrintView projectName={project.name} format={printing}
        labels={partLabels(result.parts, {
          token: workshopToken, origin: window.location.origin, labelOf: (cid) => labelOf(cid) ?? "",
          materialName: (p) => materialName(p.materialId) ?? t(`mebel.material.${p.material}`),
        })} />
    )}
    {!failed && printing === "pdf" && <PrintView name={project.name} result={result} snapshot={snapshot} trim={project.defaults.trim ?? 10} materialName={materialName} labelOf={(id) => labelOf(id) ?? id} cabinets={project.cabinets} />}
    </>
  );
}
