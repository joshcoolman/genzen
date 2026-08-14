/**
 * "1 of 5 images" -- what a row says about references it could not use (#341).
 *
 * The panel stopped enforcing model limits, so a generation can be given more
 * images than its endpoint holds. The extras are dropped at submit and the two
 * counts are written to `generation_metadata`, only when they disagree: a
 * normal generation carries neither, and this returns null for it, so the note
 * appears exactly when something was actually dropped.
 *
 * Read off the row rather than re-derived from the model's current capacity.
 * The row is what happened; a capacity edited afterwards would rewrite history.
 */
export function refUsageNote(
  metadata?: { images_used?: number; images_requested?: number } | null,
): string | null {
  const used = metadata?.images_used
  const requested = metadata?.images_requested
  if (used === undefined || requested === undefined) return null
  if (requested <= used) return null
  return `${used} of ${requested} images`
}
