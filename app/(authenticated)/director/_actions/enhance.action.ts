'use server'

import { enhanceSection } from '../_lib/enhance.server'
import { resolveAuth } from '#/lib/server/auth.server'

export async function enhanceDirection(
  id: string,
  index: number,
  prompt: string,
  duration: number,
) {
  return enhanceSection(
    (await resolveAuth()).userId,
    id,
    index,
    prompt,
    duration,
  )
}
