import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import i18n from '@/i18n'
import { TapHint, StagePill, useTapHintSeen } from './TapHint'

afterEach(() => { vi.restoreAllMocks(); try { localStorage.clear() } catch { /* ignore */ } })

describe('TapHint', () => {
  it('says to tap a surface and closes on ×', () => {
    const onDismiss = vi.fn()
    render(<TapHint onDismiss={onDismiss} />)
    expect(screen.getByText(i18n.t('studio.tap_hint'))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.yopish') }))
    expect(onDismiss).toHaveBeenCalled()
  })
})

describe('useTapHintSeen', () => {
  it('is remembered once marked', () => {
    const first = renderHook(() => useTapHintSeen())
    expect(first.result.current[0]).toBe(false)
    act(() => first.result.current[1]())
    expect(first.result.current[0]).toBe(true)
    expect(renderHook(() => useTapHintSeen()).result.current[0]).toBe(true)
  })

  it('a storage that throws still lets the hint close', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    const { result } = renderHook(() => useTapHintSeen())
    expect(result.current[0]).toBe(false)
    act(() => result.current[1]())
    expect(result.current[0]).toBe(true)
  })
})

describe('StagePill', () => {
  it('reads "<room> · <stage>"', () => {
    render(<StagePill roomName="Mening xonam" phase="boyoq" />)
    expect(screen.getByText(/^Mening xonam · .+/)).toBeInTheDocument()
  })

  // QA 2026-11-05 #17: on a phone the stage list is hidden (`hidden lg:flex`)
  // and the pill could not be tapped, so it said "Paint/Wallpaper" forever and
  // there was no way to the next stage.
  it('says the stage it is given', () => {
    render(<StagePill roomName="Zal" phase="pol" />)
    expect(screen.getByText(`Zal · ${i18n.t('studio.lib.stage.pol')}`)).toBeInTheDocument()
  })

  it('opens the stage list on a tap, and a pick goes to that stage', () => {
    const onPick = vi.fn()
    render(<StagePill roomName="Zal" phase="boyoq" onPick={onPick} />)
    const pill = screen.getByRole('button', { name: /Zal/ })
    expect(pill).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(pill)
    expect(pill).toHaveAttribute('aria-expanded', 'true')

    const list = screen.getByRole('list', { name: i18n.t('studio.three_d.bosqichni_tanlash') })
    expect(list.querySelectorAll('button')).toHaveLength(7)
    expect(screen.getByRole('button', { name: i18n.t('studio.lib.stage.boyoq') })).toHaveAttribute('aria-current', 'step')

    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.lib.stage.pol') }))
    expect(onPick).toHaveBeenCalledWith('pol')
    expect(screen.queryByRole('list')).toBeNull()
  })
})
