/**
 * Structured FAL error blob persisted into user_images.generation_metadata.error.
 * Mirror of the human-readable message goes into user_images.generation_error.
 */
export interface FalErrorBlob {
  status: 'failed'
  code: string
  message: string
  fal_request_id?: string
  failed_at: string
  stage: 'submit' | 'queue'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object')
    return value as Record<string, unknown>
  return null
}

function extractDetailMessages(detail: unknown): Array<string> {
  if (!Array.isArray(detail)) return []
  const out: Array<string> = []
  for (const entry of detail) {
    const record = asRecord(entry)
    if (record && typeof record.msg === 'string') {
      out.push(record.msg)
    }
  }
  return out
}

/**
 * A thrown value as a sentence, following `.cause` down.
 *
 * Node's `fetch` reports every network failure as the single word pair "fetch
 * failed" and puts the actual reason -- `ECONNRESET`, `ETIMEDOUT`, a TLS
 * error -- on `cause`. Reading only `.message` therefore turns every one of
 * them into the same useless string, which is what `generation_error` held for
 * three failed generations in #556 and what made them unanswerable.
 *
 * Depth is capped because an `AggregateError` chain can be long, and this ends
 * up in a column and on a card.
 */
export function describeThrown(err: unknown, depth = 3): string {
  const parts: Array<string> = []
  let current: unknown = err
  for (let i = 0; i <= depth && current; i++) {
    const record = asRecord(current)
    const message =
      record && typeof record.message === 'string' && record.message
        ? record.message
        : typeof current === 'string'
          ? current
          : null
    const code = record && typeof record.code === 'string' ? record.code : null
    const part = [message, code && code !== message ? `(${code})` : null]
      .filter(Boolean)
      .join(' ')
    if (part && !parts.includes(part)) parts.push(part)
    current = record?.cause
  }
  return parts.join(': ') || 'unknown error'
}

/**
 * Walks an unknown thrown value (typically a FAL SDK error) and produces a
 * structured blob with the most specific human-readable message we can find.
 *
 * Fallback chain: body.detail[].msg → body.detail (string) → body.message
 *   → body.error → err.message → 'FAL request failed'.
 */
export function extractFalError(err: unknown): FalErrorBlob {
  const failed_at = new Date().toISOString()
  const blob: FalErrorBlob = {
    status: 'failed',
    code: 'unknown',
    message: 'FAL request failed',
    failed_at,
    stage: 'submit',
  }

  if (!err) return blob

  const errObj = asRecord(err)
  if (!errObj) {
    if (typeof err === 'string') blob.message = err
    return blob
  }

  const status = errObj.status
  if (typeof status === 'number') {
    blob.code = `fal_${status}`
  }

  const requestId = errObj.request_id ?? errObj.requestId
  if (typeof requestId === 'string') {
    blob.fal_request_id = requestId
  }

  // FAL SDK surfaces the HTTP body on the error as `body` (sometimes `response`).
  const body =
    asRecord(errObj.body) ??
    asRecord((asRecord(errObj.response) ?? {}).body) ??
    null

  if (body) {
    const detailMsgs = extractDetailMessages(body.detail)
    if (detailMsgs.length > 0) {
      blob.message = detailMsgs.join('; ')
      return blob
    }
    if (typeof body.detail === 'string') {
      blob.message = body.detail
      return blob
    }
    if (typeof body.message === 'string') {
      blob.message = body.message
      return blob
    }
    if (typeof body.error === 'string') {
      blob.message = body.error
      return blob
    }
  }

  if (err instanceof Error && err.message) {
    // The cause chain, not just the message -- see describeThrown.
    blob.message = describeThrown(err)
    const causeCode = asRecord(errObj.cause)?.code
    if (blob.code === 'unknown' && typeof causeCode === 'string') {
      blob.code = causeCode
    }
    return blob
  }

  if (typeof errObj.message === 'string') {
    blob.message = errObj.message
  }

  return blob
}
