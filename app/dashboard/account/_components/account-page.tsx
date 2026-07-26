'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { ActivityPreview } from '@/features/activity/components/ActivityPreview'
import { checkConnections } from '@/lib/server/check-connections'

type Status = 'checking' | 'connected' | 'error'

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    checking: 'bg-yellow-900/30 text-yellow-500',
    connected: 'bg-accent-sage/20 text-accent-sage',
    error: 'bg-red-900/30 text-red-400',
  }
  const labels: Record<Status, string> = {
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

function StatusRow({
  label,
  status,
  detail,
  error,
}: {
  label: string
  status: Status
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

export function AccountPage() {
  const { user } = useAuth()
  const [fal, setFal] = useState<{ status: Status; error?: string }>({
    status: 'checking',
  })

  // Only FAL is probed now. The old page also pinged `supabase.auth.getUser()`
  // to prove the session was live -- there is no such round trip any more, the
  // session is a cookie this request already carried.
  useEffect(() => {
    checkConnections()
      .then((result) => setFal(result.fal))
      .catch((err: unknown) =>
        setFal({
          status: 'error',
          error: err instanceof Error ? err.message : 'Server error',
        }),
      )
  }, [])

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Account</h1>

      <div className="bg-card rounded-lg p-6 space-y-4">
        <h2 className="font-medium">User Information</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Email</span>
            <span className="text-foreground">{user.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">User ID</span>
            <span className="text-foreground font-mono text-xs">{user.id}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Created</span>
            <span className="text-foreground">
              {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <ActivityPreview />

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Status</h2>
        <div className="bg-card rounded-lg p-6 space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground">
            Connection Status
          </h3>
          <div className="space-y-3">
            <StatusRow label="Auth" status="connected" detail={user.email} />
            <StatusRow label="FAL" status={fal.status} error={fal.error} />
          </div>
        </div>
      </div>
    </div>
  )
}
