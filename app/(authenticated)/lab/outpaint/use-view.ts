'use client'

import { useCallback, useMemo, useState } from 'react'
import { buildOutpaintPrompt } from './outpaint-prompt'
import type { PickedImage } from '../_components/image-input/image-input'
import {
  estimateImageCostCents,
  getModelName,
} from '#/features/ai-images/models'
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

/** One press of Generate: a source, a shape, and one result per model. */
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
 * `origin: 'images'` on every row, which is a small lie -- there is no `lab`
 * origin and adding one is a migration, which a lab page does not get to have.
 */
export function useView() {
  const { user } = useAuth()
  const userImages = useUserImages(user.id)

  // 'sidebar' is every model with an image endpoint, which is the whole of
  // what can be asked to outpaint. Its own storage scope, so tinkering here
  // does not rewrite the selection Images opens with.
  const modelSelector = useModelSelector({
    capability: 'sidebar',
    mode: 'multi',
    storageScope: 'lab-outpaint',
  })

  const [picked, setPicked] = useState<Array<PickedImage>>([])
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [guidance, setGuidance] = useState('')
  const [runs, setRuns] = useState<Array<OutpaintRun>>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const source = picked.at(0)

  // Priced for the image endpoint, which is the only one this page hits: a
  // megapixel-billed model costs about twice as much through it (#304), so a
  // figure taken from the text-to-image price would be half the truth.
  const visibleModels = useMemo(
    () => pricedForImages(modelSelector.models, true),
    [modelSelector.models],
  )

  const estimatedCost = useMemo(
    () => estimateImageCostCents(modelSelector.selectedIds, 1, true),
    [modelSelector.selectedIds],
  )

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
    if (!source || modelSelector.selectedIds.length === 0) return

    setIsRunning(true)
    setError(null)
    const prompt = buildOutpaintPrompt(aspectRatio, guidance)
    const results: Array<OutpaintResult> = []

    try {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Outpaint failed')
    } finally {
      setIsRunning(false)
    }

    if (results.length > 0) {
      setRuns((current) => [
        {
          key: current.length + 1,
          source,
          aspectRatio,
          guidance: guidance.trim(),
          startedAt: new Date().toISOString(),
          results,
        },
        ...current,
      ])
      // Once, so the pending cards have something to settle against; the poll
      // takes it from here.
      await refresh()
    }
  }, [source, modelSelector.selectedIds, aspectRatio, guidance, refresh])

  return {
    userImages,
    picked,
    setPicked,
    clearPicked: useCallback(() => setPicked([]), []),
    orientation,
    setOrientation,
    aspectRatio,
    setAspectRatio,
    guidance,
    setGuidance,
    modelSelector,
    visibleModels,
    estimatedCost,
    runs,
    clear: useCallback(() => setRuns([]), []),
    isRunning,
    error,
    canRun: !!source && modelSelector.selectedIds.length > 0 && !isRunning,
    run,
  }
}
