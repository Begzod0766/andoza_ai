import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useWallFocusStore } from '@/store/wallFocusStore'
import { WallTargetChips } from './WallTargetChips'
import { getWallTargets, FLOOR_TARGET } from './shared'

const options = [...getWallTargets({ walls: ['0', '1'].map((id) => ({ id })) as never }), FLOOR_TARGET]

beforeEach(() => useWallFocusStore.setState({ hovered: null, turnTo: null, nonce: 0 }))

describe('WallTargetChips', () => {
  it('pointing at a wall chip, or focusing it, lights that wall; leaving clears it', () => {
    render(<WallTargetChips options={options} value="ALL" onSelect={() => {}} />)
    const wall2 = screen.getByRole('button', { name: 'Devor 2' })
    fireEvent.pointerEnter(wall2)
    expect(useWallFocusStore.getState().hovered).toBe('1')
    fireEvent.pointerLeave(wall2)
    expect(useWallFocusStore.getState().hovered).toBeNull()
    fireEvent.focus(wall2)
    expect(useWallFocusStore.getState().hovered).toBe('1')
    fireEvent.blur(wall2)
    expect(useWallFocusStore.getState().hovered).toBeNull()
  })

  it('pressing a wall chip selects it and turns the camera to it — again after a repeat press', () => {
    const onSelect = vi.fn()
    render(<WallTargetChips options={options} value="ALL" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Devor 1' }))
    expect(onSelect).toHaveBeenCalledWith('0')
    expect(useWallFocusStore.getState()).toMatchObject({ turnTo: '0', nonce: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Devor 1' }))
    expect(useWallFocusStore.getState().nonce).toBe(2)
  })

  it('"Hamma devorlar" frames the room again; the floor chip does not move the camera to a wall', () => {
    render(<WallTargetChips options={options} value="0" onSelect={() => {}} />)
    useWallFocusStore.setState({ turnTo: '0' })
    fireEvent.click(screen.getByRole('button', { name: /Hamma devorlar|Barcha devorlar/ }))
    expect(useWallFocusStore.getState().turnTo).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Pol' }))
    expect(useWallFocusStore.getState().turnTo).toBeNull()
  })

  it('the chosen chip reports aria-pressed', () => {
    render(<WallTargetChips options={options} value="1" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Devor 2' })).toHaveAttribute('aria-pressed', 'true')
  })
})
