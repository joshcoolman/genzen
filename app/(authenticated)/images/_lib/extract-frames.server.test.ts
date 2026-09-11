import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectImageFrames } from '../_actions/extract-frames.action'
import {
  detectFramesInternal,
  extractFramesInternal,
  loadFrameSource,
} from './extract-frames.server'

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  download: vi.fn(),
  generate: vi.fn(),
  save: vi.fn(),
  require: vi.fn(),
  vision: vi.fn(),
}))
vi.mock('#/lib/server/auth.server', () => ({
  resolveAuth: () => Promise.resolve({ userId: 'owner' }),
}))
vi.mock('#/lib/server/db.server', () => ({
  sql: mocks.sql,
  first: (rows: Array<unknown>) => rows[0],
}))
vi.mock('#/lib/image-storage', () => ({
  createImageStorage: () => ({ download: mocks.download }),
}))
vi.mock('#/lib/server/ai.server', () => ({
  ai: { reasoning: { modelId: 'claude' } },
  requireAiRole: mocks.require,
}))
vi.mock('#/lib/server/vision-image.server', () => ({
  loadVisionImage: mocks.vision,
}))
vi.mock('#/features/user-images/server/save-derived-image.server', () => ({
  saveDerivedImage: mocks.save,
}))
vi.mock('ai', () => ({
  generateText: mocks.generate,
  Output: { object: vi.fn() },
}))
const sourceId = '11111111-1111-4111-8111-111111111111'
const frame = {
  id: '22222222-2222-4222-8222-222222222222',
  label: 'Red',
  left: 0,
  top: 0,
  width: 20,
  height: 10,
}
let buffer: Buffer
beforeEach(async () => {
  vi.resetAllMocks()
  buffer = await sharp({
    create: { width: 40, height: 10, channels: 3, background: '#ff0000' },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 20, height: 10, channels: 3, background: '#0000ff' },
        })
          .png()
          .toBuffer(),
        left: 20,
        top: 0,
      },
    ])
    .png()
    .toBuffer()
  mocks.sql.mockImplementation((parts: TemplateStringsArray) =>
    Promise.resolve(
      parts.join('').includes('from user_images')
        ? [
            {
              storage_path: 'owner/source.png',
              mime_type: 'image/png',
              title: 'Sheet',
            },
          ]
        : [{ id: 'group' }],
    ),
  )
  mocks.download.mockImplementation(() =>
    Promise.resolve(new Blob([new Uint8Array(buffer)])),
  )
  mocks.vision.mockResolvedValue({ data: 'vision', mediaType: 'image/jpeg' })
  mocks.generate.mockResolvedValue({
    output: {
      frames: [{ label: 'Red', left: 0, top: 0, right: 500, bottom: 1000 }],
    },
  })
  mocks.save.mockResolvedValue('saved')
})
describe('frame extraction server boundaries', () => {
  it('detects from the owned source without writing any crops or requiring storyboard history', async () => {
    const review = await detectFramesInternal(sourceId)
    expect(review).toMatchObject({
      sourceId,
      width: 40,
      height: 10,
      frames: [
        expect.objectContaining({ left: 0, top: 0, width: 20, height: 10 }),
      ],
    })
    expect(mocks.sql.mock.calls[0].slice(1)).toEqual([sourceId, 'owner'])
    expect(mocks.save).not.toHaveBeenCalled()
    expect(
      mocks.generate.mock.calls[0][0].messages[0].content[0],
    ).toMatchObject({ type: 'image', image: 'vision' })
  })
  it('keeps no-panel detection as an empty review', async () => {
    mocks.generate.mockResolvedValueOnce({ output: { frames: [] } })
    expect((await detectFramesInternal(sourceId)).frames).toEqual([])
  })
  it('rejects missing or foreign sources before storage or vision', async () => {
    mocks.sql.mockResolvedValueOnce([])
    await expect(detectFramesInternal(sourceId)).rejects.toThrow('unavailable')
    expect(mocks.download).not.toHaveBeenCalled()
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('normalizes EXIF orientation so detection, preview dimensions and cropping agree', async () => {
    buffer = await sharp({
      create: { width: 30, height: 10, channels: 3, background: '#00ff00' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer()
    const source = await loadFrameSource(sourceId, 'owner')
    expect(source).toMatchObject({ width: 10, height: 30 })
  })
  it('crops the actual pixels and records source, position, bounds and stable retry identity', async () => {
    const review = await detectFramesInternal(sourceId)
    const input = {
      sourceId,
      sourceHash: review.sourceHash,
      batchId: crypto.randomUUID(),
      frames: [frame],
    }
    const result = await extractFramesInternal(input)
    expect(result.outcomes).toEqual([
      { frameId: frame.id, recordId: 'saved', error: null },
    ])
    const saved = mocks.save.mock.calls[0][0]
    const pixels = await sharp(saved.buffer)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect(pixels.info).toMatchObject({ width: 20, height: 10 })
    expect([...pixels.data]).toEqual(
      Array.from({ length: 200 }, () => [255, 0, 0]).flat(),
    )
    expect(saved.metadata.frame_extraction).toMatchObject({
      source_image_id: sourceId,
      source_width: 40,
      source_height: 10,
      position: 1,
      bounds: { left: 0, top: 0, width: 20, height: 10 },
    })
    expect(saved.idempotencyKey).toBe(
      `owner:extract:${input.batchId}:${frame.id}`,
    )
  })
  it('stops changed sources and bad crops before creating a group or output', async () => {
    const source = await loadFrameSource(sourceId, 'owner')
    const input = {
      sourceId,
      sourceHash: '0'.repeat(64),
      batchId: crypto.randomUUID(),
      frames: [frame],
    }
    await expect(extractFramesInternal(input)).rejects.toThrow('changed')
    await expect(
      extractFramesInternal({
        ...input,
        sourceHash: source.sourceHash,
        frames: [{ ...frame, width: 41 }],
      }),
    ).rejects.toThrow('beyond')
    expect(mocks.save).not.toHaveBeenCalled()
    expect(
      mocks.sql.mock.calls.every(([parts]) =>
        parts.join('').includes('from user_images'),
      ),
    ).toBe(true)
  })
  it('keeps partial successes and reports each failed frame', async () => {
    const source = await loadFrameSource(sourceId, 'owner')
    mocks.save.mockImplementation((input) =>
      input.position === 1
        ? Promise.reject(new Error('Storage unavailable'))
        : Promise.resolve('saved'),
    )
    const second = { ...frame, id: crypto.randomUUID(), left: 20 }
    const result = await extractFramesInternal({
      sourceId,
      sourceHash: source.sourceHash,
      batchId: crypto.randomUUID(),
      frames: [frame, second],
    })
    expect(result.outcomes).toEqual([
      { frameId: frame.id, recordId: null, error: 'Storage unavailable' },
      { frameId: second.id, recordId: 'saved', error: null },
    ])
  })
  it('returns actionable action errors explicitly for production', async () => {
    mocks.require.mockImplementationOnce(() => {
      throw new Error('Configure Claude before detection')
    })
    await expect(detectImageFrames(sourceId)).resolves.toEqual({
      data: null,
      error: 'Configure Claude before detection',
    })
  })
})
