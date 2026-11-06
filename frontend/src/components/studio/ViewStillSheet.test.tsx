/**
 * QA 2026-11-05 re-check R2: with Camera 1–4 chosen, "Render" did nothing on
 * the phone. The still WAS taken; it was then handed over as a blob link with
 * `download` set and clicked — which a desktop browser saves and the iOS app's
 * WebView silently ignores. The still is now shown, and saved from there by the
 * share sheet where the device has one.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ViewStillSheet, saveStill, viewStillFilename } from './ViewStillSheet'

const blob = new Blob(['png'], { type: 'image/png' })

afterEach(() => {
  vi.restoreAllMocks()
  // jsdom has no share sheet; the tests that give it one take it away again.
  delete (navigator as { share?: unknown }).share
  delete (navigator as { canShare?: unknown }).canShare
})

describe('ViewStillSheet', () => {
  it('shows the picture the camera just took', () => {
    render(<ViewStillSheet still={{ blob, url: 'blob:still', filename: 'xona-cam3-9x16.png', station: 3 }} onClose={() => {}} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:still')
    expect(screen.getByRole('button', { name: 'Saqlash' })).toBeInTheDocument()
  })

  it('shows nothing without a picture', () => {
    render(<ViewStillSheet still={null} onClose={() => {}} />)
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('saves through the share sheet where there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { share, canShare: () => true })
    render(<ViewStillSheet still={{ blob, url: 'blob:still', filename: 'a.png', station: 1 }} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    const files = share.mock.calls[0][0].files as File[]
    expect(files[0].name).toBe('a.png')
  })
})

describe('saveStill', () => {
  it('falls back to a download link, kept alive long enough to be followed', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: revoke })
    vi.useFakeTimers()
    try {
      await expect(saveStill(blob, 'a.png')).resolves.toBe('downloaded')
      expect(click).toHaveBeenCalledTimes(1)
      // Revoking in the same tick as the click cancels the download in Safari.
      expect(revoke).not.toHaveBeenCalled()
      vi.runAllTimers()
      expect(revoke).toHaveBeenCalledWith('blob:x')
    } finally {
      vi.useRealTimers()
    }
  })

  it('counts a dismissed share sheet as cancelled, not as a reason to download', async () => {
    const err = Object.assign(new Error('cancel'), { name: 'AbortError' })
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(err), canShare: () => true })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await expect(saveStill(blob, 'a.png')).resolves.toBe('cancelled')
    expect(click).not.toHaveBeenCalled()
  })
})

// Begzod0766/andoza_ai#180: with the app in English the saved still was
// "Mening xonam-kamera3-9x16.png" — "kamera" was hard-coded Uzbek. The name now
// says "cam", the same in every language, and the room's own name is made safe
// to be a file name.
describe('viewStillFilename (#180)', () => {
  it('names the camera the same way in every language', () => {
    expect(viewStillFilename('Mening xonam', 3, '9:16')).toBe('Mening xonam-cam3-9x16.png')
  })

  it('keeps no character a file name cannot hold', () => {
    expect(viewStillFilename('Zal/Oshxona', 1, '16:9')).toBe('Zal-Oshxona-cam1-16x9.png')
    expect(viewStillFilename('A:B*?"<>|\\C', 1, '16:9')).toBe('A-B-C-cam1-16x9.png')
    expect(viewStillFilename('Мой зал?', 4, '4:3')).toBe('Мой зал-cam4-4x3.png')
  })

  it('a room with no usable name is still a room', () => {
    expect(viewStillFilename('', 2, '1:1')).toBe('xona-cam2-1x1.png')
    expect(viewStillFilename('  /:*  ', 2, '1:1')).toBe('xona-cam2-1x1.png')
  })
})
