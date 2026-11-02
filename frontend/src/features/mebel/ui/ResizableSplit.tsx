import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const STEP = 24;

/** A height kept in localStorage; a storage that is missing or throws just keeps the default. */
export function useStoredHeight(key: string, fallback: number): [number, (h: number) => void] {
  const [height, setHeight] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(key));
      return Number.isFinite(stored) && stored > 0 ? stored : fallback;
    } catch {
      return fallback;
    }
  });
  const set = (h: number) => {
    setHeight(h);
    try { localStorage.setItem(key, String(h)); } catch { /* the height just isn't remembered */ }
  };
  return [height, set];
}

/**
 * The bar under the 3D view: drag it (mouse or touch) or use the arrow keys to give the view
 * more or less of the screen, within [min, max].
 */
export function ResizableSplit({ height, onHeight, min, max, label }: {
  height: number;
  onHeight: (h: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  const clamp = (h: number) => Math.min(max, Math.max(min, Math.round(h)));
  const drag = useRef<{ startY: number; startH: number } | null>(null);
  const latest = useRef({ onHeight, clamp });
  latest.current = { onHeight, clamp };

  useEffect(() => {
    const move = (e: globalThis.PointerEvent) => {
      if (!drag.current) return;
      latest.current.onHeight(latest.current.clamp(drag.current.startH + e.clientY - drag.current.startY));
    };
    const up = () => { drag.current = null; };
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
    drag.current = { startY: e.clientY, startH: height };
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); onHeight(clamp(height + STEP)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); onHeight(clamp(height - STEP)); }
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
