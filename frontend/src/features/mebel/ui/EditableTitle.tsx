import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * The project's name as the page title; a click turns it into a field. Enter or leaving the field
 * keeps the new name, Escape drops it, and an empty name is refused (the old one stays).
 */
export function EditableTitle({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  // Enter or Escape ends the edit; the blur the browser fires as the field goes must not end it again.
  const done = useRef(false);

  const finish = (keep: boolean) => {
    if (done.current) return;
    done.current = true;
    const next = draft?.trim() ?? "";
    if (keep && next && next !== name) onRename(next);
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={120}
        aria-label={t("mebel.project_name")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") finish(true);
          else if (e.key === "Escape") finish(false);
        }}
        className="min-w-0 flex-1 rounded-lg border border-line bg-card-soft px-2 py-1 text-base font-bold text-ink focus:outline-none focus:ring-2 focus:ring-[#5B84F5]/70"
      />
    );
  }
  return (
    <h1 aria-label={name} className="min-w-0 flex-1 truncate text-base font-bold text-ink">
      <button type="button" onClick={() => { done.current = false; setDraft(name); }} aria-label={t("mebel.header.rename", { name })}
        className="max-w-full truncate rounded-lg px-1 text-left hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B84F5]/70">
        <span aria-hidden="true">{name}</span>
      </button>
    </h1>
  );
}
