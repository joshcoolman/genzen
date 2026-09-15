'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  GEN_FALLBACK_RATIO,
  MAX_REFS,
  clampRatio,
  genModel,
  genModelFor,
  genRatiosFor,
} from '../../gen'
import { RefPicker } from '../ref-picker/ref-picker'
import styles from './gen-form.module.css'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'
import { estimateVideoCost } from '#/features/video/inputs'
import { cx } from '#/lib/utils'
import { Button, CostNote, Textarea, Thumbnail } from '#/components'

/** The continuity frame, once it has been resolved to a library row. */
export interface GenFrame {
  id: string
  url: string
  title: string
}

/**
 * What to make next, and nothing else (#660).
 *
 * **The frame is the default and the prompt is the whole question.** Appending
 * to a run almost always means "carry on from where that ended", so the
 * previous clip's last frame is already in the slot when this opens and the
 * only thing left to say is what happens next. Dropping it is one click and
 * turns the request into text-to-video -- a hard cut, which is a real thing to
 * want and not the common one.
 *
 * **There is no model picker, no resolution and usually no ratio.** See
 * `gen.ts` for why one model, and why a continuation needs no aspect ratio at
 * all: H3's image endpoint has no such parameter and follows the frame, so a
 * generated clip always matches the run without anyone being asked. The ratio
 * pills appear only with no frame, which is the one case where nothing else
 * can answer the question.
 *
 * **References are the one control that changes the model** (#665). A run
 * drifts as soon as a clip moves away from what came before it, and no wording
 * restores a face that left the shot -- the picture that would is in an earlier
 * clip. Adding one moves the request to Kling O3 Pro, the only model in the
 * lineup taking references and a first frame together, so the continuity frame
 * survives; dropping every reference moves it back to H3 Max Turbo. That costs
 * 14c/s against 0.625, and the form says so beside the price rather than
 * offering a picker -- the inputs select the model, the way they do on Video.
 *
 * Nothing is sent to Claude. There is no enhance step and no rewrite before
 * FAL -- the words submitted are the words typed, which is the bargain that
 * keeps a press cheap enough to make casually.
 */
export function GenForm({
  frame,
  frameLoading,
  frameError,
  onDropFrame,
  endFrame,
  endFrameLoading,
  onDropEndFrame,
  refs,
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

  /* The inputs choose the model, and the duration pills do not follow it: every
     duration H3 Max Turbo offers is one Kling takes, so adding a reference
     changes the price and nothing else on screen. */
  const model = genModelFor(refs.length)
  const images = [
    ...(frame ? [{ id: frame.id, role: 'first' as const }] : []),
    ...refs.map((ref) => ({ id: ref.id, role: 'reference' as const })),
    ...(endFrame ? [{ id: endFrame.id, role: 'last' as const }] : []),
  ]
  const cost = estimateVideoCost(model, duration, undefined, images)
  const ratios = genRatiosFor(refs.length)

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
            disabled={refs.length >= MAX_REFS}
            onClick={() => setPickingRef(true)}
          >
            <Plus size={14} />
            Add ref
          </Button>
        </div>
        <p className={styles.frameNote}>
          {refs.length === 0
            ? `A frame from an earlier clip, so the prompt can name someone who has left the shot. Up to ${MAX_REFS}.`
            : `${model.label}: the only model taking references and a starting frame together. It carries identity and look -- framing is still the prompt's job.`}
        </p>
      </div>

      <RefPicker
        open={pickingRef}
        onOpenChange={setPickingRef}
        clips={runClips}
        remaining={MAX_REFS - refs.length}
        onAdd={onAddRefs}
      />

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
              className={cx(styles.pill, duration === value && styles.pillOn)}
              aria-pressed={duration === value}
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
          disabled={busy || frameLoading || prompt.trim().length === 0}
        >
          {busy ? 'Submitting' : submitLabel}
        </Button>
        {/* Lighting's rule: a lab page that spends money prints the figure
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
