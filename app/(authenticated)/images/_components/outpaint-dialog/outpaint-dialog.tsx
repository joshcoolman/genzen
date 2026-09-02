'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import styles from './outpaint-dialog.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import {
  estimateImageCostCents,
  getModelName,
} from '#/features/ai-images/models'
import { outpaintModelId } from '#/features/ai-images/outpaint'
import {
  ALL_RATIOS,
  ActionButton,
  Button,
  CostNote,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  RatioIcon,
  matchRatio,
} from '#/components'
import { cx } from '#/lib/utils'

interface OutpaintDialogProps {
  /** The picture being reframed. Null closes the dialog. */
  image: SavedAiImage | null
  /** Its thumbnail, which is also what the ratio is measured from. */
  imageUrl: string | undefined
  busy: boolean
  onGenerate: (ratios: Array<string>) => void
  onCancel: () => void
}

/**
 * Pick shapes, press Generate (#430 in the lab; here it is the real thing).
 *
 * **No model picker, on purpose.** The lab page exists to answer "which model
 * can do this"; once that is answered the answer is a constant, and a control
 * offering it again would be asking a settled question before every press. The
 * model is named under the estimate so it is never a secret -- it is just not
 * a decision.
 *
 * **The shape you already have is not a shape you can ask for.** It is in the
 * grid, greyed, labelled `Current`, rather than absent: a missing row reads as
 * an option the app does not support, and this one is the option you do not
 * need. Measured from the thumbnail rather than read from a column, because an
 * upload has no `aspect_ratio` in its metadata and a generation's records what
 * was asked for rather than what came back.
 *
 * **Multi-select, because one source usually owes several deliverables.** Each
 * ratio is its own generation, submitted one after another; they land in the
 * grid as pending cards like any other and settle on the gallery's own poll.
 * Nothing is loaded into the generator panel -- this is a side errand about
 * one picture, not a change to what you were working on.
 */
export function OutpaintDialog({
  image,
  imageUrl,
  busy,
  onGenerate,
  onCancel,
}: OutpaintDialogProps) {
  const [selected, setSelected] = useState<Array<string>>([])
  const [currentRatio, setCurrentRatio] = useState<string | null>(null)

  // A fresh picture is a fresh question: carrying the last selection over
  // would make the second press of Generate the accidental one.
  useEffect(() => {
    setSelected([])
    setCurrentRatio(null)
  }, [image?.id])

  // Measured off the thumbnail, which `generate-thumbnail.server` resizes with
  // `fit: 'inside'` -- so its ratio is the full image's, and it is the one
  // browsers already have cached from the grid.
  useEffect(() => {
    if (!image || !imageUrl) return
    let live = true
    const probe = new Image()
    probe.onload = () => {
      if (live)
        setCurrentRatio(matchRatio(probe.naturalWidth, probe.naturalHeight))
    }
    probe.src = imageUrl
    return () => {
      live = false
    }
  }, [image, imageUrl])

  const modelId = outpaintModelId()
  const estimate = useMemo(
    () => estimateImageCostCents([modelId], Math.max(selected.length, 1), true),
    [modelId, selected.length],
  )

  const groups = useMemo(() => {
    const out: Array<{ name: string; items: typeof ALL_RATIOS }> = []
    for (const ratio of ALL_RATIOS) {
      if (out[out.length - 1]?.name !== ratio.group) {
        out.push({ name: ratio.group, items: [] })
      }
      out[out.length - 1].items.push(ratio)
    }
    return out
  }, [])

  function toggle(label: string) {
    setSelected((current) =>
      current.includes(label)
        ? current.filter((r) => r !== label)
        : [...current, label],
    )
  }

  return (
    <Dialog
      open={image !== null}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>Outpaint</DialogTitle>
          <DialogDescription>
            Extend this picture into other shapes. Pick as many as you need.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.body}>
          {/* The source, small. Not decoration: the grid can be scrolled away
              from the card that opened this, and a dialog about "this picture"
              has to say which one. */}
          <span
            className={styles.source}
            style={
              imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined
            }
            aria-hidden="true"
          />

          <div className={styles.groups}>
            {groups.map((group) => (
              <div key={group.name}>
                <div className={styles.groupLabel}>{group.name}</div>
                <div className={styles.grid}>
                  {group.items.map((ratio) => {
                    const isCurrent = ratio.label === currentRatio
                    const isOn = selected.includes(ratio.label)
                    return (
                      <button
                        key={ratio.label}
                        type="button"
                        className={cx(
                          styles.tile,
                          isOn && styles.tileOn,
                          isCurrent && styles.tileCurrent,
                        )}
                        aria-pressed={isOn}
                        disabled={isCurrent || busy}
                        onClick={() => toggle(ratio.label)}
                      >
                        <RatioIcon w={ratio.w} h={ratio.h} />
                        <span className={styles.tileLabel}>{ratio.label}</span>
                        {isCurrent ? (
                          <span className={styles.tileNote}>Current</span>
                        ) : (
                          isOn && <Check className={styles.tileCheck} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The estimate reads for what a press will actually cost, so it is
            zero until something is picked -- the same rule Generate follows. */}
        <CostNote
          cents={selected.length === 0 ? 0 : estimate.cents}
          unpriced={estimate.unpriced}
        />
        <p className={styles.model}>{getModelName(modelId)}</p>

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <ActionButton
            loading={busy}
            loadingText="Sending"
            disabled={selected.length === 0}
            onClick={() => onGenerate(selected)}
          >
            {selected.length > 1
              ? `Generate ${selected.length} images`
              : 'Generate'}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
