'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PromptOrigins } from '#/features/ai-images/prompt-origins'
import type { GenerationOrigin } from '#/lib/types/db'
import { pushRef } from '#/features/ai-images/ref-images'
import { usePersistedState } from '#/lib/use-persisted-state'
import { generateImage } from '#/features/ai-images/server/generate-image.action'
import { captionImage } from '#/features/ai-images/server/caption-image.action'
import { enhancePrompt } from '#/features/ai-images/server/enhance-prompt.action'
import { fetchImageAsBase64 } from '#/lib/server/fetch-image-base64.action'
import { useReportError } from '#/components'
import {
  LANDSCAPE_RATIOS,
  PORTRAIT_RATIOS,
  flipOrientation,
  getRatioOptions,
} from '#/features/ai-images/constants'
import { endpointFor, maxRefsFor } from '#/features/ai-images/models'
import { recordPromptOrigin } from '#/features/ai-images/prompt-origins'
import { systemInstructionsPrefix } from '#/features/ai-images/system-instructions'
import { computeFileHash } from '#/features/user-images/lib/file-hash'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { useAuth } from '#/lib/auth'

const EMPTY_PROMPTS: Array<string> = ['']

/** How many enhance pairs to keep in localStorage. Only the ones still sitting
 *  in the textarea can ever be read, so this is a cap, not a policy. */
const MAX_PROMPT_ORIGINS = 20

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
      recordId: string | null
      error: string | null
    }>,
  ) => void
  /** Tag generations as canvas-owned, so they are reclaimable on canvas load.
   *  Membership only -- which surface made it is `origin` (#207). */
  onCanvas?: boolean
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
  sourceImage: { base64: string; name: string; id?: string } | null
  describingImage: boolean
  totalImages: number
  canGenerate: boolean
  ratioOptions: Array<string>
  selectedStyleId: string | null
  setSelectedStyleId: (id: string | null) => void
  setOrientation: (o: 'landscape' | 'portrait') => void
  handleOrientationToggle: () => void
  handleGenerate: () => Promise<void>
  setSourceFile: (file: File) => void
  /** True while an attached file is being saved to the library. Generate is
   *  disabled meanwhile -- see the note on the state. */
  savingSource: boolean
  /** `id` is the library row this came from. Pass it wherever it is known --
   *  a source with an id survives Retry, one without it cannot (#214). */
  setSourceFromUrl: (url: string, name: string, id?: string) => void
  setSourceFromUrls?: (
    images: Array<{ id: string; url: string; title: string }>,
  ) => void
  setSourceFromBase64: (base64: string, name: string) => void
  /** Swap the primary reference from the source chip (#284): keeps the prompt,
   *  and the submit sends the id rather than a URL. */
  setSourceFromLibrary: (id: string, url: string, name: string) => void
  handleClearSourceImage: () => void
  handleCaption: () => Promise<void>
  clearPrompts: () => void
  /** Add prompts to the end of the list, leaving what is there alone. */
  appendPrompts: (texts: Array<string>) => void
  refImages: Array<RefImage>
  addRefImages: (images: Array<RefImage>) => void
  pushRefImage: (image: RefImage) => void
  replaceRefImages: (images: Array<RefImage>) => void
  removeRefImage: (id: string) => void
  maxRefImages: number
  /** Index of the prompt currently being enhanced, or null. */
  enhancingPromptIndex: number | null
  handleEnhancePrompt: (index: number) => Promise<void>
}

