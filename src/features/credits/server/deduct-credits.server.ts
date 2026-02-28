import { createServerFn } from '@tanstack/react-start'
import type { CreditReason } from '@/features/credits'
import { requireAuth } from '@/lib/server/auth.server'
import { getCreditRepository } from '@/features/credits'

interface DeductCreditsInput {
  accessToken: string
  amount: number
  reason: CreditReason
}

export const deductCredits = createServerFn({ method: 'POST' })
  .inputValidator((data: DeductCreditsInput) => data)
  .handler(async ({ data }) => {
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new Error('Amount must be a positive number')
    }
    const user = await requireAuth(data.accessToken)
    const repo = getCreditRepository()
    return repo.deductCredits(user.id, data.amount, data.reason)
  })
