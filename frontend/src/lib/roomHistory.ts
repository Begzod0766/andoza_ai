import { useStore } from 'zustand'
import { useRoomStore } from '@/store/roomStore'

/**
 * Undo and redo for the room, for the keyboard shortcut and the header buttons alike.
 *
 * A step taken back is an edit like any other and must be saved. The history restores the room's
 * content but not `isDirty` (it is no part of a step), and the autosave acts only on an unsaved
 * room: undo after a save used to change the screen and never the server, so the undone thing came
 * back on reload (mobile QA 2026-11-11 #9). The room is marked unsaved first, so the restore that
 * follows is seen as an edit.
 */

const history = () => useRoomStore.temporal.getState()

/** Takes the last step back. False when there is none. */
export function undoRoom(): boolean {
  if (history().pastStates.length === 0) return false
  useRoomStore.setState({ isDirty: true })
  history().undo()
  return true
}

/** Brings back the step last undone. False when there is none. */
export function redoRoom(): boolean {
  if (history().futureStates.length === 0) return false
  useRoomStore.setState({ isDirty: true })
  history().redo()
  return true
}

/** Whether there is a step to take back, and one to bring back. */
export function useRoomHistory(): { canUndo: boolean; canRedo: boolean } {
  const canUndo = useStore(useRoomStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useRoomStore.temporal, (s) => s.futureStates.length > 0)
  return { canUndo, canRedo }
}
