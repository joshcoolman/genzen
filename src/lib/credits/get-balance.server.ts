import { createServerFn } from '@tanstack/react-start'
import { FALCreditProvider } from './fal-provider.server'
import type { CreditBalance } from './types'
import { requireAuth } from '@/lib/server/auth.server'

interface GetBalanceInput {
  accessToken: string
}

/**
 * Get credit balance from the current provider (FAL for now)
 * Future: Could switch based on user settings or app config
 */
export const getCreditBalance = createServerFn({ method: 'POST' })
  .inputValidator((data: GetBalanceInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    try {
      // For now, always use FAL provider
      // Future: Could be configurable per user or app-wide
      const provider = new FALCreditProvider()
      const balance = await provider.getBalance()

      return {
        success: true,
        balance,
        provider: provider.providerName,
      }
    } catch (error) {
      console.error('Failed to get credit balance:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get balance',
        balance: null,
        provider: 'FAL AI',
      }
    }
  })
