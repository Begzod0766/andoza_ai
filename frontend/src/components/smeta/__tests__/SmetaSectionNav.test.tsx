import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import { SmetaSectionNav } from '../SmetaSectionNav'
import type { LineGroup } from '@/lib/smetaGroups'

const group = (key: LineGroup['key'], subtotal: number): LineGroup =>
  ({ key, items: [], subtotal, share: 0 }) as LineGroup
const GROUPS = [group('tayyorlash', 602000), group('pol', 3419400), group('jihoz', 12500000)]
const fmt = (n: number) => `${n} UZS`

describe('SmetaSectionNav: the estimate sections as a row under the sticky total', () => {
  it('shows one link per section with its name and subtotal', () => {
    render(<SmetaSectionNav groups={GROUPS} active="pol" onPick={() => {}} fmt={fmt} />)
    expect(screen.getByRole('navigation', { name: i18n.t('smeta.bolimlar') })).toBeInTheDocument()
    for (const g of GROUPS) {
      const link = screen.getByRole('button', { name: new RegExp(i18n.t(`smeta.toifa.${g.key}`)) })
      expect(link).toHaveTextContent(fmt(g.subtotal))
    }
  })

  it('marks the section being read, and only it', () => {
    render(<SmetaSectionNav groups={GROUPS} active="pol" onPick={() => {}} fmt={fmt} />)
    const current = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'true')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent(i18n.t('smeta.toifa.pol'))
  })

  it('a tap goes to that section', () => {
    const onPick = vi.fn()
    render(<SmetaSectionNav groups={GROUPS} active={null} onPick={onPick} fmt={fmt} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('smeta.toifa.jihoz')) }))
    expect(onPick).toHaveBeenCalledWith('jihoz')
  })

  it('with a single section there is nothing to jump between: no row', () => {
    const { container } = render(<SmetaSectionNav groups={[GROUPS[0]]} active={null} onPick={() => {}} fmt={fmt} />)
    expect(container).toBeEmptyDOMElement()
  })
})
