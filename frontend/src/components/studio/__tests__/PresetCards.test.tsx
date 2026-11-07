import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PresetCards } from '../PresetCards'
import { DESIGN_PRESETS } from '@/lib/aiDesignPresets'
import i18n from '@/i18n'

describe('PresetCards: ready-made styles as picture cards', () => {
  it('shows one card per style, named, with a drawing of the room and its palette', () => {
    render(<PresetCards onPick={() => {}} />)
    const cards = screen.getAllByRole('button')
    expect(cards).toHaveLength(DESIGN_PRESETS.length)
    for (const p of DESIGN_PRESETS) {
      const card = screen.getByRole('button', { name: i18n.t(p.labelKey) })
      expect(card.querySelector('[data-part="room"]')).not.toBeNull()
      expect(card.querySelectorAll('[data-part="swatch"]').length).toBeGreaterThan(1)
    }
  })

  it('a tap applies that style', () => {
    const onPick = vi.fn()
    render(<PresetCards onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: i18n.t(DESIGN_PRESETS[1].labelKey) }))
    expect(onPick).toHaveBeenCalledWith(DESIGN_PRESETS[1].id)
  })

  it('marks the style last applied, and only it', () => {
    render(<PresetCards onPick={() => {}} selected={DESIGN_PRESETS[2].id} />)
    const pressed = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveAccessibleName(i18n.t(DESIGN_PRESETS[2].labelKey))
  })

  it('every card is disabled while a design is being applied', () => {
    render(<PresetCards onPick={() => {}} disabled />)
    for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled()
  })
})
