'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { readLastRun, writeLastRun } from './last-run'
import type { EnhanceCard, EnhanceRun } from './last-run'
import { useModelSelector } from '#/features/ai-images/model-selector/use-model-selector'
import {
  getModelName,
  promptGuidePathFor,
  slugFor,
} from '#/features/ai-images/models'
import { enhancePrompt } from '#/features/ai-images/server/enhance-prompt.action'
import {
  MULTI_SHOT_PROMPTS,
  multiShotOptions,
  multiShotPrompt,
} from '#/lib/prompts/multi-shot'

/** What steers a model with no guide of its own. Named on the card rather than
 *  once at the top of the page, so every card points at the file that actually
 *  produced it. */
const SHARED_INSTRUCTION = 'src/lib/prompts/enhance-prompt.md'

/**
 * What the run is written for. `image` is the original page: the same idea
 * across the image lineup, one card each. Anything else is a multi-shot writer
 * from `src/lib/prompts/multi-shot/`, which answers with a shot-by-shot video
 * prompt -- one card, because the instruction already names the video model it
 * is written for and the image selection has nothing to say about it.
 */
export const IMAGE_TARGET = 'image'

export const ENHANCE_TARGETS = [
  { id: IMAGE_TARGET, label: 'Image models' },
  ...MULTI_SHOT_PROMPTS.map((p) => ({ id: p.id, label: p.label })),
]

/**
 * Enhance, comparing models side by side (#465).
 *
 * One prompt, several models, one press — and a card per model showing what
 * that model's instruction made of the same idea. #463 wrote the per-model
 * guides; nothing could tell whether they beat the shared instruction, because
 * nothing put two of them next to each other.
 *
 * **Every card is a rewrite of the same words.** There is no per-model input:
 * the model is not a second thing to write for, it is a format the one idea is
 * rendered into.
 */
