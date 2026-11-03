import * as React from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  updateRoom, listWallpapers, uploadWallpaper, deleteWallpaper,
} from "@/lib/api";
import type { Room, Wallpaper } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "@/store/roomStore";
import type { WallCovering, FloorType, DesignState } from "@/store/roomStore";
import { LightPanel } from "@/components/studio/LightPanel";
import type { LightTypeId } from "@/lib/lightCatalog";
import { useRestoreUserModels } from "@/hooks/useRestoreUserModels";

import type { PhaseKey } from "@/lib/phases";
import { resolveTargetWall } from "./design-panel/shared";
import { WallSection } from "./design-panel/WallSection";
import { FloorSection } from "./design-panel/FloorSection";
import { MebelSection } from "./design-panel/MebelSection";
import { SuvoqSection } from "./design-panel/SuvoqSection";
import { MontajSection } from "./design-panel/MontajSection";

export function DesignPanel({ room, phase, selectedWall, onWallChange, selectedLightId, onLightChange, armedLightType, onArmLight, planMode }: {
  room: Room;
  phase: PhaseKey;
  selectedWall?: string | null;
  onWallChange?: (id: string | null) => void;
  /** Light selected in the 3D viewport — keeps the panel and the scene in sync. */
  selectedLightId?: string | null;
  onLightChange?: (id: string | null) => void;
  /** Fixture armed for click-to-place in the 2D lighting plan. */
  armedLightType?: LightTypeId | null;
  onArmLight?: (id: LightTypeId | null) => void;
  /** A 2D plan is on screen, so the palette arms rather than auto-places. */
  planMode?: boolean;
}) {
  const { t } = useTranslation()
  useRestoreUserModels()

  const designState = useRoomStore((s) => s.designState);
  const setDesignState = useRoomStore((s) => s.setDesignState);
  const setWallCovering = useRoomStore((s) => s.setWallCovering);
  const setFloorTexture = useRoomStore((s) => s.setFloorTexture);
  const surfaces = useRoomStore((s) => s.surfaces);
  const applySurface = useRoomStore((s) => s.applySurface);

  // Which wall/floor/ceiling target the wall- and plaster-covering actions
  // below apply to — the same derivation WallSection and SuvoqSection use
  // internally for their own rendering, driven by the same `selectedWall`
  // prop, so all three always agree on "the" active target.
  const targetWall = resolveTargetWall(selectedWall);

  const mutation = useMutation({
    mutationFn: (data: { design_state: Record<string, unknown>; surfaces?: Record<string, unknown> }) =>
      updateRoom(room.id, data),
  });

  const syncTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // surfacesRef always holds the latest store value so a debounced sync
  // fired from a design-state change still PATCHes the surfaces picked in
  // between — surfaces itself isn't a syncToApi(ds) argument.
  const surfacesRef = React.useRef(surfaces);
  surfacesRef.current = surfaces;
  function syncToApi(ds: DesignState) {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      mutation.mutate({
        surfaces: surfacesRef.current,
        design_state: {
          wallCoverings: ds.wallCoverings,
          floorType: ds.floorType,
          ceiling: ds.ceiling,
        },
      });
    }, 600);
  }

  function applyWallCovering(covering: WallCovering) {
    setWallCovering(targetWall, covering);
    const updated = {
      wallCoverings: { ...designState.wallCoverings, [targetWall]: covering },
      floorType: designState.floorType,
    };
    syncToApi({ ...designState, ...updated });
  }

  /** Apply a covering to EVERY wall, ignoring the selected wall: writes the
   * `ALL` target (the store clears per-wall overrides for ALL, so nothing
   * left over can mask it via resolveWallCovering's per-wall-first fallback)
   * and syncs the same cleared shape to the API. */
  function applyAllWallsCovering(covering: WallCovering) {
    setWallCovering("ALL", covering);
    syncToApi({ ...designState, wallCoverings: { ALL: covering } });
  }

  /** Suvoq-phase texture covering: UVW map fixed at 100 cm × 100 cm
   * (repeatX is tiles-per-metre — see applyWallpaper) and not editable. */
  function suvoqFixedCovering(url: string): WallCovering {
    return { kind: 'texture', url, color: '#ffffff', repeatX: 1.0, repeatY: 1.0, offsetX: 0, offsetY: 0, rotation: 0 };
  }

  function handleSetPaintColor(color: string) {
    applyWallCovering({ kind: "paint", color });
    // A plain swatch has no do'kon material behind it — clear any earlier
    // link so the smeta doesn't keep pricing this wall against a product
    // the user just moved away from.
    applySurface(targetWall, "");
  }

  function handleSetFloorType(type: string) {
    const ft = type as FloorType;
    setDesignState({ floorType: ft, floorConfigured: true });
    setFloorTexture(null);
    syncToApi({ ...designState, floorType: ft, floorConfigured: true, floorTexture: null });
    // Switching category invalidates any material picked for the old one
    // (e.g. a laminate product doesn't belong on a "tile" floor) — clear it
    // rather than leave the smeta pricing the new floor against it.
    applySurface("floor", "");
  }

  // ─── Wallpaper library ──────────────────────────────────────────────────────
  //
  // Uploads go to the server, not into the design state. A data URL used to be
  // stored inline, which meant the image was gone after a reload (and nobody
  // else could use it). Now the covering only carries the library URL, so a
  // saved room reloads with its wallpaper and every user sees the same shelf.

  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.is_admin === true;

  // The shared picker below serves the Bo'yoq/Oboy, Suvoq and Shpaklovka
  // phases, which each keep their OWN image library. Derive the scope bucket
  // from the active phase so an image uploaded in one never surfaces in another
  // (floor uploads are scoped to "pol" in FloorSection/WallFloorTargetPanel).
  const libraryScope: "oboy" | "suvoq" | "shpaklovka" =
    phase === "suvoq" ? "suvoq" : phase === "shpaklovka" ? "shpaklovka" : "oboy";

  const { data: wallpapers = [] } = useQuery<Wallpaper[]>({
    queryKey: ["wallpapers", libraryScope],
    queryFn: () => listWallpapers({ kind: libraryScope }),
    staleTime: 60_000,
  });
  const [wallpaperBusy, setWallpaperBusy] = React.useState(false);
  const [wallpaperError, setWallpaperError] = React.useState<string | null>(null);

  function applyWallpaper(url: string) {
    // Default wallpaper UVW map size = 100 cm × 100 cm: repeatX is tiles-per-metre
    // (see WallComponents), so 1.0 => one tile per metre = 100 cm; repeatY 1.0 keeps
    // the pattern aspect-preserved (undistorted) at ~100 cm tall.
    applyWallCovering({ kind: 'texture', url, color: '#ffffff', repeatX: 1.0, repeatY: 1.0, offsetX: 0, offsetY: 0, rotation: 0 });
  }

  // One picker for every phase that uploads a wall image.
  //
  // The input is mounted at the panel root, not inside a section: it used to
  // live inside the Bo'yoq section behind a mode check, so from Suvoq the ref
  // was null and pressing the upload button did nothing at all, silently.
  // `pickerIntent` records which button opened it, since a plaster photo and a
  // wallpaper roll want different tiling.
  const textureFileRef = React.useRef<HTMLInputElement>(null);
  const pickerIntent = React.useRef<'wallpaper' | 'plaster'>('wallpaper');

  function openTexturePicker(intent: 'wallpaper' | 'plaster') {
    pickerIntent.current = intent;
    setWallpaperError(null);
    textureFileRef.current?.click();
  }

  /** Covering for a plaster/shpaklovka photo. Same 100 cm x 100 cm UVW map
   *  the Bo'yoq/Oboy images use (repeatX is tiles-per-metre — see
   *  applyWallpaper): the user asked for one mapping across the phases
   *  instead of the 2.4 m "plaster patch" tile this used to apply, which
   *  rendered the same image at a visibly different scale in each phase. */
  function plasterUploadCovering(url: string): WallCovering {
    return { kind: 'texture', url, color: '#ffffff', repeatX: 1.0, repeatY: 1.0, offsetX: 0, offsetY: 0, rotation: 0 };
  }

  /**
   * Upload drop-zone plus the shared image library.
   *
   * Rendered identically wherever a wall image can be chosen — the Bo'yoq
   * "Rasm" tab and the Suvoq finishes — so the two phases don't drift into
   * offering the same capability through different-looking controls. `onPick`
   * decides how the chosen image is applied, which is the only real
   * difference: a wallpaper roll and a plaster patch tile differently.
   */
  function renderTexturePicker(
    intent: 'wallpaper' | 'plaster',
    onPick: (url: string) => void,
    libraryLabel: string,
  ) {
    const active = targetWall === "ALL"
      ? designState.wallCoverings.ALL
      : (designState.wallCoverings[targetWall] ?? designState.wallCoverings.ALL);
    const activeUrl = active.kind === 'texture' ? active.url : null;
    return (
      <>
        <button
          onClick={() => openTexturePicker(intent)}
          disabled={wallpaperBusy}
          className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-line rounded-xl text-ink-muted hover:border-brand/50 hover:text-accent transition-colors disabled:opacity-50"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <span className="text-sm font-medium">
            {wallpaperBusy ? t('studio.shared.yuklanmoqda') : t('studio.shared.rasm_yuklash')}
          </span>
          <span className="text-xs text-ink-muted">{t('studio.shared.rasm_format')}</span>
        </button>
        {wallpaperError && <p className="text-xs text-red-500">{wallpaperError}</p>}

        {/* Shared library — uploaded once, stays for everyone */}
        {wallpapers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">{libraryLabel}</p>
              <span className="text-[10px] text-ink-muted">{t('studio.shared.dona_soni', { count: wallpapers.length })}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {wallpapers.map((w) => (
                <div key={w.id} className="relative">
                  <button
                    onClick={() => onPick(w.url)}
                    title={w.name}
                    className={`block w-full aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                      activeUrl === w.url ? 'border-brand' : 'border-line hover:border-line'
                    }`}
                  >
                    <img src={w.url} alt={w.name} loading="lazy" className="w-full h-full object-cover" />
                  </button>
                  {isAdmin && (
                    // w-11 h-11 (44px) invisible hit area centered on the same
                    // visual spot the old w-5 h-5 circle occupied — enlarging
                    // the circle itself would swallow a chunk of a 3-column
                    // thumbnail grid, so only the tappable area grows.
                    <button
                      onClick={() => handleWallpaperDelete(w)}
                      title={t("studio.kutubxonadan_ochirish")}
                      aria-label={t("studio.kutubxonadan_ochirish")}
                      className="absolute -top-[18px] -right-[18px] w-11 h-11 flex items-center justify-center text-ink-muted hover:text-red-500"
                    >
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-card border border-line shadow text-[10px] leading-none">
                        ✕
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] leading-4 text-ink-muted">
              {isAdmin ? t("studio.yuklangan_rasmlar_admin") : t("studio.yuklangan_rasmlar")}
            </p>
          </div>
        )}
      </>
    );
  }

  async function handleTextureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setWallpaperError(t('studio.shared.faqat_rasm'));
      return;
    }
    const intent = pickerIntent.current;
    setWallpaperBusy(true);
    setWallpaperError(null);
    try {
      const wallpaper = await uploadWallpaper(file, { kind: libraryScope });
      // Suvoq is the simplified phase: every upload goes straight onto ALL
      // walls with the fixed 100 cm mapping, whatever wall is selected.
      if (phase === 'suvoq') applyAllWallsCovering(suvoqFixedCovering(wallpaper.url));
      else if (intent === 'plaster') applyWallCovering(plasterUploadCovering(wallpaper.url));
      else applyWallpaper(wallpaper.url);
      queryClient.invalidateQueries({ queryKey: ["wallpapers", libraryScope] });
    } catch (err) {
      setWallpaperError(
        err instanceof Error && err.message
          ? t('studio.shared.yuklab_bolmadi_msg', { message: err.message })
          : t('studio.shared.yuklab_bolmadi'),
      );
    } finally {
      setWallpaperBusy(false);
    }
  }

  async function handleWallpaperDelete(wallpaper: Wallpaper) {
    // Shared and permanent: removing one takes it away from every user, and
    // any room already painted with it loses the image.
    if (!(await confirm({ title: t('studio.shared.hamma_ochirilsinmi', { name: wallpaper.name }), destructive: true }))) return;
    setWallpaperError(null);
    try {
      await deleteWallpaper(wallpaper.id);
      queryClient.invalidateQueries({ queryKey: ["wallpapers"] });
    } catch {
      setWallpaperError(t('studio.shared.ochirib_bolmadi'));
    }
  }

  return (
    // lg:self-start + lg:max-h-full (not lg:h-full): the panel hugs its own
    // content height instead of stretching to match the canvas column's full
    // height, which used to leave a large empty gap below the color swatches
    // whenever the active phase's content was short. Still scrolls (overflow
    // -y-auto + max-h-full) if content ever grows past the viewport.
    <aside className="w-full lg:w-72 lg:shrink-0 lg:self-start bg-card border-l border-line overflow-y-auto lg:max-h-full">
      {/* Mounted at the root so every phase's upload button can reach it */}
      <input
        ref={textureFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleTextureUpload}
      />
      <div className="p-4 space-y-5">

        {phase === 'boyoq' && (
          <WallSection
            room={room}
            selectedWall={selectedWall}
            onWallChange={onWallChange}
            syncToApi={syncToApi}
            applyWallCovering={applyWallCovering}
            handleSetPaintColor={handleSetPaintColor}
            handleSetFloorType={handleSetFloorType}
            renderTexturePicker={renderTexturePicker}
            applyWallpaper={applyWallpaper}
          />
        )}
        {phase === 'pol' && <FloorSection onSetFloorType={handleSetFloorType} />}
        {phase === 'mebel' && <MebelSection />}
        {phase === 'chiroq' && (
          <LightPanel selectedId={selectedLightId} onSelect={onLightChange}
            armedType={armedLightType} onArm={onArmLight} planMode={planMode} />
        )}
        {(phase === 'suvoq' || phase === 'shpaklovka') && (
          <SuvoqSection
            selectedWall={selectedWall}
            onWallChange={onWallChange}
            applyWallCovering={applyWallCovering}
            handleSetPaintColor={handleSetPaintColor}
            renderTexturePicker={renderTexturePicker}
            plasterUploadCovering={plasterUploadCovering}
            // Suvoq only — Shpaklovka shares this section and keeps its full UI.
            simplified={phase === 'suvoq'}
            applySuvoqTexture={(url) => applyAllWallsCovering(suvoqFixedCovering(url))}
            removeSuvoqTexture={() => applyAllWallsCovering({ kind: 'paint', color: '#D8D3C8' })}
          />
        )}
        {phase === 'montaj' && <MontajSection />}

        {mutation.isPending && (
          <p className="text-xs text-ink-muted animate-pulse">{t("common.saqlash")}...</p>
        )}
        {mutation.isError && (
          <p className="text-xs text-warn">{t("studio.oflayn_saqlandi")}</p>
        )}

      </div>
    </aside>
  );
}
