import styles from './connection-status.module.css'
import type {
  ConnectionCheck,
  ConnectionState,
} from '#/lib/server/check-connections.action'

const VARIANTS: Record<ConnectionState, string> = {
  checking: styles.badgeChecking,
  connected: styles.badgeConnected,
  error: styles.badgeError,
  unset: styles.badgeUnset,
}

const LABELS: Record<ConnectionState, string> = {
  checking: 'Checking...',
  connected: 'Connected',
  error: 'Error',
  unset: 'Not set',
}

function StatusBadge({ status }: { status: ConnectionState }) {
  return (
    <span className={`${styles.badge} ${VARIANTS[status]}`}>
      {LABELS[status]}
    </span>
  )
}

/**
 * One check.
 *
 * The remedy is the point (#406). This block used to print a raw provider error
 * string beside a red badge, which named the failure and nothing about fixing
 * it -- and the most common failure by far, a missing `FAL_KEY`, has a one-line
 * fix. The raw message stays, under the remedy, for the cases nothing matched.
 */
function StatusRow({ check }: { check: ConnectionCheck }) {
  return (
    <div className={styles.statusRow}>
      <div className={styles.statusHead}>
        <span className={styles.statusLabel}>{check.label}</span>
        <div className={styles.statusMeta}>
          {check.detail && (
            <span className={styles.statusDetail}>{check.detail}</span>
          )}
          <StatusBadge status={check.status} />
        </div>
      </div>
      {check.status !== 'connected' && check.remedy && (
        <p className={styles.statusRemedy}>{check.remedy}</p>
      )}
      {check.status === 'error' && check.error && (
        <p className={styles.statusError}>{check.error}</p>
      )}
    </div>
  )
}

export function ConnectionStatus({
  checks,
  isLoading,
}: {
  checks: Array<ConnectionCheck>
  isLoading: boolean
}) {
  const rows: Array<ConnectionCheck> = isLoading
    ? [{ label: 'Services', status: 'checking' }]
    : checks

  return (
    <div className={styles.card}>
      <h3 className={styles.statusTitle}>Status</h3>
      <div className={styles.statusRows}>
        {rows.map((check) => (
          <StatusRow key={check.label} check={check} />
        ))}
      </div>
    </div>
  )
}
