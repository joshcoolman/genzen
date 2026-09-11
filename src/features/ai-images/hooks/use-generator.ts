'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { promptImageCount } from '../skills/registry'

import { submitGenerationBatch } from '../submit-generation-batch'
import type { GenerationOrigin } from '#/lib/types/db'
import type { GenerationCallbacks } from '../submit-generation-batch'
import { pushRef } from '#/features/ai-images/ref-images'
import { usePersistedState } from '#/lib/use-persisted-state'
import { useReportError } from '#/components'
import {
  LANDSCAPE_RATIOS,
  PORTRAIT_RATIOS,
  flipOrientation,
  getRatioOptions,
} from '#/features/ai-images/constants'
import {
  estimateImageCostCents,
  imageCapacityFor,
} from '#/features/ai-images/models'
import { systemInstructionsPrefix } from '#/features/ai-images/system-instructions'

const EMPTY_PROMPTS: Array<string> = ['']

/**
 * One image in the generator's set. Always a library row: since #297 the only
 * way an image reaches the generator is by being picked out of the library, so
 * there is no longer a bytes-only member to special-case.
 */
export interface RefImage {
  id: string
  url: string
  title: string
}

interface UseGeneratorOptions extends GenerationCallbacks {
  selectedModels: Array<string>
  gensPerModel: number
  setError: (error: string | null) => void
  /** The surface this generator belongs to, recorded on every row it creates
   *  (#207). Required so a new host cannot be an unmarked generation source. */
  origin: GenerationOrigin
  storagePrefix?: string
  /** The canvas being worked in, if the host is a board. Generations join it
   *  at reserve time, so they are reclaimable on load. Membership only -- which
   *  surface made it is `origin` (#207). */
  canvasId?: string
  /** The group the host is currently inside, or null at top level (#319).
   *  Every generation submitted from in there is filed into it -- that is the
   *  half of a group that makes it a place to work rather than a folder. */
  groupId?: string | null
}

export interface GeneratorState {
  prompt: string
  setPrompt: (prompt: string | ((prev: string) => string)) => void
  prompts: Array<string>
  setPromptAtIndex: (index: number, value: string) => void
  addPrompt: () => void
  removePrompt: (index: number) => void
  orientation: 'landscape' | 'portrait'
  aspectRatio: string
  setAspectRatio: (ratio: string) => void
  loading: boolean
  totalImages: number
  /** Cents this submit is expected to cost, and how many selected models
   *  carry no price so are missing from it (#416). */
  estimatedCost: { cents: number; unpriced: number }
  canGenerate: boolean
  ratioOptions: Array<string>
  selectedStyleId: string | null
  setSelectedStyleId: (id: string | null) => void
  setOrientation: (o: 'landscape' | 'portrait') => void
  handleOrientationToggle: () => void
  handleGenerate: () => Promise<void>
  clearPrompts: () => void
  /** Add prompts to the end of the list, leaving what is there alone. */
  appendPrompts: (texts: Array<string>) => void
  /** Swap the whole list for this one (#433). A handoff from another page
   *  replaces rather than appends: the panel is a single working surface, and
   *  a set of variations merged into a half-written list is a run nobody can
   *  read. An empty list leaves the one blank row the panel always has. */
  replacePrompts: (texts: Array<string>) => void
  /** The set. Ordered and unbounded; index 0 drives the aspect ratio and is
   *  submitted first. Nothing else distinguishes a member. */
  refImages: Array<RefImage>
  addRefImages: (images: Array<RefImage>) => void
  pushRefImage: (image: RefImage) => void
  replaceRefImages: (images: Array<RefImage>) => void
  removeRefImage: (id: string) => void
  /** How many images the *smallest* selected model holds. Advisory since #341:
   *  nothing clamps the set to it. It is what the panel reports, and the submit
   *  truncates per model rather than to this minimum. Zero selected models is
   *  0, which is the one case that still disables the strip -- there is nothing
   *  to attach images to. */
  maxRefImages: number
}

