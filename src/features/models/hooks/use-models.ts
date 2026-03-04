import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchModels } from '../server/fetch-models.server'
import type { FalModel, ModelCategory } from '../types'

// Module-level cache — survives unmount/remount
const cache: Record<
  string,
  {
    pages: Array<Array<FalModel>>
    nextCursor: string | null
    hasMore: boolean
  }
> = {}

function cacheKey(category: string, search: string) {
  return `${category}:${search}`
}

export function useModels() {
  const [pages, setPages] = useState<Array<Array<FalModel>>>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [category, setCategory] = useState<ModelCategory>('all')
  const [search, setSearch] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    async (opts: { append?: boolean; cursor?: string } = {}) => {
      if (opts.append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      try {
        const result = await fetchModels({
          data: {
            category: category === 'all' ? undefined : category,
            q: search || undefined,
            next_cursor: opts.cursor ?? undefined,
          },
        })

        const dedupe = (
          newItems: Array<FalModel>,
          existing: Array<FalModel>,
        ) => {
          const seen = new Set(existing.map((m) => m.endpoint_id))
          return newItems.filter((m) => {
            if (seen.has(m.endpoint_id)) return false
            seen.add(m.endpoint_id)
            return true
          })
        }

        let newPages: Array<Array<FalModel>>
        if (opts.append) {
          setPages((prev) => {
            const allExisting = prev.flat()
            newPages = [...prev, dedupe(result.data, allExisting)]
            // Update cache
            const key = cacheKey(category, search)
            cache[key] = {
              pages: newPages,
              nextCursor: result.next_cursor,
              hasMore: result.has_more,
            }
            return newPages
          })
        } else {
          const seen = new Set<string>()
          const unique = result.data.filter((m: FalModel) => {
            if (seen.has(m.endpoint_id)) return false
            seen.add(m.endpoint_id)
            return true
          })
          newPages = [unique]
          setPages(newPages)
          // Update cache
          const key = cacheKey(category, search)
          cache[key] = {
            pages: newPages,
            nextCursor: result.next_cursor,
            hasMore: result.has_more,
          }
        }
        setNextCursor(result.next_cursor)
        setHasMore(result.has_more)
      } catch (err) {
        console.error('Failed to fetch models:', err)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [category, search],
  )

  useEffect(() => {
    // Check cache first
    const key = cacheKey(category, search)
    const cached = cache[key] as (typeof cache)[string] | undefined
    if (cached) {
      setPages(cached.pages)
      setNextCursor(cached.nextCursor)
      setHasMore(cached.hasMore)
      setLoading(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      load()
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [load, category, search])

  const loadMore = useCallback(() => {
    if (nextCursor && !loadingMore) {
      load({ append: true, cursor: nextCursor })
    }
  }, [nextCursor, loadingMore, load])

  const reload = useCallback(() => {
    const key = cacheKey(category, search)
    delete cache[key]
    load()
  }, [category, search, load])

  return {
    pages,
    loading,
    loadingMore,
    category,
    setCategory,
    search,
    setSearch,
    hasMore,
    loadMore,
    reload,
  }
}
