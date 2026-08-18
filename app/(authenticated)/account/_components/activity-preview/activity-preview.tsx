'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import { clsx } from 'clsx'
import styles from './activity-preview.module.css'
import type { ActivityEntry } from '#/features/activity/types'
import { listActivity } from '#/features/activity/server/list-activity.action'
import { imageUrl } from '#/lib/image-url'
import { formatDurationMs, formatRelativeOrDate } from '#/lib/time-format'

const PREVIEW_SIZE = 5

function formatCents(cents: number | null, isEstimate = false): string {
  if (cents == null) return '—'
  const prefix = isEstimate ? '~' : ''
  const dollars = cents / 100
  if (dollars < 0.01) return `${prefix}$${dollars.toFixed(4)}`
  if (dollars < 1) return `${prefix}$${dollars.toFixed(3)}`
  return `${prefix}$${dollars.toFixed(2)}`
}

export function ActivityPreview() {
  const [entries, setEntries] = useState<Array<ActivityEntry>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    listActivity({ page: 0, pageSize: PREVIEW_SIZE })
      .then((r) => {
        if (cancelled) return
        setEntries(r.entries)
      })
      .catch(() => {
        if (cancelled) return
        setEntries([])
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Recent activity</h3>
        <Link href="/activity" className={styles.viewAll}>
          View all
          <ArrowRight className={styles.viewAllIcon} />
        </Link>
      </div>

      {isLoading && entries.length === 0 ? (
        <div className={styles.empty}>Loading…</div>
      ) : entries.length === 0 ? (
        <div className={styles.empty}>Nothing to show yet.</div>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => {
            const thumb = entry.thumbnailPath
              ? imageUrl(entry.id, 'thumb')
              : null
            return (
              <li
                key={entry.id}
                className={clsx(
                  styles.row,
                  entry.isDeleted && styles.rowDeleted,
                )}
              >
                <div className={styles.thumb}>
                  {thumb ? (
                    <img
                      src={thumb}
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
                <div className={styles.meta}>
                  <span className={styles.modelName}>{entry.modelName}</span>
                  <span className={styles.prompt}>
                    {entry.prompt || 'No prompt'}
                  </span>
                </div>
                {/* Grouped rather than three siblings of `.meta` (#406): in the
                    overview's 1fr column all three fought the model name for
                    the same line and the name lost, leaving rows of numbers
                    with nothing to identify them. As one block it can drop to
                    its own line when the card is narrow. */}
                <div className={styles.tail}>
                  <span className={styles.duration}>
                    {entry.durationMs != null
                      ? formatDurationMs(entry.durationMs)
                      : '—'}
                  </span>
                  <span className={styles.cost}>
                    {formatCents(entry.providerCostCents, entry.costIsEstimate)}
                  </span>
                  <span className={styles.time}>
                    {formatRelativeOrDate(entry.createdAt)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
