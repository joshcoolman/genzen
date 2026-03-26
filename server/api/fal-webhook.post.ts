import crypto from 'node:crypto'
import {
  defineEventHandler,
  getHeader,
  readRawBody,
  setResponseStatus,
} from 'h3'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'
import {
  markGenerationFailed,
  processImageResult,
  processVideoResult,
} from '@/lib/server/fal-completion.server'

interface FalWebhookBody {
  request_id: string
  status: string
  payload?: Record<string, unknown>
  error?: string
}

function verifyFalSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')
    const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature
    if (expected.length !== sig.length) return false
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(sig, 'hex'),
    )
  } catch {
    return false
  }
}

export default defineEventHandler(async (event) => {
  const rawBody = (await readRawBody(event)) ?? ''
  const signature = getHeader(event, 'x-fal-signature') ?? ''
  const falKey = process.env.FAL_KEY ?? ''

  if (falKey && signature && !verifyFalSignature(rawBody, signature, falKey)) {
    console.warn('[fal-webhook] Signature verification failed')
    setResponseStatus(event, 401)
    return 'Unauthorized'
  }

  let body: FalWebhookBody
  try {
    body = JSON.parse(rawBody) as FalWebhookBody
  } catch {
    setResponseStatus(event, 400)
    return 'Bad Request'
  }

  const { request_id, status, payload, error } = body

  if (!request_id) {
    setResponseStatus(event, 400)
    return 'Bad Request: missing request_id'
  }

  const supabase = getSupabaseAdmin()

  const { data: record } = await supabase
    .from('user_images')
    .select('id, user_id, source')
    .eq('request_id', request_id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!record) {
    // Unknown request_id — not our record, ignore
    return 'OK'
  }

  try {
    if (status === 'COMPLETED' && payload) {
      const isVideo = record.source === 'ai_video'
      if (isVideo) {
        await processVideoResult(supabase, record.id, payload)
      } else {
        await processImageResult(supabase, record.id, record.user_id, payload)
      }
    } else if (status === 'FAILED' || status === 'ERROR') {
      const errorMsg = typeof error === 'string' ? error : `FAL job ${status}`
      await markGenerationFailed(supabase, record.id, errorMsg)
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
