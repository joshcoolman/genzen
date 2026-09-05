import { beforeEach, expect, it, vi } from 'vitest'
import { FINAL_MODELS, runFinalProvider } from './final-provider.server'
import type { FinalStep } from './final-cut'

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  status: vi.fn(),
  result: vi.fn(),
}))
vi.mock('#/lib/server/fal-client.server', () => ({
  submitFalOnce: mocks.submit,
  fal: { queue: { status: mocks.status, result: mocks.result } },
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.submit.mockResolvedValue('receipt')
  mocks.status.mockResolvedValue({ status: 'COMPLETED' })
  mocks.result.mockResolvedValue({
    data: { video: { url: 'https://fal.media/final.mp4' } },
  })
})
function setup(steps: Partial<Record<string, FinalStep>> = {}) {
  const snapshots: Array<unknown> = []
  const checkpoint = vi.fn(() => {
    snapshots.push(structuredClone(steps))
    return Promise.resolve()
  })
  return {
    steps,
    snapshots,
    options: {
      steps,
      key: 'picture',
      endpoint: FINAL_MODELS.video,
      input: { prompt: 'Accepted story' },
      checkpoint,
      alive: vi.fn(() => Promise.resolve()),
    },
  }
}
it('checkpoints intent before spending, then the receipt, then the result', async () => {
  const { options, snapshots } = setup()
  mocks.submit.mockImplementation(() => {
    expect(snapshots).toEqual([
      { picture: { endpoint: FINAL_MODELS.video, input: options.input } },
    ])
    return Promise.resolve('receipt')
  })
  await runFinalProvider(options)
  expect(snapshots[1]).toMatchObject({ picture: { requestId: 'receipt' } })
  expect(snapshots[2]).toMatchObject({
    picture: { url: 'https://fal.media/final.mp4' },
  })
  await runFinalProvider(options)
  expect(mocks.submit).toHaveBeenCalledTimes(1)
  expect(mocks.result).toHaveBeenCalledTimes(1)
})
it('refuses to resubmit after a lost receipt and resumes a receipted request without spending again', async () => {
  const unknown = setup({ picture: { endpoint: FINAL_MODELS.video } })
  await expect(runFinalProvider(unknown.options)).rejects.toThrow('no receipt')
  expect(mocks.submit).not.toHaveBeenCalled()
  const known = setup({
    picture: { endpoint: FINAL_MODELS.video, requestId: 'old' },
  })
  await runFinalProvider(known.options)
  expect(mocks.submit).not.toHaveBeenCalled()
  expect(mocks.status).toHaveBeenCalledWith(FINAL_MODELS.video, {
    requestId: 'old',
    logs: false,
  })
})
it('does not spend when intent cannot be saved or a stop wins the race', async () => {
  const first = setup()
  first.options.checkpoint.mockRejectedValueOnce(new Error('Database down'))
  await expect(runFinalProvider(first.options)).rejects.toThrow('Database down')
  const second = setup()
  second.options.alive
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('Stopped'))
  await expect(runFinalProvider(second.options)).rejects.toThrow('Stopped')
  expect(mocks.submit).not.toHaveBeenCalled()
})
it('keeps uncertain intent after a failed submit and rejects unexpected media hosts', async () => {
  const { options, snapshots } = setup()
  mocks.submit.mockRejectedValueOnce(new Error('Connection lost'))
  await expect(runFinalProvider(options)).rejects.toThrow('Connection lost')
  expect(snapshots).toHaveLength(1)
  await expect(runFinalProvider(options)).rejects.toThrow('no receipt')
  expect(mocks.submit).toHaveBeenCalledTimes(1)
  const unsafe = setup({
    picture: { endpoint: FINAL_MODELS.video, requestId: 'old' },
  })
  mocks.result.mockResolvedValueOnce({
    data: { video: { url: 'https://localhost/private' } },
  })
  await expect(runFinalProvider(unsafe.options)).rejects.toThrow(
    'Unexpected provider media host',
  )
})
