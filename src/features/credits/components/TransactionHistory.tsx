import { useEffect, useState } from 'react'
import type { CreditTransaction } from '@/features/credits/types'
import { SectionCard } from '@/components/SectionCard'
import { useAuth } from '@/lib/auth'
import { getTransactions } from '@/features/credits/server/get-transactions.server'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { DOLLARS_PER_CREDIT } from '@/features/credits'
import { formatAbsolute, formatRelativeOrDate } from '@/lib/time-format'

const REASON_LABELS: Record<string, string> = {
  image_gen: 'Image generation',
  variation: 'Variation',
  edit: 'Edit',
  first_frame: 'Frame generation',
  last_frame: 'Frame generation',
  video_gen: 'Video generation',
  multishot_gen: 'Multi-shot video',
  pack_purchase: 'Credit pack purchase',
  initial_grant: 'Welcome credits',
}

function formatDollars(credits: number): string {
  const dollars = credits * DOLLARS_PER_CREDIT
  return `${dollars < 0 ? '-' : ''}$${Math.abs(dollars).toFixed(2)}`
}

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason
}

export function TransactionHistory() {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const credits = useCredits()
  // Refetch when balance changes so a fresh top-up shows up.
  const balance = credits.balance
  const [transactions, setTransactions] = useState<Array<CreditTransaction>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getTransactions({ data: { accessToken, limit: 20 } })
      .then((rows) => {
        if (cancelled) return
        setTransactions(rows)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken, balance])

  return (
    <SectionCard title="Recent transactions">
      {loading && transactions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : transactions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No transactions yet.</p>
      ) : (
        <div className="-mx-2">
          {transactions.map((tx) => {
            const isCredit = tx.amount > 0
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-3 px-2 py-2 border-b border-border last:border-0 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-foreground">
                    {reasonLabel(tx.reason)}
                  </div>
                  <div
                    className="text-[11px] text-muted-foreground"
                    title={formatAbsolute(tx.createdAt)}
                  >
                    {formatRelativeOrDate(tx.createdAt)}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div
                    className={
                      isCredit ? 'text-accent-sage' : 'text-foreground'
                    }
                  >
                    {isCredit ? '+' : ''}
                    {tx.amount} credits
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDollars(tx.amount)} &middot; bal {tx.balanceAfter}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}
