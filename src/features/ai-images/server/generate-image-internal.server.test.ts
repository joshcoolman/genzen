import { beforeEach, describe, expect, it, vi } from 'vitest'
import { submitGeneratorImage } from './submit-generator-image.action'
import { generateImageInternal } from './generate-image-internal.server'
import type { PreparedImageSkill } from '../skills/types'

const mocks = vi.hoisted(() => ({
  reserve: vi.fn(),
  submit: vi.fn(),
  mark: vi.fn(),
  fail: vi.fn(),
  build: vi.fn(),
  validate: vi.fn(),
  source: vi.fn(),
  refs: vi.fn(),
}))
vi.mock('#/lib/server/auth.server', () => ({
  resolveAuth: () => Promise.resolve({ userId: 'owner' }),
}))
vi.mock('#/lib/server/db.server', () => ({
  first: (rows: Array<unknown>) => rows[0],
  sql: vi.fn().mockResolvedValue([]),
}))
vi.mock('#/lib/server/fal-client.server', () => ({
  fal: { queue: { submit: mocks.submit } },
}))
vi.mock('#/lib/server/fal-retry.server', () => ({
  withNetworkRetry: (_: string, fn: () => unknown) => fn(),
}))
vi.mock('#/lib/server/fal-key.server', () => ({ assertFalKey: vi.fn() }))
vi.mock('#/lib/server/describe-image.server', () => ({
  describeImage: vi.fn(),
}))
vi.mock('#/lib/server/fal-image-upload.server', () => ({
  uploadBufferToFal: vi.fn(),
}))
vi.mock('#/lib/server/fal-image-inputs.server', () => ({
  uploadLibraryImageToFal: mocks.source,
  uploadLibraryImagesToFal: mocks.refs,
}))
vi.mock('#/lib/server/compute-cost.server', () => ({
  computeFalCostCents: () => Promise.resolve(3),
}))
vi.mock('#/lib/server/create-pending-generation.server', () => ({
  createPendingGeneration: mocks.reserve,
  markGenerationSubmitted: mocks.mark,
  markGenerationFailed: mocks.fail,
  describeGenerationError: (e: Error) => e.message,
}))
vi.mock('./fal-params.server', () => ({ buildFalInput: mocks.build }))
vi.mock('./storyboard.server', () => ({
  validatePreparedSkill: mocks.validate,
}))

