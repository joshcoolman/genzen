import { fal } from './fal-client.server'

/**
 * Ask FAL to stop a job whose row we are about to throw away (#369).
 *
 * Trashing a generating card used to soft-delete the row and leave the job
 * running: FAL finished it, billed for it, and the picture landed in Trash. The
 * click plainly means "I do not want this", and the only way to honour that is
 * to say so to the provider.
 *
 * **Best effort, and never fatal.** A cancel can lose its race -- the job may
 * already be rendering, or done -- and none of that changes what the click
 * asked for. So a failure here is logged and swallowed, and the caller deletes
 * the row either way. The cost of the race is a wasted generation, which is the
 * cost of not trying at all; the cost of throwing would be a card that will not
 * go away.
 */
export async function cancelFalRequest(
  requestId: string | null,
  metadata: Record<string, unknown> | null,
): Promise<void> {
  if (!requestId) return

  const meta = metadata ?? {}
  // The resolved endpoint, which is what the queue knows the job by. `model` is
  // the base id written at reserve and is not a queue address.
  const falModelId =
    (meta.fal_model_id as string | undefined) ??
    (meta.model as string | undefined)
  if (!falModelId) return

  try {
    await fal.queue.cancel(falModelId, { requestId })
  } catch (err) {
    console.error(
      `[fal-cancel] could not cancel ${requestId} on ${falModelId}:`,
      err instanceof Error ? err.message : err,
    )
  }
}
