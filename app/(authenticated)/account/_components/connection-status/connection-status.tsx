import styles from './connection-status.module.css'

export type ConnectionState = 'checking' | 'connected' | 'error'

const VARIANTS: Record<ConnectionState, string> = {
  checking: styles.badgeChecking,
  connected: styles.badgeConnected,
  error: styles.badgeError,
}

const LABELS: Record<ConnectionState, string> = {
  checking: 'Checking...',
  connected: 'Connected',
  error: 'Error',
}

function StatusBadge({ status }: { status: ConnectionState }) {
  return (
    <span className={`${styles.badge} ${VARIANTS[status]}`}>
      {LABELS[status]}
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
  status: ConnectionState
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

interface ConnectionStatusProps {
  email: string
  fal: { status: ConnectionState; error?: string }
}

export function ConnectionStatus({ email, fal }: ConnectionStatusProps) {
  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Status</h2>
      <div className={styles.card}>
        <h3 className={styles.statusTitle}>Connection Status</h3>
        <div className={styles.statusRows}>
          <StatusRow label="Auth" status="connected" detail={email} />
          <StatusRow label="FAL" status={fal.status} error={fal.error} />
        </div>
      </div>
    </div>
  )
}
