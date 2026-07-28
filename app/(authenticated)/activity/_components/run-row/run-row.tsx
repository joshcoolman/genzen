import {
  AlertCircle,
  CheckCircle2,
  Clock4,
  Image as ImageIcon,
} from 'lucide-react'
import { clsx } from 'clsx'
import styles from './run-row.module.css'
import type { ActivityEntry } from '#/features/activity/types'
import {
  formatAbsolute,
  formatDurationMs,
  formatRelativeOrDate,
} from '#/lib/time-format'

interface RunRowProps {
  entry: ActivityEntry
  thumbnailUrl: string | null
  onSelect?: (id: string) => void
}

function StatusIndicator({ status }: { status: ActivityEntry['status'] }) {
  if (status === 'completed') {
    return (
      <span className={`${styles.status} ${styles.statusCompleted}`}>
        <CheckCircle2 className={styles.statusIcon} />
        <span className={styles.statusLabel}>Completed</span>
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className={`${styles.status} ${styles.statusFailed}`}>
        <AlertCircle className={styles.statusIcon} />
        <span className={styles.statusLabel}>Failed</span>
      </span>
    )
  }
  return (
    <span className={`${styles.status} ${styles.statusPending}`}>
      <Clock4 className={styles.statusIcon} />
      <span className={styles.statusLabel}>Pending</span>
    </span>
  )
}

function formatCents(cents: number | null, isEstimate = false): string {
  if (cents == null) return '—'
  const prefix = isEstimate ? '~' : ''
  const dollars = cents / 100
  if (dollars === 0) return `${prefix}$0.00`
  if (dollars < 0.01) return `${prefix}$${dollars.toFixed(4)}`
  if (dollars < 1) return `${prefix}$${dollars.toFixed(3)}`
  return `${prefix}$${dollars.toFixed(2)}`
}

export function RunRow({ entry, thumbnailUrl, onSelect }: RunRowProps) {
  const duration =
    entry.durationMs != null ? formatDurationMs(entry.durationMs) : '—'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(entry.id)}
      className={clsx(styles.row, entry.isDeleted && styles.rowDeleted)}
    >
      {/* Thumbnail */}
      <div className={styles.thumb}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={styles.thumbImage}
          />
        ) : (
          <div className={styles.thumbFallback}>
            <ImageIcon className={styles.thumbIcon} />
          </div>
        )}
      </div>

      {/* Model + provider + deleted badge */}
      <div className={styles.model}>
        <span className={styles.modelName}>{entry.modelName}</span>
        {entry.provider && (
          <span className={styles.provider}>{entry.provider}</span>
        )}
        {entry.isDeleted && <span className={styles.deletedTag}>deleted</span>}
      </div>

      {/* Prompt */}
      <div className={styles.cell}>
        <p className={styles.prompt} title={entry.prompt || undefined}>
          {entry.prompt || (
            <span className={styles.promptEmpty}>No prompt</span>
          )}
        </p>
        {entry.status === 'failed' && entry.errorMessage && (
          <p className={styles.rowError} title={entry.errorMessage}>
            {entry.errorMessage}
          </p>
        )}
      </div>

      {/* Status */}
      <div className={styles.cell}>
        <StatusIndicator status={entry.status} />
      </div>

      {/* Duration */}
      <div className={styles.duration}>{duration}</div>

      {/* Cost */}
      <div
        className={styles.cost}
        title={
          entry.costIsEstimate
            ? "Estimated from FAL's pricing table — FAL's result carried no cost field"
            : 'What FAL charged'
        }
      >
        {formatCents(entry.providerCostCents, entry.costIsEstimate)}
      </div>

      {/* Time */}
      <div className={styles.time} title={formatAbsolute(entry.createdAt)}>
        {formatRelativeOrDate(entry.createdAt)}
      </div>
    </button>
  )
}