export function useView() {
  const [prompt, setPrompt] = useState('')
  const [target, setTarget] = useState<string>(IMAGE_TARGET)
  const [steering, setSteering] = useState('')
  // The clip's length and shape. Only meaningful for a multi-shot target, and
  // seeded from the first writer's own video model rather than a literal --
  // a number here that its model refuses is a script that cannot be generated.
  const [duration, setDuration] = useState(
    () => multiShotOptions(MULTI_SHOT_PROMPTS[0].id)?.defaultDuration ?? 10,
  )
  const [aspectRatio, setAspectRatio] = useState(
    () => multiShotOptions(MULTI_SHOT_PROMPTS[0].id)?.aspectRatios[0] ?? '16:9',
  )
  const [run, setRun] = useState<EnhanceRun | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  // The selection is a text-to-image one: the guides are written for generating
  // from a prompt, and vendors treat editing as a different prompt language
  // (#463). Its own storage scope, so tinkering here does not rewrite the
  // selection Images opens with.
  const modelSelector = useModelSelector({
    capability: 'generate',
    mode: 'multi',
    storageScope: 'lab-enhance',
  })

  /**
   * The last run outlives navigation, so the page is read once on mount rather
   * than starting empty, and the prompt box comes back with it — the point is
   * pressing Enhance again after editing a `.md`, which means the words have to
   * still be there.
   *
   * **`hydrated` is state, not a ref, and that is the whole fix.** With a ref
   * set inside the read effect, the write effect below fired on the same commit
   * with `run` still null and wiped the record it had just read. It survived a
   * plain reload — the re-render put it straight back — but React's dev
   * double-mount reads storage *after* that wipe and finds nothing, so the run
   * vanished exactly where it was supposed to persist. State defers the first
   * write to the commit after the read, where there is something to write.
   */
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    const stored = readLastRun()
    if (stored) {
      setRun(stored)
      setPrompt(stored.prompt)
      setSteering(stored.steering)
      // Restored for the same reason as the prompt: the point of coming back
      // is pressing Enhance again after editing the `.md`, and a run at a
      // different length is not the same run.
      if (stored.duration) setDuration(stored.duration)
      if (stored.aspectRatio) setAspectRatio(stored.aspectRatio)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    writeLastRun(run)
  }, [hydrated, run])

  const selectedModels = useMemo(
    () =>
      modelSelector.models.filter((m) =>
        modelSelector.selectedIds.includes(m.id),
      ),
    [modelSelector.models, modelSelector.selectedIds],
  )

  const multiShot = multiShotPrompt(target)

  // Off the writer's video model, so switching to a writer for a different
  // model re-offers that model's lengths and shapes. Null for the image
  // target, where the controls are not part of the question.
  const shotOptions = useMemo(() => multiShotOptions(target), [target])

  // Same coercion the video route does, for the same reason: a value carried
  // across a target switch can be one the new model refuses.
  useEffect(() => {
    if (!shotOptions) return
    if (!shotOptions.durations.includes(duration)) {
      setDuration(shotOptions.defaultDuration)
    }
    if (!shotOptions.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(shotOptions.aspectRatios[0])
    }
  }, [shotOptions, duration, aspectRatio])

  const enhance = useCallback(async () => {
    const input = prompt.trim()
    const steer = steering.trim()
    if (!input) return
    if (!multiShot && selectedModels.length === 0) return

    setIsRunning(true)

    // Every card is placed before any call goes out, so the grid is the shape
    // of the answer from the first frame and each one fills in where it stands.
    // Results that arrived in completion order would reorder the comparison
    // under the eye reading it.
    const cards: Array<EnhanceCard> = multiShot
      ? [
          {
            modelId: multiShot.id,
            modelName: multiShot.label,
            guideFile: multiShot.file,
            status: 'pending',
            output: '',
            error: null,
          },
        ]
      : selectedModels.map((m) => ({
          modelId: m.id,
          modelName: getModelName(m.id),
          guideFile: promptGuidePathFor(m.id) ?? SHARED_INSTRUCTION,
          status: 'pending',
          output: '',
          error: null,
        }))
    setRun({
      prompt: input,
      steering: steer,
      cards,
      ...(multiShot ? { duration, aspectRatio } : {}),
    })

    const settle = (modelId: string, patch: Partial<EnhanceCard>) =>
      setRun((current) =>
        current === null
          ? current
          : {
              ...current,
              cards: current.cards.map((c) =>
                c.modelId === modelId ? { ...c, ...patch } : c,
              ),
            },
      )

    // Concurrent, unlike Outpaint's sequential loop. Nothing here reserves a
    // database row or joins a queue that answers in its own order — these are
    // independent text calls, and a card that has come back should be readable
    // while the rest are still out.
    await Promise.all(
      cards.map(async (card) => {
        try {
          const { enhancedPrompt } = await enhancePrompt({
            prompt: input,
            ...(multiShot
              ? { multiShotId: multiShot.id, duration, aspectRatio }
              : { modelSlug: slugFor(card.modelId) }),
            ...(steer ? { steering: steer } : {}),
          })
          settle(card.modelId, { status: 'done', output: enhancedPrompt })
        } catch (err) {
          settle(card.modelId, {
            status: 'error',
            error: err instanceof Error ? err.message : 'Enhance failed',
          })
        }
      }),
    )

    setIsRunning(false)
  }, [prompt, steering, selectedModels, multiShot, duration, aspectRatio])

  const clear = useCallback(() => setRun(null), [])

  return {
    prompt,
    setPrompt,
    steering,
    setSteering,
    run,
    isRunning,
    modelSelector,
    target,
    setTarget,
    duration,
    setDuration,
    aspectRatio,
    setAspectRatio,
    shotOptions,
    isMultiShot: multiShot != null,
    canRun:
      prompt.trim().length > 0 &&
      (multiShot != null || selectedModels.length > 0) &&
      !isRunning,
    modelCount: selectedModels.length,
    enhance,
    clear,
  }
}
