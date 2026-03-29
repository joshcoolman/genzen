import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { UsageStats } from '@/features/credits'
import { DOLLARS_PER_CREDIT } from '@/features/credits'
import { getCredits } from '@/features/credits/server/get-credits.server'

export interface CreditsState {
  balance: number | null
  dollarBalance: string | null
  usageStats: UsageStats | null
  loading: boolean
  refresh: () => Promise<void>
  showInsufficientCredits: (cost: number) => void
  isLow: boolean
  isEmpty: boolean
}

const defaultState: CreditsState = {
  balance: null,
  dollarBalance: null,
  usageStats: null,
  loading: false,
  refresh: async () => {},
  showInsufficientCredits: () => {},
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
    } catch (err) {
      console.error('[credits] Failed to load balance:', err)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const dollarBalance =
    balance !== null ? `$${(balance * DOLLARS_PER_CREDIT).toFixed(2)}` : null

  return {
    balance,
    dollarBalance,
    usageStats,
    loading,
    refresh,
    isLow: balance !== null && balance < 10,
    isEmpty: balance !== null && balance === 0,
  }
}

export function useCredits() {
  return useContext(CreditsContext)
}
