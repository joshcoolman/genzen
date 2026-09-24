'use client'

import styles from './frame-dialog.module.css'
import type { FrameDraft } from '../../use-view'
import { RATIO_TO_SIZE } from '#/features/ai-images/constants'
import {
  IMAGE_MODELS,
  estimateImageCostCents,
  imageCapacityFor,
} from '#/features/ai-images/models'
import { imageUrl } from '#/lib/image-url'
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

/** The image models with a reference endpoint: the only ones a frame made
 *  from other frames can go to. */
function modelsTakingReferences() {
  return IMAGE_MODELS.filter((m) => m.withImages !== null)
}

/**
 * Generate frame (#733): a new still from the selected ones.
 *
 * Director's derive dialog with the choices an edit wants: the selected
 * frames as references, what the frame should be, the ratio (read off the
 * run, changeable), and one image model. A model that cannot hold the
 * selection is offered greyed, with the reason in its title, rather than
 * hidden -- the fix is one fewer reference, and seeing the model says so.
 * Generate closes the dialog on the press; the strip is where the result
 * shows up.
 */
export function FrameDialog({
  draft,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: FrameDraft | null
  onChange: (next: FrameDraft) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const count = draft?.referenceIds.length ?? 0
  const cost = draft
    ? estimateImageCostCents([draft.modelSlug], 1, true)
    : { cents: 0, unpriced: 0 }

  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate frame</DialogTitle>
        </DialogHeader>
        {draft && (
          <div className={styles.form}>
            <div className={styles.refs}>
              {draft.referenceIds.map((id) => (
                <img
                  key={id}
                  className={styles.ref}
                  src={imageUrl(id, 'thumb')}
                  alt=""
                />
              ))}
            </div>
            <p className={styles.note}>
              {count === 1 ? 'This frame is' : `These ${count} frames are`} the
              references. The result lands on the strip beside them, and a
              Continue can start or end on it.
            </p>

            <Textarea
              autoFocus
              value={draft.prompt}
              placeholder="The frame you are trying to reach: the same room from the doorway, her turned to the window."
              rows={3}
              onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
            />

            <div className={styles.group}>
              <span className={styles.label}>Aspect ratio</span>
              <div className={styles.pills} role="group" aria-label="Ratio">
                {Object.keys(RATIO_TO_SIZE).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    className={cx(
                      styles.pill,
                      draft.aspectRatio === ratio && styles.pillOn,
                    )}
                    aria-pressed={draft.aspectRatio === ratio}
                    onClick={() => onChange({ ...draft, aspectRatio: ratio })}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.group}>
              <span className={styles.label}>Model</span>
              <div className={styles.pills} role="group" aria-label="Model">
                {modelsTakingReferences().map((m) => {
                  const room = imageCapacityFor(m.slug)
                  const fits = room >= count
                  return (
                    <button
                      key={m.slug}
                      type="button"
                      className={cx(
                        styles.pill,
                        m.slug === draft.modelSlug && styles.pillOn,
                      )}
                      aria-pressed={m.slug === draft.modelSlug}
                      disabled={!fits}
                      title={
                        fits
                          ? m.description
                          : `${m.name} takes ${room} reference${room === 1 ? '' : 's'}`
                      }
                      onClick={() => onChange({ ...draft, modelSlug: m.slug })}
                    >
                      {m.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={styles.submit}>
              <Button
                onClick={onSubmit}
                disabled={draft.prompt.trim().length === 0}
              >
                Generate
              </Button>
              <CostNote cents={cost.cents} unpriced={cost.unpriced} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
