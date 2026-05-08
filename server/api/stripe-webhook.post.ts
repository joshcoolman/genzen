import {
  defineEventHandler,
  getHeader,
  readRawBody,
  setResponseStatus,
} from 'h3'
import type Stripe from 'stripe'
import { addCreditsInternal } from '@/features/credits/server/add-credits.server'
import { CREDIT_PACKS } from '@/features/credits/types'
import { getStripe } from '@/lib/server/stripe.server'

function isPack(credits: number): boolean {
  return CREDIT_PACKS.some((p) => p.credits === credits)
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  eventId: string,
): Promise<void> {
  const userId = session.client_reference_id ?? session.metadata?.user_id
  if (!userId) {
    console.error(
      `[stripe-webhook] checkout.session.completed missing user_id (session=${session.id})`,
    )
    return
  }

  const packCreditsRaw = session.metadata?.pack_credits
  const packCredits = packCreditsRaw ? Number(packCreditsRaw) : NaN
  if (!Number.isFinite(packCredits) || !isPack(packCredits)) {
    console.error(
      `[stripe-webhook] checkout.session.completed invalid pack_credits=${packCreditsRaw} (session=${session.id})`,
    )
    return
  }

  // Only credit on actually-paid sessions. Stripe sends this event for unpaid
  // bank-redirect / async flows too — guard against granting before settlement.
  if (session.payment_status !== 'paid') {
    console.warn(
      `[stripe-webhook] Session ${session.id} not paid (status=${session.payment_status}); skipping credit grant`,
    )
    return
  }

  try {
    await addCreditsInternal(userId, packCredits, 'pack_purchase', eventId)
    console.log(
      `[stripe-webhook] Credited ${packCredits} to user=${userId} (session=${session.id})`,
    )
  } catch (err) {
    // Postgres unique violation on stripe_event_id = already processed
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      err.code === '23505'
    ) {
      console.log(
        `[stripe-webhook] Event ${eventId} already processed; skipping`,
      )
      return
    }
    throw err
  }
}

export default defineEventHandler(async (event) => {
  const rawBody = (await readRawBody(event)) ?? ''
  const signature = getHeader(event, 'stripe-signature') ?? ''

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set')
    setResponseStatus(event, 500)
    return 'Server misconfigured'
  }

  const stripe = getStripe()
  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[stripe-webhook] Signature verification failed: ${msg}`)
    setResponseStatus(event, 401)
    return 'Unauthorized'
  }

  console.log(
    `[stripe-webhook] Received: type=${stripeEvent.type} id=${stripeEvent.id}`,
  )

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object, stripeEvent.id)
        break

      case 'payment_intent.payment_failed': {
        const intent = stripeEvent.data.object
        console.warn(
          `[stripe-webhook] Payment failed: intent=${intent.id} reason=${intent.last_payment_error?.message ?? 'unknown'}`,
        )
        break
      }

      default:
        // Ignore unhandled event types
        break
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(
      `[stripe-webhook] Processing failed for event=${stripeEvent.id}: ${msg}`,
    )
    // Return 200 anyway so Stripe doesn't retry-storm. Errors are surfaced via
    // Stripe Dashboard > Webhooks > recent events.
  }

  return 'OK'
})
