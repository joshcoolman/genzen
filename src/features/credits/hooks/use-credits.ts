import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { CreditReason, UsageStats } from '@/features/credits'
import { DOLLARS_PER_CREDIT } from '@/features/credits'
import { getCredits } from '@/features/credits/server/get-credits.server'
import { deductCredits } from '@/features/credits/server/deduct-credits.server'
import { addCredits } from '@/features/credits/server/add-credits.server'

interface CreditsState {
  balance: number | null
  dollarBalance: string | null
  usageStats: UsageStats | null
  loading: boolean
  deduct: (
    amount: number,
    reason: CreditReason,
  ) => Promise<{ success: boolean; balance: number }>
  add: (amount: number, reason: CreditReason) => Promise<{ balance: number }>
  refresh: () => Promise<void>
  isLow: boolean
  isEmpty: boolean
}

const defaultState: CreditsState = {
  balance: null,
  dollarBalance: null,
  usageStats: null,
  loading: false,
  deduct: async () => ({ success: false, balance: 0 }),
  add: async () => ({ balance: 0 }),
  refresh: async () => {},
  isLow: false,
  isEmpty: false,
}

export const CreditsContext = createContext<CreditsState>(defaultState)

export function useCreditsProvider(accessToken: string | undefined) {
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

  const add = useCallback(
    async (amount: number, reason: CreditReason) => {
      if (!accessToken) return { balance: 0 }
      const result = await addCredits({
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
    add,
    refresh,
    isLow: balance !== null && balance < 10,
    isEmpty: balance !== null && balance === 0,
  }
}

export function useCredits() {
  return useContext(CreditsContext)
}
