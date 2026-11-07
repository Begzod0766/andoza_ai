import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import uz from '@/i18n/locales/uz.json'
import { FocusButton } from '@/pages/studio/three-d/SiblingRoomLayout'
import { shouldShowTapHint } from '../TapHint'

describe('studio minor fixes', () => {
  it('the discard strings the old inline confirm used are gone', () => {
    expect((uz as { studio: Record<string, unknown> }).studio).not.toHaveProperty('dizaynni_bekor_tasdiq')
    expect((uz as { studio: Record<string, unknown> }).studio).not.toHaveProperty('ha_ochirish')
  })

  it('the room being edited, shown among the others, is outlined — filled only when it is the one focused', () => {
    const { rerender } = render(<FocusButton focused={false} onClick={() => {}} name="Oshxona" active />)
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'active')
    rerender(<FocusButton focused onClick={() => {}} name="Oshxona" active />)
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'focused')
    rerender(<FocusButton focused={false} onClick={() => {}} name="Oshxona" />)
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'idle')
  })

  it('the tap hint stays away while the view is locked (a tap opens nothing then)', () => {
    expect(shouldShowTapHint({ seen: false, locked: false })).toBe(true)
    expect(shouldShowTapHint({ seen: false, locked: true })).toBe(false)
    expect(shouldShowTapHint({ seen: true, locked: false })).toBe(false)
  })
})
