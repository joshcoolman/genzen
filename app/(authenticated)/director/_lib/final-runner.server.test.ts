import { beforeEach, expect, it, vi } from 'vitest'
import { runFinalCut } from './final-runner.server'
import type { FinalWork } from './final-cut'

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  renew: vi.fn(),
  checkpoint: vi.fn(),
  finish: vi.fn(),
  fail: vi.fn(),
  release: vi.fn(),
  source: vi.fn(),
  read: vi.fn(),
  store: vi.fn(),
  ingest: vi.fn(),
  assemble: vi.fn(),
  frames: vi.fn(),
  plan: vi.fn(),
  submit: vi.fn(),
  status: vi.fn(),
  result: vi.fn(),
  upload: vi.fn(),
}))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('./final-cuts.server', () => ({
  claimFinalCut: mocks.claim,
  renewFinalCut: mocks.renew,
  checkpointFinalCut: mocks.checkpoint,
  finishFinalCut: mocks.finish,
  failFinalCut: mocks.fail,
  releaseFinalCut: mocks.release,
}))
vi.mock('./exports.server', () => ({ getExport: mocks.source }))
vi.mock('./media.server', () => ({
  readMedia: mocks.read,
  storeMedia: mocks.store,
}))
vi.mock('./ingest.server', () => ({ ingestVideo: mocks.ingest }))
vi.mock('./final-media.server', () => ({
  assembleFinalCut: mocks.assemble,
  extractFinalFrames: mocks.frames,
}))
vi.mock('./final-plan.server', () => ({
  planFinalCut: mocks.plan,
  planningWasRejected: () => false,
}))
vi.mock('#/lib/server/fal-image-upload.server', () => ({
  uploadBufferToFal: mocks.upload,
}))
vi.mock('#/lib/server/fal-client.server', () => ({
  submitFalOnce: mocks.submit,
  fal: { queue: { status: mocks.status, result: mocks.result } },
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.renew.mockResolvedValue(true)
  mocks.source.mockResolvedValue({ media_id: 'rough-export' })
  mocks.read.mockResolvedValue(new Blob(['picture']))
  mocks.assemble.mockResolvedValue(new Blob(['silent film']))
  mocks.ingest.mockResolvedValue({ mediaId: 'finished' })
})
function savedWork(): FinalWork {
  return {
    plan: {
      title: 'Chase',
      story: 'Chase',
      continuity: 'Yellow car',
      style: 'Tracking',
      referenceFrames: [0],
      shots: [{ sections: [0], duration: 5, prompt: 'Yellow car' }],
    },
    frames: [{ mediaId: 'frame', time: 1, section: 0 }],
    references: ['https://fal.media/frame.jpg'],
    steps: {
      'picture-0': {
        endpoint: 'minimax/h3-max/reference-to-video',
        requestId: 'picture-receipt',
        url: 'https://fal.media/picture.mp4',
        mediaId: 'saved-picture',
      },
      'effects-0': { endpoint: 'fal-ai/mmaudio-v2' },
      music: {
        endpoint: 'fal-ai/stable-audio-25/text-to-audio',
        requestId: 'music-receipt',
        terminal: true,
      },
    },
  }
}
it('finishes saved pictures without polling, submitting or consuming legacy audio', async () => {
  const work = savedWork()
  mocks.claim.mockResolvedValue({
    lease_id: 'lease',
    session_id: 'session',
    export_id: 'export',
    stage: 'Sound',
    work,
  })
  await runFinalCut('owner', 'job')
  expect(mocks.fail).not.toHaveBeenCalled()
  expect(mocks.submit).not.toHaveBeenCalled()
  expect(mocks.status).not.toHaveBeenCalled()
  expect(mocks.result).not.toHaveBeenCalled()
  expect(mocks.plan).not.toHaveBeenCalled()
  expect(mocks.assemble).toHaveBeenCalledTimes(1)
  const [inputs, ...extra] = mocks.assemble.mock.calls[0]
  expect(extra).toEqual([])
  expect(inputs).toHaveLength(1)
  expect(inputs[0].duration).toBe(5)
  await inputs[0].blob()
  expect(mocks.read).toHaveBeenCalledWith('owner', 'saved-picture')
  expect(mocks.finish).toHaveBeenCalledWith('owner', 'job', 'lease', {
    mediaId: 'finished',
  })
  expect(work.steps?.['effects-0']).toEqual({ endpoint: 'fal-ai/mmaudio-v2' })
})
it('still blocks an uncertain picture rather than spending again', async () => {
  const work = savedWork()
  delete work.steps!['picture-0']!.requestId
  mocks.claim.mockResolvedValue({ lease_id: 'lease', work })
  await runFinalCut('owner', 'job')
  expect(mocks.fail).toHaveBeenCalledWith(
    'owner',
    'job',
    'lease',
    expect.stringContaining('no saved result or receipt'),
  )
  expect(mocks.submit).not.toHaveBeenCalled()
  expect(mocks.assemble).not.toHaveBeenCalled()
})
