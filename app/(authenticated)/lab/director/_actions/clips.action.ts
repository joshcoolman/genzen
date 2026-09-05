'use server'

import { ENDPOINTS, clipRequestSchema } from '../clips'
import { readReceipt, signReceipt } from '../clip-jobs.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { fal } from '#/lib/server/fal-client.server'
import { uploadBufferToFal } from '#/lib/server/fal-image-upload.server'
import { assertFalKey } from '#/lib/server/fal-key.server'
import rules from '#/lib/prompts/director-clips.md'

function localOnly() {
  if (process.env.NODE_ENV !== 'development')
    throw new Error('Clip brainstorming is a local Lab experiment.')
}

export async function submitClip(data: FormData) {
  const { userId } = await resolveAuth()
  localOnly()
  assertFalKey()
  const request = clipRequestSchema.parse(
    JSON.parse(String(data.get('request'))),
  )
  const frame = data.get('frame')
  if (
    frame !== null &&
    (!(frame instanceof File) ||
      !frame.size ||
      frame.size > 15 * 1024 * 1024 ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(frame.type))
  )
    throw new Error(
      'The starting frame must be a JPEG, PNG or WebP under 15 MB.',
    )
  const imageUrl =
    frame instanceof File
      ? await uploadBufferToFal(await frame.arrayBuffer())
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
  localOnly()
  const receipt = readReceipt(token, userId)
  const status = await fal.queue.status(ENDPOINTS[receipt.model], {
    requestId: receipt.requestId,
    logs: false,
  })
  return status.status
}
