import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '@/lib/server/auth.server'
import { getCreditRepository } from '@/features/credits'

interface GetCreditsInput {
  accessToken: string
}

export const getCredits = createServerFn({ method: 'POST' })
  .inputValidator((data: GetCreditsInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    const repo = getCreditRepository()
    const [balance, usageStats] = await Promise.all([
      repo.getBalance(user.id),
      repo.getUsageStats(user.id),
    ])
    console.log(`[credits] getCredits userId=${user.id} balance=${balance}`)
    return { balance, usageStats }
  })
