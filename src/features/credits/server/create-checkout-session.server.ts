import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { CREDIT_PACKS } from '@/features/credits'
import { requireAuth } from '@/lib/server/auth.server'
import { getStripe } from '@/lib/server/stripe.server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'

const CreateCheckoutSessionSchema = z.object({
  accessToken: z.string().min(1),
  packCredits: z.number().int().positive(),
})

function getAppUrl(): string {
  const url = process.env.APP_URL ?? process.env.VITE_APP_URL
  if (!url) {
    throw new Error('APP_URL (or VITE_APP_URL) must be set')
  }
  return url.replace(/\/$/, '')
}

async function resolveStripeCustomerId(
  userId: string,
  email: string | undefined,
): Promise<string> {
  const supabase = getSupabaseAdmin()

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load profile: ${error.message}`)

  if (profile?.stripe_customer_id) return profile.stripe_customer_id

  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  })

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)

  if (updateError) {
    // Best-effort cleanup so we don't leave orphan Stripe customers.
    await stripe.customers.del(customer.id).catch(() => {})
    throw new Error(`Failed to persist customer: ${updateError.message}`)
  }

  return customer.id
}

export const createCheckoutSession = createServerFn({ method: 'POST' })
  .inputValidator((data: z.infer<typeof CreateCheckoutSessionSchema>) =>
    CreateCheckoutSessionSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const pack = CREDIT_PACKS.find((p) => p.credits === data.packCredits)
    if (!pack) {
      throw new Error('Invalid credit pack')
    }

    const user = await requireAuth(data.accessToken)
    const customerId = await resolveStripeCustomerId(user.id, user.email)

    const appUrl = getAppUrl()
    const stripe = getStripe()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: pack.price * 100,
            product_data: {
              name: `GenZen ${pack.description} Pack`,
              description: `${pack.credits} credits ($${(pack.credits * 0.1).toFixed(2)} of generation)`,
            },
          },
        },
      ],
      metadata: {
        user_id: user.id,
        pack_credits: String(pack.credits),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          pack_credits: String(pack.credits),
        },
      },
      success_url: `${appUrl}/dashboard/account?checkout=success`,
      cancel_url: `${appUrl}/dashboard/account?checkout=cancelled`,
    })

    if (!session.url) {
      throw new Error('Stripe session created without a URL')
    }

    return { url: session.url }
  })
