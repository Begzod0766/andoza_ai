import { Redo2, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { redoRoom, undoRoom, useRoomHistory } from "@/lib/roomHistory";

/**
 * Undo and redo in the studio header (mobile QA 2026-11-11 #1). Until these, undo was Ctrl/⌘+Z
 * alone, which a phone does not have. Each is off while it has nothing to do.
 */
export function UndoRedoButtons() {
  const { t } = useTranslation();
  const { canUndo, canRedo } = useRoomHistory();
  const cls = "w-10 h-10 rounded-full bg-card-soft text-ink flex items-center justify-center flex-shrink-0 transition-colors hover:bg-line disabled:opacity-35 disabled:hover:bg-card-soft";
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button type="button" className={cls} disabled={!canUndo} onClick={() => undoRoom()} aria-label={t("studio.page.undo")} title={t("studio.page.undo")}>
        <Undo2 size={18} aria-hidden="true" />
      </button>
      <button type="button" className={cls} disabled={!canRedo} onClick={() => redoRoom()} aria-label={t("studio.page.redo")} title={t("studio.page.redo")}>
        <Redo2 size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
