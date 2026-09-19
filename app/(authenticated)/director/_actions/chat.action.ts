'use server'

import { randomInt, randomUUID } from 'node:crypto'
import { generateVideo } from '../../video/_actions/generate-video.action'
import { genModel } from '../[id]/gen'
import {
  appendChatTurn,
  removeChatClip,
  replaceChatClip,
  requireSession,
} from '../_lib/sessions.server'
import { chatTurnSchema, idSchema } from '../_lib/types'
import {
  answerAsCharacter,
  composeClipPrompt,
  countWords,
  durationForWords,
} from '#/lib/server/director-chat.server'
import { spokenFromClipPrompt } from '#/lib/director-clip-prompt'
import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'

/** Every chat clip is vertical (#670): the format is fixed, not chosen. */
const CHAT_RATIO = '9:16'

/**
 * Ask the character a question (#670).
 *
 * Claude writes the answer as clip prompts; every clip is submitted at once,
 * text-to-video, each prompt carrying the whole character -- so a three-clip
 * answer waits one clip's time, and the seams are hard cuts a character talking
 * to camera survives. The turn is recorded with its clip ids before FAL has
 * answered, exactly as Add gen puts a placeholder in the run: the standard poll
 * settles the rows.
 *
 * Nothing waits on the previous answer. Continuity between turns is by
 * description, not by frame, which is what lets a question be asked while the
 * last answer is still rendering.
 */
export async function askCharacter(
  sessionId: string,
  question: string,
  /** Who should answer, in the person's words. Read on the first turn only;
   *  after that the character is pinned. */
  steer?: string | null,
) {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  if (!session.chat) throw new Error('This session is not a chat.')
  const asked = chatTurnSchema.shape.question.parse(question)

  const model = genModel()
  const first = session.chat.character === null
  /* One seed per session, chosen here on the first turn and pinned (#687).
     Same seed and near-identical prompts start every burst from the same
     noise, which is the one non-wording lever the endpoint has for keeping
     the picture -- and, if the audio shares the seed, the voice -- steady
     across clips generated apart. */
  const seed = session.chat.seed ?? randomInt(0, 2 ** 31)
  const answer = await answerAsCharacter({
    character: session.chat.character,
    steer: first ? steer : null,
    transcript: session.chat.turns.map((t) => ({
      question: t.question,
      line: t.line,
    })),
    question: asked,
    durations: model.durations,
  })

  /* Settled, not all-or-nothing: a submit that fails has already left a
     failed row in the library, and the ones that went through are being made
     and paid for. An answer with fewer clips than written still plays; only
     one with none is an error. */
  /* The stored character wins over the one the model wrote back: a later turn
     may paraphrase it, and the anchor is the one thing that must not drift. */
  const character = session.chat.character ?? answer.character
  const submitted = await Promise.allSettled(
    answer.clips.map((clip) =>
      generateVideo({
        prompt: composeClipPrompt(
          character,
          answer.scene,
          clip.action,
          clip.spoken,
        ),
        duration: clip.duration,
        aspectRatio: CHAT_RATIO,
        modelSlug: model.slug,
        origin: 'director',
        seed,
      }),
    ),
  )
  const clipIds = submitted.flatMap((s) =>
    s.status === 'fulfilled' ? [s.value.recordId] : [],
  )
  if (clipIds.length === 0) {
    const failed = submitted[0]
    throw failed.status === 'rejected' && failed.reason instanceof Error
      ? failed.reason
      : new Error('The answer could not be generated.')
  }

  return appendChatTurn(
    userId,
    session.id,
    {
      id: randomUUID(),
      question: asked,
      line: answer.line,
      clipIds,
      created_at: new Date().toISOString(),
    },
    answer.character,
    answer.title.trim().slice(0, 120) || undefined,
    first ? steer : null,
    seed,
  )
}

/** Drop one burst from a chat and trash it (#688). The line stays said. */
export async function dropChatClip(sessionId: string, clipId: string) {
  const { userId } = await resolveAuth()
  return removeChatClip(userId, idSchema.parse(sessionId), clipId)
}

/**
 * Make one burst again (#688), for the odd one that came out garbled.
 *
 * Same prompt, **a fresh seed for this burst only**: with the session's seed
 * pinned, the same words on the same seed are the same clip, so a re-roll has
 * to move the one thing that would change it. The rest of the session keeps
 * its seed. The new row takes the old one's place in the run and the turn; the
 * old row goes to Trash.
 *
 * Not the same length, though (#692). Submitting the stored `duration_seconds`
 * carried the replaced clip's number forward for good, and the oldest of those
 * predate #685 -- dealt out of the lineup in ascending order by clip position,
 * so a twenty-word line sat in twelve seconds and came back as the
 * language-shaped noise #685 exists to stop. The line is timed again here, and
 * it shortens as readily as it lengthens: a burst that drags is the common
 * complaint, and it is only a re-roll of a clip nobody liked.
 *
 * `normal`, because nothing records the turn's pace -- the chat holds
 * character, steer, seed and turns. It is the slower of the two on purpose:
 * too long is that noise, while slightly short merely clips the tail.
 */
export async function rerunChatClip(sessionId: string, clipId: string) {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  if (!session.chat) throw new Error('This session is not a chat.')
  if (!session.cut.clipIds.includes(idSchema.parse(clipId)))
    throw new Error('That clip is not in this chat.')
  const rows = await sql<
    Array<{ description: string | null; duration: string | null }>
  >`
    select description, generation_metadata->>'duration_seconds' as duration
    from user_images where id = ${clipId} and user_id = ${userId}
  `
  const row = rows.at(0)
  if (!row?.description) throw new Error('That clip has no prompt to rerun.')
  const model = genModel()
  const spoken = spokenFromClipPrompt(row.description)
  /* No spoken segment at all -- a silent burst -- keeps what it had: an empty
     word count would buy it the shortest duration in the lineup and cut the
     action short. `null`, not an empty string: the reader tells the two apart,
     and a clip whose prompt predates #688 says "Speaking to camera:" without
     ", in English" -- reading those as silent would leave exactly the oldest
     clips, the ones carrying the durations #685 stopped, on their old number. */
  const duration =
    spoken === null
      ? Number(row.duration) || model.defaultDuration
      : durationForWords(countWords(spoken), model.durations, 'normal')
  const { recordId } = await generateVideo({
    prompt: row.description,
    duration,
    aspectRatio: CHAT_RATIO,
    modelSlug: model.slug,
    origin: 'director',
    seed: randomInt(0, 2 ** 31),
  })
  const updated = await replaceChatClip(userId, session.id, clipId, recordId)
  return { session: updated, recordId, duration }
}
