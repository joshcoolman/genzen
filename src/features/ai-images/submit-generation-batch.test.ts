import { beforeEach, describe, expect, it, vi } from 'vitest'
import { submitGenerationBatch } from './submit-generation-batch'
import type { PreparedImageSkill } from './skills/types'

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), generate: vi.fn() }))
vi.mock('./server/prepare-image-skill.action', () => ({
  prepareImageSkill: mocks.prepare,
}))
vi.mock('./server/submit-generator-image.action', () => ({
  submitGeneratorImage: mocks.generate,
}))

const model = 'gpt-image-2.5-sunburst'
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const prepared = Array.from({ length: 6 }, (_, i) => ({
  prompt: `Prepared shot ${i + 1}`,
  skill: {
    model: 'openai/gpt-image-2.5/sunburst/edit',
    originalInput: '/storyboard A chase',
    shotNumber: i + 1,
    layout: { sheetAspectRatio: '16:9' },
  } as PreparedImageSkill,
}))
function batch() {
  return {
    prompts: ['/storyboard A chase'],
    referenceIds: ['reference-one', 'reference-two'],
    selectedModels: [model],
    gensPerModel: 1,
    aspectRatio: '16:9',
    systemInstructions: 'Style. ',
    selectedStyleId: null,
    origin: 'images' as const,
    groupId: 'original-group',
    onSubmitStart: vi.fn(),
    onSubmitOutcome: vi.fn(),
    onAfterSubmit: vi.fn(),
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.prepare.mockResolvedValue(prepared)
  mocks.generate.mockImplementation(() =>
    Promise.resolve({
      recordId: crypto.randomUUID(),
      error: null,
    }),
  )
})
describe('background generation batches', () => {
  it('draws every card before planning, shares preparation across variants, and settles each card', async () => {
    const plan = deferred<typeof prepared>()
    const input = { ...batch(), gensPerModel: 2 }
    mocks.prepare.mockImplementation(() => {
      expect(input.onSubmitStart).toHaveBeenCalledOnce()
      return plan.promise
    })
    const running = submitGenerationBatch(input)
    expect(input.onSubmitStart.mock.calls[0][0]).toHaveLength(12)
    expect(mocks.prepare).toHaveBeenCalledOnce()
    expect(mocks.generate).not.toHaveBeenCalled()
    plan.resolve(prepared)
    await running
    expect(mocks.generate).toHaveBeenCalledTimes(12)
    expect(mocks.generate.mock.calls[0][0]).toMatchObject({
      prompt: 'Prepared shot 1',
      typedPrompt: '/storyboard A chase',
      sourceImageId: 'reference-one',
      referenceImageIds: ['reference-two'],
      aspectRatio: '16:9',
      groupId: 'original-group',
      skill: prepared[0].skill,
    })
    const ids = input.onSubmitStart.mock.calls[0][0].map(
      (c: { placeholderId: string }) => c.placeholderId,
    )
    expect(new Set(ids).size).toBe(12)
    expect(
      input.onSubmitOutcome.mock.calls.map(([o]) => o.placeholderId),
    ).toEqual(ids)
  })

  it('lets ordinary prompts and a second click finish while the first plan is unresolved', async () => {
    const plan = deferred<typeof prepared>()
    mocks.prepare.mockReturnValueOnce(plan.promise)
    const first = {
      ...batch(),
      prompts: ['/storyboard A chase', 'A still life'],
    }
    const firstRunning = submitGenerationBatch(first)
    const second = {
      ...batch(),
      prompts: ['Another idea'],
      groupId: 'second-group',
    }
    await submitGenerationBatch(second)
    expect(first.onSubmitOutcome).toHaveBeenCalledOnce()
    expect(second.onAfterSubmit).toHaveBeenCalledOnce()
    expect(mocks.generate.mock.calls.map(([input]) => input.groupId)).toEqual([
      'original-group',
      'second-group',
    ])
    plan.resolve(prepared)
    await firstRunning
    expect(first.onAfterSubmit.mock.calls[0][0]).toHaveLength(7)
    expect(mocks.generate.mock.lastCall?.[0].groupId).toBe('original-group')
  })

  it('returns an error for every preparation placeholder without submitting any render', async () => {
    const plan = deferred<typeof prepared>()
    mocks.prepare.mockReturnValueOnce(plan.promise)
    const input = { ...batch(), gensPerModel: 2 }
    const running = submitGenerationBatch(input)
    const failure = expect(running).rejects.toThrow(
      'Reference image unavailable',
    )
    plan.reject(new Error('Reference image unavailable'))
    await failure
    expect(mocks.generate).not.toHaveBeenCalled()
    expect(input.onSubmitOutcome).toHaveBeenCalledTimes(12)
    for (const [outcome] of input.onSubmitOutcome.mock.calls) {
      expect(outcome).toMatchObject({
        recordId: null,
        error: 'Reference image unavailable',
      })
    }
    expect(input.onAfterSubmit).toHaveBeenCalledOnce()
  })

  it('reconciles provider failures to their reserved row instead of leaving a duplicate local card', async () => {
    mocks.generate.mockResolvedValueOnce({
      recordId: 'failed-row',
      error: 'Queue unavailable',
    })
    const input = batch()
    await expect(submitGenerationBatch(input)).rejects.toThrow(
      'Queue unavailable',
    )
    expect(input.onSubmitOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: 'failed-row',
        error: 'Queue unavailable',
      }),
    )
  })
  it('preserves the same typed invocation across preparation and rendering, including surrounding whitespace', async () => {
    const originalInput = '  /storyboard A chase  '
    mocks.prepare.mockResolvedValueOnce(
      prepared.map((p) => ({ ...p, skill: { ...p.skill, originalInput } })),
    )
    await submitGenerationBatch({ ...batch(), prompts: [originalInput] })
    expect(mocks.prepare.mock.calls[0][0].originalInput).toBe(originalInput)
    expect(mocks.generate.mock.calls[0][0].typedPrompt).toBe(originalInput)
  })
  it('rejects invalid commands before creating cards or requesting paid work', async () => {
    for (const prompt of [
      '/storyboard',
      '/storyboardish A chase',
      '/unknown',
    ]) {
      const input = { ...batch(), prompts: [prompt] }
      await expect(submitGenerationBatch(input)).rejects.toThrow()
      expect(input.onSubmitStart).not.toHaveBeenCalled()
    }
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it('reports a render failure on its own card without losing a sibling success', async () => {
    mocks.generate.mockRejectedValueOnce(new Error('Queue unavailable'))
    const input = { ...batch(), gensPerModel: 2 }
    await expect(submitGenerationBatch(input)).rejects.toThrow(
      'Queue unavailable',
    )
    expect(input.onAfterSubmit.mock.calls[0][0].slice(0, 2)).toEqual([
      expect.objectContaining({ recordId: null, error: 'Queue unavailable' }),
      expect.objectContaining({ recordId: expect.any(String), error: null }),
    ])
  })
})
