import { APICallError } from 'ai'
import { expect, it, vi } from 'vitest'
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
