'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ActivityEntry, ActivityFilters } from '#/features/activity/types'
import { listActivity } from '#/features/activity/server/list-activity.server'
import { checkPendingGenerations } from '#/lib/server/check-pending-generations.server'

const PAGE_SIZE = 50

const EMPTY_FILTERS: ActivityFilters = {
  models: [],
  statuses: [],
}

export function useView() {
  const [entries, setEntries] = useState<Array<ActivityEntry>>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [filters, setFiltersState] = useState<ActivityFilters>(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const getThumbUrl = useMemo(() => {
    const base = process.env.VITE_R2_PUBLIC_URL?.replace(/\/$/, '') ?? ''
    return (path: string | null): string | null => {
      if (!base || !path) return null
      return `${base}/${path}`
    }
  }, [])

  const fetchRef = useRef(0)
  const refetch = useCallback(
    (opts?: { silent?: boolean }) => {
      const id = ++fetchRef.current
      if (!opts?.silent) setIsLoading(true)

      listActivity({
        page,
        pageSize: PAGE_SIZE,
        models: filters.models.length > 0 ? filters.models : undefined,
        statuses: filters.statuses.length > 0 ? filters.statuses : undefined,
      })
        .then((result) => {
          if (id !== fetchRef.current) return
          setEntries(result.entries)
          setTotal(result.total)
        })
        .catch(() => {
          if (id !== fetchRef.current) return
          setEntries([])
          setTotal(0)
        })
        .finally(() => {
          if (id !== fetchRef.current) return
          setIsLoading(false)
        })
    },
    [page, filters],
  )

  useEffect(() => {
    refetch()
  }, [refetch])

  // Poll for pending rows so this page progresses even when the user isn't on
  // Images. Runs only while work is live.
  const hasPendingWork = entries.some((e) => e.status === 'pending')
  useEffect(() => {
    if (!hasPendingWork) return
    // A settled row means this page is stale. Realtime no longer delivers the
    // UPDATE (#174), so the poll drives the refetch itself.
    const pollOnce = () =>
      checkPendingGenerations()
        .then((result) => {
          if (result.completed === 0 && result.failed === 0) return
          return refetch({ silent: true })
        })
        .catch(() => {})

    void pollOnce()
    const interval = setInterval(() => {
      void pollOnce()
    }, 5000)
    return () => clearInterval(interval)
  }, [hasPendingWork, refetch])

  // Arrow keys cycle the detail panel through the visible rows. Lives here
  // rather than in the view because it is selection behaviour, not layout --
  // and the view owns no state to hang it on any more.
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

  const setFilters = (next: ActivityFilters) => {
    setFiltersState(next)
    setPage(0)
  }

  const clearFilters = () => setFilters(EMPTY_FILTERS)

  const hasActiveFilters =
    filters.models.length > 0 || filters.statuses.length > 0

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return {
    entries,
    total,
    totalPages,
    isLoading,
    page,
    setPage,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    getThumbUrl,
    selectedId,
    setSelectedId,
  }
}
