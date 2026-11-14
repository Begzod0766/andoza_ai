import { useTranslation } from "react-i18next";
import { CAMERA_CHOICES, cameraLabel, cameraTitle, RENDER_ASPECTS, type RenderAspect } from "@/lib/roomCameras";
import { CameraButton, LockButton } from "./CanvasButtons";
import { MoveRoomsButton } from "./RoomSlide";
import { cameraRowRightInset, showsEditingCorners } from "./cameraViewChrome";

export interface CameraBarProps {
  /** Whether the camera button has its list open. */
  listOpen: boolean;
  onToggleList(): void;
  /** Stand at a camera: null for the 360 one (ThreeDPage's `enterCamera`). */
  onPick(station: number | null): void;
  panorama: boolean;
  /** 1-based fixed camera, or null. */
  cameraStation: number | null;
  aspect: RenderAspect;
  onAspect(aspect: RenderAspect): void;
  /** The 360 camera's Render: the render sheet. */
  onRender360(): void;
  /** A fixed camera's Render: its still (RoomCameras' `requestViewCapture`). */
  onRenderStill(): void;
  /** How many pictures are saved for the room; the button shows from one. */
  savedCount: number;
  onOpenGallery(): void;
  viewLocked: boolean;
  onToggleLock(): void;
  /** "Move rooms" — a flat of several rooms, and not while locked. */
  showMoveRooms: boolean;
  moveRoomsOn: boolean;
  onToggleMoveRooms(): void;
  /** Whether the Flat toggle stands in the bottom-right corner (a flat of several rooms). */
  flatShown: boolean;
}

/**
 * Bottom-left: the cameras.
 *
 * One button, and everything else behind it. The five cameras and the two
 * picture shapes used to sit in the corner permanently — nine controls lying
 * across the room the user was trying to look at, in the one view whose whole
 * job is to be looked at. So the button opens a list, the list closes the
 * moment a camera is chosen, and the only thing left on screen after that is
 * the one control that camera still needs: render.
 *
 * Two things keep the row still under the user's thumb (QA 2026-11-05 re-check
 * R3, R5):
 *  - The list is laid OVER the row, above the button, rather than being part
 *    of it. As a column inside the row it made the row's first item as wide as
 *    its widest chip, the row re-wrapped, and the same tap point landed on a
 *    different button with the list open.
 *  - The row stops short of the bottom-right corner buttons
 *    (`cameraRowRightInset`), and what does not fit wraps UPWARD
 *    (`flex-wrap-reverse`), so nothing slides under Flat or the arc and the
 *    first line stays where it was.
 *
 * Because the row wraps UPWARD, on a phone whatever did not fit on the first
 * line ("My renders", the 9:16 toggle, Render) and the "fixed" hint stand
 * above the camera button — exactly where the list rises (QA 2026-11-06 1.2,
 * #174). So while the list is open every other item is hidden IN PLACE
 * (`invisible`): the row keeps its shape, nothing moves under the thumb, a
 * hidden item takes no taps, and the list opens over clear space. Picking a
 * camera (or tapping the button again) closes the list and brings them back.
 */
