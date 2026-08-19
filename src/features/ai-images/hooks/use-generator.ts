'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GenerationOrigin } from '#/lib/types/db'
import { pushRef } from '#/features/ai-images/ref-images'
import { usePersistedState } from '#/lib/use-persisted-state'
import { optimisticId } from '#/lib/optimistic-id'
import { generateImage } from '#/features/ai-images/server/generate-image.action'
import { useReportError } from '#/components'
import {
  LANDSCAPE_RATIOS,
  PORTRAIT_RATIOS,
  flipOrientation,
  getRatioOptions,
} from '#/features/ai-images/constants'
import {
  endpointFor,
  estimateImageCostCents,
  imageCapacityFor,
  modelTitleFor,
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

interface UseGeneratorOptions {
  selectedModels: Array<string>
  gensPerModel: number
  setError: (error: string | null) => void
  /** The surface this generator belongs to, recorded on every row it creates
   *  (#207). Required so a new host cannot be an unmarked generation source. */
  origin: GenerationOrigin
  storagePrefix?: string
  // Ordered per-call outcomes (one per submitted generation, in submit order),
  // so callers can map each result to its placeholder and attribute failures.
  // `model` is the user-facing base id; `recordId` is null when the submit
  // itself failed (no DB record), with `error` carrying the reason.
  onAfterSubmit?: (
    results: Array<{
      model: string
      placeholderId: string
      recordId: string | null
      error: string | null
    }>,
  ) => void
  /**
   * Fires **before any request**, one entry per generation about to be
   * submitted, in submit order (#313).
   *
   * A submit reserves its row before it does anything fallible, so the row
   * exists roughly 100ms in -- but `recordId` was not returned until after the
   * bucket read, the FAL upload and the queue submit, and the host only heard
   * about any of it once every call had settled. That was ~10s of an unchanged
   * grid after pressing Generate. The host does not need the row to draw a
   * card; it needs the model and the prompt, and it has both at click time.
   */
  onSubmitStart?: (
    placeholders: Array<{
      placeholderId: string
      model: string
      /** The row's eventual title, resolved here rather than by the host: it
       *  comes from the endpoint the submit will use, which only this hook has
       *  worked out. Same function the reserve and the completion call, so the
       *  badge cannot change when the card becomes real (#367). */
      title: string
      prompt: string
      sourceImageId?: string
    }>,
  ) => void
  /**
   * Fires as each generation settles, rather than after all of them. One slow
   * model no longer holds up the rest -- which is the whole reason the calls
   * are fired together in the first place.
   */
  onSubmitOutcome?: (outcome: {
    placeholderId: string
    model: string
    recordId: string | null
    error: string | null
  }) => void
  /** Tag generations as canvas-owned, so they are reclaimable on canvas load.
   *  Membership only -- which surface made it is `origin` (#207). */
  onCanvas?: boolean
  /** The group the host is currently inside, or null at top level (#319).
   *  Every generation submitted from in there is filed into it -- that is the
   *  half of a group that makes it a place to work rather than a folder. */
  groupId?: string | null
  /**
   * Text prepended to every submitted prompt (not shown in the textarea). Used by
   * canvas multi-image generate to auto-label images ("[Image 1, Image 2, ...]")
   * so the model can be referenced by number without the user typing it.
   */
  promptPrefix?: string
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
  /** The set. Ordered and unbounded; index 0 drives the aspect ratio and is
   *  submitted first. Nothing else distinguishes a member. */
  refImages: Array<RefImage>
  addRefImages: (images: Array<RefImage>) => void
  pushRefImage: (image: RefImage) => void
  replaceRefImages: (images: Array<RefImage>) => void
  removeRefImage: (id: string) => void
  /** Put this image in slot 0, keeping the rest of the set. Applying variations
   *  is the one caller: the prompts are *of* that image, so it belongs in the
   *  slot the aspect ratio follows. Not a card gesture -- Cmd-click adds
   *  (`pushRefImage`), because replacing meant clicking three cards left one
   *  image. */
  setPrimaryImage: (image: RefImage) => void
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
  onCanvas,
  groupId,
  promptPrefix,
}: UseGeneratorOptions): GeneratorState {
  // Surfaces failures the user can act on: a missing provider key opens the
  // key dialog, anything else toasts. `setError` alone was not enough — the AI
  // Images page never rendered it, so failures vanished entirely.
  const reportError = useReportError()

  // Read the latest prefix at submit time without re-creating handleGenerate.
  const promptPrefixRef = useRef(promptPrefix ?? '')
  promptPrefixRef.current = promptPrefix ?? ''
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
  const [loading, setLoading] = useState(false)
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

  /** Slot 0, keeping the rest. The one asymmetry left in the set: index 0 is
   *  what the aspect ratio is derived from and what the submit sends first. */
  const setPrimaryImage = useCallback((image: RefImage) => {
    setRefImages((prev) => {
      const rest = prev.slice(1).filter((img) => img.id !== image.id)
      return [image, ...rest]
    })
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
    Math.max(activePromptCount, hasImages ? 1 : 0) * gensPerModel
  const totalImages = runsPerModel * selectedModels.length
  // Priced off the lineup rather than FAL's pricing API -- see
  // `estimateImageCostCents` (#416, #400).
  const estimatedCost = estimateImageCostCents(selectedModels, runsPerModel)
  const canGenerate =
    (activePromptCount > 0 || hasImages) && selectedModels.length > 0

  const ratioOptions = getRatioOptions(orientation)

  function handleOrientationToggle() {
    const flipped = flipOrientation(orientation, aspectRatio)
    setOrientation(flipped.orientation)
    setAspectRatio(flipped.aspectRatio)
  }

  async function handleGenerate() {
    if (loading || !canGenerate) return

    // Each entry keeps the user-facing `base` id (for labelling) alongside the
    // `resolved` endpoint we actually submit to (edit/img2img variant).
    const modelsToUse = selectedModels.flatMap((modelId) => {
      const resolved = endpointFor(modelId, hasImages)
      return Array.from({ length: gensPerModel }, () => ({
        base: modelId,
        resolved,
      }))
    })

    // Collect non-empty prompts; if none but sourceImage exists, use ['']
    const activePrompts = prompts.filter((p) => p.trim())
    const promptsToRun = activePrompts.length > 0 ? activePrompts : ['']

    setLoading(true)
    setError(null)

    try {
      // The set goes out as `[first, ...rest]` -- the wire keeps a source field
      // and a references field, and the server concatenates them back into one
      // ordered `image_urls`. Index 0 is first because it was concatenated
      // first and for no other reason; the split survives only because
      // `generation_metadata` (and so Retry, #214) is written in those terms.
      const [primary, ...rest] = refImages
      const restIds = rest.map((r) => r.id)
      const referenceImageIds = restIds.length > 0 ? restIds : undefined
      const sourceImageId = hasImages ? primary.id : undefined

      // Two distinct facts, and the row has room for one: what was typed and
      // what was sent. `prompt` stays the sent string, because retry replays
      // it; the typed one rides along so a past generation's input is
      // recoverable (#210).
      const promptPlans = promptsToRun.map((promptText) => {
        const typedPrompt = promptText.trim()
        // System instructions (#272) lead, then whatever the host prepends --
        // canvas image labels describe the references this prompt talks about,
        // so they belong next to the prompt. Read from storage at submit rather
        // than passed in: one global value, and both hosts get it for free.
        const finalPrompt = `${systemInstructionsPrefix()}${promptPrefixRef.current}${typedPrompt}`
        return {
          typedPrompt,
          finalPrompt,
        }
      })

      // One descriptor per generation, so a placeholder, its submit and its
      // outcome all line up -- by id now rather than by array index.
      const calls = promptPlans.flatMap((plan) =>
        modelsToUse.map((m) => ({
          placeholderId: optimisticId(),
          model: m.base,
          resolved: m.resolved,
          plan,
        })),
      )

      // Before any await. Everything above this line is synchronous, so the
      // host can draw its cards in the same tick as the click (#313).
      onSubmitStart?.(
        calls.map((c) => ({
          placeholderId: c.placeholderId,
          model: c.model,
          title: modelTitleFor(c.resolved),
          prompt: c.plan.typedPrompt,
          ...(sourceImageId ? { sourceImageId } : {}),
        })),
      )

      const results = await Promise.allSettled(
        calls.map((c) => {
          const { typedPrompt, finalPrompt } = c.plan
          return generateImage({
            origin,
            prompt: finalPrompt,
            ...(typedPrompt !== finalPrompt ? { typedPrompt } : {}),
            model: c.resolved,
            aspectRatio,
            idempotencyKey: crypto.randomUUID(),
            ...(sourceImageId ? { sourceImageId } : {}),
            ...(selectedStyleId ? { styleId: selectedStyleId } : {}),
            ...(referenceImageIds ? { referenceImageIds } : {}),
            ...(onCanvas ? { onCanvas: true } : {}),
            ...(groupIdRef.current ? { groupId: groupIdRef.current } : {}),
          }).then(
            (value) => {
              onSubmitOutcome?.({
                placeholderId: c.placeholderId,
                model: c.model,
                recordId: value.recordId,
                error: null,
              })
              return value
            },
            (reason: unknown) => {
              onSubmitOutcome?.({
                placeholderId: c.placeholderId,
                model: c.model,
                recordId: null,
                error:
                  reason instanceof Error ? reason.message : String(reason),
              })
              throw reason
            },
          )
        }),
      )
      // Ordered outcomes (one per call) so the caller can map each to its
      // placeholder and mark per-model failures instead of dropping slots.
      const outcomes = results.map((r, i) => ({
        model: calls[i].model,
        placeholderId: calls[i].placeholderId,
        recordId:
          r.status === 'fulfilled'
            ? (r.value as { recordId: string }).recordId
            : null,
        error:
          r.status === 'rejected'
            ? r.reason instanceof Error
              ? r.reason.message
              : String(r.reason)
            : null,
      }))
      // Report outcomes (successes AND failures) so the caller stamps/persists/
      // polls what went through and surfaces what didn't -- no silent drops.
      if (onAfterSubmit && outcomes.length > 0) {
        onAfterSubmit(outcomes)
      }
      const firstError = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      )
      if (firstError) {
        throw firstError.reason
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : String(err)
      setError(message)
      reportError(err, message)
    } finally {
      setLoading(false)
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
    loading,
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
    refImages,
    addRefImages,
    pushRefImage,
    replaceRefImages,
    removeRefImage,
    setPrimaryImage,
    maxRefImages,
  }
}
