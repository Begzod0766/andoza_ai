import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRoomStore } from "@/store/roomStore";

/**
 * Whether the room shows its Qibla arrow — the ⋮ menu's Qibla switch.
 *
 * It is the room's own, kept in designState beside the city and direction it
 * is worked out from, so the autosave carries it and reopening the room brings
 * it back on (issue #183). It was component state before, and so reset to off
 * every time the studio was left.
 */
export function useQiblaVisible(): [boolean, Dispatch<SetStateAction<boolean>>] {
  const show = useRoomStore((st) => st.designState.showQibla ?? false);
  const set = useCallback((next: SetStateAction<boolean>) => {
    const st = useRoomStore.getState();
    const cur = st.designState.showQibla ?? false;
    const value = typeof next === "function" ? next(cur) : next;
    if (value !== cur) st.setDesignState({ showQibla: value });
  }, []);
  return [show, set];
}
