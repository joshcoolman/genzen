'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  GEN_FALLBACK_RATIO,
  REF_MODEL_SLUG,
  VEO_REF_MODEL_SLUG,
  clampRatio,
  genDurationFor,
  genModel,
  genModelFor,
  genRatiosFor,
  referenceCapacity,
} from '../../gen'
import { RefPicker } from '../ref-picker/ref-picker'
import styles from './gen-form.module.css'
import type { ReferenceModelSlug } from '../../gen'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'
import { estimateVideoCost, imageCompatibility } from '#/features/video/inputs'
import { cx } from '#/lib/utils'
import { Button, CostNote, Textarea, Thumbnail } from '#/components'

/** The continuity frame, once it has been resolved to a library row. */
export interface GenFrame {
  id: string
  url: string
  title: string
}

/** Add Gen keeps the incoming frame visible. Reference clips can try Veo's
 * prompted opening match or Kling's fixed-frame handoff; no inputs are dropped.
 * Duration and price reflect the selected model before submission. */
export function GenForm({
  frame,
  frameLoading,
  frameError,
  onDropFrame,
  endFrame,
  endFrameLoading,
  onDropEndFrame,
  refs,
  referenceModel,
  onReferenceModelChange,
  runClips,
  onAddRefs,
  onDropRef,
  prompt,
  onPromptChange,
  duration,
  onDurationChange,
  ratio,
  onRatioChange,
  busy,
  submitLabel,
  onSubmit,
}: {
  frame: GenFrame | null
  /** The previous clip's ending is still being read out of it. */
  frameLoading: boolean
  /** Reading it failed. The form still works -- without the frame. */
  frameError: string | null
  onDropFrame: () => void
  /** The frame the clip has to end on, pinning the join to whatever follows it
   *  in the run. Null when nothing follows, which is most of the time. */
  endFrame: GenFrame | null
  endFrameLoading: boolean
  onDropEndFrame: () => void
  /** Frames pulled out of earlier clips, carrying identity and look (#665). */
  referenceModel: ReferenceModelSlug
  onReferenceModelChange: (value: ReferenceModelSlug) => void
  refs: Array<GenFrame>
  /** The run's finished clips: the first step of picking a reference is saying
   *  which clip it is in. */
  runClips: Array<VideoRecord>
  onAddRefs: (frames: Array<GenFrame>) => void
  onDropRef: (id: string) => void
  prompt: string
  onPromptChange: (value: string) => void
  duration: number
  onDurationChange: (value: number) => void
  /** Only ever submitted, and only ever shown, when there is no frame. */
  ratio: string
  onRatioChange: (value: string) => void
  busy: boolean
  submitLabel: string
  onSubmit: () => void
}) {
  const [pickingRef, setPickingRef] = useState(false)

  // Keep the displayed duration and quote aligned with the submitted model.
  const model = genModelFor(refs.length, referenceModel)
  const selectedDuration = genDurationFor(model, duration)
  const maxRefs = referenceCapacity(referenceModel, !!frame)
  const veo = refs.length > 0 && referenceModel === VEO_REF_MODEL_SLUG
  const images = [
    ...(frame ? [{ id: frame.id, role: 'first' as const }] : []),
    ...refs.map((ref) => ({ id: ref.id, role: 'reference' as const })),
    ...(endFrame ? [{ id: endFrame.id, role: 'last' as const }] : []),
  ]
  const cost = estimateVideoCost(model, selectedDuration, undefined, images)
  const ratios = genRatiosFor(refs.length, referenceModel)
  const inputError = imageCompatibility(model, images)

  return (
    <div className={styles.form}>
      <div className={styles.frame}>
        <FrameSlot
          frame={frame}
          loading={frameLoading}
          empty="No starting frame"
          dropLabel="Generate without a starting frame"
          onDrop={onDropFrame}
        />

        {/* Only where the run continues past this clip. Appending has no far
            seam -- the last clip of a run is free to end anywhere. */}
        {(endFrame || endFrameLoading) && (
          <>
            <span className={styles.arrow} aria-hidden>
              &rarr;
            </span>
            <FrameSlot
              frame={endFrame}
              loading={endFrameLoading}
              empty="No ending frame"
              dropLabel="Let this clip end anywhere"
              onDrop={onDropEndFrame}
            />
          </>
        )}

        <p className={styles.frameNote}>
          {frameError
            ? frameError
            : veo && frame
              ? 'Uses this as Image 1 and asks Veo to match the opening. The frame is not fixed.'
              : endFrame
                ? 'Pinned at both ends, so the joins either side survive. Say what happens in between.'
                : frame
                  ? 'Starts on the frame the clip before it ended on.'
                  : 'Starts from nothing. A hard cut into the run.'}
        </p>
      </div>

      {/* Beside frame one, because that is the frame they exist to make sense
          of: the run continues from where it is, and the references are what
          let the prompt name something no longer in it. */}
      <div className={styles.refs}>
        <div className={styles.refStrip}>
          {refs.map((ref) => (
            <div key={ref.id} className={styles.refThumb}>
              <Thumbnail url={ref.url} alt={ref.title} />
              <button
                type="button"
                className={styles.drop}
                onClick={() => onDropRef(ref.id)}
                aria-label={`Drop ${ref.title}`}
                title="Drop this reference"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            disabled={refs.length >= maxRefs}
            onClick={() => setPickingRef(true)}
          >
            <Plus size={14} />
            Add ref
          </Button>
        </div>
        <p className={styles.frameNote}>
          {refs.length === 0
            ? `A frame from an earlier clip, so the prompt can name someone who has left the shot. Up to ${maxRefs}.`
            : veo
              ? 'Veo uses up to three images total. The starting frame comes first; other images guide appearance.'
              : 'Kling fixes the starting frame and uses other images for appearance.'}
        </p>
      </div>

      <RefPicker
        open={pickingRef}
        onOpenChange={setPickingRef}
        clips={runClips}
        remaining={Math.max(0, maxRefs - refs.length)}
        onAdd={onAddRefs}
      />

      {refs.length > 0 && (
        <div className={styles.pills} role="group" aria-label="Reference model">
          {([VEO_REF_MODEL_SLUG, REF_MODEL_SLUG] as const).map((slug) => (
            <button
              type="button"
              key={slug}
              className={cx(
                styles.pill,
                referenceModel === slug && styles.pillOn,
              )}
              aria-pressed={referenceModel === slug}
              onClick={() => onReferenceModelChange(slug)}
            >
              {genModelFor(1, slug).label}
            </button>
          ))}
        </div>
      )}
      {inputError && (
        <p role="alert" className={styles.frameNote}>
          {veo && endFrame
            ? 'Veo cannot fix an ending frame. Choose Kling to keep both joins.'
            : inputError}
        </p>
      )}

      <Textarea
        autoFocus
        value={prompt}
        placeholder="What happens next"
        rows={3}
        onChange={(e) => onPromptChange(e.target.value)}
      />

      <div className={styles.controls}>
        <div className={styles.pills} role="group" aria-label="Duration">
          {model.durations.map((value) => (
            <button
              key={value}
              type="button"
              className={cx(
                styles.pill,
                selectedDuration === value && styles.pillOn,
              )}
              aria-pressed={selectedDuration === value}
              onClick={() => onDurationChange(value)}
            >
              {value}s
            </button>
          ))}
        </div>

        {/* Only without a frame. With one the endpoint either has no ratio
            parameter or follows the picture, so a control here would offer a
            choice that is not taken. The options are the chosen model's: Kling
            names three shapes and refuses the rest. */}
        {!frame && !endFrame && (
          <div className={styles.pills} role="group" aria-label="Aspect ratio">
            {ratios.map((value) => (
              <button
                key={value}
                type="button"
                className={cx(
                  styles.pill,
                  clampRatio(ratios, ratio) === value && styles.pillOn,
                )}
                aria-pressed={clampRatio(ratios, ratio) === value}
                onClick={() => onRatioChange(value)}
              >
                {value}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.submit}>
        <Button
          onClick={onSubmit}
          disabled={
            busy ||
            frameLoading ||
            endFrameLoading ||
            !!inputError ||
            prompt.trim().length === 0
          }
        >
          {busy ? 'Submitting' : submitLabel}
        </Button>
        {/* The lab's rule: a page that spends money prints the figure
            before the press -- and once a reference can move the request to a
            model twenty times the price, the figure is not enough on its own.
            The model is named where the money is. */}
        <CostNote cents={cost} />
        <p className={styles.frameNote}>
          {refs.length > 0
            ? `${model.label}, and drop every reference to fall back to ${genModel().label}.`
            : model.label}
        </p>
      </div>
    </div>
  )
}

/** One end of the clip: a frame, a spinner, or the space where one would be. */
function FrameSlot({
  frame,
  loading,
  empty,
  dropLabel,
  onDrop,
}: {
  frame: GenFrame | null
  loading: boolean
  empty: string
  dropLabel: string
  onDrop: () => void
}) {
  if (loading) {
    return <div className={cx(styles.slot, styles.slotBusy)}>Reading it</div>
  }
  if (!frame) return <div className={styles.slot}>{empty}</div>
  return (
    <div className={styles.thumb}>
      <Thumbnail url={frame.url} alt={frame.title} />
      <button
        type="button"
        className={styles.drop}
        onClick={onDrop}
        aria-label={dropLabel}
        title={dropLabel}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export { GEN_FALLBACK_RATIO }
