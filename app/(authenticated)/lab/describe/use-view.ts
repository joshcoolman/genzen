'use client'

import { useCallback, useState } from 'react'
import type { PickedImage } from '../_components/image-input/image-input'
import type { DescribeMode } from '#/lib/prompts/describe'
import { captionImage } from '#/features/ai-images/server/caption-image.action'
import { DESCRIBE_MODES } from '#/lib/prompts/describe'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { useAuth } from '#/lib/auth'

export interface DescribeRun {
  mode: DescribeMode
  title: string
  output: string
}

export function useView() {
  const { user } = useAuth()
  const userImages = useUserImages(user.id)

  const [picked, setPicked] = useState<Array<PickedImage>>([])
  const [mode, setMode] = useState<DescribeMode>(DESCRIBE_MODES[0].id)
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
