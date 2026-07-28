'use client'

import { useEffect, useState } from 'react'
import { ActivityPreview } from '../activity-preview/activity-preview'
import styles from './account-page.module.css'
import { useAuth } from '#/lib/auth'
import { checkConnections } from '#/lib/server/check-connections'

type Status = 'checking' | 'connected' | 'error'

function StatusBadge({ status }: { status: Status }) {
  const variants: Record<Status, string> = {
    checking: styles.badgeChecking,
    connected: styles.badgeConnected,
    error: styles.badgeError,
  }
  const labels: Record<Status, string> = {
    checking: 'Checking...',
    connected: 'Connected',
    error: 'Error',
  }
  return (
    <span className={`${styles.badge} ${variants[status]}`}>
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
    <div className={styles.statusRow}>
      <span className={styles.statusLabel}>{label}</span>
      <div className={styles.statusMeta}>
        {detail && <span className={styles.statusDetail}>{detail}</span>}
        <StatusBadge status={status} />
        {error && status === 'error' && (
          <span className={styles.statusError}>{error}</span>
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
    <div className={styles.page}>
      <h1 className={styles.title}>Account</h1>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>User Information</h2>
        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Email</span>
            <span className={styles.fieldValue}>{user.email}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>User ID</span>
            <span className={styles.fieldValueMono}>{user.id}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Created</span>
            <span className={styles.fieldValue}>
              {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <ActivityPreview />

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Status</h2>
        <div className={styles.card}>
          <h3 className={styles.statusTitle}>Connection Status</h3>
          <div className={styles.statusRows}>
            <StatusRow label="Auth" status="connected" detail={user.email} />
            <StatusRow label="FAL" status={fal.status} error={fal.error} />
          </div>
        </div>
      </div>
    </div>
  )
}
