import { useEffect, useState } from 'react'
import { CheckCircle2, X, XCircle } from 'lucide-react'
import { createFileRoute } from '@tanstack/react-router'
import { StatsRow } from '@/components/StatsRow'
import { SectionCard } from '@/components/SectionCard'
import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { DOLLARS_PER_CREDIT } from '@/features/credits'
import { CreditPackSelector } from '@/features/credits/components/CreditPackSelector'
import { TransactionHistory } from '@/features/credits/components/TransactionHistory'
import { ActivityPreview } from '@/features/activity/components/ActivityPreview'
import { supabase } from '@/lib/supabase'
import { checkConnections } from '@/lib/server/check-connections'

export const Route = createFileRoute('/dashboard/account')({
  component: AccountPage,
})

// --- Credits helpers ---

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

function CheckoutResultBanner({
  result,
  onDismiss,
}: {
  result: 'success' | 'cancelled'
  onDismiss: () => void
}) {
  const isSuccess = result === 'success'
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
        isSuccess
          ? 'border-accent-sage/30 bg-accent-sage/10'
          : 'border-border bg-muted/30'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-sage" />
      ) : (
        <XCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
      )}
      <div className="flex-1 text-sm">
        <p className="font-medium text-foreground">
          {isSuccess ? 'Payment successful' : 'Checkout cancelled'}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isSuccess
            ? "Your credits have been added. They'll appear in your balance below within a moment."
            : 'No charge was made. You can try again any time.'}
        </p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function AccountPage() {
  const { user, session } = useAuth()
  const credits = useCredits()

  // Status state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    supabase: 'checking',
    fal: 'checking',
  })

  // Checkout result banner (read from ?checkout=success|cancelled on mount)
  const [checkoutResult, setCheckoutResult] = useState<
    'success' | 'cancelled' | null
  >(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const result = params.get('checkout')
    if (result === 'success' || result === 'cancelled') {
      setCheckoutResult(result)
      window.history.replaceState({}, '', '/dashboard/account')
      if (result === 'success') {
        // Webhook may take a beat to land. Refresh now and again shortly.
        void credits.refresh()
        const t = setTimeout(() => void credits.refresh(), 2000)
        return () => clearTimeout(t)
      }
    }
  }, [credits])

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

      {checkoutResult && (
        <CheckoutResultBanner
          result={checkoutResult}
          onDismiss={() => setCheckoutResult(null)}
        />
      )}

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
            <CreditPackSelector />
          </div>
        </SectionCard>

        <TransactionHistory />

        <ActivityPreview />
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
