'use server'

import { ENDPOINTS, clipRequestSchema } from '../clips'
import { readReceipt, signReceipt } from '../clip-jobs.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { fal } from '#/lib/server/fal-client.server'
import { uploadBufferToFal } from '#/lib/server/fal-image-upload.server'
import { assertFalKey } from '#/lib/server/fal-key.server'
import rules from '#/lib/prompts/director-clips.md'

export async function submitClip(data: FormData) {
  const { userId } = await resolveAuth()
  assertFalKey()
  const request = clipRequestSchema.parse(
    JSON.parse(String(data.get('request'))),
  )
  const check = (value: FormDataEntryValue | null, what: string) => {
    if (value === null) return null
    if (
      !(value instanceof File) ||
      !value.size ||
      value.size > 15 * 1024 * 1024 ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(value.type)
    )
      throw new Error(`The ${what} must be a JPEG, PNG or WebP under 15 MB.`)
    return value
  }
  const frame = check(data.get('frame'), 'starting frame')
  const tail = check(data.get('tail'), 'ending frame')
  const imageUrl = frame
    ? await uploadBufferToFal(await frame.arrayBuffer())
    : undefined
  // Both H3 Max endpoints take `end_image_url` beside the first frame
  // (verified against fal's schema, 2026-09-13). It is what pins a replaced
  // middle section to the frame the next section opens on.
  const endImageUrl = tail
    ? await uploadBufferToFal(await tail.arrayBuffer())
    : undefined
  const prompt = [
    rules,
    'Prior directions:',
    ...request.context.map((text, index) => `${index + 1}. ${text}`),
    'Latest direction:',
    request.prompt,
  ].join('\n\n')
  if (prompt.length > 50000)
    throw new Error('Scene context is too long. Start a new cut.')
  const result = await fal.queue.submit(ENDPOINTS[request.settings.model], {
    input: {
      prompt,
      duration: request.settings.duration,
      resolution: request.settings.resolution,
      prompt_expansion_mode: 'balanced',
      enable_safety_checker: true,
      ...(imageUrl ? { image_url: imageUrl } : {}),
      ...(endImageUrl ? { end_image_url: endImageUrl } : {}),
    },
  })
  return signReceipt({
    owner: userId,
    requestId: result.request_id,
    model: request.settings.model,
  })
}

export async function checkClip(token: string) {
  const { userId } = await resolveAuth()
  const receipt = readReceipt(token, userId)
  const status = await fal.queue.status(ENDPOINTS[receipt.model], {
    requestId: receipt.requestId,
    logs: false,
  })
  return status.status
}
