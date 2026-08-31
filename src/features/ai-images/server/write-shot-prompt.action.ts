'use server'

import { generateText } from 'ai'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { ai, requireAiRole } from '#/lib/server/ai.server'
import { createImageStorage } from '#/lib/image-storage'
import { findShot } from '#/lib/prompts/shots'
import shotEnhanceInstruction from '#/lib/prompts/shots/enhance.md'

interface WriteShotPromptInput {
  imageId: string
  shotId: string
  instructions?: string
}

/**
 * The long path behind Shots' `Enhance` (#553): a vision model looks at the
 * picture and writes the prompt FAL is then given.
 *
 * **Why there are two paths at all.** The short one sends the angle
 * description straight to FAL, which is what the sixteen were proven with. Its
 * limit is that the image model is told to hold a subject it has never been
 * told anything about -- the instruction "keep everything unchanged" names
 * nothing. This path replaces that with an inventory of what is actually in
 * the frame, which is the thing a written prompt can carry and a bare angle
 * cannot. Which one wins is what the checkbox exists to find out; do not
 * delete either until the pictures have answered.
 *
 * **One call per image-and-angle pair, not one per image.** An inventory
 * written for a worm's-eye shot and an inventory written for a macro detail
 * are not the same paragraph -- the second has to know which feature is about
 * to fill the frame. Reusing one description across sixteen angles would be
 * cheaper and would make every angle read like the reference.
 *
 * **It throws rather than falling back to the short path.** A silent fallback
 * is what #365 cost: with no `ANTHROPIC_API_KEY` every image-only generation
 * quietly generated at full price against a placeholder prompt. `Enhance` is
 * checked or it is not, and a run that could not enhance says so.
 */
export async function writeShotPrompt(data: WriteShotPromptInput) {
  const { userId } = await resolveAuth()

  const shot = findShot(data.shotId)
  if (!shot) throw new Error(`Unknown shot "${data.shotId}"`)

  if (!/^[0-9a-f-]{36}$/i.test(data.imageId)) {
    throw new Error('Invalid imageId')
  }

  const row = first(
    await sql<Array<{ storage_path: string | null }>>`
      select storage_path from user_images
      where id = ${data.imageId} and user_id = ${userId}
    `,
  )
  if (!row?.storage_path) throw new Error('Image not found')

  requireAiRole('fast')

  // Bytes, not a URL: since #226 the only URL is an authenticated app route,
  // and this call is already server-side with bucket credentials in hand.
  const blob = await createImageStorage().download(row.storage_path)
  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

  const nudge = (data.instructions ?? '').trim()
  const { default: description } = await shot.system()

  const { text } = await generateText({
    model: ai.fast,
    system: shotEnhanceInstruction,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: `data:image/jpeg;base64,${base64}` },
          {
            type: 'text',
            text: [
              `Camera position: ${description.trim()}`,
              nudge && `User instructions: ${nudge}`,
            ]
              .filter(Boolean)
              .join('\n\n'),
          },
        ],
      },
    ],
  })

  const prompt = text.trim()
  if (!prompt) throw new Error('The prompt writer returned nothing')
  return { prompt }
}
