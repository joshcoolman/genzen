'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { resolveGenerationInputs } from '#/features/ai-images/server/generation-inputs.server'

/**
 * Everything needed to put a past generation back in the panel (#382).
 *
 * **This is not `planRetry`, and the three differences are the whole design.**
 * Both read `generation_metadata`, but a retry reproduces a request and this
 * fills a form:
 *
 * 1. **The prompt is the other one.** `planRetry` returns `sent_prompt ??
 *    prompt` -- the string FAL received, system-instructions preamble and all
 *    -- because a retry must reproduce the request exactly. Putting that in
 *    the textarea would show the preamble *and* prepend it again at submit.
 *    This wants `prompt`: what the user typed (#367).
 * 2. **It loads what it can rather than refusing.** `planRetry` throws
 *    `RetryNotReproducible` on a source it cannot replay, on the grounds that
 *    a partial request silently generates something else. That reasoning does
 *    not carry here: a panel is a starting point, not a submission. Whatever
 *    still resolves comes back and `missing` says what did not, so the user
 *    can re-attach or generate without it.
 * 3. **The model is deliberately absent.** The selection is the working
 *    context you are already in, not part of the thing being loaded --
 *    clobbering it throws away the deliberate half of the setup to restore the
 *    half you are about to change. Loading one generation and firing it at
 *    three models is the move this composes into.
 *
 * The images come from `resolveGenerationInputs`, the same resolver Activity
 * uses -- source first, then references, which is the order the panel held
 * them in and the order FAL received them (#380).
 */
export interface LoadedGeneration {
  /** What the user typed. Empty when the row has no prompt of its own. */
  prompt: string
  aspectRatio: string | null
  images: Array<{ id: string; title: string }>
  /**
   * How many of this generation's inputs could not be brought back -- trashed,
   * or destroyed outright. Reported rather than hidden: a set that silently
   * comes back one image short is a generation you would repeat wrongly.
   */
  missing: number
}

export async function loadGeneration(
  imageId: string,
): Promise<LoadedGeneration> {
  const { userId } = await resolveAuth()

  const row = first(
    await sql<Array<{ generation_metadata: Record<string, unknown> | null }>>`
      select generation_metadata from user_images
      where id = ${imageId} and user_id = ${userId}
    `,
  )

  if (!row) throw new Error('That generation is no longer in your library')

  const meta = row.generation_metadata ?? {}
  const inputs = await resolveGenerationInputs(meta, userId)

  // A trashed input is missing for this purpose even though Activity still
  // shows it: the panel is about what to send next, and Trash is where you put
  // things you did not want. Restoring it is a deliberate act, not something a
  // Load button should do on your behalf.
  const usable = inputs.filter((i) => !i.isDeleted && i.storagePath)

  return {
    prompt: typeof meta.prompt === 'string' ? meta.prompt : '',
    aspectRatio:
      typeof meta.aspect_ratio === 'string' ? meta.aspect_ratio : null,
    images: usable.map((i) => ({ id: i.id, title: i.title ?? 'Untitled' })),
    missing: inputs.length - usable.length,
  }
}
