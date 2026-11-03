import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import { CameraButton, LockButton } from '../CanvasButtons'

describe('canvas buttons', () => {
  it('the camera button says Kameralar from md up and keeps its accessible name', () => {
    const onClick = vi.fn()
    render(<CameraButton active={false} expanded={false} onClick={onClick} />)
    const b = screen.getByRole('button', { name: i18n.t('studio.three_d.kameralar') })
    expect(screen.getByText(i18n.t('studio.three_d.kameralar'))).toHaveClass('hidden', 'md:inline')
    fireEvent.click(b)
    expect(onClick).toHaveBeenCalled()
  })

  it('the lock says whether editing is closed or open, and reports aria-pressed', () => {
    const { rerender } = render(<LockButton locked onClick={() => {}} />)
    expect(screen.getByText(i18n.t('studio.three_d.tahrir_yopiq'))).toHaveClass('hidden', 'md:inline')
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button')).toHaveAccessibleName(i18n.t('studio.three_d.tahrirlashni_yoqish'))
    rerender(<LockButton locked={false} onClick={() => {}} />)
    expect(screen.getByText(i18n.t('studio.three_d.tahrir_ochiq'))).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAccessibleName(i18n.t('studio.three_d.tahrirlashni_qulflash'))
  })
})
