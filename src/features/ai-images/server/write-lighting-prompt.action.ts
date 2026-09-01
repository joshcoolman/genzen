'use server'

import { generateText } from 'ai'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { createImageStorage } from '#/lib/image-storage'
import { findLightingEffect } from '#/lib/prompts/lighting'
import subjectInstruction from '#/lib/prompts/lighting/subject.md'
import applyInstruction from '#/lib/prompts/lighting/apply.md'
import wrapper from '#/lib/prompts/lighting/wrapper.md'

/**
 * The two vision passes behind Lighting (#563).
 *
 * **This started with no writer at all**, on the reasoning that a lighting
 * effect is a complete, self-contained description of light and the editing
 * model can already see the picture. It works on portraits and fails on
 * everything else: the effects were written from portrait sessions and named a
 * cheek, an ear, a neck. Sent against a photograph of a truck, the model cannot
 * resolve any of that, drops the subject clause and renders the only half it
 * can -- the background split, with the vehicle left its original colour.
 *
 * The failure is not that the model cannot find the truck's surfaces. It is
 * that it was told about surfaces the truck does not have. So the fix is not
 * vaguer prose -- "the side that turns away" is weaker steering than "the near
 * cheek", and weaker steering is what produced a background swap in the first
 * place. It is to keep the prose concrete and make *this picture* supply the
 * nouns.
 *
 * Which is the split Shots arrived at over six sessions, by the same road: no
 * writer, then one call, then two. `write-shot-prompt.action.ts` records where
 * that ends up, and its reasoning is load-bearing here rather than merely
 * similar -- do not re-derive it.
 *
 * **The split is different from Shots', though the shape is identical.** Shots
 * writes a *scene* once because sixteen frames of one subject have to agree
 * with each other. Lighting writes a *surface inventory* once because an effect
 * is written for any subject and has to be bound to this one. Same benefit as a
 * side effect: two effects picked at once describe the same truck in the same
 * words, so what differs between the two pictures is the light and nothing
 * else.
 *
 * **The caller concatenates, as in Shots.** `wrapper.md` is prepended in code
 * and never handed to a model to carry forward, so "keep the subject, the pose,
 * the framing and the identity" is byte-identical in every prompt by
 * construction rather than by request. A model asked to reproduce a clause
 * verbatim paraphrases it, and a paraphrased instruction to change nothing is
 * an instruction to change something.
 *
 * Both throw rather than falling back to the effect text alone. That fallback
 * is exactly the version this replaced, and it fails silently -- a picture
 * comes back, it is simply the wrong one. #365 is the precedent.
 */

async function loadImage(imageId: string, userId: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(imageId)) throw new Error('Invalid imageId')

  const row = first(
    await sql<Array<{ storage_path: string | null }>>`
      select storage_path from user_images
      where id = ${imageId} and user_id = ${userId}
    `,
  )
  if (!row?.storage_path) throw new Error('Image not found')

  // Bytes, not a URL: since #226 the only URL is an authenticated app route,
  // and this call is already server-side with bucket credentials in hand.
  const blob = await createImageStorage().download(row.storage_path)
  return Buffer.from(await blob.arrayBuffer()).toString('base64')
}

async function write(
  system: string,
  base64: string,
  text: string,
): Promise<string> {
  const { text: written } = await generateText({
    model: ai.fast,
    system,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: `data:image/jpeg;base64,${base64}` },
          { type: 'text', text },
        ],
      },
    ],
  })
  const out = written.trim()
  if (!out) throw new Error('The lighting writer returned nothing')
  return out
}

/** Pass one: what is in the picture, written once and reused by every effect. */
export async function writeLightingSubject(data: { imageId: string }) {
  const { userId } = await resolveAuth()
  requireAiRole('fast')
  const base64 = await loadImage(data.imageId, userId)

  const subject = await write(
    subjectInstruction,
    base64,
    'Inventory the subject of this picture.',
  )
  return { subject }
}

/** Pass two: one effect, aimed at the surfaces pass one named. */
export async function writeLighting(data: {
  imageId: string
  effectId: string
  subject: string
}) {
  const { userId } = await resolveAuth()
  const effect = findLightingEffect(data.effectId)
  if (!effect) throw new Error(`Unknown lighting effect "${data.effectId}"`)
  requireAiRole('fast')

  const base64 = await loadImage(data.imageId, userId)
  const { default: description } = await effect.system()

  const written = await write(
    applyInstruction,
    base64,
    [
      `The subject: ${data.subject.trim()}`,
      `The lighting setup: ${description.trim()}`,
    ].join('\n\n'),
  )
  return { prompt: `${wrapper.trim()}\n\n${written}` }
}
