import { useEffect, useRef } from 'react'
import { useRoomStore, type RoomTemporalState } from '@/store/roomStore'

/**
 * What the studio keeps across a reload of its own (lib/safeReload: a new version, a chunk of the
 * old build gone): the stage the user was on and the undo/redo history, in session storage (this
 * tab only). The room itself is saved to the server before. Phone QA 2026-11-24 #12.
 *
 * The stage and the history are kept apart: the stage is read by the 3D page when it opens, the
 * history by the studio once the room has loaded (loading it clears the history), in either order.
 */
const PHASE_KEY = 'studioResume.phase'
const HISTORY_KEY = 'studioResume.history'
/** A copy older than this is not the reload it was written for. */
export const RESUME_MAX_AGE_MS = 10 * 60_000

interface PhaseCopy { roomId: string; at: number; phase: string | null; viewStage: string | null }
interface HistoryCopy {
  roomId: string
  at: number
  /** `updated_at` of the saved room the history leads to. */
  updatedAt: string
  past: Partial<RoomTemporalState>[]
  future: Partial<RoomTemporalState>[]
}

/** The stage the open 3D page is on (it holds it in its own state). */
let livePhase: { roomId: string; phase: string } | null = null

export function rememberStudioPhase(roomId: string, phase: string): void {
  livePhase = { roomId, phase }
}

export function forgetStudioPhase(roomId: string): void {
  if (livePhase?.roomId === roomId) livePhase = null
}

function read<T extends { roomId: string; at: number }>(key: string, roomId: string, now: number): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const copy = JSON.parse(raw) as T
    if (copy.roomId !== roomId || !(now - copy.at >= 0 && now - copy.at <= RESUME_MAX_AGE_MS)) return null
    return copy
  } catch {
    return null
  }
}

function remove(key: string): void {
  try { sessionStorage.removeItem(key) } catch { /* nothing kept */ }
}

/** Writes the stage and the history of this room, the room having just been saved at `updatedAt`. */
export function writeStudioResume(roomId: string, updatedAt: string | null, now = Date.now()): void {
  const phase: PhaseCopy = {
    roomId,
    at: now,
    phase: livePhase?.roomId === roomId ? livePhase.phase : null,
    viewStage: useRoomStore.getState().viewStage ?? null,
  }
  try { sessionStorage.setItem(PHASE_KEY, JSON.stringify(phase)) } catch { /* the stage is lost, the room is not */ }

  remove(HISTORY_KEY)
  // Without a saved copy to match after the reload, the history could lead to a room that is not it.
  if (!updatedAt) return
  const { pastStates, futureStates } = useRoomStore.temporal.getState()
  // The newest steps first to go when the whole history does not fit.
  for (const keep of [Infinity, 10]) {
    const copy: HistoryCopy = {
      roomId, at: now, updatedAt,
      past: pastStates.slice(-keep),
      future: futureStates.slice(-keep),
    }
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(copy))
      return
    } catch { /* too big: try fewer steps */ }
  }
}

/** The stage kept for this room, if the reload just happened. Kept until clearStudioPhase. */
export function peekStudioPhase(roomId: string, now = Date.now()): { phase: string | null; viewStage: string | null } | null {
  const copy = read<PhaseCopy>(PHASE_KEY, roomId, now)
  return copy ? { phase: copy.phase, viewStage: copy.viewStage } : null
}

export function clearStudioPhase(): void {
  remove(PHASE_KEY)
}

/**
 * Puts the kept undo/redo history back, once, for the room just loaded — only when it is the very
 * copy that was saved before the reload (nobody saved it again since, here or on another device).
 */
export function restoreStudioHistory(roomId: string, updatedAt: string | null, now = Date.now()): boolean {
  const copy = read<HistoryCopy>(HISTORY_KEY, roomId, now)
  remove(HISTORY_KEY)
  if (!copy || !updatedAt || copy.updatedAt !== updatedAt) return false
  useRoomStore.temporal.setState({
    pastStates: copy.past as RoomTemporalState[],
    futureStates: copy.future as RoomTemporalState[],
  })
  return true
}

/**
 * The 3D page's way to get its kept stage back: once the room has loaded (`roomReady`), since
 * loading it (resetRoom) puts the view back to the finished room — applied when the page opened,
 * the stage never showed (phone QA 2026-11-24, #393 #10). Given once, then forgotten; a page
 * opened again before the room loaded still gets it.
 */
export function useResumedStage(
  roomId: string,
  roomReady: boolean,
  apply: (kept: { phase: string | null; viewStage: string | null }) => void,
): void {
  const applyRef = useRef(apply)
  applyRef.current = apply
  useEffect(() => {
    if (!roomReady) return
    const kept = peekStudioPhase(roomId)
    if (!kept) return
    clearStudioPhase()
    applyRef.current(kept)
  }, [roomId, roomReady])
}
