/** The switch for a bathroom's extractor fan (spec 2026-11-10): on unless the user turns it off. */
import { describe, it, expect, beforeEach , vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRoomStore } from '@/store/roomStore'
import { SantexnikaSection } from './SantexnikaSection'

// The shop lists ask the server (react-query); here they are stand-ins that say which line they pick for.
vi.mock('./ShopPickList', () => ({
  ShopPickList: ({ smetaKey, title }: { smetaKey: string; title: string }) => <div data-testid={`pick-${smetaKey}`}>{title}</div>,
}))


const box = () => screen.queryByRole('checkbox', { name: 'Tortuvchi ventilyator' }) as HTMLInputElement | null

describe('SantexnikaSection: extractor fan', () => {
  beforeEach(() => {
    useRoomStore.getState().resetDesignState()
    useRoomStore.setState({ isDirty: false })
  })

  it('is on in a bathroom that never set it', () => {
    render(<SantexnikaSection bathroom />)
    expect(box()!.checked).toBe(true)
    expect('ventFan' in useRoomStore.getState().designState).toBe(false)
  })

  it('unticking saves ventFan false, ticking again saves true', () => {
    render(<SantexnikaSection bathroom />)
    fireEvent.click(box()!)
    expect(useRoomStore.getState().designState.ventFan).toBe(false)
    expect(useRoomStore.getState().isDirty).toBe(true)
    expect(box()!.checked).toBe(false)
    fireEvent.click(box()!)
    expect(useRoomStore.getState().designState.ventFan).toBe(true)
  })

  it('is not offered outside a bathroom', () => {
    render(<SantexnikaSection />)
    expect(box()).toBeNull()
  })
})
