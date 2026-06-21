import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cleanImagesForSave,
  fetchDeadRecordIds,
  filterLoadedImages,
  setOnCanvas,
} from './persistence'
import type { CanvasImage } from '../types'
import { supabase } from '@/lib/supabase'

const completed: CanvasImage = {
  id: 'c1',
  recordId: 'rec-c1',
  storagePath: 'path/c1.png',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  signedUrl: 'https://example.com/c1.png',
  model: 'fal-ai/flux-2-pro/edit',
}

const pending: CanvasImage = {
  id: 'p1',
  recordId: 'rec-p1',
  storagePath: '',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  pending: true,
}

const failed: CanvasImage = {
  id: 'f1',
  recordId: 'rec-f1',
  storagePath: '',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  failed: true,
  errorMessage: 'NSFW content blocked',
  model: 'fal-ai/nano-banana-2',
  signedUrl: 'https://example.com/stale.png',
}

// Legacy / not-yet-submitted: no recordId -> not durable, must be dropped.
const noRecord: CanvasImage = {
  id: 'n1',
  recordId: '',
  storagePath: '',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
}

describe('persistence durability contract', () => {
  it('filterLoadedImages keeps anything with a recordId, drops the rest', () => {
    const kept = filterLoadedImages([completed, pending, failed, noRecord])
    expect(kept.map((i) => i.id)).toEqual(['c1', 'p1', 'f1'])
  })

  it('cleanImagesForSave drops no-recordId images and strips signedUrl', () => {
    const saved = cleanImagesForSave([completed, pending, failed, noRecord])
    expect(saved.map((i) => i.id)).toEqual(['c1', 'p1', 'f1'])
    for (const img of saved) {
      expect('signedUrl' in img).toBe(false)
    }
  })

  it('cleanImagesForSave preserves pending placeholders so in-flight work resumes', () => {
    const saved = cleanImagesForSave([pending])
    expect(saved[0]).toMatchObject({ recordId: 'rec-p1', pending: true })
  })

  it('cleanImagesForSave preserves failed tiles with model + error (no silent loss on reload)', () => {
    const saved = cleanImagesForSave([failed])
    expect(saved[0]).toMatchObject({
      recordId: 'rec-f1',
      failed: true,
      errorMessage: 'NSFW content blocked',
      model: 'fal-ai/nano-banana-2',
    })
    expect('signedUrl' in saved[0]).toBe(false)
  })
})

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
