import { AlertCircle, CheckCircle2, Clock4 } from 'lucide-react'
import { clsx } from 'clsx'
import styles from './run-row.module.css'
import type { ActivityEntry } from '#/features/activity/types'
import { MediaBox } from '#/components'
import { formatCents } from '#/lib/format'
import {
  formatAbsolute,
  formatDurationMs,
  formatRelativeOrDate,
} from '#/lib/time-format'

/** Matches the 48px the column was sized at by hand. */
const THUMB_SIZE = 48

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

export function RunRow({ entry, thumbnailUrl, onSelect }: RunRowProps) {
  const duration =
    entry.durationMs != null ? formatDurationMs(entry.durationMs) : '—'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(entry.id)}
      className={clsx(styles.row, entry.isDeleted && styles.rowDeleted)}
    >
      {/* Thumbnail. A clip has no poster frame anywhere in the app, so it is
          a `<video>` painting frame one -- see MediaBox. */}
      <MediaBox
        kind={entry.source === 'ai_video' ? 'video' : 'image'}
        src={thumbnailUrl}
        alt=""
        size={THUMB_SIZE}
        fit="cover"
      />

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
        {formatCents(entry.providerCostCents, {
          estimate: entry.costIsEstimate,
        })}
      </div>

      {/* Time */}
      <div className={styles.time} title={formatAbsolute(entry.createdAt)}>
        {formatRelativeOrDate(entry.createdAt)}
      </div>
    </button>
  )
}