export function CameraBar(p: CameraBarProps) {
  const { t } = useTranslation();
  const cornersShown = showsEditingCorners({ panorama: p.panorama, cameraStation: p.cameraStation });
  const inset = cameraRowRightInset({ cornersShown, flatShown: p.flatShown });
  // Everything but the camera button, while its list is open (see above).
  const hide = p.listOpen ? "invisible" : "";

  return (
    <div
      data-testid="camera-bar"
      className={`absolute bottom-5 left-4 ${inset} z-20 flex flex-col items-start gap-2 pointer-events-none`}
    >
      {/* A fixed camera does not turn: the shot is the same every time, so a
          drag does nothing — which looked like the view had frozen (QA #18). */}
      {p.cameraStation != null && (
        <p className={`${hide} max-w-full rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-medium leading-tight text-white backdrop-blur-sm`}>
          {t("render.kadr.qotirilgan")}
        </p>
      )}

      <div
        data-testid="camera-row"
        className="relative flex w-full flex-wrap-reverse items-center gap-2 [&>*]:pointer-events-auto"
      >
        <div className="relative">
          <CameraButton
            active={p.listOpen || p.panorama || p.cameraStation != null}
            expanded={p.listOpen}
            onClick={p.onToggleList}
            tourId="camera"
          />
          {/* Rises from the button rather than running across the foot of the
              screen: a column keeps it clear of the arc menu in the opposite
              corner, and it reads as having come OUT of the button it is
              anchored to. Absolutely placed, so opening it moves nothing. */}
          {p.listOpen && (
            <div
              data-testid="camera-list"
              className="absolute bottom-full left-0 z-10 mb-2 flex w-max flex-col-reverse items-start gap-1.5 animate-[radialpop_120ms_ease-out]"
            >
              {CAMERA_CHOICES.map((c) => {
                const active = c.station == null ? p.panorama : p.cameraStation === c.station;
                return (
                  <button
                    key={c.labelKey + (c.n ?? '')}
                    onClick={() => p.onPick(c.station)}
                    title={cameraLabel(c)}
                    aria-pressed={active}
                    className={`h-10 pl-3 pr-4 rounded-full flex items-center gap-2 whitespace-nowrap text-[13px] font-bold shadow-lg ring-1 transition-colors ${
                      active ? 'bg-brand text-white ring-brand/40' : 'bg-white/95 text-brand ring-black/5'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                      active ? 'bg-white/20' : 'bg-brand/10'
                    }`}>
                      {c.badge}
                    </span>
                    {cameraTitle(c)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* The lock: taps and holds in the 3D view open nothing while it
            is on, so the room can be turned without a menu popping up. */}
        <LockButton locked={p.viewLocked} onClick={p.onToggleLock} className={hide} tourId="lock" />

        {/* Move rooms: X / Z arrows on a tapped room (RoomSlide.tsx). */}
        {p.showMoveRooms && <MoveRoomsButton active={p.moveRoomsOn} onClick={p.onToggleMoveRooms} className={hide} />}

        {/* The pictures already made for this room, from any camera: looking
            at one again must not cost another render. */}
        {p.savedCount > 0 && (
          <button
            onClick={p.onOpenGallery}
            title={t("render.saqlangan")}
            className={`${hide} px-4 h-12 rounded-full bg-white/95 text-brand text-[13px] font-bold shadow-lg ring-1 ring-black/5 flex items-center gap-1.5 whitespace-nowrap`}
          >
            {t("render.renderlarim")}
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-brand text-white text-[11px] leading-5 text-center">
              {p.savedCount}
            </span>
          </button>
        )}

        {/* Render, once a camera is chosen — and only then, because it is
            the picture from THAT camera it would make. The 360 camera goes
            to the render sheet; a fixed one takes its own still (shown in
            ViewStillSheet), so it also needs to be asked which shape. */}
        {p.panorama && (
          <button
            onClick={p.onRender360}
            title={t("render.sarlavha")}
            className={`${hide} px-4 h-12 rounded-full bg-brand text-white text-[13px] font-bold shadow-lg ring-1 ring-brand/40`}
          >
            {t("render.nomi")}
          </button>
        )}

        {p.cameraStation != null && (
          <>
            {/* Portrait or landscape. Both framings of the same view — the
                horizontal angle is fixed, so switching turns the picture
                rather than cropping the room out of its sides. */}
            <div className={`${hide} flex items-center rounded-full bg-white/95 shadow-lg ring-1 ring-black/5 overflow-hidden`}>
              {RENDER_ASPECTS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => p.onAspect(a)}
                  aria-pressed={p.aspect.label === a.label}
                  className={`px-2.5 h-12 text-[12px] font-bold transition-colors ${
                    p.aspect.label === a.label ? 'bg-brand text-white' : 'text-brand'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <button
              onClick={p.onRenderStill}
              title={`${p.aspect.width} x ${p.aspect.height}`}
              className={`${hide} px-4 h-12 rounded-full bg-brand text-white text-[13px] font-bold shadow-lg ring-1 ring-brand/40`}
            >
              {t("render.nomi")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
