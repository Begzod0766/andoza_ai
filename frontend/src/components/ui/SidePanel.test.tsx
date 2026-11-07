import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SidePanel } from './SidePanel'

function renderPanel(open = true) {
  const onOpenChange = vi.fn()
  const view = render(
    <div>
      <button type="button">Outside</button>
      <SidePanel open={open} onOpenChange={onOpenChange} title="AI dizayner" closeLabel="Yopish">
        <p>Panel content</p>
      </SidePanel>
    </div>,
  )
  return { onOpenChange, ...view }
}

describe('SidePanel: a panel at the right that leaves the room in view', () => {
  it('shows its title and content as a dialog when open, nothing when closed', () => {
    renderPanel()
    expect(screen.getByRole('dialog', { name: 'AI dizayner' })).toBeInTheDocument()
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    renderPanel(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('lays no dimming overlay over the room', () => {
    renderPanel()
    expect(document.querySelector('[data-side-panel-overlay]')).toBeNull()
    expect(document.querySelector('.bg-black\\/40')).toBeNull()
  })

  it('stays open while the user works the room behind it', () => {
    const { onOpenChange } = renderPanel()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes with its close button and with Escape', () => {
    const { onOpenChange } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Yopish' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    onOpenChange.mockReset()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
