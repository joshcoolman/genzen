import { z } from 'zod'
import type { CreditReason } from '@/features/credits'
import { CreditReasonSchema, getCreditRepository } from '@/features/credits'

const AddCreditsSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().positive(),
  reason: CreditReasonSchema,
})

/**
 * Internal-only function for adding credits. NOT a public server fn.
 * Only callable from other server code (refunds, future Stripe webhook).
 */
export async function addCreditsInternal(
  userId: string,
  amount: number,
  reason: CreditReason,
): Promise<{ balance: number }> {
  const validated = AddCreditsSchema.parse({ userId, amount, reason })
  const repo = getCreditRepository()
  return repo.addCredits(validated.userId, validated.amount, validated.reason)
}
