import { afterEach, expect, it, vi } from 'vitest'
import { submitFalOnce } from './fal-client.server'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('./fal-fetch.server', () => ({ falFetch: mocks.fetch }))
vi.mock('@fal-ai/client', () => ({ fal: { config: vi.fn() } }))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
it('does not retry a paid POST on an ambiguous server failure', async () => {
  vi.stubEnv('FAL_KEY', 'test-only')
  mocks.fetch.mockResolvedValue(new Response('unavailable', { status: 503 }))
  await expect(
    submitFalOnce('minimax/h3-max/reference-to-video', { prompt: 'test' }),
  ).rejects.toThrow('503')
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
})
it('returns the accepted receipt through the shared HTTP/1 transport', async () => {
  vi.stubEnv('FAL_KEY', 'test-only')
  mocks.fetch.mockResolvedValue(Response.json({ request_id: 'saved-receipt' }))
  expect(
    await submitFalOnce('minimax/h3-max/reference-to-video', {
      prompt: 'test',
    }),
  ).toBe('saved-receipt')
  expect(mocks.fetch).toHaveBeenCalledWith(
    'https://queue.fal.run/minimax/h3-max/reference-to-video',
    expect.objectContaining({
      method: 'POST',
      headers: {
        Authorization: 'Key test-only',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'test' }),
    }),
  )
})
