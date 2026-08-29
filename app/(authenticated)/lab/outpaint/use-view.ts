'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { OUTPAINT_MODEL_IDS } from './outpaint-models'
import type { PickedImage } from '../_components/image-input/image-input'
import {
  estimateImageCostCents,
  getModelName,
} from '#/features/ai-images/models'
import { buildOutpaintPrompt } from '#/features/ai-images/outpaint'
import { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import { pricedForImages } from '#/features/ai-images/model-selector/unified-models'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'
import { generateImage } from '#/features/ai-images/server/generate-image.action'
import { listGalleryImages } from '#/features/ai-images/server/gallery.action'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { useAuth } from '#/lib/auth'
import { imageUrl } from '#/lib/image-url'

/** One model's attempt at one run. */
export interface OutpaintResult {
  recordId: string
  modelName: string
  status: 'pending' | 'completed' | 'failed'
  url: string | null
  error: string | null
  /** What FAL charged, once the row settles. Null while pending, and on an
   *  endpoint the lineup has no price for. */
  costCents: number | null
}

/** One source image's share of a press: a shape, and one result per model.
 *  Several images make several of these from one click (#441). */
export interface OutpaintRun {
  key: number
  source: PickedImage
  aspectRatio: string
  guidance: string
  startedAt: string
  results: Array<OutpaintResult>
}

/**
 * Outpaint, in the lab (#430).
 *
 * **The cheap version, deliberately.** The picture is handed to the model with
 * an instruction and the shape asked for, and nothing is composited first --
 * the open question the page exists to settle is whether asking plainly works
 * at all. If it does not, the next thing to try is drawing the source onto a
 * canvas at the target ratio and asking for the bars alone, which #317 proved
 * the browser can do. Nothing here assumes either answer.
 *
 * **Several models at once, because there are two questions and one press has
 * to separate them:** is the instruction any good, and can this model outpaint.
 * All four smear and it is the instruction; three clean and one not and you
 * have learned which model to reach for.
 *
 * **And several images, for the opposite reason** (#441). The ratio and the
 * models are the settings; the images are the input. Reframing four stills to
 * 16:9 used to be four trips through the same three controls, changing only
 * the picker. Images x models generations from one press, which is why the
 * count is on the button and the press asks first past `CONFIRM_ABOVE_CENTS`.
 *
 * `origin: 'images'` on every row, which is a small lie -- there is no `lab`
 * origin and adding one is a migration, which a lab page does not get to have.
 */
/**
 * How many images the strip takes. Not a limit anything enforces downstream --
 * each generation is its own request with one source -- just a number past
 * which a press is more likely to be a slip than an intention.
 */
export const MAX_SOURCES = 8

/**
 * Above this much, Generate asks first.
 *
 * Money rather than a count, as Video does it (#417): eight z-image runs is
 * four cents and eight Nano Banana runs is sixty-four, so the number of
 * generations says little about the size of the click. This is the one lab
 * page that spends real money, and multiplying images by models is how a press
 * that looks the same as the last one costs eight times more.
 */
const CONFIRM_ABOVE_CENTS = 100

export function useView() {
  const { user } = useAuth()
  const userImages = useUserImages(user.id)

  // 'sidebar' is every model with an image endpoint, narrowed by
  // `OUTPAINT_MODEL_IDS` to the ones that can actually be asked to extend a
  // frame. Its own storage scope, so tinkering here does not rewrite the
  // selection Images opens with.
  const modelSelector = useModelSelector({
    capability: 'sidebar',
    mode: 'multi',
    allowedIds: OUTPAINT_MODEL_IDS,
    storageScope: 'lab-outpaint',
  })

  const [picked, setPicked] = useState<Array<PickedImage>>([])
  /** Run keys, monotonic. `runs.length` was enough while a press made one run;
   *  four runs from one press would all read the same length and collide. */
  const nextKey = useRef(1)
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [guidance, setGuidance] = useState('')
  const [runs, setRuns] = useState<Array<OutpaintRun>>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Priced for the image endpoint, which is the only one this page hits: a
  // megapixel-billed model costs about twice as much through it (#304), so a
  // figure taken from the text-to-image price would be half the truth.
  const visibleModels = useMemo(
    () => pricedForImages(modelSelector.models, true),
    [modelSelector.models],
  )

  // One generation per image per model, so the images are the `runsPerModel`
  // factor. Both axes multiply and the models are priced differently, which is
  // why this sums per model rather than scaling one figure.
  const estimatedCost = useMemo(
    () =>
      estimateImageCostCents(
        modelSelector.selectedIds,
        Math.max(picked.length, 1),
        true,
      ),
    [modelSelector.selectedIds, picked.length],
  )

  /** What one press will make. On the button, because a press with four images
   *  and four models looks exactly like a press with one of each. */
  const generationCount = picked.length * modelSelector.selectedIds.length

  /** The oldest run still waiting, which is what paces the poll (#327). */
  const pendingSince = useMemo(() => {
    const waiting = runs.filter((run) =>
      run.results.some((r) => r.status === 'pending'),
    )
    return waiting.reduce<string | null>(
      (oldest, run) =>
        !oldest || run.startedAt < oldest ? run.startedAt : oldest,
      null,
    )
  }, [runs])

  /**
   * Re-read the library and settle whatever has landed.
   *
   * The library is the store: these rows are `user_images` like any other, so
   * there is nothing to persist here and nothing to query for. The runs
   * themselves are lost on navigation, as every lab page's are.
   */
  const refresh = useCallback(async () => {
    let rows
    try {
      rows = await listGalleryImages()
    } catch {
      // A failed poll is not worth reporting -- the next tick re-reads.
      return
    }
    const byId = new Map(rows.map((row) => [row.id, row]))
    setRuns((current) =>
      current.map((run) => ({
        ...run,
        results: run.results.map((result) => {
          const row = byId.get(result.recordId)
          if (!row) return result
          return {
            ...result,
            status: row.status,
            url: row.status === 'completed' ? imageUrl(row.id, 'thumb') : null,
            error: row.generation_error,
            costCents:
              row.generation_metadata?.provider_cost_cents ?? result.costCents,
          }
        }),
      })),
    )
  }, [])

  useGenerationPoll(pendingSince, refresh)

  const run = useCallback(async () => {
    if (picked.length === 0 || modelSelector.selectedIds.length === 0) return

    setIsRunning(true)
    setError(null)
    const prompt = buildOutpaintPrompt(aspectRatio, guidance)
    const startedAt = new Date().toISOString()
    const made: Array<OutpaintRun> = []

    try {
      // Image-major: every model's attempt at the first picture lands before
      // any of the second, so a submit abandoned half way has finished some
      // images rather than started all of them.
      for (const source of picked) {
        const results: Array<OutpaintResult> = []
        // Sequential, as Video submits: each call reserves a row before it
        // reaches FAL, and firing them together interleaves the reservations
        // against a queue that answers in its own order.
        for (const modelId of modelSelector.selectedIds) {
          const created = await generateImage({
            prompt,
            model: modelId,
            origin: 'images',
            aspectRatio,
            sourceImageId: source.id,
          })
          results.push({
            recordId: created.recordId,
            modelName: getModelName(created.model),
            status: 'pending',
            url: null,
            error: null,
            costCents: null,
          })
        }
        made.push({
          key: nextKey.current++,
          source,
          aspectRatio,
          guidance: guidance.trim(),
          startedAt,
          results,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Outpaint failed')
    } finally {
      setIsRunning(false)
    }

    if (made.length > 0) {
      // Newest first, and the images in the order they were picked -- the
      // reverse would put the last picture at the top of a press you read
      // downwards.
      setRuns((current) => [...made.reverse(), ...current])
      // Once, so the pending cards have something to settle against; the poll
      // takes it from here.
      await refresh()
    }
  }, [picked, modelSelector.selectedIds, aspectRatio, guidance, refresh])

  return {
    userImages,
    picked,
    /** Appends what the picker hands back, minus anything already on the strip
     *  and anything past `MAX_SOURCES`. */
    addPicked: useCallback((incoming: Array<PickedImage>) => {
      setPicked((current) => {
        const have = new Set(current.map((p) => p.id))
        return [...current, ...incoming.filter((p) => !have.has(p.id))].slice(
          0,
          MAX_SOURCES,
        )
      })
    }, []),
    removePicked: useCallback(
      (id: string) =>
        setPicked((current) => current.filter((p) => p.id !== id)),
      [],
    ),
    orientation,
    setOrientation,
    aspectRatio,
    setAspectRatio,
    guidance,
    setGuidance,
    modelSelector,
    visibleModels,
    estimatedCost,
    generationCount,
    needsConfirm: estimatedCost.cents > CONFIRM_ABOVE_CENTS,
    runs,
    clear: useCallback(() => setRuns([]), []),
    isRunning,
    error,
    canRun: generationCount > 0 && !isRunning,
    run,
  }
}
