'use server'

import { slugify } from '../effect-file'
import { resolveAuth } from '#/lib/server/auth.server'
import { deriveLightingSetup } from '#/lib/server/derive-lighting.server'

/**
 * Pass one of #562: a reference photograph in, a lighting setup out.
 *
 * The reading itself is `derive-lighting.server.ts`, shared with the Lighting
 * role on a staged reference (#635). This action adds only what the lab
 * needs: the slug that would be the effect's filename.
 */

export interface DerivedEffect {
  /** Slug, and the filename the effect would get. */
  id: string
  name: string
  setup: string
  gels: Array<{ token: string; color: string }>
}

export async function deriveLightingEffect(data: {
  imageId: string
}): Promise<DerivedEffect> {
  const { userId } = await resolveAuth()
  const derived = await deriveLightingSetup(userId, data.imageId)
  return { id: slugify(derived.name), ...derived }
}