export function useGenerator({
  selectedModels,
  gensPerModel,
  setError,
  origin,
  storagePrefix = 'genzen',
  onAfterSubmit,
  onSubmitStart,
  onSubmitOutcome,
  canvasId,
  groupId,
}: UseGeneratorOptions): GeneratorState {
  // Surfaces failures the user can act on: a missing provider key opens the
  // key dialog, anything else toasts. `setError` alone was not enough — the AI
  // Images page never rendered it, so failures vanished entirely.
  const reportError = useReportError()

  // A ref for the same reason, and a sharper one: leaving a group must not be
  // able to strand an in-flight submit against the group you just left.
  const groupIdRef = useRef(groupId ?? null)
  groupIdRef.current = groupId ?? null
  const promptsKey = `${storagePrefix}:prompts`
  const legacyPromptKey = `${storagePrefix}:prompt`
  const orientationKey = `${storagePrefix}:orientation`
  const aspectRatioKey = `${storagePrefix}:aspect-ratio`

  function persistPrompts(next: Array<string>) {
    localStorage.setItem(promptsKey, JSON.stringify(next))
    localStorage.removeItem(legacyPromptKey)
  }

  const [prompts, setPromptsRaw] = usePersistedState<Array<string>>(() => {
    const stored = localStorage.getItem(promptsKey)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {
        /* ignore */
      }
    }
    const legacy = localStorage.getItem(legacyPromptKey)
    if (legacy) return [legacy]
    return ['']
  }, EMPTY_PROMPTS)

  const prompt = prompts[0]
  const [orientation, setOrientation, orientationHydrated] = usePersistedState<
    'landscape' | 'portrait'
  >(
    () =>
      localStorage.getItem(orientationKey) === 'portrait'
        ? 'portrait'
        : 'landscape',
    'landscape',
  )
  const [aspectRatio, setAspectRatio, aspectRatioHydrated] = usePersistedState(
    () => localStorage.getItem(aspectRatioKey) ?? '16:9',
    '16:9',
  )
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [refImages, setRefImages] = useState<Array<RefImage>>([])

  // Backwards-compat: setPrompt updates prompts[0]
  const setPrompt = useCallback(
    (value: string | ((prev: string) => string)) => {
      setPromptsRaw((prev) => {
        const next = [...prev]
        next[0] = typeof value === 'function' ? value(prev[0]) : value
        persistPrompts(next)
        return next
      })
    },
    [],
  )

  const setPromptAtIndex = useCallback((index: number, value: string) => {
    setPromptsRaw((prev) => {
      const next = [...prev]
      next[index] = value
      persistPrompts(next)
      return next
    })
  }, [])

  const addPrompt = useCallback(() => {
    setPromptsRaw((prev) => {
      const next = [...prev, '']
      persistPrompts(next)
      return next
    })
  }, [])

  const removePrompt = useCallback((index: number) => {
    setPromptsRaw((prev) => {
      // Removing the last row leaves one empty field rather than an empty list:
      // the X never does nothing, and `prompts[0]` always exists for the
      // Cmd-click power move (`images/use-view.ts` -> `setPrompt`).
      const next = prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index)
      persistPrompts(next)
      return next
    })
  }, [])

  const replacePrompts = useCallback((texts: Array<string>) => {
    const next = texts.length > 0 ? texts : ['']
    setPromptsRaw(next)
    persistPrompts(next)
  }, [])

  const appendPrompts = useCallback((texts: Array<string>) => {
    setPromptsRaw((prev) => {
      const next = [...prev, ...texts]
      persistPrompts(next)
      return next
    })
  }, [])

  // Persist orientation + aspect ratio on change. Gated on hydration: before it,
  // these still hold the SSR fallback, and writing that back erases the stored
  // value on every page load.
  useEffect(() => {
    if (!orientationHydrated) return
    localStorage.setItem(orientationKey, orientation)
  }, [orientation, orientationHydrated])

  useEffect(() => {
    if (!aspectRatioHydrated) return
    localStorage.setItem(aspectRatioKey, aspectRatio)
  }, [aspectRatio, aspectRatioHydrated])

  /**
   * The smallest capacity across the selected models -- reported, not enforced
   * (#341).
   *
   * It was a clamp until #341, and the clamp was the problem: ticking a
   * one-image model *deleted* four staged images, and unticking it did not
   * bring them back. Now the set holds what you put in it, each model takes
   * what it can hold, and the row records the difference. The number survives
   * because the panel still shows it; the minimum is the honest summary of a
   * mixed selection.
   *
   * The silent truncation #297 closed is still closed, by the other half of
   * this change: `buildFalInput` reports what it sent, so "same click, same
   * cost, no warning" is now "same click, same cost, and the card says 1 of 5".
   */
  const maxRefImages = useMemo(() => {
    if (selectedModels.length === 0) return 0
    return Math.min(...selectedModels.map(imageCapacityFor))
  }, [selectedModels])

  /** Appends whatever is not already in the set. No cap: see `maxRefImages`. */
  const addRefImages = useCallback((images: Array<RefImage>) => {
    setRefImages((prev) => {
      const existingIds = new Set(prev.map((r) => r.id))
      const newImages = images.filter((img) => !existingIds.has(img.id))
      return [...prev, ...newImages]
    })
  }, [])

  /** The front of the strip: "use this one" goes to slot 0, keeping the rest. */
  const pushRefImage = useCallback((image: RefImage) => {
    setRefImages((prev) => pushRef(prev, image))
  }, [])

  const removeRefImage = useCallback((id: string) => {
    setRefImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  // The aspect ratio follows whatever is in slot 0 (#297). One effect rather
  // than a call inside every mutator: a removal that promotes image 2 to the
  // front is just as much "a new first image" as a pick is, and only a
  // derivation keyed on the slot gets that for free.
  const primaryUrl = refImages[0]?.url
  useEffect(() => {
    if (!primaryUrl) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const { naturalWidth: w, naturalHeight: h } = img
      if (!w || !h) return
      const ratio = w / h
      const isLandscape = ratio >= 1
      const candidates = isLandscape ? LANDSCAPE_RATIOS : PORTRAIT_RATIOS
      const parseRatio = (r: string) => {
        const [a, b] = r.split(':').map(Number)
        return a / b
      }
      const closest = candidates.reduce((best, r) =>
        Math.abs(parseRatio(r) - ratio) < Math.abs(parseRatio(best) - ratio)
          ? r
          : best,
      )
      setOrientation(isLandscape ? 'landscape' : 'portrait')
      setAspectRatio(closest)
    }
    img.src = primaryUrl
    return () => {
      cancelled = true
    }
  }, [primaryUrl])

  // Replace the whole ref set. Canvas pre-fills a group through it; since #341
  // it differs from `addRefImages` only in discarding what was there.
  const replaceRefImages = useCallback((images: Array<RefImage>) => {
    setRefImages(images)
  }, [])

  // Images with no prompt still generate, so the row count floors at one as
  // soon as the set is non-empty. Was `sourceImage ? 1 : 0`; the set replaced
  // the slot, and "is it non-empty" is the same rule stated over it.
  const activePromptCount = prompts.filter((p) => p.trim()).length
  const hasImages = refImages.length > 0
  const runsPerModel =
    Math.max(
      prompts.reduce((sum, p) => sum + promptImageCount(p), 0),
      hasImages ? 1 : 0,
    ) * gensPerModel
  const totalImages = runsPerModel * selectedModels.length
  // Priced off the lineup rather than FAL's pricing API -- see
  // `estimateImageCostCents` (#416, #400).
  const estimatedCost = estimateImageCostCents(
    selectedModels,
    runsPerModel,
    hasImages,
  )
  const canGenerate =
    (activePromptCount > 0 || hasImages) && selectedModels.length > 0

  const ratioOptions = getRatioOptions(orientation)

  function handleOrientationToggle() {
    const flipped = flipOrientation(orientation, aspectRatio)
    setOrientation(flipped.orientation)
    setAspectRatio(flipped.aspectRatio)
  }

  async function handleGenerate() {
    if (!canGenerate) return
    setError(null)
    try {
      await submitGenerationBatch({
        prompts: [...prompts],
        referenceIds: refImages.map((r) => r.id),
        selectedModels: [...selectedModels],
        gensPerModel,
        aspectRatio,
        systemInstructions: systemInstructionsPrefix(),
        selectedStyleId,
        origin,
        canvasId,
        groupId: groupIdRef.current,
        onSubmitStart,
        onSubmitOutcome,
        onAfterSubmit,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      reportError(err, message)
    }
  }

  const clearPrompts = useCallback(() => {
    setPromptsRaw([''])
    persistPrompts([''])
  }, [])

  return {
    prompt,
    setPrompt,
    prompts,
    setPromptAtIndex,
    addPrompt,
    removePrompt,
    orientation,
    setOrientation,
    aspectRatio,
    setAspectRatio,
    // Background work belongs to the cards; the composer stays available.
    loading: false,
    totalImages,
    estimatedCost,
    canGenerate,
    ratioOptions,
    selectedStyleId,
    setSelectedStyleId,
    handleOrientationToggle,
    handleGenerate,
    clearPrompts,
    appendPrompts,
    replacePrompts,
    refImages,
    addRefImages,
    pushRefImage,
    replaceRefImages,
    removeRefImage,
    maxRefImages,
  }
}
