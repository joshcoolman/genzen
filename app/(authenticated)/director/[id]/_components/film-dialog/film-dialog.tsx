'use client'

import {
  sectionCostCents,
  sectionDuration,
  sectionModel,
  sectionPinsOpening,
  sectionTakesEndFrame,
} from '../../board'
import styles from './film-dialog.module.css'
import type { BoardScene } from '../../../_lib/types'
import {
  Button,
  CostNote,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Switch,
  Textarea,
} from '#/components'
import { imageUrl } from '#/lib/image-url'

/**
 * Generate video for one section (#697).
 *
 * **Nothing to choose, and guidance is optional.** The model, the shape and the
 * length are all settled by the row -- Kling O3 Pro because it is the only one
 * taking a first frame and references together, 16:9 like every frame on the
 * board, and the line's own seconds because that is how long the words take to
 * say. The words here are a note on top of that, not the request.
 *
 * **The price is the whole reason this is a dialog and not a bare button.** At
 * 14c/s a row is 70c to $1.68, and a board with a button on every row is $38
 * available one click at a time. A press that prints what it costs is a
 * decision; one that does not is an accident waiting to be repeated.
 */
export function FilmDialog({
  scene,
  model,
  spoken,
  onSpokenChange,
  words,
  onWordsChange,
  endFrame,
  onEndFrameChange,
  busy,
  onSubmit,
  onOpenChange,
}: {
  scene: BoardScene | null
  /** The model this take will be generated with (#702). */
  model: string
  /** What the character says in this take. */
  spoken: string
  onSpokenChange: (value: string) => void
  words: string
  onWordsChange: (value: string) => void
  /** Pin the closing frame as the clip's last frame. */
  endFrame: boolean
  onEndFrameChange: (value: boolean) => void
  busy: boolean
  onSubmit: () => void
  onOpenChange: (open: boolean) => void
}) {
  const seconds = scene ? sectionDuration(scene.seconds, model) : 0
  /* Kling pins the opening frame; Seedance has no start-image parameter, so
     there it is a reference instead -- the clip does not begin on it. The
     dialog says which, because it is the difference between the cut you
     approved and a picture the model was shown. */
  const pins = sectionPinsOpening(model)
  const canEndFrame = sectionTakesEndFrame(model)

  return (
    <Dialog open={scene !== null} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>Generate scene {scene ? scene.number : ''}</DialogTitle>
        </DialogHeader>
        {/* The frames this take is pinned to, side by side once there are two.
            The end frame appears when it is switched on and goes when it is
            switched off, because what the toggle does is add a picture to the
            request and the dialog should show the request. */}
        {scene?.openingId && (
          <div className={styles.frames}>
            <figure className={styles.frame}>
              <img
                className={styles.image}
                src={imageUrl(scene.openingId, 'thumb')}
                alt={`Scene ${scene.number}, opening frame`}
              />
              <figcaption className={styles.frameCaption}>
                {pins ? 'Opens on' : 'Reference for the look'}
              </figcaption>
            </figure>
            {endFrame && canEndFrame && scene.closingId && (
              <figure className={styles.frame}>
                <img
                  className={styles.image}
                  src={imageUrl(scene.closingId, 'thumb')}
                  alt={`Scene ${scene.number}, closing frame`}
                />
                <figcaption className={styles.frameCaption}>Ends on</figcaption>
              </figure>
            )}
          </div>
        )}
        {/* **The line is editable here, and this is the only place it is.**
            Kling refuses a line naming a trademarked work, and no model may
            reword an author's dialogue on their behalf -- so rewording it is
            the only thing that gets such a section made, and it has to be a
            box rather than a rule. The same field a pronunciation respelling
            writes: what the model is told to say, as against what the film
            says. `scene.line` is untouched and stays what Script reads. */}
        <label className={styles.field}>
          <span className={styles.label}>Said in this take</span>
          <Textarea
            value={spoken}
            onChange={(event) => onSpokenChange(event.target.value)}
            rows={3}
          />
        </label>
        {scene && spoken.trim() !== scene.line.trim() && (
          <p className={styles.record}>The script still reads: {scene.line}</p>
        )}
        <p className={styles.facts}>
          {sectionModel(model).label} ·{' '}
          {pins
            ? 'opens on this frame'
            : 'this frame as a reference, not pinned'}{' '}
          · {seconds}s · 16:9 · with sound
        </p>
        <label className={styles.field}>
          <span className={styles.label}>Guidance for the shot</span>
          <Textarea
            value={words}
            onChange={(event) => onWordsChange(event.target.value)}
            rows={2}
            placeholder="Optional. He turns away at the end. Hold the camera still."
          />
        </label>
        <div className={styles.foot}>
          <CostNote
            cents={scene ? sectionCostCents(scene.seconds, model) : 0}
          />
          <Button variant="primary" loading={busy} onClick={onSubmit}>
            Generate
          </Button>
        </div>
        {/* **Off by default, and offered anyway.** A pair that reads as a cut
            is two camera setups, and a continuous take pinned at both ends of
            two setups morphs between them rather than moving. But a pair that
            is genuinely two moments of one shot is exactly what an end frame
            is for, and only looking at the pair says which kind it is -- so it
            is a choice per take rather than a rule. */}
        {/* Only where the endpoint has one. Seedance's takes no end image at
            all, so the control would be a switch that does nothing. */}
        {canEndFrame && (
          <label className={styles.toggle}>
            <Switch
              checked={endFrame}
              onCheckedChange={onEndFrameChange}
              disabled={!scene?.closingId}
            />
            <span>
              Include end frame
              <span className={styles.hint}>
                {scene?.closingId
                  ? ' — the clip lands on the closing frame. Best when the pair is one shot, not a cut.'
                  : ' — this scene has no closing frame yet.'}
              </span>
            </span>
          </label>
        )}
        {/* Four to eight minutes on fal's own numbers, which is a different
            order of wait from an image and worth saying before the press. */}
        <p className={styles.wait}>
          A section takes several minutes. It lands on the row when it is done.
        </p>
      </DialogContent>
    </Dialog>
  )
}
