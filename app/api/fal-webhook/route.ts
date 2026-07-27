import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import type { Tables } from '@/lib/types/supabase'
import { first, sql } from '@/lib/server/db.server'
import {
  markGenerationFailedWithBlob,
  processImageResult,
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

export async function POST(request: Request) {
  // The raw text, not a parsed body: the signature is computed over the exact
  // bytes FAL sent, so any re-serialisation would invalidate it.
  const rawBody = await request.text()

  // Extract FAL webhook signature headers
  const webhookRequestId = request.headers.get('x-fal-webhook-request-id') ?? ''
  const webhookUserId = request.headers.get('x-fal-webhook-user-id') ?? ''
  const webhookTimestamp = request.headers.get('x-fal-webhook-timestamp') ?? ''
  const webhookSignature = request.headers.get('x-fal-webhook-signature') ?? ''

  // Verify signature if all headers are present
  let signatureVerified = false
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
        return new NextResponse('Unauthorized', { status: 401 })
      }
      signatureVerified = true
    } catch (err) {
      jwksConsecutiveFailures++
      console.warn(
        `[fal-webhook] Signature verification error (consecutive failures: ${jwksConsecutiveFailures}):`,
        err,
      )
      if (jwksConsecutiveFailures >= JWKS_MAX_CONSECUTIVE_FAILURES) {
        // Invalidate cache so the next request forces a fresh JWKS fetch.
        // Without this, a 24h warm cache means the counter never resets
        // even after the FAL API recovers.
        jwksCache = null
        jwksCacheTime = 0
        console.warn(
          '[fal-webhook] Rejecting webhook: JWKS failure threshold exceeded; cache invalidated for retry',
        )
        return new NextResponse('Unauthorized', { status: 401 })
      }
    }
  }

  // Reset consecutive-failure counter after a successful verification pass.
  // This allows recovery after a transient FAL JWKS outage.
  if (signatureVerified && jwksConsecutiveFailures > 0) {
    console.log(
      '[fal-webhook] JWKS verification recovered; resetting failure counter',
    )
    jwksConsecutiveFailures = 0
  }

  let body: FalWebhookBody
  try {
    body = JSON.parse(rawBody) as FalWebhookBody
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const { request_id, status, payload, error } = body

  console.log(
    `[fal-webhook] Received: request_id=${request_id} status=${status}`,
  )

  if (!request_id) {
    return new NextResponse('Bad Request: missing request_id', { status: 400 })
  }

  let record: WebhookRecord | undefined
  try {
    record = first(
      await sql<Array<WebhookRecord>>`
        select id, user_id, source from user_images
        where request_id = ${request_id}
      `,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(
      `[fal-webhook] DB query failed for request_id=${request_id}: ${msg}`,
    )
    return new NextResponse('Internal Server Error', { status: 500 })
  }

  if (!record) {
    console.warn(`[fal-webhook] No record found for request_id=${request_id}`)
    return new NextResponse('OK')
  }

  try {
    // FAL webhooks send status "OK" for success (not "COMPLETED" like the queue API)
    if ((status === 'OK' || status === 'COMPLETED') && payload) {
      await processImageResult(record.id, record.user_id, payload)
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
      await markGenerationFailedWithBlob(record.id, blob)
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

  return new NextResponse('OK')
}
