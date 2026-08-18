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
    blob.message = err.message
    return blob
  }

  if (typeof errObj.message === 'string') {
    blob.message = errObj.message
  }

  return blob
}
