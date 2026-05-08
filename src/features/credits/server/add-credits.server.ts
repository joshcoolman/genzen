import { z } from 'zod'
import type { CreditReason } from '@/features/credits'
import { CreditReasonSchema, getCreditRepository } from '@/features/credits'

const AddCreditsSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().positive(),
  reason: CreditReasonSchema,
  stripeEventId: z.string().min(1).optional(),
})

/**
 * Internal-only function for adding credits. NOT a public server fn.
 * Only callable from other server code (refunds, Stripe webhook, signup grant).
 *
 * Pass `stripeEventId` from the Stripe webhook to enforce idempotency via the
 * unique constraint on `credit_transactions.stripe_event_id`. Duplicate
 * deliveries throw a PostgrestError with code '23505' that the caller can
 * detect and treat as already-processed.
 */
export async function addCreditsInternal(
  userId: string,
  amount: number,
  reason: CreditReason,
  stripeEventId?: string,
): Promise<{ balance: number }> {
  const validated = AddCreditsSchema.parse({
    userId,
    amount,
    reason,
    stripeEventId,
  })
  const repo = getCreditRepository()
  return repo.addCredits(
    validated.userId,
    validated.amount,
    validated.reason,
    validated.stripeEventId,
  )
}
