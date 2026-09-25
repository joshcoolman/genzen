'use client'

import { useCallback, useRef, useState } from 'react'
import { useRunOverlay } from '../_components/run-overlay/run-overlay-provider'
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

  const runOverlay = useRunOverlay()
  const known = useRef(new Set(initial.map((p) => p.id)))
  known.current = new Set(posts.map((p) => p.id))

  /**
   * The overlay shows only what is true today (#725): one activity for the
   * whole call, then the real outcome. Research, writing and heroes are one
   * server action that reports nothing until it returns, so there are no
   * snippets and no slots until #737 makes the run observable.
   */
  const fetchNews = useCallback(
    (guidance: string) => {
      setIsFetching(true)
      setError(null)
      runOverlay.start('News', (emit) => {
        emit({ kind: 'activity', text: 'Researching and writing' })
        void getNews(guidance).then((result) => {
          if (result.ok) {
            const added = result.value.filter(
              (p) => !known.current.has(p.id),
            ).length
            setPosts(result.value)
            emit(
              added > 0
                ? {
                    kind: 'end',
                    outcome: 'success',
                    text: `${added} new ${added === 1 ? 'article' : 'articles'} ready`,
                    href: '/news',
                  }
                : {
                    kind: 'end',
                    outcome: 'empty',
                    text: 'Nothing new this time',
                  },
            )
          } else {
            setError(result.error)
            emit({ kind: 'end', outcome: 'failed', text: result.error.message })
          }
          setIsFetching(false)
        })
        // Not cancellable: the server action runs to completion either way.
        return () => {}
      })
    },
    [runOverlay],
  )

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
