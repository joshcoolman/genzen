import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addImagesToCanvas, saveCanvasState } from '../_actions/canvas'
import {
  addToCanvas,
  filterLoadedImages,
  groupsForSave,
  memberToImage,
  positionsForSave,
  saveCanvas,
  stateToImages,
} from './persistence'
import type { CanvasMemberRecord } from '../_actions/canvas'
import type { CanvasImage } from './types'

// vi.mock is hoisted -- keep factories self-contained
vi.mock('../_actions/canvas', () => ({
  addImagesToCanvas: vi.fn(),
  removeImagesFromCanvas: vi.fn(),
  saveCanvasState: vi.fn(),
  trashCanvasImages: vi.fn(),
}))
vi.mock('#/lib/image-storage', () => ({
  createImageStorage: vi.fn(),
}))

function member(over: Partial<CanvasMemberRecord> = {}): CanvasMemberRecord {
  return {
    image_id: 'img-1',
    storage_path: 'path/1.png',
    status: 'completed',
    generation_error: null,
    generation_metadata: null,
    url: 'https://example.com/1.png',
    x: 10,
    y: 20,
    width: 300,
    height: 400,
    ...over,
  }
}

describe('memberToImage', () => {
  it('uses the image id as the card id, so groups survive a reload', () => {
    const img = memberToImage(member({ image_id: 'abc' }))
    expect(img.id).toBe('abc')
    expect(img.recordId).toBe('abc')
  })

  it('carries a pending generation through as a placeholder', () => {
    const img = memberToImage(
      member({ status: 'pending', storage_path: null, url: null }),
    )
    expect(img).toMatchObject({ pending: true, storagePath: '' })
    expect(img.failed).toBeUndefined()
  })

  it('carries a failure through with its reason and model', () => {
    const img = memberToImage(
      member({
        status: 'failed',
        storage_path: null,
        url: null,
        generation_error: 'NSFW content blocked',
        generation_metadata: { model: 'fal-ai/nano-banana-2' },
      }),
    )
    expect(img).toMatchObject({
      failed: true,
      errorMessage: 'NSFW content blocked',
      model: 'fal-ai/nano-banana-2',
    })
  })

  it('leaves an unplaced row sized zero for the placement pass to fill', () => {
    const img = memberToImage(
      member({ x: null, y: null, width: null, height: null }),
    )
    expect(img).toMatchObject({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('stateToImages', () => {
  it('reports which members still need a position', () => {
    const { images, unplacedIds } = stateToImages({
      canvasId: 'c',
      transform: null,
      groups: [],
      images: [
        member({ image_id: 'placed' }),
        member({
          image_id: 'fresh',
          x: null,
          y: null,
          width: null,
          height: null,
        }),
      ],
    })

    expect(images.map((i) => i.id)).toEqual(['placed', 'fresh'])
    expect([...unplacedIds]).toEqual(['fresh'])
  })
})

const card = (over: Partial<CanvasImage> = {}): CanvasImage => ({
  id: 'a',
  recordId: 'rec-a',
  storagePath: 'path/a.png',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...over,
})

describe('filterLoadedImages', () => {
  it('drops a card whose user_images row has not returned yet', () => {
    const kept = filterLoadedImages([
      card({ id: 'a' }),
      card({ id: 'b', recordId: '' }),
    ])
    expect(kept.map((i) => i.id)).toEqual(['a'])
  })
})

describe('positionsForSave', () => {
  it('skips cards with no row and cards with no size', () => {
    const positions = positionsForSave([
      card({ id: 'a', recordId: 'rec-a', x: 5, y: 6 }),
      card({ id: 'b', recordId: '' }),
      card({ id: 'c', recordId: 'rec-c', width: 0, height: 0 }),
    ])

    expect(positions).toEqual([
      { imageId: 'rec-a', x: 5, y: 6, width: 100, height: 100 },
    ])
  })
})

describe('groupsForSave', () => {
  // The failure this prevents: a group formed over freshly-uploaded cards holds
  // local placeholder ids, and saving those would name images that do not exist
  // on the next load -- a group that quietly loses its members.
  it('translates local placeholder ids to record ids', () => {
    const images = [
      card({ id: 'local-1', recordId: 'rec-1' }),
      card({ id: 'local-2', recordId: 'rec-2' }),
    ]
    const saved = groupsForSave(images, [
      { id: 'g1', imageIds: ['local-1', 'local-2'], columns: 2, padding: 24 },
    ])

    expect(saved[0].imageIds).toEqual(['rec-1', 'rec-2'])
  })

  it('drops members with no row, and a group left under two', () => {
    const images = [
      card({ id: 'local-1', recordId: 'rec-1' }),
      card({ id: 'local-2', recordId: '' }),
    ]
    const saved = groupsForSave(images, [
      { id: 'g1', imageIds: ['local-1', 'local-2'], columns: 2, padding: 24 },
    ])

    expect(saved).toEqual([])
  })

  it('is the identity mapping for loaded cards', () => {
    const images = [
      card({ id: 'rec-1', recordId: 'rec-1' }),
      card({ id: 'rec-2', recordId: 'rec-2' }),
    ]
    const groups = [
      { id: 'g1', imageIds: ['rec-1', 'rec-2'], columns: 2, padding: 24 },
    ]
    expect(groupsForSave(images, groups)).toEqual(groups)
  })
})

// The wrappers swallow failures so a write that cannot reach the server never
// takes a card off the screen or throws into a drag handler.
describe('fail-safe wrappers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saveCanvas swallows a failed write', async () => {
    vi.mocked(saveCanvasState).mockRejectedValue(new Error('network'))
    await expect(
      saveCanvas('c1', {
        images: [card()],
        transform: { x: 0, y: 0, scale: 0.5 },
        groups: [],
      }),
    ).resolves.toBeUndefined()
  })

  it('addToCanvas no-ops on empty / falsy ids without touching the DB', async () => {
    await addToCanvas('c1', [])
    await addToCanvas('c1', [{ imageId: '' }])
    expect(addImagesToCanvas).not.toHaveBeenCalled()
  })

  it('addToCanvas passes members through, and swallows a failure', async () => {
    vi.mocked(addImagesToCanvas).mockResolvedValue(undefined)
    await addToCanvas('c1', [{ imageId: 'x', x: 1, y: 2 }])
    expect(addImagesToCanvas).toHaveBeenCalledWith('c1', [
      { imageId: 'x', x: 1, y: 2 },
    ])

    vi.mocked(addImagesToCanvas).mockRejectedValue(new Error('network'))
    await expect(addToCanvas('c1', [{ imageId: 'y' }])).resolves.toBeUndefined()
  })
})
