import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomSheet } from './BottomSheet'

/** Every element from `el` up to (not past) the sheet's portal root, `el` included. */
function chain(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) out.push(n)
  return out
}

function renderSheet() {
  render(
    <BottomSheet open onOpenChange={() => {}} title="Sheet">
      <label htmlFor="kind">Kind</label>
      <select id="kind" defaultValue="">
        <option value="">Not set</option>
        <option value="a">A</option>
      </select>
      <input aria-label="Name" />
      <textarea aria-label="Notes" />
    </BottomSheet>,
  )
}

// #184: the AI designer's "Room type" <select> never opened its iOS picker. The sheet had
// `touch-action: none` on its whole body, so every native control inside it sat under a
// no-touch-behaviour ancestor; WebKit then does not hand the tap to the control. Drag-to-dismiss
// only ever starts from the grab handle (dragListener={false}), so only the handle needs it.
describe('BottomSheet: native form controls keep their touch behaviour (#184)', () => {
  it('no ancestor of a select/input/textarea in the sheet has touch-action: none', () => {
    renderSheet()
    for (const el of [screen.getByRole('combobox'), screen.getByLabelText('Name'), screen.getByLabelText('Notes')]) {
      for (const n of chain(el)) expect(n.style.touchAction, n.outerHTML.slice(0, 80)).not.toBe('none')
    }
  })

  it('a pointerdown / touchstart on the select is not defaultPrevented and not captured', () => {
    const capture = vi.fn()
    const original = HTMLElement.prototype.setPointerCapture
    HTMLElement.prototype.setPointerCapture = capture
    try {
      renderSheet()
      const select = screen.getByRole('combobox')
      expect(fireEvent.pointerDown(select, { pointerId: 1, pointerType: 'touch', isPrimary: true })).toBe(true)
      expect(fireEvent.touchStart(select, { touches: [{ clientX: 10, clientY: 10 }], changedTouches: [{ clientX: 10, clientY: 10 }] })).toBe(true)
      expect(fireEvent.pointerUp(select, { pointerId: 1, pointerType: 'touch', isPrimary: true })).toBe(true)
      expect(fireEvent.touchEnd(select, { changedTouches: [{ clientX: 10, clientY: 10 }] })).toBe(true)
      expect(fireEvent.click(select)).toBe(true)
      expect(capture).not.toHaveBeenCalled()
    } finally {
      HTMLElement.prototype.setPointerCapture = original
    }
  })

  it('the grab handle alone keeps touch-action: none for the drag', () => {
    renderSheet()
    const dialog = screen.getByRole('dialog')
    const handle = dialog.querySelector<HTMLElement>('[data-sheet-handle]')
    expect(handle).not.toBeNull()
    expect(handle!.style.touchAction).toBe('none')
  })
})

// #184, second round: the tap still did nothing on iOS, yet moving focus onto the select with the
// keyboard's "previous field" arrow opened its picker. Radix Dialog moves focus to the first
// tabbable element on open, which in the AI designer is the "Room type" <select>. WKWebView only
// opens a picker (or keyboard) when focus ARRIVES by a user gesture; a tap on a control that already
// holds programmatic focus is no new focus, so nothing opens. The sheet must not hand its first field
// focus on open.
describe('BottomSheet: opening does not focus a form control (#184)', () => {
  it('focus lands on the sheet itself, not on the first select/input', () => {
    renderSheet()
    const dialog = screen.getByRole('dialog')
    const active = document.activeElement as HTMLElement | null
    expect(active?.tagName).not.toBe('SELECT')
    expect(active?.tagName).not.toBe('INPUT')
    expect(active?.tagName).not.toBe('TEXTAREA')
    // Still inside the dialog, so the focus trap and Escape keep working.
    expect(dialog.contains(active)).toBe(true)
  })

  it('a tap on the select keeps the same node from pointerdown to click (no re-mount)', () => {
    renderSheet()
    const before = screen.getByRole('combobox')
    expect(fireEvent.pointerDown(before, { pointerId: 1, pointerType: 'touch', isPrimary: true })).toBe(true)
    expect(fireEvent.mouseDown(before)).toBe(true)
    expect(screen.getByRole('combobox')).toBe(before)
    fireEvent.pointerUp(before, { pointerId: 1, pointerType: 'touch', isPrimary: true })
    fireEvent.mouseUp(before)
    expect(fireEvent.click(before)).toBe(true)
    expect(screen.getByRole('combobox')).toBe(before)
    expect(before.isConnected).toBe(true)
  })
})
