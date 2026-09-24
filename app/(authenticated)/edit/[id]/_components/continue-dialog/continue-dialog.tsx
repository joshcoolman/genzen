'use client'

import { Loader, X } from 'lucide-react'
import styles from './continue-dialog.module.css'
import type { ContinueDraft } from '../../use-view'
import type { VideoModel } from '#/features/video/models'
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
 */
export function ContinueDialog({
  draft,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: ContinueDraft | null
  onChange: (next: ContinueDraft) => void
  onClose: () => void
  onSubmit: () => void
}) {
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
          <DialogTitle>Continue</DialogTitle>
        </DialogHeader>
        {draft && model && (
          <div className={styles.form}>
            <div className={styles.frames}>
              <Slot
                frame={draft.first}
                loading={draft.firstLoading}
                empty="No starting frame"
              />
              {(draft.last || draft.lastLoading) && (
                <>
                  <span className={styles.arrow} aria-hidden>
                    &rarr;
                  </span>
                  <Slot
                    frame={draft.last}
                    loading={draft.lastLoading}
                    empty="No ending frame"
                    onDrop={() => onChange({ ...draft, last: null })}
                  />
                </>
              )}
            </div>
            <p className={styles.note}>
              {draft.error
                ? draft.error
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
                Generate
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
  onDrop,
}: {
  frame: { id: string; url: string; title: string } | null
  loading: boolean
  empty: string
  onDrop?: () => void
}) {
  return (
    <div className={styles.slot}>
      {loading ? (
        <Loader size={14} />
      ) : frame ? (
        <>
          <img src={frame.url} alt={frame.title} />
          {onDrop && (
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
        </>
      ) : (
        <span>{empty}</span>
      )}
    </div>
  )
}
