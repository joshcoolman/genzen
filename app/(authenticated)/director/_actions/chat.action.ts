'use server'

import { randomUUID } from 'node:crypto'
import { generateVideo } from '../../video/_actions/generate-video.action'
import { genModel } from '../[id]/gen'
import { appendChatTurn, requireSession } from '../_lib/sessions.server'
import { chatTurnSchema, idSchema } from '../_lib/types'
import {
  answerAsCharacter,
  composeClipPrompt,
} from '#/lib/server/director-chat.server'
import { resolveAuth } from '#/lib/server/auth.server'

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
export async function askCharacter(sessionId: string, question: string) {
  const { userId } = await resolveAuth()
  const session = await requireSession(userId, idSchema.parse(sessionId))
  if (!session.chat) throw new Error('This session is not a chat.')
  const asked = chatTurnSchema.shape.question.parse(question)

  const model = genModel()
  const answer = await answerAsCharacter({
    character: session.chat.character,
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
  )
}
