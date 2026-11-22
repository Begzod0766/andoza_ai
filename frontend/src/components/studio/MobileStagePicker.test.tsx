import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { visibleStages } from '@/lib/phases'
import { MobileStagePicker } from './MobileStagePicker'

const stages = visibleStages('hammom')

describe('MobileStagePicker (phone, spec 2026-11-18)', () => {
  it('shows the stage the 3D draws, or "Tayyor xona" for the finished room', () => {
    const { rerender } = render(<MobileStagePicker stages={stages} view="full" onPick={() => {}} onFull={() => {}} />)
    expect(screen.getByRole('button', { name: /Bosqich: Tayyor xona/ })).toBeInTheDocument()
    rerender(<MobileStagePicker stages={stages} view="suvoq" onPick={() => {}} onFull={() => {}} />)
    expect(screen.getByRole('button', { name: /Bosqich: Suvoq/ })).toBeInTheDocument()
  })
  it('is for a phone only: hidden from lg up, where the stage list is', () => {
    const { container } = render(<MobileStagePicker stages={stages} view="full" onPick={() => {}} onFull={() => {}} />)
    expect((container.firstChild as HTMLElement).className).toContain('lg:hidden')
    // Above the stage banner under it, so the open list is never covered.
    expect((container.firstChild as HTMLElement).className).toContain('z-10')
  })
  it('opens the list of the room\'s stages; a pick moves the 3D there and closes it', () => {
    const onPick = vi.fn()
    render(<MobileStagePicker stages={stages} view="full" onPick={onPick} onFull={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Quvurlar' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Bosqich:/ }))
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Quvurlar', 'Jihozlar', 'Mebel', 'Tayyor xona']))
    fireEvent.click(screen.getByRole('button', { name: 'Pol' }))
    expect(onPick).toHaveBeenCalledWith('pol')
    expect(screen.queryByRole('button', { name: 'Quvurlar' })).toBeNull()
  })
  it('says when its list opens and closes', () => {
    const onOpenChange = vi.fn()
    render(<MobileStagePicker stages={stages} view="full" onPick={() => {}} onFull={() => {}} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Bosqich:/ }))
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: 'Suvoq' }))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })
  it('"Tayyor xona" in the list goes back to the finished room', () => {
    const onFull = vi.fn()
    render(<MobileStagePicker stages={stages} view="pol" onPick={() => {}} onFull={onFull} />)
    fireEvent.click(screen.getByRole('button', { name: /Bosqich:/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tayyor xona' }))
    expect(onFull).toHaveBeenCalled()
  })
  it('marks the pill for the tour, and the list once open', () => {
    const { container } = render(<MobileStagePicker stages={stages} view="full" onPick={() => {}} onFull={() => {}} />)
    expect(container.querySelector('[data-tour="stage"]')).not.toBeNull()
    expect(container.querySelector('[data-tour="stage-list"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Bosqich:/ }))
    expect(container.querySelector('[data-tour="stage-list"]')).not.toBeNull()
  })

  it('hand_on_row: the tour\'s hand anchor is the first stage row other than the current one', () => {
    const { rerender } = render(<MobileStagePicker stages={stages} view={stages[0].key} onPick={() => {}} onFull={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Bosqich:/ }))
    const list = document.querySelector('[data-tour="stage-list"]') as HTMLElement
    let at = list.querySelectorAll('[data-tour-hand-at]')
    expect(at).toHaveLength(1)
    expect(at[0].tagName).toBe('BUTTON')
    expect(at[0].textContent).toBe(screen.getAllByRole('button')[2].textContent)
    rerender(<MobileStagePicker stages={stages} view="full" onPick={() => {}} onFull={() => {}} />)
    at = list.querySelectorAll('[data-tour-hand-at]')
    expect(at).toHaveLength(1)
    expect(at[0]).toBe(screen.getAllByRole('button')[1])
  })
})
