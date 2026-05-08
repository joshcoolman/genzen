import Stripe from 'stripe'

let client: Stripe | null = null

export function getStripe(): Stripe {
  if (!client) {
    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    client = new Stripe(secret)
  }
  return client
}
