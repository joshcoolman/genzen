'use client'

import { useState } from 'react'
import { Images, Loader, X } from 'lucide-react'
import styles from './continue-dialog.module.css'
import type { ContinueDraft, JoinFrame } from '../../use-view'
import type { EditFrame } from '../../../_lib/types'
import type { VideoModel } from '#/features/video/models'
import { imageUrl } from '#/lib/image-url'
import { estimateVideoCost } from '#/features/video/inputs'
import {
  resolutionsFor,
  videoModelBySlug,
  videoModelsByPrice,
} from '#/features/video/models'
import { cx } from '#/lib/utils'
import {
  Button,
  CostNote,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '#/components'

/** The models that take a last frame, cheapest first. Today that is every
 *  model in the lineup; the filter is what keeps it true. */
function modelsTakingLastFrame(): Array<VideoModel> {
  return videoModelsByPrice().filter(
    (m) =>
      m.endpoints.withImage?.acceptsEndImage ||
      m.endpoints.withFirstAndLastImage !== undefined,
  )
}

/**
 * Continue: the clip between two frames (#731).
 *
 * Director's gen form, cut to this: two frame slots, a model, a length, a
 * resolution where the model offers one, a prompt that may be blank when
 * both frames are set, the price, one button. No references and no ratio --
 * the frames carry the shape. Generate closes the dialog on the press; the
 * strip is where the result shows up.
 *
 * Either slot can take a frame off the strip instead (#733): the picker under
 * the slots lists the group's finished stills, and a pick swaps the derived
 * frame for one of them. That is how a frame generated here is used here --
 * an ending made from the cut becomes the frame the next clip is pinned to.
 * The ending slot is always drawn for that reason, empty when nothing follows.
 */
export function ContinueDialog({
  draft,
  frames,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ContinueDraft | null
  /** The strip's frames, for the slot picker. */
  frames: Array<EditFrame>
  onChange: (next: ContinueDraft) => void
  onClose: () => void
  onSubmit: () => void
}) {
  /* Which slot is choosing off the strip, if one is. Reset when the dialog
     closes, since the dialog unmounts its content with it. */
  const [picking, setPicking] = useState<'first' | 'last' | null>(null)
  const stills = frames.filter((f) => f.status === 'completed')
  const pick = (frame: EditFrame) => {
    if (!draft || !picking) return
    const chosen: JoinFrame = {
      id: frame.id,
      url: imageUrl(frame.id, 'thumb'),
      title: frame.title,
    }
    onChange(
      picking === 'first'
        ? { ...draft, first: chosen, firstLoading: false, error: null }
        : { ...draft, last: chosen, lastLoading: false },
    )
    setPicking(null)
  }
  const model = draft ? videoModelBySlug(draft.modelSlug) : undefined
  const cost =
    draft && model
      ? estimateVideoCost(model, draft.duration, draft.resolution, [
          ...(draft.first
            ? [{ id: draft.first.id, role: 'first' as const }]
            : []),
          ...(draft.last ? [{ id: draft.last.id, role: 'last' as const }] : []),
        ])
      : null
  const resolutions = model ? resolutionsFor(model) : []

  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {draft?.mode === 'rerun' ? 'Rerun' : 'Continue'}
          </DialogTitle>
        </DialogHeader>
        {draft && model && (
          <div className={styles.form}>
            <div className={styles.frames}>
              <Slot
                frame={draft.first}
                loading={draft.firstLoading}
                empty="No starting frame"
                picking={picking === 'first'}
                onPick={
                  stills.length > 0
                    ? () => setPicking(picking === 'first' ? null : 'first')
                    : undefined
                }
              />
              <span className={styles.arrow} aria-hidden>
                &rarr;
              </span>
              <Slot
                frame={draft.last}
                loading={draft.lastLoading}
                empty="No ending frame"
                picking={picking === 'last'}
                onPick={
                  stills.length > 0
                    ? () => setPicking(picking === 'last' ? null : 'last')
                    : undefined
                }
                onDrop={
                  draft.last
                    ? () => onChange({ ...draft, last: null })
                    : undefined
                }
              />
            </div>
            {picking && (
              <div
                className={styles.picker}
                role="listbox"
                aria-label={
                  picking === 'first'
                    ? 'Pick a starting frame'
                    : 'Pick an ending frame'
                }
              >
                {stills.map((frame) => (
                  <button
                    key={frame.id}
                    type="button"
                    className={styles.pickerTile}
                    title={frame.title}
                    onClick={() => pick(frame)}
                  >
                    <img src={imageUrl(frame.id, 'thumb')} alt={frame.title} />
                  </button>
                ))}
              </div>
            )}
            <p className={styles.note}>
              {draft.error
                ? draft.error
                : draft.mode === 'rerun'
                  ? 'Loaded as this clip was made. Change what you like; the new take replaces this one and the old goes to Trash.'
                  : draft.last
                    ? 'Pinned at both ends: the clip opens where this one stops and closes where the next begins. Leave the prompt blank to let the model find its way between them.'
                    : 'Carries on from where the highlighted clip stops.'}
            </p>

            <div className={styles.group}>
              <span className={styles.label}>Model</span>
              <div className={styles.pills} role="group" aria-label="Model">
                {modelsTakingLastFrame().map((m) => (
                  <button
                    key={m.slug}
                    type="button"
                    className={cx(
                      styles.pill,
                      m.slug === draft.modelSlug && styles.pillOn,
                    )}
                    aria-pressed={m.slug === draft.modelSlug}
                    title={m.description}
                    onClick={() =>
                      onChange({
                        ...draft,
                        modelSlug: m.slug,
                        // A length the new model does not offer snaps to its
                        // default; a resolution never carries across.
                        duration: m.durations.includes(draft.duration)
                          ? draft.duration
                          : m.defaultDuration,
                        resolution: undefined,
                      })
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.group}>
              <span className={styles.label}>Length</span>
              <div className={styles.pills} role="group" aria-label="Duration">
                {model.durations.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={cx(
                      styles.pill,
                      draft.duration === value && styles.pillOn,
                    )}
                    aria-pressed={draft.duration === value}
                    onClick={() => onChange({ ...draft, duration: value })}
                  >
                    {value}s
                  </button>
                ))}
              </div>
            </div>

            {resolutions.length > 0 && (
              <div className={styles.group}>
                <span className={styles.label}>Resolution</span>
                <div
                  className={styles.pills}
                  role="group"
                  aria-label="Resolution"
                >
                  {resolutions.map((r) => {
                    const on = (draft.resolution ?? model.resolution) === r.id
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={cx(styles.pill, on && styles.pillOn)}
                        aria-pressed={on}
                        onClick={() => onChange({ ...draft, resolution: r.id })}
                      >
                        {r.id.toLowerCase()}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <Textarea
              autoFocus
              value={draft.prompt}
              placeholder={
                draft.last
                  ? 'Move smoothly between these two frames'
                  : 'What happens next'
              }
              rows={3}
              onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
            />

            <div className={styles.submit}>
              <Button
                onClick={onSubmit}
                disabled={
                  !draft.first ||
                  draft.firstLoading ||
                  draft.lastLoading ||
                  (!draft.last && draft.prompt.trim().length === 0)
                }
              >
                {draft.mode === 'rerun' ? 'Rerun' : 'Generate'}
              </Button>
              <CostNote cents={cost} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Slot({
  frame,
  loading,
  empty,
  picking,
  onPick,
  onDrop,
}: {
  frame: { id: string; url: string; title: string } | null
  loading: boolean
  empty: string
  /** This slot is the one choosing off the strip. */
  picking: boolean
  /** Open the strip picker for this slot. Absent when the strip is empty. */
  onPick?: () => void
  onDrop?: () => void
}) {
  return (
    <div className={cx(styles.slot, picking && styles.slotPicking)}>
      {loading ? (
        <Loader size={14} />
      ) : frame ? (
        <img src={frame.url} alt={frame.title} />
      ) : (
        <span>{empty}</span>
      )}
      {!loading && frame && onDrop && (
        <button
          type="button"
          className={styles.drop}
          onClick={onDrop}
          aria-label="Let this clip end anywhere"
          title="Let this clip end anywhere"
        >
          <X size={12} />
        </button>
      )}
      {!loading && onPick && (
        <button
          type="button"
          className={styles.pickButton}
          onClick={onPick}
          aria-pressed={picking}
          aria-label="Pick a frame from the strip"
          title="Pick a frame from the strip"
        >
          <Images size={12} />
        </button>
      )}
    </div>
  )
}
