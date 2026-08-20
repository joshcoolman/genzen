'use client'

import { useCallback, useState } from 'react'
import type { PickedImage } from '../_components/image-input/image-input'
import { generateVariationPrompts } from '#/features/ai-images/server/generate-variation-prompts.action'
import { MAX_VARIATION_IMAGES } from '#/features/ai-images/constants'
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
  /** The set the prompts were written against, in the order they were shown to
   *  the model. Handed over whole, because a prompt may name "image 2". */
  sources: Array<PickedImage>
}

/** The action caps at 4 (`Math.min(data.count, 4)`), so offering more would be
 *  a control that lies. */
export const COUNTS = [1, 2, 3, 4]

export { MAX_VARIATION_IMAGES }

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
 *
 * **Several images is a different question, asked on the same page** (#436).
 * "Combine these and match the illustration style of the one with the clouds"
 * is a variation, and it needs the model to see every picture and to be able to
 * name them. Which instruction file steers a run therefore depends on how many
 * images are in it, and the page says which one is live.
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
        // description when there is no picture it can read. The image's own
        // title is what the app passes; keeping that means this page exercises
        // the same path the app does.
        prompt: image.title,
        sourceImageIds: picked.map((p) => p.id),
        count,
        guidance: guidance.trim() || undefined,
      })
      setRuns((current) => [
        {
          key: current.length + 1,
          guidance: guidance.trim(),
          title: picked.length === 1 ? image.title : `${picked.length} images`,
          prompts: result.prompts,
          sources: picked,
        },
        ...current,
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Variations failed')
    } finally {
      setIsRunning(false)
    }
  }, [image, picked, count, guidance])

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
      // Guidance rides on every prompt rather than going over as a prompt of
      // its own (#436). It is standing context for the whole run -- keep the
      // sparkles, drop the DJ set -- and the panel runs every non-empty
      // prompt, so a slot of its own was one generation of the context and N
      // that had never heard it. Concatenated, not labelled as two halves: the
      // panel has no notion of a two-part prompt.
      prompts: variationRun.guidance
        ? variationRun.prompts.map((p) => `${variationRun.guidance}\n\n${p}`)
        : variationRun.prompts,
      // The whole set, in the order the prompts were written against.
      images: variationRun.sources,
    })
    setLoadedKey(variationRun.key)
  }, [])

  return {
    userImages,
    loadInImages,
    loadedKey,
    picked,
    /** Appends what the picker hands back, minus anything already on the strip
     *  and anything past `MAX_VARIATION_IMAGES`. The picker returns only what
     *  was newly ticked, so replacing would drop the set built up over two
     *  visits to it -- and here order is the contract, so an append is also
     *  what keeps "image 2" meaning the second one you chose. */
    addPicked: useCallback((incoming: Array<PickedImage>) => {
      setPicked((current) => {
        const have = new Set(current.map((p) => p.id))
        return [...current, ...incoming.filter((p) => !have.has(p.id))].slice(
          0,
          MAX_VARIATION_IMAGES,
        )
      })
    }, []),
    removePicked: useCallback(
      (id: string) => setPicked((prev) => prev.filter((p) => p.id !== id)),
      [],
    ),
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
    /** Which file is steering the next run. The lab's whole point is editing
     *  the instruction and looking at what happens, so a page that forked its
     *  instruction has to say which fork is live. */
    instructionFile:
      picked.length > 1
        ? 'src/lib/prompts/image-variation-multi.md'
        : 'src/lib/prompts/image-variation.md',
  }
}
