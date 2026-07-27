'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import type { ActivityEntry } from '#/features/activity/types'
import { listActivity } from '#/features/activity/server/list-activity.server'
import { formatDurationMs, formatRelativeOrDate } from '#/lib/time-format'
import { cn } from '#/lib/utils'

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

  const getThumbUrl = useMemo(() => {
    const base = process.env.VITE_R2_PUBLIC_URL?.replace(/\/$/, '') ?? ''
    return (path: string | null): string | null => {
      if (!base || !path) return null
      return `${base}/${path}`
    }
  }, [])

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
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="font-medium">Recent activity</h3>
        <Link
          href="/dashboard/activity"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading && entries.length === 0 ? (
        <div className="px-6 py-6 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : entries.length === 0 ? (
        <div className="px-6 py-6 text-center text-sm text-muted-foreground">
          Nothing to show yet.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((entry) => {
            const thumb = getThumbUrl(entry.thumbnailPath)
            return (
              <li
                key={entry.id}
                className={cn(
                  'flex items-center gap-3 px-6 py-3 text-sm',
                  entry.isDeleted && 'opacity-60',
                )}
              >
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-black">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted/50">
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs font-medium text-foreground">
                    {entry.modelName}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {entry.prompt || 'No prompt'}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {entry.durationMs != null
                    ? formatDurationMs(entry.durationMs)
                    : '—'}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-foreground">
                  {formatCents(entry.providerCostCents, entry.costIsEstimate)}
                </span>
                <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                  {formatRelativeOrDate(entry.createdAt)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
