'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ActivityEntry, ActivityFilters } from '#/features/activity/types'
import { listActivity } from '#/features/activity/server/list-activity.action'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'

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

  /**
   * Which entry's panel is open lives in the URL, so `/activity?entry=<id>`
   * opens straight onto it. That is what an image card's Details link points
   * at, in a new tab -- close the tab and you are back where you were, with
   * the working surface untouched.
   *
   * The entry does not have to be in the list. The list is windowed to the
   * last three active days while the panel fetches by id, so a link to an
   * older generation shows the right detail over a list that does not contain
   * it. Arrow-cycling already no-ops on an entry it cannot find, so this is
   * merely odd rather than broken.
   */
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('entry')

  const setSelectedId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams.toString())
      if (id) next.set('entry', id)
      else next.delete('entry')
      const query = next.toString()
      // Replace, not push: paging through entries with the arrow keys would
      // otherwise stack one history entry per image, and Back would walk them
      // one at a time instead of leaving Activity.
      router.replace(query ? `/activity?${query}` : '/activity', {
        scroll: false,
      })
    },
    [router, searchParams],
  )

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
  // Images -- the same timer Images and Video use (#327). A settled row means
  // this page is stale; realtime no longer delivers the UPDATE (#174), so the
  // poll drives the refetch itself.
  const pendingSince = entries
    .filter((e) => e.status === 'pending')
    .reduce<
      string | null
    >((oldest, e) => (!oldest || e.createdAt < oldest ? e.createdAt : oldest), null)

  useGenerationPoll(pendingSince, () => refetch({ silent: true }))

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
    selectedId,
    setSelectedId,
  }
}
