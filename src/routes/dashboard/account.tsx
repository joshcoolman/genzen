import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { ActivityPreview } from '@/features/activity/components/ActivityPreview'
import { supabase } from '@/lib/supabase'
import { checkConnections } from '@/lib/server/check-connections'

export const Route = createFileRoute('/dashboard/account')({
  component: AccountPage,
})

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

      <ActivityPreview />

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
