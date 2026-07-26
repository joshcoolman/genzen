'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listActivity } from '../server/list-activity.server'
import type { ActivityEntry, ActivityFilters, ActivityTotals } from '../types'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { checkPendingGenerations } from '@/lib/server/check-pending-generations.server'

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
  const { user } = useAuth()
  const userId = user.id

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

  // Realtime: refetch (debounced) on any user_images change for this user.
  // Batches rapid-fire updates when many generations complete at once.
  const refetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!userId) return

    const scheduleRefetch = () => {
      if (refetchDebounceRef.current) clearTimeout(refetchDebounceRef.current)
      refetchDebounceRef.current = setTimeout(() => {
        refetch({ silent: true })
      }, 400)
    }

    const channel = supabase
      .channel(`activity_changes_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_images',
          filter: `user_id=eq.${userId}`,
        },
        scheduleRefetch,
      )
      .subscribe()

    return () => {
      if (refetchDebounceRef.current) clearTimeout(refetchDebounceRef.current)
      void supabase.removeChannel(channel)
    }
  }, [userId, refetch])

  // Poll for pending rows so this page progresses even when the user isn't on
  // AI Images. Runs only while work is live.
  const hasPendingWork = entries.some((e) => e.status === 'pending')
  useEffect(() => {
    if (!hasPendingWork) return
    checkPendingGenerations().catch(() => {})
    const interval = setInterval(() => {
      checkPendingGenerations().catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [hasPendingWork])

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
