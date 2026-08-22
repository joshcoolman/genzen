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

/** What steers a model with no guide of its own. Named on the card rather than
 *  once at the top of the page, so every card points at the file that actually
 *  produced it. */
const SHARED_INSTRUCTION = 'src/lib/prompts/enhance-prompt.md'

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
  const [steering, setSteering] = useState('')
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

  const enhance = useCallback(async () => {
    const input = prompt.trim()
    const steer = steering.trim()
    if (!input || selectedModels.length === 0) return

    setIsRunning(true)

    // Every card is placed before any call goes out, so the grid is the shape
    // of the answer from the first frame and each one fills in where it stands.
    // Results that arrived in completion order would reorder the comparison
    // under the eye reading it.
    const cards: Array<EnhanceCard> = selectedModels.map((m) => ({
      modelId: m.id,
      modelName: getModelName(m.id),
      guideFile: promptGuidePathFor(m.id) ?? SHARED_INSTRUCTION,
      status: 'pending',
      output: '',
      error: null,
    }))
    setRun({ prompt: input, steering: steer, cards })

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
            modelSlug: slugFor(card.modelId),
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
  }, [prompt, steering, selectedModels])

  const clear = useCallback(() => setRun(null), [])

  return {
    prompt,
    setPrompt,
    steering,
    setSteering,
    run,
    isRunning,
    modelSelector,
    canRun: prompt.trim().length > 0 && selectedModels.length > 0 && !isRunning,
    modelCount: selectedModels.length,
    enhance,
    clear,
  }
}
