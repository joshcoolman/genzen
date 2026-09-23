'use client'

import { useCallback, useState } from 'react'
import { getNews } from './_actions/news'
import type { NewsPost } from '#/lib/types/db'

export function useView(initial: Array<NewsPost>) {
  const [posts, setPosts] = useState(initial)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return { posts, isFetching, error, fetchNews }
}
