import { create } from "zustand";

/**
 * The wall the design panel is pointing at, shared with the 3D view.
 *
 * `hovered` lights a wall while its chip is under the pointer or keyboard focus.
 * `turnTo` + `nonce` ask the camera to face a wall: a chip press sets them (the nonce
 * bumps every press, so pressing the same chip after moving the camera turns back to
 * it); "Hamma devorlar" clears `turnTo`, which frames the whole room again. A wall
 * tapped in the 3D view only selects it — the camera stays where the user put it.
 */
interface WallFocusState {
  hovered: string | null;
  turnTo: string | null;
  nonce: number;
  setHovered: (id: string | null) => void;
  requestTurn: (id: string | null) => void;
  reset: () => void;
}

export const useWallFocusStore = create<WallFocusState>((set) => ({
  hovered: null,
  turnTo: null,
  nonce: 0,
  setHovered: (hovered) => set({ hovered }),
  requestTurn: (turnTo) => set((s) => ({ turnTo, nonce: s.nonce + 1 })),
  reset: () => set({ hovered: null, turnTo: null }),
}));

/** The real walls a chip can turn the camera to (not the floor, ceiling or trims). */
export const isWallTarget = (key: string | null): key is string =>
  key != null && !["ALL", "FLOOR", "CEILING", "SKIRTING", "CORNICE"].includes(key);
