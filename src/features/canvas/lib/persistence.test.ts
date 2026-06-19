import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchDeadRecordIds, setOnCanvas } from './persistence'
import { supabase } from '@/lib/supabase'

// vi.mock is hoisted — keep factories self-contained
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))
vi.mock('@/lib/image-storage', () => ({
  createImageStorage: vi.fn(),
}))

/** Chainable Supabase query stub that is awaitable and resolves to `result`. */
function mockChain(result: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    then: (resolve: (v: unknown) => void) => resolve(result),
  }
  return chain
}

describe('fetchDeadRecordIds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports soft-deleted and missing rows as dead, never live ones', async () => {
    // a1 alive, a2 soft-deleted, a3 absent from the result entirely
    vi.mocked(supabase.from).mockReturnValue(
      mockChain({
        data: [
          { id: 'a1', deleted_at: null },
          { id: 'a2', deleted_at: '2026-01-01T00:00:00Z' },
        ],
      }) as unknown as ReturnType<typeof supabase.from>,
    )

    const dead = await fetchDeadRecordIds(['a1', 'a2', 'a3'])

    // The invariant that protects user arrangements: a live row is NEVER pruned.
    expect(dead.has('a1')).toBe(false)
    expect(dead.has('a2')).toBe(true)
    expect(dead.has('a3')).toBe(true)
  })

  it('returns an empty set for empty input without querying', async () => {
    const dead = await fetchDeadRecordIds([])
    expect(dead.size).toBe(0)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('fails safe (empty set) when the query throws', async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error('network')
    })
    const dead = await fetchDeadRecordIds(['a1'])
    expect(dead.size).toBe(0)
  })
})

describe('setOnCanvas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no-ops on empty / falsy ids without touching the DB', async () => {
    await setOnCanvas([], true)
    await setOnCanvas(['', ''], true)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('writes the on_canvas flag for the given ids', async () => {
    const chain = mockChain({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(
      chain as unknown as ReturnType<typeof supabase.from>,
    )

    await setOnCanvas(['x', 'y'], false)

    expect(supabase.from).toHaveBeenCalledWith('user_images')
    expect(chain.update).toHaveBeenCalledWith({ on_canvas: false })
    expect(chain.in).toHaveBeenCalledWith('id', ['x', 'y'])
  })
})
