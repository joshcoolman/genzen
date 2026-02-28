import { createServerFn } from '@tanstack/react-start'
import { requireAuth } from '@/lib/server/auth.server'
import { getCreditRepository } from '@/features/credits'

interface GetTransactionsInput {
  accessToken: string
  limit?: number
}

export const getTransactions = createServerFn({ method: 'POST' })
  .inputValidator((data: GetTransactionsInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)
    const repo = getCreditRepository()
    return repo.getTransactions(data.limit)
  })
