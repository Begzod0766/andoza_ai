import { useTranslation } from "react-i18next";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { updateRoom } from "@/lib/api";
import { DEFAULT_DESIGN_STATE, useRoomStore } from "@/store/roomStore";
import { MENU_ICON, MENU_ROW } from "./menuRow";

/**
 * "Dizaynni bekor qilish" in the studio's ⋮ menu. It used to be the loudest button of the
 * design panel, always in view under the colour picks; behind the menu it is one step
 * further away and still asks first, since the room's design cannot be got back.
 */
export function DiscardDesignMenuItem({ roomId, onDone }: { roomId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const resetDesignState = useRoomStore((s) => s.resetDesignState);

  const discard = async () => {
    const ok = await confirm({
      title: t("studio.dizaynni_bekor_qilish"),
      description: t("studio.dizayn_bekor_izoh"),
      confirmLabel: t("studio.dizaynni_bekor_qilish"),
      destructive: true,
    });
    if (!ok) return;
    resetDesignState();
    onDone();
    if (roomId !== "local") {
      await updateRoom(roomId, {
        design_state: { wallCoverings: DEFAULT_DESIGN_STATE.wallCoverings, floorType: DEFAULT_DESIGN_STATE.floorType },
      }).catch(() => {});
    }
  };

  return (
    <button type="button" onClick={() => void discard()} className={`${MENU_ROW} text-red-500`}>
      <svg className={MENU_ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
      </svg>
      <span>{t("studio.dizaynni_bekor_qilish")}</span>
    </button>
  );
}
