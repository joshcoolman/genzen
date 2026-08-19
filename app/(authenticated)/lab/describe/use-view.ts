'use client'

import { useCallback, useState } from 'react'
import type { PickedImage } from '../_components/image-input/image-input'
import { captionImage } from '#/features/ai-images/server/caption-image.action'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { useAuth } from '#/lib/auth'

/**
 * Describe has two modes and the app only ever used one.
 *
 * `reconstruct` writes a prompt meant to regenerate the picture; `anchor` writes
 * a short factual description meant to steer an image-to-image run. They are
 * different jobs with different instruction files, and the dialog this replaces
 * hard-coded `reconstruct` — so half the feature has never been visible.
 */
export type DescribeMode = 'reconstruct' | 'anchor'

export const MODE_FILES: Record<DescribeMode, string> = {
  reconstruct: 'src/lib/prompts/describe-reconstruct.md',
  anchor: 'src/lib/prompts/describe-anchor.md',
}

export interface DescribeRun {
  mode: DescribeMode
  title: string
  output: string
}

export function useView() {
  const { user } = useAuth()
  const userImages = useUserImages(user.id)

  const [picked, setPicked] = useState<Array<PickedImage>>([])
  const [mode, setMode] = useState<DescribeMode>('reconstruct')
  const [runs, setRuns] = useState<Array<DescribeRun>>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const image = picked.at(0)

  const run = useCallback(async () => {
    if (!image) return
    setIsRunning(true)
    setError(null)
    try {
      const { caption } = await captionImage({ imageId: image.id, mode })
      setRuns((current) => [
        { mode, title: image.title, output: caption },
        ...current,
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Describe failed')
    } finally {
      setIsRunning(false)
    }
  }, [image, mode])

  return {
    userImages,
    picked,
    setPicked,
    clearPicked: useCallback(() => setPicked([]), []),
    mode,
    setMode,
    runs,
    clear: useCallback(() => setRuns([]), []),
    isRunning,
    error,
    canRun: !!image && !isRunning,
    run,
  }
}
