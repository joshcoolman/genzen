'use server'

import { isReadRole } from '../ref-roles'
import type { ReadRole } from '../ref-roles'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { describeImage } from '#/lib/server/describe-image.server'
import {
  deriveLightingSetup,
  fillGels,
} from '#/lib/server/derive-lighting.server'
import { loadVisionImage } from '#/lib/server/vision-image.server'
import { requireAiRole } from '#/lib/server/ai.server'

/**
 * Read a staged reference for its role (#635): the text that goes with the
 * prompt in place of the picture.
 *
 * Called when the role is chosen, so the result is on screen before a submit
 * and cached on the thumbnail by the caller; the submit and Retry never call
 * this. Each role is an existing reader pointed at the strip:
 *
 * - `lighting` is Lighting's own derive with its gels filled in
 * - `style` is the Style describe mode
 * - `subject` is the Reconstruct describe mode
 *
 * Throws with no `ANTHROPIC_API_KEY` rather than returning nothing, per #365;
 * the thumbnail shows the message and the submit stays disabled until the role
 * is changed back or the picture removed.
 */
export async function readReference(data: {
  imageId: string
  role: ReadRole
}): Promise<{ text: string }> {
  const { userId } = await resolveAuth()
  if (!isReadRole(data.role)) throw new Error('Not a read role')

  if (data.role === 'lighting') {
    const derived = await deriveLightingSetup(userId, data.imageId)
    return { text: fillGels(derived.setup, derived.gels) }
  }

  requireAiRole('fast')
  if (!/^[0-9a-f-]{36}$/i.test(data.imageId)) throw new Error('Invalid imageId')
  const row = first(
    await sql<Array<{ storage_path: string | null }>>`
      select storage_path from user_images
      where id = ${data.imageId} and user_id = ${userId}
    `,
  )
  if (!row?.storage_path) throw new Error('Reference image not found')
  const image = await loadVisionImage(row.storage_path)
  if (!image) throw new Error('Could not read the reference image')

  const text = await describeImage(
    `data:${image.mediaType};base64,${image.data}`,
    data.role === 'style' ? 'style' : 'reconstruct',
  )
  if (!text) throw new Error('The model returned nothing for this image.')
  return { text }
}
