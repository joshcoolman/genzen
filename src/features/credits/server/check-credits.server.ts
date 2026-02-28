import type { CreditReason } from '@/features/credits'
import { requireAuth } from '@/lib/server/auth.server'
import { CREDIT_COSTS, getCreditRepository } from '@/features/credits'

export async function checkAndDeductCredits(
  accessToken: string,
  reason: CreditReason,
): Promise<{ allowed: boolean; balance: number; cost: number }> {
  await requireAuth(accessToken)
  const repo = getCreditRepository()
  const cost = CREDIT_COSTS[reason] ?? 1
  const result = await repo.deductCredits(cost, reason)
  if (!result.success) {
    return { allowed: false, balance: result.balance, cost }
  }
  return { allowed: true, balance: result.balance, cost }
}
