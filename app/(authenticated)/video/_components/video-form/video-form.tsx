'use client'

import { Clapperboard } from 'lucide-react'
import { formatCost } from '../../models'
import { PromptList } from '../../../_components/prompt-list/prompt-list'
import styles from './video-form.module.css'
import type { ReactNode } from 'react'
import type { VideoModel } from '../../models'
import { ActionButton, SingleSelect } from '#/components'

/**
 * The control column: prompts, frames, what shape and how long, Generate.
 *
 * **Ordered like `GeneratorPanel` on purpose** -- prompt first, images under
 * it, the request's own settings below those, then a full-width Generate, with
 * the model picker last. It should feel like the same room: the two surfaces do
 * the same job and a person moves between them in one session. It inherits
 * `--panel-rhythm` from that panel's stylesheet for the same reason -- one
 * value for every gap down a narrow column, because the eye reads unequal gaps
 * as misalignment rather than as hierarchy.
 *
 * Not a copy of it. The differences are all real:
 *
 * - **Two image slots, and they are labelled.** `GeneratorPanel` dropped its
 *   "Reference images" heading because one unlabelled strip under a prompt is
 *   unambiguous. Two are not -- first frame and last frame do different things
 *   -- so they carry the same quiet label the settings below use.
 * - **Duration where the count stepper is.** Video generates one clip per
 *   prompt; there is no "3 each" to ask for.
 * - **The aspect control can be absent entirely**, because some endpoints have
 *   no `aspect_ratio` param at all (#385).
 * - **The model picker is single-select**, so the count on the button is
 *   prompts alone rather than prompts x models x gens.
 */
export function VideoForm({
  model,
  framesSlot,
  modelSlot,
  prompts,
  onUpdatePrompt,
  onAddPrompt,
  onRemovePrompt,
  onClearPrompts,
  pendingCount,
  duration,
  onDurationChange,
  aspectRatio,
  aspectOptions,
  onAspectRatioChange,
  estimatedCost,
  isSubmitting,
  canSubmit,
  onSubmit,
}: {
  model: VideoModel
  /** The first/last frame strips, between the prompts and the settings --
   *  where the reference strip sits in `GeneratorPanel`. Passed in because the
   *  view owns the picker they open. */
  framesSlot: ReactNode
  /** The model picker, last, as it is in `GeneratorPanel`. */
  modelSlot: ReactNode
  prompts: Array<string>
  onUpdatePrompt: (index: number, value: string) => void
  onAddPrompt: () => void
  onRemovePrompt: (index: number) => void
  onClearPrompts: () => void
  pendingCount: number
  duration: number
  onDurationChange: (value: number) => void
  aspectRatio: string
  /** Per endpoint. **Empty means there is no control**, not that no ratio
   *  works -- H3's image endpoint follows the frame it is given (#385). */
  aspectOptions: Array<string>
  onAspectRatioChange: (value: string) => void
  estimatedCost: number
  isSubmitting: boolean
  canSubmit: boolean
  onSubmit: () => void
}) {
  return (
    <div className={styles.root}>
      <PromptList
        prompts={prompts}
        onUpdatePrompt={onUpdatePrompt}
        onAddPrompt={onAddPrompt}
        onRemovePrompt={onRemovePrompt}
        onClearPrompts={onClearPrompts}
        disabled={isSubmitting}
        placeholders={{
          first:
            'What happens in the shot? Name the camera move and where it ends. Dialogue in quotes is spoken aloud.',
          additional: 'Another take...',
        }}
      />

      {framesSlot}

      <div className={styles.controls}>
        <div className={styles.control}>
          <span className={styles.label}>Duration</span>
          {/* SingleSelect clears on re-click, and a clip with no duration is
              not a request -- so an unset value falls back to the model's. */}
          <SingleSelect
            value={String(duration)}
            onChange={(value) =>
              onDurationChange(Number(value ?? model.defaultDuration))
            }
            options={model.durations.map((seconds) => ({
              value: String(seconds),
              label: `${seconds}s`,
            }))}
          />
        </div>

        {/* Absent, not empty. A control with no options would say the choice
            exists and had been taken away. */}
        {aspectOptions.length > 0 && (
          <div className={styles.control}>
            <span className={styles.label}>Aspect</span>
            <SingleSelect
              value={aspectRatio}
              onChange={(value) =>
                onAspectRatioChange(value ?? aspectOptions[0])
              }
              options={aspectOptions.map((ratio) => ({
                value: ratio,
                label: ratio === 'auto' ? 'Match image' : ratio,
              }))}
            />
          </div>
        )}
      </div>

      {/* The button takes the row whole, as it does in the panel: its label
          carries the price, which is the only warning that a click on a 20s
          clip costs three dollars. */}
      <ActionButton
        icon={<Clapperboard size={16} />}
        loading={isSubmitting}
        loadingText="Queueing"
        disabled={!canSubmit}
        onClick={onSubmit}
        className={styles.generate}
      >
        {pendingCount > 1 ? `Generate ${pendingCount} clips` : 'Generate'}{' '}
        {formatCost(estimatedCost)}
      </ActionButton>

      <p className={styles.note}>
        {model.label} · {model.resolution}
        {model.supportsAudio ? ' · audio included' : ''}
      </p>

      {modelSlot}
    </div>
  )
}
