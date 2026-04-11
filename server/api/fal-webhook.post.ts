import crypto from 'node:crypto'
import {
  defineEventHandler,
  getHeader,
  readRawBody,
  setResponseStatus,
} from 'h3'
import type { Tables } from '@/lib/types/supabase'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'
import {
  markGenerationFailedWithBlob,
  processImageResult,
  processVideoResult,
} from '@/lib/server/fal-completion.server'
import { extractFalError } from '@/lib/server/fal-error.server'

interface FalWebhookBody {
  request_id: string
  status: string
  payload?: Record<string, unknown>
  error?: string
}

type WebhookRecord = Pick<Tables<'user_images'>, 'id' | 'user_id' | 'source'>

// --- ED25519 JWKS signature verification per FAL docs ---

const JWKS_URL = 'https://rest.fal.ai/.well-known/jwks.json'
const JWKS_CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
let jwksCache: Array<{ x: string }> | null = null
let jwksCacheTime = 0
let jwksConsecutiveFailures = 0
const JWKS_MAX_CONSECUTIVE_FAILURES = 3

async function fetchJwks(): Promise<Array<{ x: string }>> {
  const now = Date.now()
  if (jwksCache && now - jwksCacheTime < JWKS_CACHE_DURATION) {
    return jwksCache
  }
  const response = await fetch(JWKS_URL, { signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`)
  const data = (await response.json()) as { keys?: Array<{ x: string }> }
  jwksCache = data.keys ?? []
  jwksCacheTime = now
  jwksConsecutiveFailures = 0
  return jwksCache
}

async function verifyFalWebhookSignature(
  rawBody: string,
  requestId: string,
  userId: string,
  timestamp: string,
  signatureHex: string,
): Promise<boolean> {
  // Validate timestamp (within +/- 5 minutes)
  const timestampInt = parseInt(timestamp, 10)
  if (isNaN(timestampInt)) return false
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestampInt) > 300) return false

  // Construct message: requestId\nuserId\ntimestamp\nsha256(body)
  const bodyHash = crypto
    .createHash('sha256')
    .update(Buffer.from(rawBody, 'utf-8'))
    .digest('hex')
  const message = `${requestId}\n${userId}\n${timestamp}\n${bodyHash}`
  const messageBytes = Buffer.from(message, 'utf-8')

  // Decode signature from hex
  let signatureBytes: Buffer
  try {
    signatureBytes = Buffer.from(signatureHex, 'hex')
  } catch {
    return false
  }

  // Fetch JWKS and try each key
  const keys = await fetchJwks()
  for (const key of keys) {
    if (typeof key.x !== 'string') continue
    try {
      const publicKeyBytes = Buffer.from(key.x, 'base64url')
      const keyObject = crypto.createPublicKey({
        key: Buffer.concat([
          // ED25519 DER prefix (RFC 8410)
          Buffer.from('302a300506032b6570032100', 'hex'),
          publicKeyBytes,
        ]),
        format: 'der',
        type: 'spki',
      })
      const valid = crypto.verify(null, messageBytes, keyObject, signatureBytes)
      if (valid) return true
    } catch {
      continue
    }
  }
  return false
}

export default defineEventHandler(async (event) => {
  const rawBody = (await readRawBody(event)) ?? ''

  // Extract FAL webhook signature headers
  const webhookRequestId = getHeader(event, 'x-fal-webhook-request-id') ?? ''
  const webhookUserId = getHeader(event, 'x-fal-webhook-user-id') ?? ''
  const webhookTimestamp = getHeader(event, 'x-fal-webhook-timestamp') ?? ''
  const webhookSignature = getHeader(event, 'x-fal-webhook-signature') ?? ''

  // Verify signature if all headers are present
  if (webhookRequestId && webhookSignature) {
    try {
      const valid = await verifyFalWebhookSignature(
        rawBody,
        webhookRequestId,
        webhookUserId,
        webhookTimestamp,
        webhookSignature,
      )
      if (!valid) {
        console.warn('[fal-webhook] ED25519 signature verification failed')
        setResponseStatus(event, 401)
        return 'Unauthorized'
      }
    } catch (err) {
      jwksConsecutiveFailures++
      console.warn(
        `[fal-webhook] Signature verification error (consecutive failures: ${jwksConsecutiveFailures}):`,
        err,
      )
      if (jwksConsecutiveFailures >= JWKS_MAX_CONSECUTIVE_FAILURES) {
        console.warn(
          '[fal-webhook] Rejecting webhook: JWKS failure threshold exceeded',
        )
        setResponseStatus(event, 401)
        return 'Unauthorized'
      }
    }
  }

  let body: FalWebhookBody
  try {
    body = JSON.parse(rawBody) as FalWebhookBody
  } catch {
    setResponseStatus(event, 400)
    return 'Bad Request'
  }

  const { request_id, status, payload, error } = body

  console.log(
    `[fal-webhook] Received: request_id=${request_id} status=${status}`,
  )

  if (!request_id) {
    setResponseStatus(event, 400)
    return 'Bad Request: missing request_id'
  }

  const supabase = getSupabaseAdmin()

  const result = await supabase
    .from('user_images')
    .select('id, user_id, source')
    .eq('request_id', request_id)
    .maybeSingle()

  if (result.error) {
    console.error(
      `[fal-webhook] DB query failed for request_id=${request_id}: ${result.error.message} (code=${result.error.code})`,
    )
    setResponseStatus(event, 500)
    return 'Internal Server Error'
  }

  const record = result.data as WebhookRecord | null
  if (!record) {
    console.warn(`[fal-webhook] No record found for request_id=${request_id}`)
    return 'OK'
  }

  try {
    // FAL webhooks send status "OK" for success (not "COMPLETED" like the queue API)
    if ((status === 'OK' || status === 'COMPLETED') && payload) {
      const isVideo = record.source === 'ai_video'
      if (isVideo) {
        await processVideoResult(supabase, record.id, payload)
      } else {
        await processImageResult(supabase, record.id, record.user_id, payload)
      }
      console.log(`[fal-webhook] Processed successfully: record=${record.id}`)
    } else if (status === 'FAILED' || status === 'ERROR') {
      // FAL surfaces failure detail inconsistently — sometimes as a top-level
      // error string, sometimes inside payload.detail[].msg. Hand both to the
      // extractor and let it pick the most specific message.
      const source =
        payload ?? (typeof error === 'string' ? { message: error } : error)
      const blob = extractFalError(source ?? null)
      blob.stage = 'webhook'
      if (blob.code === 'unknown') blob.code = 'fal_webhook'
      blob.fal_request_id ??= request_id
      await markGenerationFailedWithBlob(supabase, record.id, blob)
      console.log(
        `[fal-webhook] Marked failed: record=${record.id} error=${blob.message}`,
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(
      `[fal-webhook] Processing failed for record=${record.id}: ${msg}`,
    )
    // Return 200 to prevent FAL from retrying — error is logged
  }

  return 'OK'
})
