import { APICallError } from 'ai'
import { beforeEach, expect, it, vi } from 'vitest'
import { planFinalCut, planningWasRejected } from './final-plan.server'
import type * as AiSdk from 'ai'
import type { SavedExport } from './types'

const mocks = vi.hoisted(() => ({ generate: vi.fn(), read: vi.fn() }))
vi.mock('ai', async (original) => ({
  ...(await original<typeof AiSdk>()),
  generateText: mocks.generate,
}))
vi.mock('./media.server', () => ({ readMedia: mocks.read }))
vi.mock('#/lib/server/ai.server', () => ({
  ai: { vision: 'vision' },
  requireAiRole: vi.fn(),
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.read.mockResolvedValue(new Blob(['frame'], { type: 'image/jpeg' }))
})
it('sends only accepted source directions and exported frames, using Anthropic-compatible tool output', async () => {
  mocks.read.mockResolvedValue(new Blob(['frame'], { type: 'image/jpeg' }))
  mocks.generate.mockResolvedValue({
    output: {
      title: 'Finished',
      story: 'Accepted',
      continuity: 'Yellow car',
      style: 'Tracking',
      referenceFrames: [0],
      music: 'Instrumental',
      shots: [
        {
          sections: [0],
          duration: 5,
          prompt: 'Yellow car moving',
          sound: 'Engine',
        },
      ],
    },
  })
  await planFinalCut(
    'owner',
    {
      duration: 5,
      source: [{ prompt: 'Only the accepted yellow car', duration: 5 }],
    } as SavedExport,
    [{ mediaId: 'exported-frame', section: 0, time: 1 }],
  )
  const call = mocks.generate.mock.calls[0][0]
  expect(call.providerOptions.anthropic.structuredOutputMode).toBe('jsonTool')
  expect(call.maxRetries).toBe(0)
  expect(JSON.parse(call.messages[0].content[0].text).sections).toEqual([
    { index: 0, direction: 'Only the accepted yellow car', duration: 5 },
  ])
  expect(mocks.read).toHaveBeenCalledWith('owner', 'exported-frame')
})
it('allows retry only for a definite planning rejection, not a lost or invalid generated result', () => {
  const error = (statusCode: number) =>
    new APICallError({
      message: 'Rejected',
      url: 'https://api.anthropic.com',
      requestBodyValues: {},
      statusCode,
    })
  expect(planningWasRejected(error(400))).toBe(true)
  expect(planningWasRejected(error(503))).toBe(false)
  expect(planningWasRejected(new Error('Connection lost'))).toBe(false)
})
const treatment = {
  title: 'Chase',
  story: 'A car chase',
  continuity: 'Yellow car',
  style: 'Dynamic',
  referenceFrames: [0],
  music: 'Instrumental',
  shots: [
    {
      sections: [0],
      duration: 15,
      prompt: 'Follow the yellow car',
      sound: 'Engine',
    },
  ],
}
it('fits an overlong treatment from a 167-second rough cut without another AI request', async () => {
  mocks.generate.mockResolvedValue({
    output: { ...treatment, shots: Array(12).fill(treatment.shots[0]) },
  })
  const output = await planFinalCut(
    'owner',
    {
      duration: 167,
      source: [{ duration: 167, prompt: 'Chase' }],
    } as SavedExport,
    [{ mediaId: 'frame', section: 0, time: 1 }],
  )
  expect(output.shots.reduce((sum, shot) => sum + shot.duration, 0)).toBe(120)
  expect(mocks.generate).toHaveBeenCalledTimes(1)
  const input = JSON.parse(
    mocks.generate.mock.calls[0][0].messages[0].content[0].text,
  )
  expect(input).toMatchObject({ budgetSeconds: 120, maxShots: 12 })
})
it('repairs structural mistakes once before rendering, but never retries an uncertain AI request', async () => {
  mocks.generate
    .mockResolvedValueOnce({
      output: { ...treatment, shots: [treatment.shots[0], treatment.shots[0]] },
    })
    .mockResolvedValueOnce({ output: treatment })
  const source = {
    duration: 5,
    source: [{ duration: 5, prompt: 'Chase' }],
  } as SavedExport
  const frames = [{ mediaId: 'frame', section: 0, time: 1 }]
  const alive = vi.fn(() => Promise.resolve())
  const output = await planFinalCut('owner', source, frames, alive)
  expect(output.shots.map((shot) => shot.duration)).toEqual([5])
  expect(mocks.generate).toHaveBeenCalledTimes(2)
  expect(alive).toHaveBeenCalledTimes(2)
  expect(
    JSON.parse(mocks.generate.mock.calls[1][0].messages[0].content[0].text)
      .repair.problem,
  ).toContain('fewer shots')
  mocks.generate.mockReset().mockRejectedValueOnce(new Error('Connection lost'))
  await expect(planFinalCut('owner', source, frames)).rejects.toThrow(
    'Connection lost',
  )
  expect(mocks.generate).toHaveBeenCalledTimes(1)
})
