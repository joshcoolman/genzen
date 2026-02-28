import { useCallback, useEffect, useState } from 'react'
import type { CreditReason, UsageStats } from '@/features/credits'
import { DOLLARS_PER_CREDIT } from '@/features/credits'
import { getCredits } from '@/features/credits/server/get-credits.server'
import { deductCredits } from '@/features/credits/server/deduct-credits.server'

export function useCredits(accessToken: string | undefined) {
  const [balance, setBalance] = useState<number | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const data = await getCredits({ data: { accessToken } })
      setBalance(data.balance)
      setUsageStats(data.usageStats)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const deduct = useCallback(
    async (amount: number, reason: CreditReason) => {
      if (!accessToken) return { success: false, balance: 0 }
      const result = await deductCredits({
        data: { accessToken, amount, reason },
      })
      setBalance(result.balance)
      return result
    },
    [accessToken],
  )

  const dollarBalance =
    balance !== null ? `$${(balance * DOLLARS_PER_CREDIT).toFixed(2)}` : null

  return {
    balance,
    dollarBalance,
    usageStats,
    loading,
    deduct,
    refresh,
    isLow: balance !== null && balance < 10,
    isEmpty: balance !== null && balance === 0,
  }
}
