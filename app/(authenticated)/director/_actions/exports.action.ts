'use server'

import { deleteExport, listExports, renameExport } from '../_lib/exports.server'
import { idSchema } from '../_lib/types'
import { resolveAuth } from '#/lib/server/auth.server'

export async function loadExports(sessionId: string) {
  return listExports((await resolveAuth()).userId, idSchema.parse(sessionId))
}
export async function changeExportName(
  sessionId: string,
  id: string,
  name: string,
) {
  await renameExport(
    (await resolveAuth()).userId,
    idSchema.parse(sessionId),
    idSchema.parse(id),
    name,
  )
}
export async function removeExport(sessionId: string, id: string) {
  await deleteExport(
    (await resolveAuth()).userId,
    idSchema.parse(sessionId),
    idSchema.parse(id),
  )
}
