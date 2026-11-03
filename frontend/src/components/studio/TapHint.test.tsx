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
})
