import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import { SummaryBar } from './SummaryBar'

afterEach(() => { void i18n.changeLanguage('uz') })

describe('SummaryBar', () => {
  it('writes the metres with the UI language\'s decimal mark, not the browser\'s', async () => {
    await i18n.changeLanguage('ru')
    render(<SummaryBar summary={{ sheets: 1, offcuts: 0, edgeMeters: 42.5, parts: 3, total: null, warnings: 0 }} priceReady={false} onOpen={() => {}} />)
    expect(screen.getByRole('group').textContent).toContain('42,5')
  })
})
