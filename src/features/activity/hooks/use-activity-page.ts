'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listActivity } from '../server/list-activity.server'
import type { ActivityEntry, ActivityFilters, ActivityTotals } from '../types'
import { checkPendingGenerations } from '#/lib/server/check-pending-generations.server'

const PAGE_SIZE = 50

const EMPTY_FILTERS: ActivityFilters = {
  models: [],
  statuses: [],
  dateFrom: null,
  dateTo: null,
}

const EMPTY_TOTALS: ActivityTotals = {
  count: 0,
  totalDurationMs: 0,
  totalProviderCostCents: 0,
  totalsIncludeEstimates: false,
  exceedsCap: false,
}

export function useActivityPage() {
  const [entries, setEntries] = useState<Array<ActivityEntry>>([])
  const [total, setTotal] = useState(0)
  const [totals, setTotals] = useState<ActivityTotals>(EMPTY_TOTALS)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [filters, setFiltersState] = useState<ActivityFilters>(EMPTY_FILTERS)

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
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      })
        .then((result) => {
          if (id !== fetchRef.current) return
          setEntries(result.entries)
          setTotal(result.total)
          setTotals(result.totals)
        })
        .catch(() => {
          if (id !== fetchRef.current) return
          setEntries([])
          setTotal(0)
          setTotals(EMPTY_TOTALS)
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
  // AI Images. Runs only while work is live.
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

  const setFilters = (next: ActivityFilters) => {
    setFiltersState(next)
    setPage(0)
  }

  const clearFilters = () => setFilters(EMPTY_FILTERS)

  const hasActiveFilters =
    filters.models.length > 0 ||
    filters.statuses.length > 0 ||
    filters.dateFrom != null ||
    filters.dateTo != null

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return {
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
  }
}
