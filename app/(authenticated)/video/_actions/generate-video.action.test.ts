import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateVideo } from './generate-video.action'

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  auth: vi.fn(),
  upload: vi.fn(),
  reserve: vi.fn(),
  submit: vi.fn(),
  submitted: vi.fn(),
  failed: vi.fn(),
}))
vi.mock('#/lib/server/db.server', () => ({ sql: mocks.sql }))
vi.mock('#/lib/server/auth.server', () => ({ resolveAuth: mocks.auth }))
vi.mock('#/lib/server/fal-image-inputs.server', () => ({
  uploadLibraryImagesToFal: mocks.upload,
}))
vi.mock('#/lib/server/fal-client.server', () => ({
  fal: { queue: { submit: mocks.submit } },
}))
vi.mock('#/lib/server/fal-retry.server', () => ({
  withNetworkRetry: (_name: string, run: () => unknown) => run(),
}))
vi.mock('#/features/video/server/director-exports.server', () => ({
  publishDirectorExports: vi.fn(),
}))
vi.mock('#/lib/server/create-pending-generation.server', () => ({
  createPendingGeneration: mocks.reserve,
  markGenerationSubmitted: mocks.submitted,
  markGenerationFailed: mocks.failed,
  describeGenerationError: (e: Error) => e.message,
}))
const a = '00000000-0000-4000-8000-000000000001'
const b = '00000000-0000-4000-8000-000000000002'
const base = {
  prompt: 'Image 1 walks across the valley',
  duration: 8,
  aspectRatio: '16:9',
  modelSlug: 'minimax-h3',
  groupId: 'group-1',
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ userId: 'owner-1' })
  mocks.sql.mockImplementation((query: unknown) =>
    Array.isArray(query) && 'raw' in query
      ? Promise.resolve([{ id: a }, { id: b }])
      : query,
  )
  mocks.reserve.mockResolvedValue({ recordId: 'record-1' })
  mocks.upload.mockResolvedValue(['url-a', 'url-b'])
  mocks.submit.mockResolvedValue({ request_id: 'request-1' })
})
describe('Video server action', () => {
  it('records ordered references and uses the authenticated owner for uploads', async () => {
    const images = [
      { id: b, role: 'reference' as const },
      { id: a, role: 'reference' as const },
    ]
    await generateVideo({ ...base, images })
    expect(mocks.upload).toHaveBeenCalledWith([b, a], 'owner-1')
    expect(mocks.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner-1',
        groupId: 'group-1',
        generationType: 'image_to_video',
        falModelId: 'minimax/h3/reference-to-video',
        extraMetadata: expect.objectContaining({
          input_images: images,
          reference_image_ids: [b, a],
          estimated_cost_cents: 48,
        }),
      }),
    )
    expect(mocks.submit).toHaveBeenCalledWith('minimax/h3/reference-to-video', {
      input: expect.objectContaining({
        reference_image_urls: ['url-a', 'url-b'],
      }),
    })
    expect(mocks.submitted).toHaveBeenCalledWith('record-1', 'request-1')
    const ownershipCall = mocks.sql.mock.calls.find(
      ([query]) => Array.isArray(query) && 'raw' in query,
    )!
    expect(ownershipCall[0].join(' ')).toMatch(/user_id =/)
    expect(ownershipCall).toContain('owner-1')
  })
  it('rejects missing, deleted or inaccessible images before reserving or uploading', async () => {
    mocks.sql.mockImplementation((query: unknown) =>
      Array.isArray(query) && 'raw' in query ? Promise.resolve([]) : query,
    )
    await expect(
      generateVideo({ ...base, images: [{ id: a, role: 'reference' }] }),
    ).rejects.toThrow('Source image not found')
    expect(mocks.reserve).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.submit).not.toHaveBeenCalled()
  })
  it('refuses unsupported roles, unknown models, invalid IDs and duplicate frames before any paid work', async () => {
    await expect(
      generateVideo({
        ...base,
        modelSlug: 'minimax-h3-max',
        images: [{ id: a, role: 'reference' }],
      }),
    ).rejects.toThrow(/reference images/)
    await expect(
      generateVideo({ ...base, modelSlug: 'retired' }),
    ).rejects.toThrow(/Unknown/)
    await expect(
      generateVideo({ ...base, images: [{ id: 'not-a-uuid', role: 'first' }] }),
    ).rejects.toThrow()
    await expect(
      generateVideo({
        ...base,
        images: [
          { id: a, role: 'first' },
          { id: b, role: 'first' },
        ],
      }),
    ).rejects.toThrow(/one first/)
    expect(mocks.reserve).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.submit).not.toHaveBeenCalled()
  })
  it('records upload failure without submitting a generation that lost an image', async () => {
    mocks.upload.mockRejectedValue(new Error('Storage unavailable'))
    await expect(
      generateVideo({
        ...base,
        images: [
          { id: a, role: 'reference' },
          { id: b, role: 'reference' },
        ],
      }),
    ).rejects.toThrow('Storage unavailable')
    expect(mocks.failed).toHaveBeenCalledWith('record-1', 'Storage unavailable')
    expect(mocks.submit).not.toHaveBeenCalled()
  })
  it('keeps text-only generation free of image fields', async () => {
    mocks.upload.mockResolvedValue([])
    await generateVideo(base)
    expect(mocks.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ generationType: 'text_to_video' }),
    )
    expect(mocks.submit.mock.calls[0][1].input).not.toHaveProperty(
      'reference_image_urls',
    )
    expect(mocks.submit.mock.calls[0][1].input).not.toHaveProperty('image_url')
  })
})
