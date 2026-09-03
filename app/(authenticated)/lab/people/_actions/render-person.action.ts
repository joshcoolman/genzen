'use server'

import { buildFalInput } from '#/features/ai-images/server/fal-params.server'
import { endpointFor } from '#/features/ai-images/models'
import studio from '#/lib/prompts/people/studio.md'
import { resolveAuth } from '#/lib/server/auth.server'
import { assertFalKey } from '#/lib/server/fal-key.server'
import { fal } from '#/lib/server/fal-client.server'
import { withNetworkRetry } from '#/lib/server/fal-retry.server'
import { describeThrown } from '#/lib/server/fal-error.server'

/** 4:5, the headshot standard, and not a control. Crop distance is what makes
 *  a set read as one shoot; the ratio only makes the grid tidy. */
const ASPECT_RATIO = '4:5'

/**
 * One person: the fixed studio clause, then their paragraph (#578).
 *
 * **It waits, and it stores nothing**, exactly as the lighting lab's candidate
 * render does. A board of thirty is mostly rejects, and rows reserved for those
 * are rows to go and delete afterwards. Keep is the write.
 *
 * **The clause is prepended here rather than written into each spec**, so every
 * tile on the board was shot in the same room no matter which press or which
 * model made it. The writer is told never to mention lighting, background,
 * framing, camera or wardrobe for the same reason.
 */
export async function renderPerson(data: {
  /** One person's paragraph, from `writeCast`. */
  spec: string
  /** A picker id from `PEOPLE_MODELS`. */
  modelId: string
}): Promise<{ url: string }> {
  await resolveAuth()
  assertFalKey()

  const spec = data.spec.trim()
  if (!spec) throw new Error('No person to render')

  const endpoint = endpointFor(data.modelId, false)
  const { input } = await buildFalInput({
    modelId: endpoint,
    prompt: `${studio.trim()}\n\nThe person: ${spec}`,
    aspectRatio: ASPECT_RATIO,
    safetyLevel: 'permissive',
  })

  try {
    const result = await withNetworkRetry<{
      data?: { images?: Array<{ url?: string }> }
    }>('subscribe', () =>
      (fal.subscribe as any)(endpoint, { input, logs: false }),
    )
    const url = result.data?.images?.[0]?.url
    if (!url) throw new Error('The model returned no image')
    return { url }
  } catch (err) {
    throw new Error(describeThrown(err) || 'That one failed')
  }
}
