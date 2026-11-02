import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MenuAction {
  label: string;
  onSelect: () => void;
}

/**
 * A button that opens a short list of actions under it (`role="menu"`). It closes on a choice,
 * on Escape and on a click anywhere else. Used for the products tab's "Qo'shish ▾" and a row's "⋯".
 */
export function ActionMenu({ label, trigger, actions, triggerClassName, align = "end" }: {
  /** The trigger's accessible name. */
  label: string;
  trigger: ReactNode;
  actions: MenuAction[];
  triggerClassName?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={cn(
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B84F5]/70",
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-30 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); setOpen(false); a.onSelect(); }}
              className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-ink/10 focus-visible:bg-ink/10 focus-visible:outline-none"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
