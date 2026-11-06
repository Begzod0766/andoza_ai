/**
 * QA 2026-11-05 #19: "1/6", "1/21", "1/113" in the corner menu read like page
 * numbers. They are where the scrolling ring is sitting in its list, and the
 * marker has to say so in words.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import { QuarterArcMenu, type ArcCategory } from './QuarterArcMenu'

function category(count: number): ArcCategory {
  return {
    key: 'wall',
    label: 'Devor',
    icon: null,
    items: Array.from({ length: count }, (_, i) => ({ key: `w${i}`, label: `Oboy ${i + 1}`, onSelect: () => {} })),
  }
}

function openRing(count: number) {
  render(<QuarterArcMenu categories={[category(count)]} />)
  fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.arc.add') }))
  fireEvent.click(screen.getByRole('button', { name: /Devor/ }))
}

describe('the ring position marker (QA #19)', () => {
  it('says "1 of 30" in words, with an accessible label, not "1/30"', () => {
    openRing(30)
    expect(screen.queryByText('1/30')).toBeNull()
    expect(screen.getByText(i18n.t('studio.arc.position', { pos: 1, total: 30 }))).toBeInTheDocument()
    expect(screen.getByLabelText(i18n.t('studio.arc.position_aria', { pos: 1, total: 30 }))).toBeInTheDocument()
  })

  it('is not shown when the whole list fits', () => {
    openRing(2)
    expect(screen.queryByText(i18n.t('studio.arc.position', { pos: 1, total: 2 }))).toBeNull()
  })
})
