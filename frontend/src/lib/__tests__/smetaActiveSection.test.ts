import { describe, it, expect } from 'vitest'
import { activeSection } from '../smetaActiveSection'

// Section tops relative to the viewport, px, in page order; the sticky bar ends at 100 px.
describe('activeSection: the section being read under the sticky bar', () => {
  it('is the last section whose top has passed under the bar, not the first still showing', () => {
    // Wall preparation's tail still shows at the top, wall finishing fills the screen (prod 2026-11-07).
    expect(activeSection([['tayyorlash', -600], ['pardoz', 40], ['pol', 900]], 100, false)).toBe('pardoz')
  })

  it('before any section reaches the bar, it is the first', () => {
    expect(activeSection([['tayyorlash', 300], ['pardoz', 900]], 100, false)).toBe('tayyorlash')
  })

  it('at the bottom of the page it is the last section, which can never reach the bar', () => {
    expect(activeSection([['elektr', -200], ['jihoz', 250]], 100, true)).toBe('jihoz')
  })

  it('no sections, no answer', () => {
    expect(activeSection([], 100, false)).toBeNull()
  })
})
