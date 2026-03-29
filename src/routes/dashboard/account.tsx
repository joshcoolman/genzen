import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Image,
  Pencil,
  Scissors,
  Video,
} from 'lucide-react'
import type { CreditReason, CreditTransaction } from '@/features/credits'
import { StatsRow } from '@/components/StatsRow'
import { SectionCard } from '@/components/SectionCard'
import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { getTransactions } from '@/features/credits/server/get-transactions.server'
import { DOLLARS_PER_CREDIT } from '@/features/credits'
import { CreditPackSelector } from '@/features/credits/components/CreditPackSelector'
import { supabase } from '@/lib/supabase'
import { checkConnections } from '@/lib/server/check-connections'

export const Route = createFileRoute('/dashboard/account')({
  component: AccountPage,
})

// --- Credits helpers ---

const REASON_LABELS: Record<CreditReason, string> = {
  image_gen: 'Image generation',
  variation: 'Image variation',
  edit: 'Image edit',
  first_frame: 'First frame',
  last_frame: 'Last frame',
  video_gen: 'Video generation',
  multishot_gen: 'Multi-shot generation',
  pack_purchase: 'Credit pack',
  initial_grant: 'Welcome credits',
}

const REASON_ICONS: Record<CreditReason, React.ReactNode> = {
  image_gen: <Image className="h-4 w-4" />,
  variation: <Scissors className="h-4 w-4" />,
  edit: <Pencil className="h-4 w-4" />,
  first_frame: <Image className="h-4 w-4" />,
  last_frame: <Image className="h-4 w-4" />,
  video_gen: <Video className="h-4 w-4" />,
  multishot_gen: <Video className="h-4 w-4" />,
  pack_purchase: <Gift className="h-4 w-4" />,
  initial_grant: <Gift className="h-4 w-4" />,
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDollars(credits: number) {
  return `$${(credits * DOLLARS_PER_CREDIT).toFixed(2)}`
}

// --- Status helpers ---

interface ConnectionStatus {
  supabase: 'checking' | 'connected' | 'error'
  supabaseError?: string
  fal: 'checking' | 'connected' | 'error'
  falError?: string
}

function StatusRow({
  label,
  status,
  detail,
  error,
}: {
  label: string
  status: 'checking' | 'connected' | 'error'
  detail?: string
  error?: string
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {detail && (
          <span className="text-sm text-muted-foreground">{detail}</span>
        )}
        <StatusBadge status={status} />
        {error && status === 'error' && (
          <span className="text-xs text-destructive">{error}</span>
        )}
      </div>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: 'checking' | 'connected' | 'error'
}) {
  const styles = {
    checking: 'bg-yellow-900/30 text-yellow-500',
    connected: 'bg-accent-sage/20 text-accent-sage',
    error: 'bg-red-900/30 text-red-400',
  }

  const labels = {
    checking: 'Checking...',
    connected: 'Connected',
    error: 'Error',
  }

  return (
    <span
      className={`text-xs px-2 py-1 rounded-full font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}

// --- Main page ---

function AccountPage() {
  const { user, session } = useAuth()
  const credits = useCredits()

  // Credits state
  const [transactions, setTransactions] = useState<Array<CreditTransaction>>([])

  const refreshTransactions = useCallback(() => {
    if (!session?.access_token) return
    void getTransactions({
      data: { accessToken: session.access_token, limit: 20 },
    }).then(setTransactions)
  }, [session?.access_token])

  useEffect(() => {
    refreshTransactions()
  }, [refreshTransactions])

  // Status state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    supabase: 'checking',
    fal: 'checking',
  })

  useEffect(() => {
    async function runChecks() {
      try {
        const { error } = await supabase.auth.getUser()
        if (error) {
          setConnectionStatus((s) => ({
            ...s,
            supabase: 'error',
            supabaseError: error.message,
          }))
        } else {
          setConnectionStatus((s) => ({ ...s, supabase: 'connected' }))
        }
      } catch (err) {
        setConnectionStatus((s) => ({
          ...s,
          supabase: 'error',
          supabaseError: err instanceof Error ? err.message : 'Unknown error',
        }))
      }

      if (!session?.access_token) {
        setConnectionStatus((s) => ({
          ...s,
          fal: 'error',
          falError: 'Missing session token',
        }))
        return
      }
      try {
        const serverStatus = await checkConnections({
          data: { accessToken: session.access_token },
        })
        setConnectionStatus((s) => ({
          ...s,
          fal: serverStatus.fal.status,
          falError: serverStatus.fal.error,
        }))
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Server error'
        setConnectionStatus((s) => ({
          ...s,
          fal: 'error',
          falError: errorMsg,
        }))
      }
    }

    if (user) {
      runChecks()
    }
  }, [user, session])

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Account</h1>

      {/* Profile */}
      <div className="bg-card rounded-lg p-6 space-y-4">
        <h2 className="font-medium">User Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Email</span>
            <span className="text-foreground">{user?.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">User ID</span>
            <span className="text-foreground font-mono text-xs">
              {user?.id}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Created</span>
            <span className="text-foreground">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString()
                : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Credits */}
      <div className="space-y-6">
        <h2 className="text-lg font-medium">Credits</h2>

        <StatsRow
          stats={[
            {
              label: 'Current balance',
              labelClassName: 'text-warm-gold',
              value: credits.dollarBalance ?? '--',
              detail:
                credits.balance !== null
                  ? `${credits.balance} credits available`
                  : 'Loading...',
            },
            {
              label: 'Spent today',
              labelClassName: 'text-warm-gold',
              value: credits.usageStats
                ? formatDollars(credits.usageStats.today)
                : '--',
              detail: credits.usageStats
                ? `${credits.usageStats.today} credits`
                : undefined,
            },
            {
              label: 'Usage this month',
              labelClassName: 'text-warm-gold',
              value: credits.usageStats
                ? formatDollars(credits.usageStats.thisMonth)
                : '--',
              detail: credits.usageStats
                ? `${credits.usageStats.thisMonth} credits used`
                : undefined,
            },
            {
              label: 'Daily average',
              labelClassName: 'text-warm-gold',
              value: credits.usageStats
                ? formatDollars(credits.usageStats.dailyAverage)
                : '--',
              detail: credits.usageStats
                ? `${credits.usageStats.dailyAverage} credits / day`
                : undefined,
            },
          ]}
        />
        <SectionCard title="Add Credits">
          <div className="-mx-6 -my-6">
            <CreditPackSelector onPurchaseComplete={refreshTransactions} />
          </div>
        </SectionCard>

        <SectionCard title="Recent Activity">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions yet.
            </p>
          ) : (
            <div className="-mx-6 -my-6">
              {transactions.map((tx, i) => (
                <div
                  key={tx.id}
                  className={`flex items-center gap-3 px-6 py-3 text-sm ${
                    i < transactions.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <span className="text-muted-foreground">
                    {REASON_ICONS[tx.reason]}
                  </span>
                  <span className="flex-1 font-medium">
                    {REASON_LABELS[tx.reason]}
                  </span>
                  <span
                    className={
                      tx.amount > 0
                        ? 'text-accent-brand font-medium'
                        : 'text-muted-foreground'
                    }
                  >
                    {tx.amount > 0 ? (
                      <span className="flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3" />+{tx.amount}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ArrowDownLeft className="h-3 w-3" />
                        {tx.amount}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground w-16 text-right tabular-nums">
                    {relativeTime(tx.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Status */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Status</h2>

        <div className="bg-card rounded-lg p-6 space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground">
            Connection Status
          </h3>
          <div className="space-y-3">
            <StatusRow
              label="Supabase"
              status={connectionStatus.supabase}
              error={connectionStatus.supabaseError}
            />
            <StatusRow label="Auth" status="connected" detail={user?.email} />
            <StatusRow
              label="FAL"
              status={connectionStatus.fal}
              error={connectionStatus.falError}
            />
          </div>
        </div>

        <div className="bg-card rounded-lg p-6 space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground">
            Environment
          </h3>
          <div className="text-sm space-y-2 text-muted-foreground">
            <div>
              <span className="text-muted-foreground">Supabase URL:</span>{' '}
              {import.meta.env.VITE_SUPABASE_URL}
            </div>
            <div>
              <span className="text-muted-foreground">User ID:</span> {user?.id}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
