// ─── Combined store type ───────────────────────────────────────────────────
//
// RoomStore is the union of every slice's state + actions. Kept in its own
// file (rather than in roomStore.ts) so slice files can import it — for the
// `StateCreator<RoomStore, [], [], XSlice>` typing the standard Zustand
// slice pattern relies on — without creating a value-level circular import
// with roomStore.ts itself.

import type { IdentitySlice } from './slices/identitySlice'
import type { GeometrySlice } from './slices/geometrySlice'
import type { DesignSlice } from './slices/designSlice'
import type { FurnitureSlice } from './slices/furnitureSlice'
import type { ElectricalSlice } from './slices/electricalSlice'
import type { PlumbingSlice } from './slices/plumbingSlice'
import type { TowelRailSlice } from './slices/towelRailSlice'
import type { LightSlice } from './slices/lightSlice'
import type { UiSlice } from './slices/uiSlice'
import type { LifecycleSlice } from './slices/lifecycleSlice'

export interface RoomStore
  extends IdentitySlice,
    GeometrySlice,
    DesignSlice,
    FurnitureSlice,
    ElectricalSlice,
    PlumbingSlice,
    TowelRailSlice,
    LightSlice,
    UiSlice,
    LifecycleSlice {}
