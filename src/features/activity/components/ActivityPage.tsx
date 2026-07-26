'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useActivityPage } from '../hooks/use-activity-page'
import { ActivityDetailPanel } from './ActivityDetailPanel'
import { ActivityFilters } from './ActivityFilters'
import { ActivityRow } from './ActivityRow'
import { ActivityTotals } from './ActivityTotals'

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
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="text-sm text-muted-foreground">
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
      <div className="grid grid-cols-[48px_minmax(0,1.2fr)_minmax(0,2fr)_110px_80px_90px_minmax(130px,_auto)] items-center gap-3 px-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <div />
        <div>Model</div>
        <div>Prompt</div>
        <div>Status</div>
        <div>Duration</div>
        <div>Cost</div>
        <div className="text-right">Time</div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading && entries.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
            Loading activity…
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
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
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {totalPages} · {total.toLocaleString()} run
            {total === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-input bg-background text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-input bg-background text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
