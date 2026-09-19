import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rerunChatClip } from './chat.action'
import { composeClipPrompt } from '#/lib/server/director-chat.server'

/**
 * What a re-roll is generated at (#692).
 *
 * Mocks rather than a database: every claim here is about the number handed to
 * `generateVideo`, and the row, the session and the submit are only the setup
 * that number is read out of.
 */

const CLIP_ID = randomUUID()
const SESSION_ID = randomUUID()

/** A twenty-word line, the one from the `AI and Education` session, stored on a
 *  clip whose twelve seconds were dealt out by position rather than timed. */
const LINE =
  'Every single one of them asked me the very same question again and yet nobody once stopped to listen properly'

const PROMPT = composeClipPrompt(
  'A tired professor.',
  'A lecture hall.',
  'He leans on the lectern.',
  LINE,
)

const row = { description: PROMPT, duration: '12' }

const generateVideo = vi.fn((_input: unknown) =>
  Promise.resolve({ recordId: randomUUID() }),
)

vi.mock('#/lib/server/auth.server', () => ({
  resolveAuth: vi.fn(() => Promise.resolve({ userId: randomUUID() })),
}))
vi.mock('#/lib/server/db.server', () => ({
  sql: vi.fn(() => Promise.resolve([row])),
}))
vi.mock('../../video/_actions/generate-video.action', () => ({
  generateVideo: (input: unknown) => generateVideo(input as never),
}))
vi.mock('../_lib/sessions.server', () => ({
  requireSession: vi.fn(() =>
    Promise.resolve({
      id: SESSION_ID,
      chat: { version: 1, character: 'A tired professor.', turns: [] },
      cut: { version: 2, clipIds: [CLIP_ID] },
    }),
  ),
  replaceChatClip: vi.fn(() => Promise.resolve({ id: SESSION_ID })),
  removeChatClip: vi.fn(),
  appendChatTurn: vi.fn(),
}))

beforeEach(() => {
  generateVideo.mockClear()
  row.description = PROMPT
  row.duration = '12'
})

describe('rerunning one burst (#688)', () => {
  it('times the re-roll from its own line, not from the row it replaces', async () => {
    const { duration } = await rerunChatClip(SESSION_ID, CLIP_ID)
    // Twenty words: 12s is 1.67 a second, which is what #685 exists to stop.
    expect(duration).toBe(8)
    expect(generateVideo).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 8, prompt: PROMPT }),
    )
  })

  it('shortens as readily as it lengthens, since the common case drags', async () => {
    row.duration = '5'
    expect((await rerunChatClip(SESSION_ID, CLIP_ID)).duration).toBe(8)
    row.duration = '15'
    expect((await rerunChatClip(SESSION_ID, CLIP_ID)).duration).toBe(8)
  })

  /* A clip generated before #688 says "Speaking to camera:" with no
     ", in English". Those are also the clips generated before #685 timed a
     burst at all, so they carry the very durations this fix exists to stop --
     a reader that missed the older spelling would do nothing for the sessions
     that need it most. */
  it('re-times a clip whose prompt predates "in English"', async () => {
    row.description = `A tired professor. A lecture hall. He leans on the lectern. Speaking to camera: "${LINE}"`
    expect((await rerunChatClip(SESSION_ID, CLIP_ID)).duration).toBe(8)
  })

  it('keeps a silent burst at its stored length, having nothing to time', async () => {
    row.description = composeClipPrompt(
      'A tired professor.',
      'A lecture hall.',
      'He leans on the lectern.',
      '',
    )
    row.duration = '12'
    expect((await rerunChatClip(SESSION_ID, CLIP_ID)).duration).toBe(12)
  })
})
