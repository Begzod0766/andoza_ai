import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MebelListPage from './MebelListPage'
import * as api from '@/lib/api'
import i18n from '@/i18n'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof api>('@/lib/api')
  return { ...actual, listMebelProjects: vi.fn(), createMebelProject: vi.fn(), getMebelProject: vi.fn(), deleteMebelProject: vi.fn() }
})

function Opened() {
  return <p>opened {useParams().id}</p>
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ConfirmProvider>
      <MemoryRouter initialEntries={['/mebel']}>
        <Routes>
          <Route path="/mebel" element={<MebelListPage />} />
          <Route path="/mebel/:id" element={<Opened />} />
        </Routes>
      </MemoryRouter>
      </ConfirmProvider>
    </QueryClientProvider>,
  )
}

describe('MebelListPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists the projects', async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([
      { id: 'p1', name: 'Oshxona Chilonzor', updated_at: '2026-10-29T10:00:00Z' },
      { id: 'p2', name: 'Oshxona Yunusobod', updated_at: '2026-10-28T10:00:00Z' },
    ])
    mount()
    expect(await screen.findByText('Oshxona Chilonzor')).toBeInTheDocument()
    expect(screen.getByText('Oshxona Yunusobod')).toBeInTheDocument()
  })

  it('draws in the app theme tokens, so the text stays readable at night', async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([{ id: 'p1', name: 'Oshxona', updated_at: '2026-10-29T10:00:00Z' }])
    const { container } = mount()
    await screen.findByText('Oshxona')
    expect(screen.getByRole('heading', { name: i18n.t('mebel.title') }).className).toContain('text-ink')
    expect(screen.getByText('Oshxona').closest('li')!.className).toContain('bg-card')
    expect(container.innerHTML).not.toMatch(/text-neutral-|bg-white|bg-neutral-/)
  })

  it('says when there are no projects yet', async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([])
    mount()
    expect(await screen.findByText(i18n.t('mebel.empty'))).toBeInTheDocument()
  })

  it('says the list failed to load, not that there are none', async () => {
    vi.mocked(api.listMebelProjects).mockRejectedValue(new Error('Failed to fetch'))
    mount()
    expect(await screen.findByText(i18n.t('mebel.load_failed'))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t('mebel.empty'))).not.toBeInTheDocument()
  })

  it('creates a project with one default cabinet and opens it', async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([])
    vi.mocked(api.createMebelProject).mockResolvedValue({ id: 'new1', name: 'x', data: {} as never })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('mebel.new_project') }))
    await waitFor(() => expect(screen.getByText('opened new1')).toBeInTheDocument())
    const [name, data] = vi.mocked(api.createMebelProject).mock.calls[0]
    expect(name).toBe(i18n.t('mebel.default_name'))
    expect(data.cabinets).toHaveLength(1)
    expect(data.cabinets[0]).toMatchObject({ width: 600, height: 720, depth: 560 })
  })

  it('a new project takes a name not already in the list', async () => {
    const base = i18n.t('mebel.default_name')
    vi.mocked(api.listMebelProjects).mockResolvedValue([
      { id: 'a', name: base, updated_at: '2026-10-29T10:00:00Z' },
      { id: 'b', name: `${base} 2`, updated_at: '2026-10-29T10:00:00Z' },
    ])
    vi.mocked(api.createMebelProject).mockResolvedValue({ id: 'new1', name: 'x', data: {} as never })
    mount()
    await screen.findByText(`${base} 2`)
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mebel.new_project') }))
    await waitFor(() => expect(vi.mocked(api.createMebelProject)).toHaveBeenCalled())
    expect(vi.mocked(api.createMebelProject).mock.calls[0][0]).toBe(`${base} 3`)
  })

  it('links to the offcut store', async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([])
    mount()
    expect(await screen.findByRole('link', { name: i18n.t('mebel.offcuts.title') })).toHaveAttribute('href', '/mebel/qoldiqlar')
  })

  const summary = (over: Record<string, unknown> = {}) => ({
    id: 'p1', name: 'Oshxona', updated_at: '2026-11-02T17:51:41Z', cabinets: 6, free_parts: 2, cut_at: null, ...over,
  })
  const card = () => screen.getByText('Oshxona').closest('li') as HTMLElement

  it('a card counts cabinets and free parts, leaves out zeros, and says Bo\'sh when both are 0', async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([
      summary(), summary({ id: 'p2', name: 'Shkaf', free_parts: 0 }), summary({ id: 'p3', name: 'Yangi', cabinets: 0, free_parts: 0 }),
    ] as never)
    mount()
    expect(await screen.findByText('6 shkaf · 2 erkin detal')).toBeInTheDocument()
    expect(screen.getByText('6 shkaf')).toBeInTheDocument()
    expect(screen.getByText("Bo'sh")).toBeInTheDocument()
  })

  it('a cut project carries Kesildi with its date; the updated date has no seconds', async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([summary({ cut_at: '2026-11-02T18:00:00Z' })] as never)
    mount()
    await screen.findByText('Oshxona')
    expect(card().textContent).toMatch(/Kesildi \S+/)
    expect(card().textContent).not.toMatch(/\d{1,2}:\d{2}:\d{2}/)
  })

  it('the whole card opens the project; the ⋯ menu does not', async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([summary()] as never)
    mount()
    await screen.findByText('Oshxona')
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mebel.list.actions') }))
    expect(screen.queryByText('opened p1')).toBeNull()
    expect(screen.getByRole('link', { name: /Oshxona/ })).toHaveAttribute('href', '/mebel/p1')
  })

  it('Nusxa olish copies the project under "(nusxa)" and opens the copy', async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([summary()] as never)
    vi.mocked(api.getMebelProject).mockResolvedValue({ id: 'p1', name: 'Oshxona', data: { cabinets: [1, 2] } } as never)
    vi.mocked(api.createMebelProject).mockResolvedValue({ id: 'copy1', name: 'x', data: {} } as never)
    mount()
    await screen.findByText('Oshxona')
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mebel.list.actions') }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Nusxa olish' }))
    await waitFor(() => expect(screen.getByText('opened copy1')).toBeInTheDocument())
    expect(vi.mocked(api.createMebelProject)).toHaveBeenCalledWith('Oshxona (nusxa)', expect.objectContaining({ cabinets: [1, 2], name: 'Oshxona (nusxa)' }))
  })

  it('a copy that cannot load the source says so and creates nothing', async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([summary()] as never)
    vi.mocked(api.getMebelProject).mockRejectedValue(new Error('Failed to fetch'))
    mount()
    await screen.findByText('Oshxona')
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mebel.list.actions') }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Nusxa olish' }))
    expect(await screen.findByText("Nusxa olib bo'lmadi")).toBeInTheDocument()
    expect(vi.mocked(api.createMebelProject)).not.toHaveBeenCalled()
  })

  it("O'chirish asks first and deletes only on yes", async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([summary()] as never)
    vi.mocked(api.deleteMebelProject).mockResolvedValue(undefined)
    mount()
    await screen.findByText('Oshxona')
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mebel.list.actions') }))
    fireEvent.click(screen.getByRole('menuitem', { name: "O'chirish" }))
    expect(vi.mocked(api.deleteMebelProject)).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('mebel.delete') }))
    await waitFor(() => expect(vi.mocked(api.deleteMebelProject)).toHaveBeenCalledWith('p1'))
  })

  it('the header buttons wrap on a phone instead of widening the page', async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([])
    mount()
    const offcuts = await screen.findByRole('link', { name: i18n.t('mebel.offcuts.title') })
    const header = offcuts.parentElement!.parentElement!
    expect(header).toHaveClass('flex-wrap')
    expect(offcuts.parentElement).not.toHaveClass('shrink-0')
  })

  it('copying a copy does not stack the suffix, numbers a taken name, and fits 120 characters', async () => {
    const long = 'L'.repeat(118)
    vi.mocked(api.listMebelProjects).mockResolvedValue([
      summary({ id: 'p1', name: 'Oshxona (nusxa)' }), summary({ id: 'p2', name: 'Oshxona (nusxa) 2' }), summary({ id: 'p3', name: long }),
    ] as never)
    vi.mocked(api.getMebelProject).mockImplementation(async (id: string) => ({ id, name: 'x', data: {} }) as never)
    vi.mocked(api.createMebelProject).mockResolvedValue({ id: 'c', name: 'x', data: {} } as never)
    mount()
    await screen.findByText('Oshxona (nusxa)')
    const copyOf = async (name: string) => {
      fireEvent.click(within(screen.getByText(name).closest('li') as HTMLElement).getByRole('button', { name: i18n.t('mebel.list.actions') }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Nusxa olish' }))
      await waitFor(() => expect(vi.mocked(api.createMebelProject)).toHaveBeenCalled())
      const made = vi.mocked(api.createMebelProject).mock.calls.at(-1)![0]
      vi.mocked(api.createMebelProject).mockClear()
      return made
    }
    expect(await copyOf('Oshxona (nusxa)')).toBe('Oshxona (nusxa) 3')
  })

  it('a long name still makes a copy within 120 characters', async () => {
    const long = 'L'.repeat(118)
    vi.mocked(api.listMebelProjects).mockResolvedValue([summary({ id: 'p3', name: long })] as never)
    vi.mocked(api.getMebelProject).mockResolvedValue({ id: 'p3', name: long, data: {} } as never)
    vi.mocked(api.createMebelProject).mockResolvedValue({ id: 'c', name: 'x', data: {} } as never)
    mount()
    await screen.findByText(long)
    fireEvent.click(screen.getByRole('button', { name: i18n.t('mebel.list.actions') }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Nusxa olish' }))
    await waitFor(() => expect(vi.mocked(api.createMebelProject)).toHaveBeenCalled())
    const made = vi.mocked(api.createMebelProject).mock.calls[0][0]
    expect(made.length).toBeLessThanOrEqual(120)
    expect(made.endsWith(' (nusxa)')).toBe(true)
  })

  it('a second copy while one is under way is ignored', async () => {
    vi.mocked(api.listMebelProjects).mockResolvedValue([summary()] as never)
    vi.mocked(api.getMebelProject).mockReturnValue(new Promise(() => {}))
    mount()
    await screen.findByText('Oshxona')
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByRole('button', { name: i18n.t('mebel.list.actions') }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Nusxa olish' }))
    }
    await waitFor(() => expect(vi.mocked(api.getMebelProject)).toHaveBeenCalledTimes(1))
  })
})
