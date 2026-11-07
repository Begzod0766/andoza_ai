/**
 * The styled stand-in for window.confirm(): `useConfirm()` resolves true only
 * when the user presses the confirm button; cancel, Escape and the X all
 * resolve false.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { ConfirmProvider, useConfirm, type ConfirmOptions } from './ConfirmDialog'
import { FeedbackProvider } from './FeedbackProvider'
import { showToast } from './Toast'

function Asker({ options }: { options: ConfirmOptions }) {
  const confirm = useConfirm()
  const [answer, setAnswer] = useState('none')
  return (
    <>
      <button onClick={async () => setAnswer(String(await confirm(options)))}>ask</button>
      <output>{answer}</output>
    </>
  )
}

function mount(options: ConfirmOptions = { title: "O'chirilsinmi?", description: "Bu amalni qaytarib bo'lmaydi.", destructive: true }) {
  render(<ConfirmProvider><Asker options={options} /></ConfirmProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'ask' }))
}

describe('useConfirm', () => {
  it('resolves true when confirmed', async () => {
    mount()
    const dialog = await screen.findByRole('dialog', { name: "O'chirilsinmi?" })
    expect(dialog).toHaveTextContent("Bu amalni qaytarib bo'lmaydi.")
    fireEvent.click(within(dialog).getByRole('button', { name: "O'chirish" }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('true'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('resolves false when cancelled', async () => {
    mount()
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Bekor qilish' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('false'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('resolves false on Escape', async () => {
    mount()
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('false'))
  })

  it('uses the given labels, and a neutral confirm for non-destructive questions', async () => {
    mount({ title: 'Davom etasizmi?', confirmLabel: 'Ha', cancelLabel: "Yo'q" })
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: "Yo'q" })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ha' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('true'))
  })
})

describe('showToast', () => {
  it('reaches the mounted provider from outside React', async () => {
    render(<FeedbackProvider><div /></FeedbackProvider>)
    showToast({ variant: 'error', title: "Qismni ajratib bo'lmadi", description: 'xato' })
    expect(await screen.findByText("Qismni ajratib bo'lmadi")).toBeInTheDocument()
  })
})

describe('toast viewport', () => {
  // QA 2026-11-06 4.4 (#174): the viewport stood at bottom-24 right-4 with
  // 280-380 px toasts, i.e. across the studio's bottom-left camera row on a
  // phone ("My renders"): the refusal could not be read and the toast sat on
  // the controls. On a phone it now drops in from the top, under the header;
  // from lg it keeps the bottom-right corner, where nothing else stands.
  it('sits at the top on a phone and bottom-right only from lg, above the studio panels', () => {
    render(<FeedbackProvider><div /></FeedbackProvider>)
    const viewport = screen.getByRole('region').querySelector('ol')!
    const cls = viewport.className.split(/\s+/)
    expect(cls).toContain('fixed')
    expect(cls).toContain('z-[100]')
    expect(cls).toContain('inset-x-4')
    expect(cls.some((c) => c.startsWith('top-'))).toBe(true)
    // Nothing anchors it to the bottom below lg.
    expect(cls.filter((c) => c.startsWith('bottom-'))).toEqual([])
    expect(cls).toContain('lg:bottom-24')
    expect(cls).toContain('lg:top-auto')
    // The full-width (empty) list must not swallow taps meant for the scene.
    expect(cls).toContain('pointer-events-none')
  })
})
