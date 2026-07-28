'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ActivityDetailPanel } from '../activity-detail-panel/activity-detail-panel'
import { ActivityFilters } from '../activity-filters/activity-filters'
import { ActivityRow } from '../activity-row/activity-row'
import { ActivityTotals } from '../activity-totals/activity-totals'
import styles from './activity-page.module.css'
import { useActivityPage } from '#/features/activity/hooks/use-activity-page'

export function ActivityPage() {
  const {
    entries,
    total,
    totalPages,
    totals,
    isLoading,
    page,
    setPage,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    getThumbUrl,
  } = useActivityPage()

  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Cycle through entries with arrow keys while the detail panel is open.
  useEffect(() => {
    if (!selectedId) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      const idx = entries.findIndex((entry) => entry.id === selectedId)
      if (idx === -1) return
      const nextIdx = e.key === 'ArrowRight' ? idx + 1 : idx - 1
      if (nextIdx < 0 || nextIdx >= entries.length) return
      e.preventDefault()
      setSelectedId(entries[nextIdx].id)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId, entries])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Activity</h1>
        <p className={styles.subtitle}>
          Every generation you&apos;ve run. Includes failures and deleted items.
        </p>
      </header>

      <ActivityTotals totals={totals} hasActiveFilters={hasActiveFilters} />

      <ActivityFilters
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Column headers */}
      <div className={styles.columns}>
        <div />
        <div>Model</div>
        <div>Prompt</div>
        <div>Status</div>
        <div>Duration</div>
        <div>Cost</div>
        <div className={styles.columnTime}>Time</div>
      </div>

      {/* List */}
      <div className={styles.list}>
        {isLoading && entries.length === 0 ? (
          <div className={styles.placeholder}>Loading activity…</div>
        ) : entries.length === 0 ? (
          <div className={styles.placeholder}>
            {hasActiveFilters
              ? 'Nothing matches the current filters.'
              : 'Nothing to show yet.'}
          </div>
        ) : (
          entries.map((entry) => (
            <ActivityRow
              key={entry.id}
              entry={entry}
              thumbnailUrl={getThumbUrl(entry.thumbnailPath)}
              onSelect={setSelectedId}
            />
          ))
        )}
      </div>

      <ActivityDetailPanel
        entryId={selectedId}
        onClose={() => setSelectedId(null)}
        getThumbUrl={getThumbUrl}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span>
            Page {page + 1} of {totalPages} · {total.toLocaleString()} run
            {total === 1 ? '' : 's'}
          </span>
          <div className={styles.pageButtons}>
            <button
              type="button"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className={styles.pageButton}
              aria-label="Previous page"
            >
              <ChevronLeft className={styles.pageButtonIcon} />
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className={styles.pageButton}
              aria-label="Next page"
            >
              <ChevronRight className={styles.pageButtonIcon} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
