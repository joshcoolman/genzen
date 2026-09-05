import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mediaUrl, readReceipt, signReceipt } from '../clip-jobs.server'
import { checkClip, submitClip } from './clips.action'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  submit: vi.fn(),
  status: vi.fn(),
  upload: vi.fn(),
}))
vi.mock('#/lib/server/auth.server', () => ({ resolveAuth: mocks.auth }))
vi.mock('#/lib/server/fal-client.server', () => ({
  fal: { queue: { submit: mocks.submit, status: mocks.status } },
}))
vi.mock('#/lib/server/fal-image-upload.server', () => ({
  uploadBufferToFal: mocks.upload,
}))
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('FAL_KEY', 'test-secret')
  mocks.auth.mockResolvedValue({ userId: 'owner' })
  mocks.submit.mockResolvedValue({ request_id: 'job-1' })
  mocks.upload.mockResolvedValue('https://fal.media/start.png')
})
afterEach(() => vi.unstubAllEnvs())
function data(model = 'turbo') {
  const form = new FormData()
  form.set(
    'request',
    JSON.stringify({
      prompt: 'Add a rabbit',
      context: ['A cartoon bear dances'],
      settings: { model, resolution: '768P' },
    }),
  )
  return form
}
describe('bounded authenticated clip generation', () => {
  it('sends one five-second request with fast expansion and the starting frame', async () => {
    const form = data()
    form.set('frame', new Blob(['frame'], { type: 'image/png' }), 'frame.png')
    const token = await submitClip(form)
    expect(readReceipt(token, 'owner')).toMatchObject({
      requestId: 'job-1',
      model: 'turbo',
    })
    expect(mocks.submit).toHaveBeenCalledOnce()
    expect(mocks.submit).toHaveBeenCalledWith(
      'minimax/h3-max-turbo/image-to-video',
      {
        input: expect.objectContaining({
          duration: 5,
          prompt_expansion_mode: 'balanced',
          image_url: 'https://fal.media/start.png',
          enable_safety_checker: true,
        }),
      },
    )
    const prompt = mocks.submit.mock.calls[0][1].input.prompt
    expect(prompt).toContain('A cartoon bear dances')
    expect(prompt).toContain('Add a rabbit')
    expect(prompt).toContain('Do not invent')
  })
  it('checks the existing job, without submitting or uploading again', async () => {
    mocks.status.mockResolvedValue({ status: 'COMPLETED' })
    const token = signReceipt({
      owner: 'owner',
      requestId: 'job-1',
      model: 'max',
    })
    expect(await checkClip(token)).toBe('COMPLETED')
    expect(mocks.submit).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.status).toHaveBeenCalledWith('minimax/h3-max/image-to-video', {
      requestId: 'job-1',
      logs: false,
    })
  })
  it('rejects production, invalid models and unauthenticated calls before spending', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(submitClip(data())).rejects.toThrow('local Lab')
    vi.stubEnv('NODE_ENV', 'development')
    await expect(submitClip(data('other-model'))).rejects.toThrow()
    mocks.auth.mockRejectedValue(new Error('Unauthorized'))
    await expect(submitClip(data())).rejects.toThrow('Unauthorized')
    expect(mocks.submit).not.toHaveBeenCalled()
  })
  it('rejects forged receipts, cross-account access and non-provider media', () => {
    const token = signReceipt({
      owner: 'owner',
      requestId: 'job-1',
      model: 'max',
    })
    expect(() => readReceipt(token, 'other')).toThrow('another account')
    expect(() => readReceipt(`${token}x`, 'owner')).toThrow('Invalid')
    expect(() => mediaUrl('https://fal.media.attacker.test/a')).toThrow()
    expect(() => mediaUrl('http://127.0.0.1/a')).toThrow()
    expect(mediaUrl('https://v3.fal.media/files/a.mp4')).toContain(
      'v3.fal.media',
    )
  })
})
