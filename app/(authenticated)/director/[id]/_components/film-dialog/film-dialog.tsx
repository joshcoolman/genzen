'use client'

import { sectionCostCents, sectionDuration } from '../../board'
import styles from './film-dialog.module.css'
import type { BoardScene } from '../../../_lib/types'
import {
  Button,
  CostNote,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  words,
  onWordsChange,
  busy,
  onSubmit,
  onOpenChange,
}: {
  scene: BoardScene | null
  words: string
  onWordsChange: (value: string) => void
  busy: boolean
  onSubmit: () => void
  onOpenChange: (open: boolean) => void
}) {
  const seconds = scene ? sectionDuration(scene.seconds) : 0

  return (
    <Dialog open={scene !== null} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>Generate scene {scene ? scene.number : ''}</DialogTitle>
        </DialogHeader>
        {scene?.openingId && (
          /* The frame the clip will literally begin on. */
          <img
            className={styles.frame}
            src={imageUrl(scene.openingId, 'thumb')}
            alt={`Scene ${scene.number}, opening frame`}
          />
        )}
        {scene && <p className={styles.said}>{scene.line}</p>}
        <p className={styles.facts}>
          Opens on this frame · {seconds}s · 16:9 · with sound
        </p>
        <Textarea
          value={words}
          onChange={(event) => onWordsChange(event.target.value)}
          rows={2}
          placeholder="Optional. He turns away at the end. Hold the camera still."
        />
        <div className={styles.foot}>
          <CostNote cents={scene ? sectionCostCents(scene.seconds) : 0} />
          <Button variant="primary" loading={busy} onClick={onSubmit}>
            Generate
          </Button>
        </div>
        {/* Four to eight minutes on fal's own numbers, which is a different
            order of wait from an image and worth saying before the press. */}
        <p className={styles.wait}>
          A section takes several minutes. It lands on the row when it is done.
        </p>
      </DialogContent>
    </Dialog>
  )
}
