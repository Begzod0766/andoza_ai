import { useEffect, useRef } from 'react'
import { useRoomStore } from '@/store/roomStore'
import { effectiveRoomType } from '@/lib/roomType'

/**
 * Loads the room's pipe prices once per opened bathroom or kitchen (spec 2026-11-24 § D). Keyed on the
 * room id, not on how the store came to hold the room: a room the wizard just made is already the
 * store's room, and a room switch (which resets the prices) loads again. Remounting loads again.
 * Declare it after the effect that resets and loads the room, so the reset runs first.
 */
export function usePlumbingPricesLoad(room: { id: string; name: string; room_type?: string | null } | null | undefined) {
  const loadedFor = useRef<string | null>(null)
  const id = room?.id ?? null
  const kind = room ? effectiveRoomType(room.room_type, room.name) : undefined
  const wet = kind === 'hammom' || kind === 'oshxona'
  useEffect(() => {
    if (!id || !wet || loadedFor.current === id) return
    loadedFor.current = id
    void useRoomStore.getState().loadPlumbingPrices(id)
  }, [id, wet])
}
