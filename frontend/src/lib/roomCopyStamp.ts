/**
 * `updated_at` of the server copy the store last took or wrote, kept outside the studio page
 * (mobile QA 2026-11-21, #359). The estimate is its own page, so going there unmounts the studio:
 * a ref in the page started empty on the way back, the same copy fetched again was loaded over the
 * store, and that cleared the undo history. Kept for one room: another room's stamp reads as none.
 */
let last: { id: string; at: string } | null = null

export function roomCopyStamp(roomId: string | undefined): { current: string | null } {
  return {
    get current() {
      return roomId != null && last?.id === roomId ? last.at : null
    },
    set current(at: string | null) {
      if (roomId == null) return
      last = at == null ? null : { id: roomId, at }
    },
  }
}
