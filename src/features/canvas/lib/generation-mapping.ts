/**
 * Pure mapping from ordered generation outcomes to canvas placeholder updates.
 *
 * This is the heart of the "no silent failures" guarantee: each submitted call
 * produces one outcome, in submit order, and `outcomes[i]` maps to
 * `placeholderIds[i]`. A success stamps the recordId + model (then gets polled);
 * a failure (submit rejected, no DB record) becomes a failed tile carrying the
 * model + error instead of being dropped. Extracting it keeps the positional
 * logic unit-testable, away from the React hook and server calls.
 *
 * NOTE: extracted for testing as part of canvas hardening; dedicated unit tests
 * are a pending follow-up (see canvas test suite).
 */

export interface GenerationOutcome {
  /** User-facing model id (for the on-canvas label). */
  model: string
  /** DB record id when the submit succeeded; null when it failed pre-insert. */
  recordId: string | null
  /** Failure reason when `recordId` is null. */
  error: string | null
}

/** One placeholder's resolution: either a tracked success or a failed tile. */
export interface PlaceholderUpdate {
  placeholderId: string
  model: string
  /** Set on success -- the placeholder becomes this record (then polled). */
  recordId?: string
  /** Set on failure -- the placeholder becomes a failed tile. */
  failed?: boolean
  errorMessage?: string
}

export interface MappedOutcomes {
  /** recordId -> placeholderId for the poll loop (successes only). */
  recordToPlaceholder: Map<string, string>
  /** recordIds to eagerly flag on_canvas (successes only). */
  onCanvasRecordIds: Array<string>
  /** Per-placeholder updates to apply to canvas state, keyed by placeholderId. */
  updates: Array<PlaceholderUpdate>
}

/**
 * Map outcomes onto placeholders by position. Outcomes beyond the placeholder
 * list are ignored by the caller (which appends extra placeholders first);
 * placeholders beyond the outcomes list are left untouched.
 */
export function mapOutcomesToPlaceholders(
  outcomes: Array<GenerationOutcome>,
  placeholderIds: Array<string>,
): MappedOutcomes {
  const recordToPlaceholder = new Map<string, string>()
  const onCanvasRecordIds: Array<string> = []
  const updates: Array<PlaceholderUpdate> = []

  outcomes.forEach((o, i) => {
    const placeholderId = placeholderIds[i]
    if (!placeholderId) return
    if (o.recordId) {
      recordToPlaceholder.set(o.recordId, placeholderId)
      onCanvasRecordIds.push(o.recordId)
      updates.push({ placeholderId, recordId: o.recordId, model: o.model })
    } else {
      updates.push({
        placeholderId,
        model: o.model,
        failed: true,
        errorMessage: o.error ?? 'Submission failed',
      })
    }
  })

  return { recordToPlaceholder, onCanvasRecordIds, updates }
}
