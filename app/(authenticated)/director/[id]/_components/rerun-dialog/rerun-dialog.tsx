'use client'

import { rerunModelOptions } from '../../board'
import styles from './rerun-dialog.module.css'
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
import { estimateImageCostCents } from '#/features/ai-images/models'
import { imageUrl } from '#/lib/image-url'

/**
 * Rerun one scene with guidance (#695).
 *
 * The shape `New from this` already has -- a text box, a model, Generate -- and
 * one difference that matters: **this replaces the scene's pair rather than
 * adding beside it.** A storyboard is an ordered thing, so a scene with three
 * candidate openings in it is not a row anybody can read. The pair it replaces
 * goes to Trash, one restore away.
 *
 * That is also why the model is a single choice where a derive is a
 * multi-select: every model ticked there is one more asset to compare, and here
 * there is only ever one frame in this position.
 */
export function RerunDialog({
  scene,
  words,
  onWordsChange,
  model,
  onModelChange,
  busy,
  onSubmit,
  onOpenChange,
}: {
  scene: BoardScene | null
  words: string
  onWordsChange: (value: string) => void
  model: string
  onModelChange: (slug: string) => void
  busy: boolean
  onSubmit: () => void
  onOpenChange: (open: boolean) => void
}) {
  const options = rerunModelOptions()
  /* Two frames: the opening is generated again from the sheets, and the closing
     is derived from it once it lands. */
  const { cents, unpriced } = estimateImageCostCents([model], 2, true)

  return (
    <Dialog open={scene !== null} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>
            Rerun {scene ? `scene ${scene.number}` : 'this scene'}
          </DialogTitle>
        </DialogHeader>
        {/* The line this scene is, so what you are typing about is on screen
            beside the frame it produced. */}
        {scene && <p className={styles.said}>{scene.line}</p>}
        {scene?.openingId && (
          <img
            className={styles.frame}
            src={imageUrl(scene.openingId, 'thumb')}
            alt={`Scene ${scene.number}, opening frame`}
          />
        )}
        <Textarea
          value={words}
          onChange={(event) => onWordsChange(event.target.value)}
          rows={3}
          placeholder="Wider, from across the room. At night. Show his hands."
        />
        <div className={styles.models}>
          {options.map((option) => (
            <Button
              key={option.slug}
              size="sm"
              variant={model === option.slug ? 'primary' : 'secondary'}
              aria-pressed={model === option.slug}
              onClick={() => onModelChange(option.slug)}
            >
              {option.name}
            </Button>
          ))}
        </div>
        <div className={styles.foot}>
          <CostNote cents={cents} unpriced={unpriced} />
          <Button
            variant="primary"
            loading={busy}
            disabled={!words.trim()}
            onClick={onSubmit}
          >
            Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
