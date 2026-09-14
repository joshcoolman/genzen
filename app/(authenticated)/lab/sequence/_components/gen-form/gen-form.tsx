'use client'

import { X } from 'lucide-react'
import { GEN_FALLBACK_RATIO, genModel, genRatios } from '../../gen'
import styles from './gen-form.module.css'
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
 * Nothing is sent to Claude. There is no enhance step and no rewrite before
 * FAL -- the words submitted are the words typed, which is the bargain that
 * keeps a press cheap enough to make casually.
 */
export function GenForm({
  frame,
  frameLoading,
  frameError,
  onDropFrame,
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
  const model = genModel()
  const images = frame ? [{ id: frame.id, role: 'first' as const }] : []
  const cost = estimateVideoCost(model, duration, undefined, images)

  return (
    <div className={styles.form}>
      <div className={styles.frame}>
        {frameLoading ? (
          <div className={cx(styles.slot, styles.slotBusy)}>
            Reading the last frame
          </div>
        ) : frame ? (
          <div className={styles.thumb}>
            <Thumbnail url={frame.url} alt={frame.title} />
            <button
              type="button"
              className={styles.drop}
              onClick={onDropFrame}
              aria-label="Generate without a starting frame"
              title="Generate without a starting frame"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className={styles.slot}>No starting frame</div>
        )}

        <p className={styles.frameNote}>
          {frameError
            ? frameError
            : frame
              ? 'Starts on the frame the clip before it ended on.'
              : 'Starts from nothing. A hard cut into the run.'}
        </p>
      </div>

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

        {/* Only without a frame. With one the endpoint has no ratio parameter
            and the output follows the picture, so a control here would offer a
            choice that is not taken. */}
        {!frame && (
          <div className={styles.pills} role="group" aria-label="Aspect ratio">
            {genRatios().map((value) => (
              <button
                key={value}
                type="button"
                className={cx(styles.pill, ratio === value && styles.pillOn)}
                aria-pressed={ratio === value}
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
            before the press. */}
        <CostNote cents={cost} />
      </div>
    </div>
  )
}

export { GEN_FALLBACK_RATIO }
