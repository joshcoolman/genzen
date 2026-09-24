'use server'

import { exportEdit } from '../_lib/export.server'
import { idSchema } from '../_lib/types'
import { resolveAuth } from '#/lib/server/auth.server'

/** Cut the edit into one clip on the Video wall. Minutes, for a long cut. */
export async function exportToVideo(id: string) {
  return exportEdit((await resolveAuth()).userId, idSchema.parse(id))
}
