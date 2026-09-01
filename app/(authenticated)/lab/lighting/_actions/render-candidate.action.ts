'use server'

import { buildFalInput } from '#/features/ai-images/server/fal-params.server'
import { composeLightingPrompt } from '#/features/ai-images/lighting'
import { endpointFor } from '#/features/ai-images/models'
import { resolveAuth } from '#/lib/server/auth.server'
import { assertFalKey } from '#/lib/server/fal-key.server'
import { fal } from '#/lib/server/fal-client.server'
import { uploadLibraryImageToFal } from '#/lib/server/fal-image-inputs.server'
import { withNetworkRetry } from '#/lib/server/fal-retry.server'
import { describeThrown } from '#/lib/server/fal-error.server'

/**
 * One candidate: the test subject, relit by a setup that is not an effect yet
 * (#562).
 *
 * **It waits, and it stores nothing.** Every other generation in the app
 * reserves a `user_images` row, submits to the queue and is reconciled by
 * polling, so it survives a reload and lands in Activity. This one does none of
 * that on purpose. A judging grid is thrown away: four candidates per attempt,
 * several attempts per effect, and every one of them would otherwise be a card
 * on the wall to go and delete. The cost of that is real and worth naming --
 * these runs do not appear in Activity -- which is why the page prints the
 * estimate before the press rather than after.
 *
 * **The prompt goes through `composeLightingPrompt`, the same assembly the
 * shipped dialog uses.** Wrapper, blank line, setup with its gels filled in. A
 * candidate built any other way tests a string the effect will never send, and
 * would pass while the effect fails.
 */
export async function renderLightingCandidate(data: {
  /** A library row, used as the source image to relight. */
  subjectImageId: string
  /** The setup prose, gels still as `{TOKEN}`s. */
  setup: string
  gels: Array<{ token: string; color: string }>
  /** A picker id from the panel's lineup. */
  modelId: string
}): Promise<{ url: string }> {
  const { userId } = await resolveAuth()
  assertFalKey()

  const prompt = composeLightingPrompt(
    data.setup,
    Object.fromEntries(data.gels.map((g) => [g.token, g.color])),
    'candidate',
  )

  const uploaded = await uploadLibraryImageToFal(data.subjectImageId, userId)
  if (!uploaded) throw new Error('Test subject not found')

  const endpoint = endpointFor(data.modelId, true)
  const { input } = await buildFalInput({
    modelId: endpoint,
    prompt,
    imageUrls: [uploaded],
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
    throw new Error(describeThrown(err) || 'The candidate failed')
  }
}
