import type { CreditReason } from '@/features/credits'
import { requireAuth } from '@/lib/server/auth.server'
import { CREDIT_COSTS, getCreditRepository } from '@/features/credits'

export async function checkAndDeductCredits(
  accessToken: string,
  reason: CreditReason,
  quantity: number = 1,
): Promise<{ allowed: boolean; balance: number; cost: number }> {
  const user = await requireAuth(accessToken)
  const repo = getCreditRepository()
  const unitCost = CREDIT_COSTS[reason] ?? 1
  const cost = unitCost * quantity
  const result = await repo.deductCredits(user.id, cost, reason)
  if (!result.success) {
    return { allowed: false, balance: result.balance, cost }
  }
  return { allowed: true, balance: result.balance, cost }
}

export async function refundCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
): Promise<void> {
  const repo = getCreditRepository()
  await repo.addCredits(userId, amount, reason)
}
