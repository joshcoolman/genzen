'use client'

import { Clapperboard } from 'lucide-react'
import { PromptList } from '../../../_components/prompt-list/prompt-list'
import styles from './video-form.module.css'
import type { ReactNode } from 'react'
import {
  ActionButton,
  ConfirmDialog,
  CostNote,
  SingleSelect,
  useConfirm,
} from '#/components'
import { formatCents } from '#/lib/format'

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

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
 * - **Duration where the count stepper is, and there is no stepper.** One clip
 *   per model, always (#417). Video is slow and finicky enough that nobody
 *   wants four takes of one request from one model -- the useful axis is
 *   across models, not within one.
 * - **The aspect control can be absent entirely**, because some endpoints have
 *   no `aspect_ratio` param at all (#385).
 * - **Generate asks above a price, not above a count.** `GeneratorPanel`
 *   confirms above five images; here two Flux 3 clips at 20s is $6.80 and
 *   eight LTX clips at 6s is $4.32, so the number of clips says little about
 *   the size of the click. Money is what is being risked, so money is the
 *   trigger.
 */
export function VideoForm({
  durationOptions,
  promptCount,
  needsConfirm,
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
  resolution,
  resolutionOptions,
  onResolutionChange,
  estimatedCost,
  isSubmitting,
  canSubmit,
  onSubmit,
}: {
  /** This model's, since the picker is single-select. */
  durationOptions: Array<number>
  promptCount: number
  /** The estimate crossed the threshold; ask before submitting. */
  needsConfirm: boolean
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
  /** The chosen tier. Meaningless where `resolutionOptions` is empty. */
  resolution: string
  /** Empty for a model that renders at one size -- see `resolutionsFor`. */
  resolutionOptions: Array<{ id: string; pricePerSecondCents: number }>
  onResolutionChange: (value: string) => void
  estimatedCost: number
  isSubmitting: boolean
  canSubmit: boolean
  onSubmit: () => void
}) {
  const { confirm, dialogProps } = useConfirm()

  /**
   * Above a price, say what the click is buying before it buys it.
   *
   * The multiplication spelled out, as `GeneratorPanel` does: the surprise is
   * never the total on its own, it is which of the two factors was larger than
   * you remembered. Not `destructive` -- generating is not destruction, and the
   * red confirm is for things that lose work.
   */
  async function handleSubmit() {
    if (needsConfirm) {
      const ok = await confirm({
        title: `Generate ${pendingCount} clips?`,
        message: `${plural(promptCount, 'prompt')}, one clip each, about ${formatCents(estimatedCost)}. Cancel to change the model, the duration or the resolution.`,
        confirmLabel: `Generate ${pendingCount}`,
        destructive: false,
      })
      if (!ok) return
    }
    onSubmit()
  }

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
              onDurationChange(Number(value ?? durationOptions[0]))
            }
            options={durationOptions.map((seconds) => ({
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

        {/* Same rule, and the first control that exists for one model and not
            the others -- which single-select is what makes possible. It moves
            the price, so the CostNote below tracks it. */}
        {resolutionOptions.length > 0 && (
          <div className={styles.control}>
            <span className={styles.label}>Resolution</span>
            <SingleSelect
              value={resolution}
              onChange={(value) =>
                onResolutionChange(value ?? resolutionOptions[0].id)
              }
              options={resolutionOptions.map((r) => ({
                value: r.id,
                label: r.id.toLowerCase(),
              }))}
            />
          </div>
        )}
      </div>

      {/* The button takes the row whole, as it does in the panel. Its label is
          the act; the price sits in the CostNote below, where it can carry the
          `~` and the spec without the control changing width as the duration
          changes (#416). */}
      <ActionButton
        icon={<Clapperboard size={16} />}
        loading={isSubmitting}
        loadingText="Queueing"
        disabled={!canSubmit}
        onClick={() => void handleSubmit()}
        className={styles.generate}
      >
        {pendingCount > 1 ? `Generate ${pendingCount} clips` : 'Generate video'}
      </ActionButton>

      <ConfirmDialog {...dialogProps} />

      <CostNote cents={estimatedCost} />

      {modelSlot}
    </div>
  )
}
