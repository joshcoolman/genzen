import { createServerFn } from '@tanstack/react-start'
import type { CreditReason } from '@/features/credits'
import { requireAuth } from '@/lib/server/auth.server'
import { getCreditRepository } from '@/features/credits'

interface AddCreditsInput {
  accessToken: string
  amount: number
  reason: CreditReason
}

export const addCredits = createServerFn({ method: 'POST' })
  .inputValidator((data: AddCreditsInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)
    const repo = getCreditRepository()
    return repo.addCredits(data.amount, data.reason)
  })