const skill: PreparedImageSkill = {
  id: 'storyboard',
  version: 1,
  preparationId: 'prep',
  originalInput: '/storyboard a chase',
  brief: 'a chase',
  referenceIds: ['first', 'second'],
  model: 'openai/gpt-image-2.5/sunburst/edit',
  plan: {
    continuity: 'same two cars',
    references: [
      { image: 1, role: 'cars' },
      { image: 2, role: 'road' },
    ],
    shotAspectRatio: '16:9',
    shots: Array.from({ length: 6 }, (_, i) => ({
      number: i + 1,
      description: `Beat ${i + 1}`,
      referenceImages: [1, 2],
    })),
  },
  layout: {
    columns: 3,
    rows: 2,
    emptyCells: 0,
    readingOrder: 'left-to-right, top-to-bottom',
    shotAspectRatio: '16:9',
    idealSheetRatio: '48:18',
    sheetAspectRatio: '2048:768',
    size: { image_size: { width: 2048, height: 768 } },
    fit: 'letterbox',
  },
  preparation: {
    model: 'claude',
    inputTokens: 100,
    outputTokens: 200,
    durationMs: 1000,
  },
}
const request = {
  origin: 'images' as const,
  prompt: 'prepared prompt',
  typedPrompt: skill.originalInput,
  model: skill.model,
  sourceImageId: 'first',
  referenceImageIds: ['second'],
  skill,
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.reserve.mockResolvedValue({ recordId: 'record' })
  mocks.submit.mockResolvedValue({ request_id: 'provider-request' })
  mocks.validate.mockResolvedValue('exact prepared prompt')
  mocks.source.mockResolvedValue('url-first')
  mocks.refs.mockResolvedValue(['url-second'])
  mocks.build.mockImplementation(
    (data: {
      prompt: string
      imageUrls?: Array<string>
      extraParams?: Record<string, unknown>
    }) =>
      Promise.resolve({
        input: {
          prompt: data.prompt,
          image_urls: data.imageUrls,
          quality: 'medium',
          ...data.extraParams,
        },
        imagesUsed: data.imageUrls?.length ?? 0,
        imagesRequested: data.imageUrls?.length ?? 0,
      }),
  )
})
describe('storyboard uses the ordinary generation pipeline', () => {
  it('records invocation, plan, ordered refs, layout and replay settings before rendering', async () => {
    await generateImageInternal(request)
    expect(mocks.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner',
        origin: 'images',
        prompt: '/storyboard a chase',
        aspectRatio: '2048:768',
        extraMetadata: expect.objectContaining({
          image_skill: skill,
          sent_prompt: 'exact prepared prompt',
          source_image_id: 'first',
          reference_image_ids: ['second'],
          rendering_request: {
            model: skill.model,
            imageInputParam: 'image_urls',
            settings: {
              prompt: 'exact prepared prompt',
              quality: 'medium',
              image_size: { width: 2048, height: 768 },
            },
          },
        }),
      }),
    )
    expect(mocks.submit).toHaveBeenCalledOnce()
    expect(mocks.submit).toHaveBeenCalledWith(skill.model, {
      input: {
        prompt: 'exact prepared prompt',
        image_urls: ['url-first', 'url-second'],
        quality: 'medium',
        image_size: { width: 2048, height: 768 },
      },
    })
    expect(mocks.mark).toHaveBeenCalledWith(
      'record',
      'provider-request',
      expect.objectContaining({
        prompt: '/storyboard a chase',
        sent_prompt: 'exact prepared prompt',
      }),
    )
  })
  it('stops invalid plans and missing preparation before reserving or rendering', async () => {
    mocks.validate.mockRejectedValueOnce(new Error('Invalid plan'))
    await expect(generateImageInternal(request)).rejects.toThrow('Invalid plan')
    await expect(
      generateImageInternal({ ...request, skill: undefined }),
    ).rejects.toThrow('Prepare the storyboard')
    await expect(
      generateImageInternal({
        ...request,
        skill: undefined,
        typedPrompt: '/unknown a chase',
      }),
    ).rejects.toThrow('Unknown image command')
    expect(mocks.reserve).not.toHaveBeenCalled()
    expect(mocks.submit).not.toHaveBeenCalled()
  })
  it('stops a renderer that would silently truncate references before reserving', async () => {
    mocks.build.mockResolvedValueOnce({
      input: {},
      imagesUsed: 1,
      imagesRequested: 2,
    })
    await expect(generateImageInternal(request)).rejects.toThrow(
      'every reference',
    )
    expect(mocks.submit).not.toHaveBeenCalled()
    expect(mocks.reserve).not.toHaveBeenCalled()
  })
  it('returns a reserved failed row to the composer so its card can reconcile', async () => {
    mocks.submit.mockRejectedValueOnce(new Error('Provider queue unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(submitGeneratorImage(request)).resolves.toEqual({
        recordId: 'record',
        error: 'Provider queue unavailable',
      })
      expect(mocks.fail).toHaveBeenCalledWith(
        'record',
        'Provider queue unavailable',
      )
    } finally {
      log.mockRestore()
    }
  })
  it('keeps plain rows on the normal path without planning', async () => {
    await generateImageInternal({
      origin: 'canvas',
      prompt: 'a cat',
      model: 'fal-ai/nano-banana-2',
      canvasId: 'board',
    })
    expect(mocks.validate).not.toHaveBeenCalled()
    expect(mocks.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'canvas',
        canvasId: 'board',
        prompt: 'a cat',
      }),
    )
    expect(mocks.submit).toHaveBeenCalledOnce()
  })
})
