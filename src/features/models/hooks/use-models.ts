import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchModels } from '../server/fetch-models.server'
import { fetchPricing } from '../server/fetch-pricing.server'
import type { FalModel, FalModelPricing, ModelCategory } from '../types'

export function useModels() {
  const [models, setModels] = useState<Array<FalModel>>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [category, setCategory] = useState<ModelCategory>('all')
  const [search, setSearch] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedModel, setSelectedModel] = useState<FalModel | null>(null)
  const [pricing, setPricing] = useState<FalModelPricing | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)

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

        if (opts.append) {
          setModels((prev) => [...prev, ...result.data])
        } else {
          setModels(result.data)
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
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      load()
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [load])

  const loadMore = useCallback(() => {
    if (nextCursor && !loadingMore) {
      load({ append: true, cursor: nextCursor })
    }
  }, [nextCursor, loadingMore, load])

  const openDetail = useCallback(async (model: FalModel) => {
    setSelectedModel(model)
    setPricing(null)
    setPricingLoading(true)
    try {
      const result = await fetchPricing({
        data: { endpoint_id: model.endpoint_id },
      })
      setPricing(result)
    } catch (err) {
      console.error('Failed to fetch pricing:', err)
    } finally {
      setPricingLoading(false)
    }
  }, [])

  const closeDetail = useCallback(() => {
    setSelectedModel(null)
    setPricing(null)
  }, [])

  return {
    models,
    loading,
    loadingMore,
    category,
    setCategory,
    search,
    setSearch,
    hasMore,
    loadMore,
    selectedModel,
    openDetail,
    closeDetail,
    pricing,
    pricingLoading,
  }
}
