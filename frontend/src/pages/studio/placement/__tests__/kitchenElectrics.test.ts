/**
 * A kitchen's electrics (2026-11-18): the cooker gets a 32 A outlet of its own low behind it,
 * the hood a socket high on the wall, and the sockets over the worktop sit at 1100 mm instead of
 * the 300 mm every other room uses.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { applyLanguage } from '@/i18n'
import { CATALOG, ELEC_DIMS_3D, electricalCatalogFor, electricalLabel, SOCKET_TYPES } from '../constants'
import { ELECTRICAL_DIMS } from '@/pages/studio/three-d/constants'
import type { ElectricalType } from '@/store/roomStore'

afterEach(() => applyLanguage('uz'))

describe('the cooker outlet', () => {
  it('is a device of its own, low behind the cooker', () => {
    const type: ElectricalType = 'socket_power'
    expect(CATALOG.find((c) => c.type === type)?.height).toBe(150)
    expect(SOCKET_TYPES.has(type)).toBe(true)
    expect(ELEC_DIMS_3D[type]).toBeDefined()
    expect(ELECTRICAL_DIMS[type]).toBeDefined()
  })

  it('has a name in every language', () => {
    expect(electricalLabel('socket_power')).toBe('Plita rozetkasi (32 A)')
    applyLanguage('ru')
    expect(electricalLabel('socket_power')).toBe('Розетка для плиты (32 А)')
    applyLanguage('en')
    expect(electricalLabel('socket_power')).toBe('Cooker outlet (32 A)')
  })
})

describe('what the wall ring offers', () => {
  const heights = (room: string | undefined) =>
    Object.fromEntries(electricalCatalogFor(room).map((e) => [e.key, e.height]))

  it('puts a kitchen socket over the worktop, the hood socket high, the cooker outlet low', () => {
    const h = heights('oshxona')
    expect(h.socket1).toBe(1100)
    expect(h.socket2).toBe(1100)
    expect(h['socket1:hood']).toBe(2000)
    expect(h.socket_power).toBe(150)
  })

  it('the hood socket is a single socket, named for what it is for', () => {
    const hood = electricalCatalogFor('oshxona').find((e) => e.key === 'socket1:hood')!
    expect(hood.type).toBe('socket1')
    expect(hood.label()).toBe('Vityajka rozetkasi')
  })

  it('leaves every other room as it was, with no cooker or hood outlet', () => {
    for (const room of ['mehmonxona', 'yotoqxona', 'hammom', undefined]) {
      const h = heights(room)
      expect(h.socket1).toBe(300)
      expect(h.socket2).toBe(300)
      expect(h.socket_power).toBeUndefined()
      expect(h['socket1:hood']).toBeUndefined()
    }
  })
})
