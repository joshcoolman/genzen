'use client'

import { useCallback, useState } from 'react'
import type { PickedImage } from '../_components/image-input/image-input'
import { generateVariationPrompts } from '#/features/ai-images/server/generate-variation-prompts.action'
import { writePanelHandoff } from '#/lib/panel-handoff'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { useAuth } from '#/lib/auth'

export interface VariationRun {
  /** Stable across the list, which prepends -- an index would move under the
   *  "Loaded" flag every time a new run lands. */
  key: number
  guidance: string
  title: string
  prompts: Array<string>
  source: PickedImage
}

/** The action caps at 4 (`Math.min(data.count, 4)`), so offering more would be
 *  a control that lies. */
export const COUNTS = [1, 2, 3, 4]

/**
 * Variations, on its own page (#424).
 *
 * The question here is not "are these good prompts" in the abstract — it is
 * **does it understand what I asked for**. So the guidance you gave is kept
 * beside what came back, and runs accumulate: two runs of the same image with
 * different guidance next to each other is the comparison worth making.
 *
 * The dialog this replaces fired the prompts immediately. Here they are the
 * output — nothing is generated and nothing is spent.
 */
export function useView() {
  const { user } = useAuth()
  const userImages = useUserImages(user.id)

  const [picked, setPicked] = useState<Array<PickedImage>>([])
  const [guidance, setGuidance] = useState('')
  const [count, setCount] = useState(4)
  const [runs, setRuns] = useState<Array<VariationRun>>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState<number | null>(null)

  const image = picked.at(0)

  const run = useCallback(async () => {
    if (!image) return
    setIsRunning(true)
    setError(null)
    try {
      const result = await generateVariationPrompts({
        // The action requires a non-empty prompt and uses it as the root
        // description. The image's own title is what the app passes; keeping
        // that means this page exercises the same path the app does.
        prompt: image.title,
        sourceImageId: image.id,
        count,
        guidance: guidance.trim() || undefined,
      })
      setRuns((current) => [
        {
          key: current.length + 1,
          guidance: guidance.trim(),
          title: image.title,
          prompts: result.prompts,
          source: image,
        },
        ...current,
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Variations failed')
    } finally {
      setIsRunning(false)
    }
  }, [image, count, guidance])

  /**
   * Hand a run to the Images panel and say so (#433).
   *
   * The page could copy the prompts out one at a time -- that is what it did,
   * and four copies, four pastes and re-attaching the source by hand is why
   * this page could judge the prompts but never the pictures.
   *
   * **It fills a form and stops.** Nothing generates, nothing is spent, and
   * nothing here follows what Images then does with it: that would be
   * cross-route state, which is not what the lab is for. The flag is local --
   * if the panel changes underneath it, the button is stale and that is fine.
   */
  const loadInImages = useCallback((variationRun: VariationRun) => {
    writePanelHandoff({
      // The guidance leads, per #433. Note that the panel runs every non-empty
      // prompt, so this is a generation of its own.
      prompts: variationRun.guidance
        ? [variationRun.guidance, ...variationRun.prompts]
        : variationRun.prompts,
      primaryImage: variationRun.source,
    })
    setLoadedKey(variationRun.key)
  }, [])

  return {
    userImages,
    loadInImages,
    loadedKey,
    picked,
    setPicked,
    clearPicked: useCallback(() => setPicked([]), []),
    guidance,
    setGuidance,
    count,
    setCount,
    runs,
    clear: useCallback(() => setRuns([]), []),
    isRunning,
    error,
    canRun: !!image && !isRunning,
    run,
  }
}
