import { z } from 'zod'
import { addCreditsInternal } from './add-credits.server'
import type { CreditReason } from '@/features/credits'
import { requireAuth } from '@/lib/server/auth.server'
import {
  CREDIT_COSTS,
  CreditReasonSchema,
  getCreditRepository,
} from '@/features/credits'

const CheckAndDeductSchema = z.object({
  accessToken: z.string().min(1),
  reason: CreditReasonSchema,
  quantity: z.number().int().positive().default(1),
})

export async function checkAndDeductCredits(
  accessToken: string,
  reason: CreditReason,
  quantity: number = 1,
): Promise<{
  allowed: boolean
  balance: number
  cost: number
  userId: string
}> {
  const validated = CheckAndDeductSchema.parse({
    accessToken,
    reason,
    quantity,
  })
  const user = await requireAuth(validated.accessToken)
  const repo = getCreditRepository()
  const unitCost = CREDIT_COSTS[reason as keyof typeof CREDIT_COSTS]
  const cost = unitCost * validated.quantity
  const result = await repo.deductCredits(user.id, cost, reason)
  if (!result.success) {
    return { allowed: false, balance: result.balance, cost, userId: user.id }
  }
  return { allowed: true, balance: result.balance, cost, userId: user.id }
}

export async function refundCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
): Promise<void> {
  await addCreditsInternal(userId, amount, reason)
}

/**
 * Wraps post-deduction work with automatic credit refund on failure.
 * Use after checkAndDeductCredits returns allowed: true.
 */
export async function withCreditRefund<T>(
  userId: string,
  cost: number,
  reason: CreditReason,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    await refundCredits(userId, cost, reason)
    throw err
  }
}
