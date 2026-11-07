import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MenuAction {
  label: string;
  onSelect: () => void;
}

/**
 * A button that opens a short list of actions under it (`role="menu"`). Opening moves focus to
 * the first item; arrows, Home and End move between items; Escape or a choice closes it and gives
 * focus back to the button; a click elsewhere or tabbing out closes it too. Used for the products
 * tab's "Qo'shish ▾" and a row's "⋯".
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
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items.current.filter((x): x is HTMLButtonElement => x !== null);
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const move: Record<string, number> = {
      ArrowDown: (at + 1) % list.length,
      ArrowUp: (at - 1 + list.length) % list.length,
      Home: 0,
      End: list.length - 1,
    };
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key in move) {
      e.preventDefault();
      list[move[e.key]]?.focus();
    }
  };

  return (
    <div
      ref={root}
      className="relative shrink-0"
      onBlur={(e) => { if (open && !root.current?.contains(e.relatedTarget as Node | null)) setOpen(false); }}
    >
      <button
        ref={button}
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
          onKeyDown={onKeyDown}
          className={cn(
            "absolute top-full z-30 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {actions.map((a, i) => (
            <button
              key={a.label}
              ref={(el) => { items.current[i] = el; }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); close(true); a.onSelect(); }}
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
