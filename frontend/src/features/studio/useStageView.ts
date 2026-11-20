import { useMemo } from 'react'
import { useRoomStore } from '@/store/roomStore'
import { visibleStages, type PhaseKey } from '@/lib/phases'
import { catalogRoomType, effectiveRoomType } from '@/lib/roomType'
import { drawnAt, type ItemStage } from '@/lib/stageView'

/** The open room's catalog kind ('hammom', 'oshxona', …), as the stage list reads it. */
export function useRoomKind(): string | undefined {
  return useRoomStore((s) => catalogRoomType(effectiveRoomType(s.roomType ?? undefined, s.name)))
}

/** The open room's stages, in order (the same array while the room's kind stays). */
export function useRoomStages(): PhaseKey[] {
  const kind = useRoomKind()
  return useMemo(() => visibleStages(kind).map((s) => s.key), [kind])
}

/** Whether the 3D draws a thing of stage `item` at the stage picked (spec 2026-11-18). */
export function useDrawnAt(item: ItemStage): boolean {
  const view = useRoomStore((s) => s.viewStage)
  const stages = useRoomStages()
  return drawnAt(item, view, stages)
}
