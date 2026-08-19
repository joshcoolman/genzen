'use client'

import { useCallback, useState } from 'react'
import { enhancePrompt } from '#/features/ai-images/server/enhance-prompt.action'

export interface EnhanceRun {
  /** What went in. Kept beside the result, because "too verbose" only means
   *  something next to what it was verbose about. */
  input: string
  output: string
}

/**
 * Enhance, on its own page (#424).
 *
 * The panel's version threw the result straight back into the box it came from,
 * so there was no before, no after and nothing to compare — which is why nobody
 * could tell whether an edit to `enhance-prompt.md` helped, and so nobody
 * edited it. Runs accumulate here instead, newest first, until you leave.
 */
export function useView() {
  const [prompt, setPrompt] = useState('')
  const [runs, setRuns] = useState<Array<EnhanceRun>>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    const input = prompt.trim()
    if (!input) return
    setIsRunning(true)
    setError(null)
    try {
      const { enhancedPrompt: output } = await enhancePrompt({ prompt: input })
      setRuns((current) => [{ input, output }, ...current])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enhance failed')
    } finally {
      setIsRunning(false)
    }
  }, [prompt])

  const clear = useCallback(() => setRuns([]), [])

  return {
    prompt,
    setPrompt,
    runs,
    isRunning,
    error,
    canRun: prompt.trim().length > 0 && !isRunning,
    run,
    clear,
  }
}
