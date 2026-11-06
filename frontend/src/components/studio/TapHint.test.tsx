import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import i18n from '@/i18n'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { TapHint, StagePill, StagePillLayer, STAGE_LIST_Z, useTapHintSeen } from './TapHint'

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

// Begzod0766/andoza_ai#181: the room's blue focus button (a drei <Html> label,
// zIndexRange up to 90) showed on top of the open stage list, between "Light
// fixtures" and "Furniture". The scene's labels share a stacking context with
// the pill's layer (z-20), so the layer has to rise above every label while
// the list is open.
describe('StagePillLayer (#181)', () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) return sources(p)
      return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [p] : []
    })
  }

  it('the open list sits above every scene label', () => {
    const tops = sources(join(__dirname, '..', '..')).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/zIndexRange=\{\[(\d+)/g)].map((m) => Number(m[1])))
    expect(tops.length).toBeGreaterThan(0)
    expect(STAGE_LIST_Z).toBeGreaterThan(Math.max(...tops))
  })

  it('rises only while the list is open, and drops back on a pick', () => {
    const { container } = render(<StagePillLayer roomName="Zal" phase="boyoq" onPick={() => {}} />)
    const layer = container.firstElementChild as HTMLElement
    expect(layer.style.zIndex).toBe('')
    fireEvent.click(screen.getByRole('button', { name: /Zal/ }))
    expect(layer.style.zIndex).toBe(String(STAGE_LIST_Z))
    fireEvent.click(screen.getByRole('button', { name: i18n.t('studio.lib.stage.pol') }))
    expect(layer.style.zIndex).toBe('')
  })

  it('drops back when a press outside closes the list', () => {
    const { container } = render(<StagePillLayer roomName="Zal" phase="boyoq" onPick={() => {}} />)
    const layer = container.firstElementChild as HTMLElement
    fireEvent.click(screen.getByRole('button', { name: /Zal/ }))
    act(() => { fireEvent.pointerDown(document.body) })
    expect(screen.queryByRole('list')).toBeNull()
    expect(layer.style.zIndex).toBe('')
  })
})
