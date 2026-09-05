'use client'

import { useCallback, useState } from 'react'
import {
  generateRefVideo,
  listRefVideos,
} from './_actions/generate-ref-video.action'
import {
  DEFAULT_ASPECT_RATIO,
  DEFAULT_DURATION,
  DURATIONS,
  MAX_IMAGES,
  estimateCostCents,
} from './seedance'
import type { RefVideoRecord } from './_actions/generate-ref-video.action'
import type { PickedImage } from '../_components/image-input/image-input'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'
import { useAuth } from '#/lib/auth'

export { DURATIONS, MAX_IMAGES }

/**
 * Video from reference images (#462).
 *
 * The clips are ordinary generations: reserved row, queue, the app's own poll.
 * They are in the library from the moment they are asked for and the spend is
 * in Activity -- the page holds only which ids this session made, which is the
 * part that is lost on navigation like every other lab page.
 */
export function useView() {
  const { user } = useAuth()
  const userImages = useUserImages(user.id)

  const [picked, setPicked] = useState<Array<PickedImage>>([])
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState<string>(DEFAULT_DURATION)
  const [records, setRecords] = useState<Array<RefVideoRecord>>([])
  const [ids, setIds] = useState<Array<string>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const removePicked = useCallback((id: string) => {
    setPicked((current) => current.filter((image) => image.id !== id))
  }, [])

  const refreshRecords = useCallback(async (forIds: Array<string>) => {
    if (forIds.length === 0) return
    const rows = await listRefVideos(forIds).catch(() => null)
    if (rows) setRecords(rows)
  }, [])

  const generate = useCallback(async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      const { recordId } = await generateRefVideo({
        imageIds: picked.map((image) => image.id),
        prompt,
        duration,
        aspectRatio: DEFAULT_ASPECT_RATIO,
      })
      const next = [recordId, ...ids]
      setIds(next)
      await refreshRecords(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsSubmitting(false)
    }
  }, [duration, ids, picked, prompt, refreshRecords])

  const pending = records.find((record) => record.status === 'pending')

  useGenerationPoll(pending?.created_at ?? null, () => refreshRecords(ids))

  return {
    userImages,
    picked,
    addPicked: setPicked,
    removePicked,
    prompt,
    setPrompt,
    duration,
    setDuration,
    records,
    isSubmitting,
    error,
    generate,
    estimatedCostCents: estimateCostCents(duration),
    canGenerate: picked.length > 0 && prompt.trim().length > 0 && !isSubmitting,
  }
}
