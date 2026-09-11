import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  prepareImageSkillInternal,
  validatePreparedSkill,
} from './storyboard.server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  sql: vi.fn(),
  vision: vi.fn(),
  generate: vi.fn(),
  require: vi.fn(),
  schema: vi.fn(),
}))
vi.mock('#/lib/server/auth.server', () => ({ resolveAuth: mocks.auth }))
vi.mock('#/lib/server/db.server', () => ({ sql: mocks.sql }))
vi.mock('#/lib/server/vision-image.server', () => ({
  loadVisionImage: mocks.vision,
}))
vi.mock('#/lib/server/ai.server', () => ({
  ai: { reasoning: { modelId: 'test-claude' } },
  requireAiRole: mocks.require,
}))
vi.mock('ai', () => ({
  generateText: mocks.generate,
  Output: { object: vi.fn() },
}))
vi.mock('./fal-schema.server', () => ({ fetchModelSchema: mocks.schema }))

const ids = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
]
const input = {
  skillId: 'storyboard' as const,
  brief: 'Four shots: image 1 is the fighter; image 2 is the courtyard.',
  originalInput:
    '/storyboard Four shots: image 1 is the fighter; image 2 is the courtyard.',
  referenceIds: ids,
  models: [
    'openai/gpt-image-2.5/sunburst/edit',
    'openai/gpt-image-2.5/flare/edit',
  ],
}
const plan = {
  continuity: 'The blue fighter stays in the stone courtyard.',
  shotAspectRatio: '16:9',
  references: [
    { image: 1, role: 'fighter' },
    { image: 2, role: 'courtyard' },
  ],
  shots: Array.from({ length: 4 }, (_, i) => ({
    number: i + 1,
    description: `Beat ${i + 1}`,
    referenceImages: [1, 2],
  })),
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ userId: 'owner' })
  // Reverse DB order to catch accidental ordering by query output.
  mocks.sql.mockResolvedValue([
    { id: ids[1], storage_path: 'environment' },
    { id: ids[0], storage_path: 'character' },
  ])
  mocks.vision.mockImplementation((path: string) =>
    Promise.resolve({ data: path, mediaType: 'image/jpeg' }),
  )
  mocks.schema.mockResolvedValue({
    sizeParam: 'image_size',
    imageSizeAcceptsObject: true,
    imageInputParam: 'image_urls',
  })
  mocks.generate.mockResolvedValue({
    output: plan,
    usage: { inputTokens: 50, outputTokens: 200 },
  })
})
describe('authenticated storyboard preparation', () => {
  it('plans once across models, sends actual references in numbered order, and preserves the request', async () => {
    const results = await prepareImageSkillInternal(input)
    expect(mocks.auth).toHaveBeenCalledOnce()
    expect(mocks.generate).toHaveBeenCalledOnce()
    const content = mocks.generate.mock.calls[0][0].messages[0].content
    expect(content.slice(0, 4)).toEqual([
      { type: 'text', text: 'Image 1' },
      { type: 'image', image: 'character', mediaType: 'image/jpeg' },
      { type: 'text', text: 'Image 2' },
      { type: 'image', image: 'environment', mediaType: 'image/jpeg' },
    ])
    expect(content[4].text).toContain('image 1 is the fighter')
    expect(results).toHaveLength(2)
    expect(results[0].skill.preparationId).toBe(results[1].skill.preparationId)
    expect(results[0].skill).toMatchObject({
      originalInput: input.originalInput,
      referenceIds: ids,
      plan,
      preparation: { inputTokens: 50, outputTokens: 200 },
    })
    expect(results[0].prompt).not.toContain('/storyboard')
    expect(results[0].prompt).toContain('fighter')
  })
  it('plans from a brief alone with no image reads or invented reference assignments', async () => {
    mocks.generate.mockResolvedValueOnce({
      output: {
        ...plan,
        references: [],
        shots: plan.shots.map((shot) => ({ ...shot, referenceImages: [] })),
      },
      usage: {},
    })
    const result = await prepareImageSkillInternal({
      skillId: 'storyboard',
      brief: 'Four shots of a cyclist arriving home',
      referenceIds: [],
      models: [input.models[0]],
    })
    expect(mocks.sql).not.toHaveBeenCalled()
    expect(mocks.vision).not.toHaveBeenCalled()
    expect(result[0].skill.referenceIds).toEqual([])
    const content = mocks.generate.mock.calls[0][0].messages[0].content
    expect(content).toHaveLength(1)
    expect(JSON.parse(content[0].text)).toMatchObject({
      referenceCount: 0,
      requestedShotCount: 4,
    })
  })
  it('rejects excess references before Claude', async () => {
    await expect(
      prepareImageSkillInternal({
        ...input,
        models: ['fal-ai/z-image/turbo/image-to-image'],
      }),
    ).rejects.toThrow('holds 1')
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('stops for a missing key or unreadable image without producing a rendering request', async () => {
    mocks.require.mockImplementationOnce(() => {
      throw new Error('Missing ANTHROPIC_API_KEY')
    })
    await expect(prepareImageSkillInternal(input)).rejects.toThrow(
      'ANTHROPIC_API_KEY',
    )
    expect(mocks.generate).not.toHaveBeenCalled()
    mocks.vision.mockResolvedValueOnce(null)
    await expect(prepareImageSkillInternal(input)).rejects.toThrow(
      'reference image 1',
    )
    expect(mocks.generate).not.toHaveBeenCalled()
  })
  it('rejects a bad plan and refuses to reinterpret edited references or brief at rendering', async () => {
    mocks.generate.mockResolvedValueOnce({ output: {}, usage: {} })
    await expect(prepareImageSkillInternal(input)).rejects.toThrow(
      'invalid plan',
    )
    const [{ skill, prompt }] = await prepareImageSkillInternal(input)
    expect(
      await validatePreparedSkill(skill, skill.model, ids, input.originalInput),
    ).toBe(prompt)
    await expect(
      validatePreparedSkill(
        skill,
        skill.model,
        [...ids].reverse(),
        input.originalInput,
      ),
    ).rejects.toThrow('no longer matches')
    await expect(
      validatePreparedSkill(
        skill,
        skill.model,
        ids,
        '/storyboard a different scene',
      ),
    ).rejects.toThrow('no longer matches')
    expect(mocks.generate).toHaveBeenCalledTimes(2)
  })
})
