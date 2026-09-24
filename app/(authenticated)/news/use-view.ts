'use client'

import { useCallback, useState } from 'react'
import { deleteNewsPost, getNews, regenHeroImage } from './_actions/news'
import type { NewsPost } from '#/lib/types/db'
import type { WireError } from '#/lib/effect/result'

/**
 * Every action here returns `{ ok, value } | { ok, error }` rather than
 * throwing (#721), so there is no `try`/`catch` and no `err instanceof Error`
 * dance. The failure arrives as data with a `_tag` on it, which is the point:
 * the view can tell a missing API key from a refused picture without reading a
 * message string, and a defect never reaches here at all -- it is logged
 * server-side as a `Cause` and crosses as `Unexpected`.
 */
export function useView(initial: Array<NewsPost>) {
  const [posts, setPosts] = useState(initial)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<WireError | null>(null)
  const [regenIds, setRegenIds] = useState<Set<string>>(new Set())

  const fetchNews = useCallback(async (guidance: string) => {
    setIsFetching(true)
    setError(null)
    const result = await getNews(guidance)
    if (result.ok) setPosts(result.value)
    else setError(result.error)
    setIsFetching(false)
  }, [])

  const regenImage = useCallback(async (postId: string) => {
    setRegenIds((s) => new Set(s).add(postId))
    const result = await regenHeroImage(postId)
    if (result.ok && result.value) {
      const heroId = result.value
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, hero_image_id: heroId } : p,
        ),
      )
    } else if (!result.ok) {
      setError(result.error)
    }
    setRegenIds((s) => {
      const next = new Set(s)
      next.delete(postId)
      return next
    })
  }, [])

  const deletePost = useCallback(async (postId: string) => {
    // Optimistic, and it does not put the card back on failure: the only way
    // this fails is the development-only guard in the action, which cannot
    // fire in the build that draws the control.
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    const result = await deleteNewsPost(postId)
    if (!result.ok) setError(result.error)
  }, [])

  return {
    posts,
    isFetching,
    error,
    fetchNews,
    regenIds,
    regenImage,
    deletePost,
  }
}
