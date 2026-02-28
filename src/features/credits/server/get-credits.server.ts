import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '@/lib/server/auth.server'
import { getCreditRepository } from '@/features/credits'

interface GetCreditsInput {
  accessToken: string
}

export const getCredits = createServerFn({ method: 'POST' })
  .inputValidator((data: GetCreditsInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)
    const repo = getCreditRepository()
    const [balance, usageStats] = await Promise.all([
      repo.getBalance(),
      repo.getUsageStats(),
    ])
    return { balance, usageStats }
  })
