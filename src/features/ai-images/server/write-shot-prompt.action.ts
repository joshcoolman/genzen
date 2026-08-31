'use server'

import { generateText } from 'ai'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { createImageStorage } from '#/lib/image-storage'
import { findShot } from '#/lib/prompts/shots'
import sceneInstruction from '#/lib/prompts/shots/scene.md'
import shotInstruction from '#/lib/prompts/shots/shot.md'
import wholePromptInstruction from '#/lib/prompts/shots/enhance.md'

/**
 * The two vision passes behind Shots (#553).
 *
 * **The set drifted because sixteen different writers described it.** One
 * vision call per angle meant the lighting, palette and grade were re-derived
 * from the picture sixteen times, and two honest descriptions of one photograph
 * do not use the same words -- "overcast, cool" against "diffuse daylight,
 * slightly blue" renders as two different looks. Nothing made the scene text
 * identical between shots, so it never was. Josh saw it as colour and lighting
 * drift across an otherwise consistent set, which is exactly what it is.
 *
 * The fix is the art director's split: establish the scene once, direct each
 * shot on top of it. `writeShotScene` runs once per picture and `writeShot`
 * once per angle, and **the caller concatenates them** -- the scene block is
 * never handed back to a model to carry forward. A model told to reproduce a
 * paragraph verbatim paraphrases it, and a paraphrase is the drift returning
 * with better manners. Assembling in code makes the scene byte-identical across
 * every shot by construction rather than by request, which is the same reason
 * prose lives in `.md` and assembly lives in TypeScript (#322).
 *
 * `writeWholePrompt` is the one-pass version that shipped first: one call per
 * angle, writing scene and shot together. It is kept only as the comparison
 * behind the dialog's mode control. **Delete it and the control together once
 * the pictures have answered** -- a control that outlives its own question is
 * what Outpaint's model picker was, and it was removed for it.
 *
 * All three throw rather than falling back to something cheaper. #365 is the
 * precedent: with no `ANTHROPIC_API_KEY` a silent fallback generated at full
 * price against a placeholder prompt, forever.
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
  if (!out) throw new Error('The prompt writer returned nothing')
  return out
}

/** Pass one: the scene, written once and reused unchanged by every angle. */
export async function writeShotScene(data: {
  imageId: string
  instructions?: string
}) {
  const { userId } = await resolveAuth()
  requireAiRole('fast')
  const base64 = await loadImage(data.imageId, userId)
  const nudge = (data.instructions ?? '').trim()

  const scene = await write(
    sceneInstruction,
    base64,
    nudge ? `User instructions: ${nudge}` : 'Write the scene for this picture.',
  )
  return { scene }
}

/** Pass two: this frame's camera, framing and focus, and nothing else. */
export async function writeShot(data: {
  imageId: string
  shotId: string
  scene: string
  instructions?: string
}) {
  const { userId } = await resolveAuth()
  const shot = findShot(data.shotId)
  if (!shot) throw new Error(`Unknown shot "${data.shotId}"`)
  requireAiRole('fast')

  const base64 = await loadImage(data.imageId, userId)
  const nudge = (data.instructions ?? '').trim()
  const { default: description } = await shot.system()

  const written = await write(
    shotInstruction,
    base64,
    [
      `Established scene: ${data.scene.trim()}`,
      `Camera position: ${description.trim()}`,
      nudge && `User instructions: ${nudge}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  )
  return { prompt: `${data.scene.trim()}\n\n${written}` }
}

/** The one-pass baseline: scene and shot written together, per angle. */
export async function writeWholePrompt(data: {
  imageId: string
  shotId: string
  instructions?: string
}) {
  const { userId } = await resolveAuth()
  const shot = findShot(data.shotId)
  if (!shot) throw new Error(`Unknown shot "${data.shotId}"`)
  requireAiRole('fast')

  const base64 = await loadImage(data.imageId, userId)
  const nudge = (data.instructions ?? '').trim()
  const { default: description } = await shot.system()

  const prompt = await write(
    wholePromptInstruction,
    base64,
    [
      `Camera position: ${description.trim()}`,
      nudge && `User instructions: ${nudge}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  )
  return { prompt }
}
