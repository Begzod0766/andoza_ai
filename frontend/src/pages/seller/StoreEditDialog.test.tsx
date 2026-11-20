import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StoreEditDialog } from './StoreEditDialog'

const api = vi.hoisted(() => ({ updateMyStore: vi.fn() }))
vi.mock('@/lib/api', () => ({ updateMyStore: (...a: unknown[]) => api.updateMyStore(...a) }))
vi.mock('@/components/maps/lazyMaps', () => ({
  LazyPointPicker: ({ onChange }: { onChange: (p: { lat: number; lng: number }) => void }) => (
    <button type="button" onClick={() => onChange({ lat: 41.3111234567, lng: 69.2797654321 })}>tap map</button>
  ),
  LazyShopsMap: () => null,
}))

const store = {
  id: 's1', name: 'Mebel Plus', district: 'Chilonzor', phone: null, telegram: null, logo_color: null,
  partner_tier: 'standard', status: 'approved' as const, moderation_note: null, is_active: true, created_at: '',
  address: null, lat: null, lng: null,
}

function renderDialog() {
  const onSaved = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <StoreEditDialog store={store} open onOpenChange={() => {}} onSaved={onSaved} />
    </QueryClientProvider>,
  )
  return onSaved
}

beforeEach(() => api.updateMyStore.mockReset().mockResolvedValue(store))

describe('StoreEditDialog: address and map point', () => {
  it('sends the address and a point picked on the map', async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Manzil'), { target: { value: ' Chilonzor 9-kv ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xaritadan tanlash' }))
    fireEvent.click(await screen.findByRole('button', { name: 'tap map' }))
    expect(screen.getByLabelText('Kenglik (lat)')).toHaveValue('41.311123')
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }))
    await waitFor(() => expect(api.updateMyStore).toHaveBeenCalled())
    expect(api.updateMyStore.mock.calls[0][0]).toMatchObject({ address: 'Chilonzor 9-kv', lat: 41.311123, lng: 69.279765 })
  })

  it('refuses a point outside Uzbekistan without calling the server', async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText('Kenglik (lat)'), { target: { value: '55.75' } })
    fireEvent.change(screen.getByLabelText('Uzunlik (lng)'), { target: { value: '37.62' } })
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }))
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent("O'zbekiston hududida")
    expect(api.updateMyStore).not.toHaveBeenCalled()
  })

  it('a shop with no point saves nulls', async () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Saqlash' }))
    await waitFor(() => expect(api.updateMyStore).toHaveBeenCalled())
    expect(api.updateMyStore.mock.calls[0][0]).toMatchObject({ address: null, lat: null, lng: null })
  })
})
