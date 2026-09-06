import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { grabYouTubeFrame } from './grab-youtube-frame.action'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  frame: vi.fn(),
}))
vi.mock('#/lib/server/auth.server', () => ({ resolveAuth: mocks.auth }))
vi.mock('../youtube-frame.server', () => ({ youTubeFrame: mocks.frame }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NODE_ENV', 'development')
  mocks.auth.mockResolvedValue({ userId: 'owner' })
  mocks.frame.mockResolvedValue({ base64: 'AAA', width: 1920, height: 1080 })
})
afterEach(() => vi.unstubAllEnvs())

const ID = 'dQw4w9WgXcQ'

describe('grabbing a frame from a YouTube video', () => {
  it('cuts at the position the player reported', async () => {
    await expect(
      grabYouTubeFrame({ videoId: ID, timeSeconds: 12.5 }),
    ).resolves.toEqual({ base64: 'AAA', width: 1920, height: 1080 })
    expect(mocks.frame).toHaveBeenCalledWith(ID, 12.5)
  })

  /* The whole reason this is local-only: the deploy has no yt-dlp and would
     have to keep one updated against YouTube's changes. It refuses and says so
     rather than the button quietly not existing. */
  it('refuses outside development, and names the reason', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(
      grabYouTubeFrame({ videoId: ID, timeSeconds: 1 }),
    ).rejects.toThrow(/pnpm dev/)
    expect(mocks.frame).not.toHaveBeenCalled()
  })

  /* The id is the only caller-supplied value that reaches a subprocess argument
     list, so it is checked here as well as where it was parsed. */
  it.each(['--exec=rm', '../../etc', 'short', ''])(
    'refuses %s before reaching yt-dlp',
    async (videoId) => {
      await expect(
        grabYouTubeFrame({ videoId, timeSeconds: 1 }),
      ).rejects.toThrow()
      expect(mocks.frame).not.toHaveBeenCalled()
    },
  )

  it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])(
    'refuses %s as a position',
    async (timeSeconds) => {
      await expect(
        grabYouTubeFrame({ videoId: ID, timeSeconds }),
      ).rejects.toThrow()
      expect(mocks.frame).not.toHaveBeenCalled()
    },
  )

  it('requires a signed-in user before doing any work', async () => {
    mocks.auth.mockRejectedValue(new Error('Not authenticated'))
    await expect(
      grabYouTubeFrame({ videoId: ID, timeSeconds: 1 }),
    ).rejects.toThrow()
    expect(mocks.frame).not.toHaveBeenCalled()
  })
})
