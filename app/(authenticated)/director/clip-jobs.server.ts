import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { ENDPOINTS, modelSchema } from './clips'
import { fal } from '#/lib/server/fal-client.server'
import { assertFalKey } from '#/lib/server/fal-key.server'

const receiptSchema = z.object({
  owner: z.string(),
  requestId: z.string().min(1).max(200),
  model: modelSchema,
})
type Receipt = z.infer<typeof receiptSchema>
function signature(payload: string) {
  assertFalKey()
  return createHmac('sha256', process.env.FAL_KEY!)
    .update(`genzen-director-clip-v1:${payload}`)
    .digest('base64url')
}
/** Signed receipts survive server restarts without a Lab database migration.
 * The auth user, not possession alone, authorizes every result request. */
export function signReceipt(receipt: Receipt) {
  const payload = Buffer.from(JSON.stringify(receipt)).toString('base64url')
  return `${payload}.${signature(payload)}`
}
export function readReceipt(token: string, owner: string): Receipt {
  if (typeof token !== 'string' || token.length > 2048)
    throw new Error('Invalid clip receipt.')
  const [payload, mac, extra] = token.split('.')
  if (!payload || !mac || extra) throw new Error('Invalid clip receipt.')
  const expected = Buffer.from(signature(payload))
  const received = Buffer.from(mac)
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw new Error('Invalid clip receipt.')
  const receipt = receiptSchema.parse(
    JSON.parse(Buffer.from(payload, 'base64url').toString()),
  )
  if (receipt.owner !== owner)
    throw new Error('This clip belongs to another account.')
  return receipt
}
export function mediaUrl(value: string) {
  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !(url.hostname === 'fal.media' || url.hostname.endsWith('.fal.media'))
  )
    throw new Error('Unexpected provider media host.')
  return url.href
}
export async function clipResult(receipt: Receipt) {
  const result = await fal.queue.result(ENDPOINTS[receipt.model], {
    requestId: receipt.requestId,
  })
  const data = z
    .object({ video: z.object({ url: z.string() }) })
    .parse(result.data)
  return mediaUrl(data.video.url)
}
