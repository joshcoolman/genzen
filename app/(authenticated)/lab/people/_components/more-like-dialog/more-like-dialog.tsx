'use client'

import { useEffect, useState } from 'react'
import { PEOPLE_MODELS } from '../../models'
import styles from './more-like-dialog.module.css'
import type { Tile } from '../../board'
import { estimateImageCostCents } from '#/features/ai-images/models'
import {
  ActionButton,
  Button,
  CostNote,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  NumberStepper,
} from '#/components'
import { cx } from '#/lib/utils'

/**
 * The deliberate pass: this face, a count, and which models (#578).
 *
 * **`+` on the tile is the other half of this and does not open anything.** One
 * more, on Grok, no choices -- that is the click-click-click pass through a
 * fresh board. This is what you open when a face is worth spending on.
 *
 * **It does not inherit the board's cheap default.** Being in here already
 * means the face is worth something, so the models start empty and the choice
 * is made deliberately rather than by whatever the draft pass happened to be
 * set to.
 */
export function MoreLikeDialog({
  tile,
  onConfirm,
  onCancel,
}: {
  /** The tile being riffed on, or null when the dialog is closed. */
  tile: Tile | null
  onConfirm: (count: number, modelIds: Array<string>) => void
  onCancel: () => void
}) {
  const [count, setCount] = useState(2)
  const [modelIds, setModelIds] = useState<Array<string>>([])

  useEffect(() => {
    if (!tile) return
    setCount(2)
    setModelIds([])
  }, [tile])

  const estimate = estimateImageCostCents(modelIds, count, false)

  return (
    <Dialog
      open={!!tile}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>More like this</DialogTitle>
          <DialogDescription>
            Different people from the same bucket -- same gender, ethnicity and
            rough age, new faces. Written from this tile&apos;s description
            rather than from the picture, which is what keeps them from coming
            back as relatives.
          </DialogDescription>
        </DialogHeader>

        {tile?.url && <img src={tile.url} alt="" className={styles.preview} />}

        <div className={styles.row}>
          <span className={styles.label}>How many</span>
          <NumberStepper
            value={count}
            min={1}
            max={20}
            onAdjust={(delta) =>
              setCount((c) => Math.min(Math.max(c + delta, 1), 20))
            }
          />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Models</span>
          <div className={styles.models}>
            {PEOPLE_MODELS.map((m) => {
              const on = modelIds.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  className={cx(styles.model, on && styles.modelOn)}
                  onClick={() =>
                    setModelIds((current) =>
                      current.includes(m.id)
                        ? current.filter((x) => x !== m.id)
                        : [...current, m.id],
                    )
                  }
                >
                  {m.name}
                  {m.price != null && (
                    <span className={styles.price}>${m.price.toFixed(3)}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <CostNote cents={estimate.cents} unpriced={estimate.unpriced} />
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <ActionButton
            disabled={modelIds.length === 0}
            onClick={() => onConfirm(count, modelIds)}
          >
            {`Generate ${count * Math.max(modelIds.length, 1)}`}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
