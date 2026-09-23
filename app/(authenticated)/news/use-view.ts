'use client'

import { useCallback, useState } from 'react'
import { getNews, regenHeroImage } from './_actions/news'
import type { NewsPost } from '#/lib/types/db'

export function useView(initial: Array<NewsPost>) {
  const [posts, setPosts] = useState(initial)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regenIds, setRegenIds] = useState<Set<string>>(new Set())

  const fetchNews = useCallback(async (guidance: string) => {
    setIsFetching(true)
    setError(null)
    try {
      const updated = await getNews(guidance)
      setPosts(updated)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
    } finally {
      setIsFetching(false)
    }
  }, [])

  const regenImage = useCallback(async (postId: string) => {
    setRegenIds((s) => new Set(s).add(postId))
    try {
      const heroId = await regenHeroImage(postId)
      if (heroId) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, hero_image_id: heroId } : p,
          ),
        )
      }
    } finally {
      setRegenIds((s) => {
        const next = new Set(s)
        next.delete(postId)
        return next
      })
    }
  }, [])

  return { posts, isFetching, error, fetchNews, regenIds, regenImage }
}
