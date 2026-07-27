import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listDeadRecordIds, setImagesOnCanvas } from '../server/canvas.actions'
import {
  cleanImagesForSave,
  fetchDeadRecordIds,
  filterLoadedImages,
  setOnCanvas,
} from './persistence'
import type { CanvasImage } from '../types'

const completed: CanvasImage = {
  id: 'c1',
  recordId: 'rec-c1',
  storagePath: 'path/c1.png',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  signedUrl: 'https://example.com/c1.png',
  model: 'fal-ai/nano-banana-2/edit',
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
vi.mock('../server/canvas.actions', () => ({
  listDeadRecordIds: vi.fn(),
  listOnCanvasRecords: vi.fn(),
  restoreCanvasImages: vi.fn(),
  setImagesOnCanvas: vi.fn(),
  trashCanvasImages: vi.fn(),
}))
vi.mock('#/lib/image-storage', () => ({
  createImageStorage: vi.fn(),
}))

// These two wrap the server actions and are the canvas's fail-safes: a failed
// reconcile must never prune a live image, and a failed membership write must
// never throw into a drag/drop handler.
describe('fetchDeadRecordIds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes through what the server reports as dead', async () => {
    vi.mocked(listDeadRecordIds).mockResolvedValue(['a2', 'a3'])

    const dead = await fetchDeadRecordIds(['a1', 'a2', 'a3'])

    // The invariant that protects user arrangements: a live row is NEVER pruned.
    expect(dead.has('a1')).toBe(false)
    expect(dead.has('a2')).toBe(true)
    expect(dead.has('a3')).toBe(true)
  })

  it('returns an empty set for empty input without querying', async () => {
    const dead = await fetchDeadRecordIds([])
    expect(dead.size).toBe(0)
    expect(listDeadRecordIds).not.toHaveBeenCalled()
  })

  it('fails safe (empty set) when the call throws', async () => {
    vi.mocked(listDeadRecordIds).mockRejectedValue(new Error('network'))
    const dead = await fetchDeadRecordIds(['a1'])
    expect(dead.size).toBe(0)
  })
})

describe('setOnCanvas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no-ops on empty / falsy ids without touching the DB', async () => {
    await setOnCanvas([], true)
    await setOnCanvas(['', ''], true)
    expect(setImagesOnCanvas).not.toHaveBeenCalled()
  })

  it('writes the on_canvas flag for the given ids', async () => {
    vi.mocked(setImagesOnCanvas).mockResolvedValue(undefined)

    await setOnCanvas(['x', 'y'], false)

    expect(setImagesOnCanvas).toHaveBeenCalledWith(['x', 'y'], false)
  })

  it('swallows a failed write -- syncCanvasFlags reconciles on the next save', async () => {
    vi.mocked(setImagesOnCanvas).mockRejectedValue(new Error('network'))
    await expect(setOnCanvas(['x'], true)).resolves.toBeUndefined()
  })
})
