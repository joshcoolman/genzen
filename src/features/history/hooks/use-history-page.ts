import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { listHistory } from '../server/list-history.server'
import type { GenerationMetadata, HistoryEntry, ViewMode } from '../types'
import { useAuth } from '@/lib/auth'
import { getModelName } from '@/features/ai-images/models'

const PAGE_SIZE = 24
const SEARCH_DEBOUNCE_MS = 300
const VIEW_PREFS_KEY = 'history-view-prefs'

function parseEntry(
  row: {
    id: string
    storage_path: string
    generation_metadata: unknown
    created_at: string
  },
  getUrl: (path: string) => string | null,
): HistoryEntry {
  const meta = (row.generation_metadata ?? {}) as GenerationMetadata
  return {
    id: row.id,
    storagePath: row.storage_path,
    prompt: meta.prompt ?? '',
    modelName: meta.model ? getModelName(meta.model) : 'Unknown',
    elapsedMs: meta.elapsed ?? null,
    createdAt: row.created_at,
    seed: meta.seed != null ? String(meta.seed) : null,
    thumbnailUrl: getUrl(row.storage_path),
  }
}

function loadViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_PREFS_KEY)
    if (stored === 'list' || stored === 'grid') return stored
  } catch {
    /* noop */
  }
  return 'grid'
}

export function useHistoryPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const accessToken = session?.access_token

  const [entries, setEntries] = useState<Array<HistoryEntry>>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  // Persist view mode
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_PREFS_KEY, viewMode)
    } catch {
      /* noop */
    }
  }, [viewMode])

  // Build URL resolver once
  const getUrl = useMemo(() => {
    const publicUrl =
      (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ?? ''
    return (path: string): string | null => {
      if (!publicUrl) return null
      return `${publicUrl.replace(/\/$/, '')}/${path}`
    }
  }, [])

  // Fetch
  const fetchRef = useRef(0)
  useEffect(() => {
    if (!accessToken) return
    const id = ++fetchRef.current
    setIsLoading(true)

    listHistory({
      data: {
        accessToken,
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      },
    })
      .then((result) => {
        if (id !== fetchRef.current) return
        setEntries(result.entries.map((row: any) => parseEntry(row, getUrl)))
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
  }, [accessToken, debouncedSearch, page, getUrl])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const copyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      /* noop */
    }
  }, [])

  const useAgain = useCallback(
    (prompt: string) => {
      try {
        localStorage.setItem('genzen:prompts', JSON.stringify([prompt]))
      } catch {
        /* noop */
      }
      navigate({ to: '/dashboard/ai-images' })
    },
    [navigate],
  )

  const toggleView = useCallback(() => {
    setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))
  }, [])

  return {
    entries,
    total,
    totalPages,
    isLoading,
    search,
    setSearch,
    page,
    setPage,
    viewMode,
    toggleView,
    copyPrompt,
    useAgain,
  }
}
