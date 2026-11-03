import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { initialRoomFocus } from "@/lib/roomFocus";

/**
 * Which room the canvas shows alone, or null for the whole flat.
 *
 * `/studio/:roomId` keeps the canvas mounted across a room switch, so the focus is
 * set again whenever the room changes: the room just opened is the one focused, even
 * if the flat view was showing (the old focus could otherwise hide the new room).
 */
export function useRoomFocus(roomId: string, search: string): [string | null, Dispatch<SetStateAction<string | null>>] {
  const [focused, setFocused] = useState<string | null>(() => initialRoomFocus(search, roomId));
  useEffect(() => { setFocused(initialRoomFocus(search, roomId)); }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps
  return [focused, setFocused];
}
