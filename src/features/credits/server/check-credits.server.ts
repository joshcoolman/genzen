import { z } from 'zod'
import { addCreditsInternal } from './add-credits.server'
import type { CreditReason, DeductionReason } from '@/features/credits'
import type {AuthInput} from '@/lib/server/auth.server';
import {  requireAuth } from '@/lib/server/auth.server'
import {
  CREDIT_COSTS,
  CreditReasonSchema,
  getCreditRepository,
} from '@/features/credits'

const QuantitySchema = z.number().int().positive().default(1)
const ReasonSchema = CreditReasonSchema

export type CreditAuth = string | AuthInput

async function resolveUserId(auth: CreditAuth): Promise<string> {
  if (typeof auth === 'string') {
    const user = await requireAuth(auth)
    return user.id
  }
  if (auth.userId) return auth.userId
  if (!auth.accessToken) throw new Error('Unauthorized')
  const user = await requireAuth(auth.accessToken)
  return user.id
}

export async function checkAndDeductCredits(
  auth: CreditAuth,
  reason: DeductionReason,
  quantity: number = 1,
): Promise<{
  allowed: boolean
  balance: number
  cost: number
  userId: string
}> {
  ReasonSchema.parse(reason)
  const validatedQuantity = QuantitySchema.parse(quantity)
  const userId = await resolveUserId(auth)
  const repo = getCreditRepository()
  const unitCost = CREDIT_COSTS[reason]
  const cost = unitCost * validatedQuantity
  const result = await repo.deductCredits(userId, cost, reason)
  if (!result.success) {
    return { allowed: false, balance: result.balance, cost, userId }
  }
  return { allowed: true, balance: result.balance, cost, userId }
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
