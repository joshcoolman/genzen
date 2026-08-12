'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { generateVideo, listVideos } from './_actions/generate-video.action'
import { DEFAULT_VIDEO_MODEL, estimateCostCents } from './models'
import type { VideoRecord } from './_actions/generate-video.action'
import { checkPendingGenerations } from '#/lib/server/check-pending-generations.action'
import { toast } from '#/components'

export interface VideoSource {
  id: string
  title: string
}

/**
 * The state `view.tsx` renders.
 *
 * The first read is the server component's, so there is no loading state and no
 * empty first paint. After that a 5s poll is the only update signal -- nothing
 * pushes, exactly as the gallery works: each tick asks FAL whether anything
 * settled and then re-reads the list.
 */
export function useView(
  initialVideos: Array<VideoRecord>,
  sources: Array<VideoSource>,
) {
  const searchParams = useSearchParams()
  const model = DEFAULT_VIDEO_MODEL

  const [videos, setVideos] = useState(initialVideos)
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(model.defaultDuration)
  const [aspectRatio, setAspectRatio] = useState(model.aspectRatios[0])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // `?image=<id>` is how the Animate action hands a card over. Falls back to
  // the first available source so the route is usable when visited directly.
  const [sourceId, setSourceId] = useState<string | null>(
    searchParams.get('image') ?? sources.at(0)?.id ?? null,
  )

  const hasPending = useMemo(
    () => videos.some((video) => video.status === 'pending'),
    [videos],
  )

  const refresh = useCallback(async () => {
    try {
      setVideos(await listVideos())
    } catch {
      // A failed poll is not worth a toast -- the next tick re-reads.
    }
  }, [])

  useEffect(() => {
    if (!hasPending) return

    const tick = async () => {
      try {
        await checkPendingGenerations()
      } catch {
        // Swallowed for the same reason as above.
      }
      await refresh()
    }

    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [hasPending, refresh])

  const estimatedCost = estimateCostCents(model, duration)

  const canSubmit = !!sourceId && prompt.trim().length > 0 && !isSubmitting

  const submit = useCallback(async () => {
    if (!sourceId || !prompt.trim()) return

    setIsSubmitting(true)
    try {
      await generateVideo({
        imageId: sourceId,
        prompt,
        duration,
        aspectRatio,
        modelSlug: model.slug,
      })
      // Refresh once so the pending card appears; the poll takes it from here.
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsSubmitting(false)
    }
  }, [sourceId, prompt, duration, aspectRatio, model.slug, refresh])

  return {
    model,
    sources,
    sourceId,
    setSourceId,
    videos,
    prompt,
    setPrompt,
    duration,
    setDuration,
    aspectRatio,
    setAspectRatio,
    estimatedCost,
    isSubmitting,
    canSubmit,
    submit,
  }
}