export function useGenerator({
  selectedModels,
  gensPerModel,
  setError,
  origin,
  storagePrefix = 'genzen',
  onAfterSubmit,
  onCanvas,
  promptPrefix,
}: UseGeneratorOptions): GeneratorState {
  // Surfaces failures the user can act on: a missing provider key opens the
  // key dialog, anything else toasts. `setError` alone was not enough — the AI
  // Images page never rendered it, so enhance failures vanished entirely.
  const reportError = useReportError()

  // An attached file becomes a library row immediately (#224). Written through
  // the standalone writer rather than `useUserImages`, which fetches the whole
  // library on mount -- both hosts already mount it once, and a second copy
  // just to call `create` would double that query on every page load.
  const { user } = useAuth()

  // Read the latest prefix at submit time without re-creating handleGenerate.
  const promptPrefixRef = useRef(promptPrefix ?? '')
  promptPrefixRef.current = promptPrefix ?? ''
  const promptsKey = `${storagePrefix}:prompts`
  const legacyPromptKey = `${storagePrefix}:prompt`
  const promptOriginsKey = `${storagePrefix}:prompt-origins`
  const orientationKey = `${storagePrefix}:orientation`
  const aspectRatioKey = `${storagePrefix}:aspect-ratio`

  function persistPrompts(next: Array<string>) {
    localStorage.setItem(promptsKey, JSON.stringify(next))
    localStorage.removeItem(legacyPromptKey)
  }

  // Enhance overwrites the textarea, and the typed prompt is the irreplaceable
  // one: an enhanced prompt can be re-derived from it, intent cannot be
  // re-derived from an enhanced prompt (#210). Written on enhance, read at
  // submit; no render reads it, hence a ref. See `prompt-origins.ts`.
  const promptOriginsRef = useRef<PromptOrigins>({})

  useEffect(() => {
    try {
      const stored = localStorage.getItem(promptOriginsKey)
      if (stored) promptOriginsRef.current = JSON.parse(stored)
    } catch {
      /* ignore */
    }
  }, [])

  function rememberPromptOrigin(enhanced: string, previous: string) {
    const next = recordPromptOrigin(
      promptOriginsRef.current,
      enhanced,
      previous,
      MAX_PROMPT_ORIGINS,
    )
    if (next === promptOriginsRef.current) return
    promptOriginsRef.current = next
    localStorage.setItem(promptOriginsKey, JSON.stringify(next))
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
  const [sourceImage, setSourceImage] = useState<{
    base64: string
    name: string
    /** Set when the source is a library row (the /images highlight). The
     *  submit sends the id and the server resolves the object. */
    id?: string
  } | null>(null)
  /** An attached file is uploaded the moment it arrives, so it exists as a
   *  library row before anything can go wrong with the generation (#224).
   *  Generate is gated on this: submitting mid-save would send bytes with no
   *  id, which is exactly the unreproducible source the upload exists to
   *  prevent. */
  const [savingSource, setSavingSource] = useState(false)
  const [describingImage, setDescribingImage] = useState(false)
  const [enhancingPromptIndex, setEnhancingPromptIndex] = useState<
    number | null
  >(null)
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

  const maxRefImages = useMemo(
    () => (selectedModels[0] ? maxRefsFor(selectedModels[0]) : 0),
    [selectedModels],
  )

  const addRefImages = useCallback(
    (images: Array<RefImage>) => {
      setRefImages((prev) => {
        const existingIds = new Set(prev.map((r) => r.id))
        const newImages = images.filter((img) => !existingIds.has(img.id))
        return [...prev, ...newImages].slice(0, maxRefImages)
      })
    },
    [maxRefImages],
  )

  /** The front of the strip, evicting the last. See `pushRef`; `addRefImages`
   *  is the other end, appending and slicing the tail off. */
  const pushRefImage = useCallback(
    (image: RefImage) => {
      setRefImages((prev) => pushRef(prev, image, maxRefImages))
    },
    [maxRefImages],
  )

  const removeRefImage = useCallback((id: string) => {
    setRefImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  // Replace the whole ref set without capping. Caller guarantees the count fits
  // the chosen model (canvas pre-fills a known-fitting group). addRefImages, by
  // contrast, slices to maxRefImages for ad-hoc additions.
  const replaceRefImages = useCallback((images: Array<RefImage>) => {
    setRefImages(images)
  }, [])

  const activePromptCount = prompts.filter((p) => p.trim()).length
  const totalImages =
    Math.max(activePromptCount, sourceImage ? 1 : 0) *
    selectedModels.length *
    gensPerModel
  const canGenerate =
    (activePromptCount > 0 || !!sourceImage) &&
    selectedModels.length > 0 &&
    !savingSource

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
      const resolved = endpointFor(modelId, !!sourceImage)
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
      // Only what the ref strip holds. Selecting images in the gallery used to
      // add to this silently (#284); references are explicit or they are not
      // references.
      const ids = maxRefImages > 0 ? refImages.map((r) => r.id) : []
      const referenceImageIds = ids.length > 0 ? ids : undefined

      // Submit order mirrors allCalls so callModels[i] labels outcomes[i].
      const callModels = promptsToRun.flatMap(() =>
        modelsToUse.map((m) => m.base),
      )
      const allCalls = promptsToRun.flatMap((promptText) => {
        // Three distinct facts, and the row has room for one: what was typed,
        // what the enhancer made of it, and what was sent. `prompt` stays the
        // sent string (retry replays it); the other two ride along so a past
        // generation's inputs are recoverable (#210).
        const typedPrompt = promptText.trim()
        // System instructions (#272) lead, then whatever the host prepends --
        // canvas image labels describe the references this prompt talks about,
        // so they belong next to the prompt. Read from storage at submit rather
        // than passed in: one global value, and both hosts get it for free.
        const finalPrompt = `${systemInstructionsPrefix()}${promptPrefixRef.current}${typedPrompt}`
        const originalPrompt = promptOriginsRef.current[typedPrompt]
        return modelsToUse.map((m) =>
          generateImage({
            origin,
            prompt: finalPrompt,
            ...(originalPrompt ? { originalPrompt } : {}),
            ...(typedPrompt !== finalPrompt ? { typedPrompt } : {}),
            model: m.resolved,
            aspectRatio,
            idempotencyKey: crypto.randomUUID(),
            ...(sourceImage
              ? sourceImage.id
                ? { sourceImageId: sourceImage.id }
                : sourceImage.base64.startsWith('data:')
                  ? { sourceImageBase64: sourceImage.base64 }
                  : { sourceImageUrl: sourceImage.base64 }
              : {}),
            ...(selectedStyleId ? { styleId: selectedStyleId } : {}),
            ...(referenceImageIds ? { referenceImageIds } : {}),
            ...(onCanvas ? { onCanvas: true } : {}),
          }),
        )
      })

      const results = await Promise.allSettled(allCalls)
      // Ordered outcomes (one per call) so the caller can map each to its
      // placeholder and mark per-model failures instead of dropping slots.
      const outcomes = results.map((r, i) => ({
        model: callModels[i],
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

  function applySourceBase64(
    base64: string,
    name: string,
    options?: { id?: string; keepPrompt?: boolean },
  ) {
    setSourceImage({ base64, name, ...(options?.id ? { id: options.id } : {}) })
    // Highlighting an image must not touch what you have typed (#205). An
    // upload still clears, because that is a fresh subject.
    if (!options?.keepPrompt) setPrompt('')

    const img = new Image()
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img
      if (!w || !h) return
      const ratio = w / h
      const isLandscape = ratio >= 1
      const nextOrientation = isLandscape ? 'landscape' : 'portrait'
      const candidates = isLandscape ? LANDSCAPE_RATIOS : PORTRAIT_RATIOS
      function parseRatio(r: string) {
        const [a, b] = r.split(':').map(Number)
        return a / b
      }
      const closest = candidates.reduce((best, r) =>
        Math.abs(parseRatio(r) - ratio) < Math.abs(parseRatio(best) - ratio)
          ? r
          : best,
      )
      setOrientation(nextOrientation)
      setAspectRatio(closest)
    }
    img.src = base64
  }

  /** Attach a file: preview it immediately, and save it to the library in the
   *  background so it has an identity.
   *
   *  An image is a complete artifact the moment it arrives -- unlike a
   *  half-typed prompt -- so it is worth keeping whether or not a generation
   *  ever follows. Without the row the bytes exist only in this closure, and a
   *  failed generation can never be retried because there is nothing to send
   *  again (#224). Canvas has always uploaded on paste; this is the one slot
   *  that did not.
   *
   *  If the save fails the preview stays and generation still works -- it just
   *  falls back to sending the bytes inline, and a later Retry will say plainly
   *  that the source was never saved. */
  const setSourceFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string
        applySourceBase64(base64, file.name)

        setSavingSource(true)
        void (async () => {
          try {
            const record = await saveFileToLibrary({
              userId: user.id,
              file,
              title: file.name || 'Source Image',
              fileHash: await computeFileHash(file),
            })
            // Guard against a second attach landing first: only adopt the id if
            // this is still the source on screen.
            setSourceImage((prev) =>
              prev && prev.base64 === base64
                ? { ...prev, id: record.id }
                : prev,
            )
          } catch (err) {
            reportError(err, 'Could not save that image to your library')
          } finally {
            setSavingSource(false)
          }
        })()
      }
      reader.readAsDataURL(file)
    },
    [user.id, reportError],
  )

  /** `id` is the library row this came from, when there is one. Pass it: a
   *  source carrying an id is reproducible on Retry, and one carrying only
   *  bytes is not (#214). The picker has always known the id -- it just was not
   *  handed down, so every library pick became an unreplayable paste. */
  const setSourceFromUrl = useCallback(
    async (url: string, name: string, id?: string) => {
      try {
        const { base64 } = await fetchImageAsBase64({ url })
        applySourceBase64(base64, name, id ? { id } : undefined)
      } catch (err) {
        // Was a console.error, so a failed pick looked exactly like a click
        // that missed -- which is how #291 survived as long as it did.
        reportError(err, 'Could not load that image')
      }
    },
    [applySourceBase64, reportError],
  )

  function handleClearSourceImage() {
    setSourceImage(null)
  }

  const handleCaption = useCallback(async () => {
    if (!sourceImage || describingImage) return
    setDescribingImage(true)
    try {
      const { caption } = await captionImage({
        imageBase64: sourceImage.base64,
      })
      setPrompt((prev) => (prev ? `${caption}\n\n${prev}` : caption))
    } catch {
      // caption failed silently
    } finally {
      setDescribingImage(false)
    }
  }, [sourceImage, describingImage])

  const handleEnhancePrompt = useCallback(
    async (index: number) => {
      if (enhancingPromptIndex !== null) return
      const current = prompts[index]?.trim()
      if (!current) {
        reportError('Enter a prompt before enhancing.')
        return
      }
      setEnhancingPromptIndex(index)
      try {
        const { enhancedPrompt } = await enhancePrompt({ prompt: current })
        rememberPromptOrigin(enhancedPrompt, current)
        setPromptsRaw((prev) => {
          const next = [...prev]
          next[index] = enhancedPrompt
          persistPrompts(next)
          return next
        })
      } catch (err) {
        reportError(err, 'Failed to enhance prompt')
      } finally {
        setEnhancingPromptIndex(null)
      }
    },
    [enhancingPromptIndex, prompts, reportError],
  )

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
    sourceImage,
    describingImage,
    totalImages,
    canGenerate,
    savingSource,
    ratioOptions,
    selectedStyleId,
    setSelectedStyleId,
    handleOrientationToggle,
    handleGenerate,
    setSourceFile,
    setSourceFromUrl,
    setSourceFromBase64: applySourceBase64,
    setSourceFromLibrary: (id: string, url: string, name: string) =>
      applySourceBase64(url, name, { id, keepPrompt: true }),
    handleClearSourceImage,
    handleCaption,
    clearPrompts,
    appendPrompts,
    refImages,
    addRefImages,
    pushRefImage,
    replaceRefImages,
    removeRefImage,
    maxRefImages,
    enhancingPromptIndex,
    handleEnhancePrompt,
  }
}
