'use server'

import {
  beginGeneration,
  dismissGeneration,
  recoverGeneration,
} from '../_lib/generation.server'
import { resolveAuth } from '#/lib/server/auth.server'

export async function startClip(
  id: string,
  revision: number,
  requestId: string,
  prompt: string,
  replace: number | null,
  duration?: number,
) {
  return beginGeneration(
    (await resolveAuth()).userId,
    id,
    revision,
    requestId,
    prompt,
    replace,
    duration,
  )
}
export async function pollClip(id: string) {
  return recoverGeneration((await resolveAuth()).userId, id)
}
export async function dismissClip(id: string, revision: number) {
  return dismissGeneration((await resolveAuth()).userId, id, revision)
}
