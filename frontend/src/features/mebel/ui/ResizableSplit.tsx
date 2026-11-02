import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const STEP = 24;

/** The window's height, kept current when the window is resized or the phone turned. */
export function useViewportHeight(): number {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return height;
}

/**
 * A height kept in localStorage: `set` changes it on screen, `save` remembers it. A storage that is
 * missing or throws just keeps the default.
 */
export function useStoredHeight(key: string, fallback: number): [number, (h: number) => void, (h: number) => void] {
  const [height, setHeight] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(key));
      return Number.isFinite(stored) && stored > 0 ? stored : fallback;
    } catch {
      return fallback;
    }
  });
  const save = (h: number) => {
    setHeight(h);
    try { localStorage.setItem(key, String(h)); } catch { /* the height just isn't remembered */ }
  };
  return [height, setHeight, save];
}

/**
 * The bar under the 3D view: drag it (mouse or touch) or use the arrow keys to give the view
 * more or less of the screen, within [min, max].
 */
export function ResizableSplit({ height, onHeight, onCommit, min, max, label }: {
  height: number;
  /** Every step of a drag. */
  onHeight: (h: number) => void;
  /** Where a drag ends, and each arrow-key step: the height worth remembering. */
  onCommit?: (h: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  const clamp = (h: number) => Math.min(max, Math.max(min, Math.round(h)));
  const drag = useRef<{ startY: number; startH: number; last: number } | null>(null);
  const latest = useRef({ onHeight, onCommit, clamp });
  latest.current = { onHeight, onCommit, clamp };

  useEffect(() => {
    const up = () => {
      if (!drag.current) return;
      const last = drag.current.last;
      drag.current = null;
      latest.current.onCommit?.(last);
    };
    const move = (e: globalThis.PointerEvent) => {
      if (!drag.current) return;
      // Released outside the window: no pointerup came, but no button is held any more.
      if (e.buttons === 0) { up(); return; }
      const h = latest.current.clamp(drag.current.startH + e.clientY - drag.current.startY);
      drag.current.last = h;
      latest.current.onHeight(h);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    drag.current = { startY: e.clientY, startH: height, last: height };
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowDown" ? STEP : e.key === "ArrowUp" ? -STEP : 0;
    if (!step) return;
    e.preventDefault();
    const h = clamp(height + step);
    onHeight(h);
    onCommit?.(h);
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuenow={height}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="group flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B84F5]/70"
    >
      <span className="h-1 w-12 rounded-full bg-line transition-colors group-hover:bg-ink-muted" />
    </div>
  );
}
