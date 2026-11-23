import { useRoomStore, type RoomTemporalState } from '@/store/roomStore'

/**
 * Takes the tour's practice furniture out of the room AND out of the undo history.
 *
 * Adding the practice table was an ordinary step, and so was taking it out again, so undo after the
 * tour brought the table back (phone QA 2026-11-23 #2). The removal runs with the history paused,
 * and every entry of the history loses the practice ids too: the step that added them then equals
 * the one before it and is dropped. What the user did before the tour, and any other step taken
 * during it, stays undoable.
 */
export function removePracticeOutOfHistory(ids: readonly string[]): void {
  if (ids.length === 0) return
  const temporal = useRoomStore.temporal
  temporal.getState().pause()
  try {
    useRoomStore.getState().removeFurnitureMany(ids)
  } finally {
    temporal.getState().resume()
  }

  type Entry = Partial<RoomTemporalState>
  const drop = new Set(ids)
  const strip = (e: Entry): Entry =>
    e.furniture?.some((f) => drop.has(f.id)) ? { ...e, furniture: e.furniture.filter((f) => !drop.has(f.id)) } : e
  // By value where the references differ: the removal recomputes derived fields (plumbing's
  // fixture points) into new objects of the same content.
  const same = (x: Entry, y: Entry) => {
    const keys = new Set([...Object.keys(x), ...Object.keys(y)])
    const xs = x as Record<string, unknown>
    const ys = y as Record<string, unknown>
    return [...keys].every((k) => Object.is(xs[k], ys[k]) || JSON.stringify(xs[k]) === JSON.stringify(ys[k]))
  }

  const { pastStates, futureStates } = temporal.getState()
  const room = useRoomStore.getState() as unknown as Record<string, unknown>
  // The room as it is now, in the shape of a history entry, for comparing the entries next to it.
  const sample = pastStates[pastStates.length - 1] ?? futureStates[futureStates.length - 1]
  if (!sample) return
  const current = Object.fromEntries(Object.keys(sample).map((k) => [k, room[k]])) as Entry
  const NOW = Symbol('now')

  // Oldest first, through now, to the step that redo would bring back last (futureStates is the
  // other way round: its last entry is the next redo).
  const line: (Entry | typeof NOW)[] = [...pastStates.map(strip), NOW, ...[...futureStates].reverse().map(strip)]
  const kept: (Entry | typeof NOW)[] = []
  for (const e of line) {
    const prev = kept[kept.length - 1]
    if (prev !== undefined) {
      const a = prev === NOW ? current : prev
      const b = e === NOW ? current : e
      if (same(a, b)) {
        // Equal neighbours are one step: keep now in place of an equal past one.
        if (e === NOW) kept[kept.length - 1] = NOW
        continue
      }
    }
    kept.push(e)
  }
  const at = kept.indexOf(NOW)
  temporal.setState({
    pastStates: kept.slice(0, at) as Entry[],
    futureStates: (kept.slice(at + 1) as Entry[]).reverse(),
  })
}
