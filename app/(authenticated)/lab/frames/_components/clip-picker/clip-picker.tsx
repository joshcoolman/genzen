'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { clipFacts } from '../clip-facts'
import styles from './clip-picker.module.css'
import type { VideoRecord } from '../../../../video/_actions/generate-video.action'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  MediaBox,
} from '#/components'

/** The tile edge. Paired with `--tile` in the stylesheet, which is the grid's
 *  column width: `MediaBox` is sized in px, not by its container. */
const TILE = 132

/**
 * Pick a clip out of the ones you have made.
 *
 * **`ExistingImagePicker`'s shape, deliberately** — the same dialog, the same
 * grid of tiles, the same footer counter, the same click-to-confirm when only
 * one is wanted. Picking a clip should feel like picking a reference image
 * because it is the same act.
 *
 * **Not that component with a flag, though.** It renders `Thumbnail`, which is
 * an `<img>`, and an mp4 handed to an `<img>` lands on the broken-file
 * fallback. Teaching it video means a media element inside the primitive every
 * still in the app renders through, which is the thing `MediaBox` exists to
 * avoid (#398) — and it would mean that change landing across Images, Canvas
 * and Video to serve one lab page. Its source filters (Uploads / AI Generated)
 * are meaningless here too.
 *
 * So: this shape, in the lab, where it can be used before anyone decides
 * whether the app's picker should grow a video mode. If it proves out, the real
 * generalisation gets designed against two consumers instead of a guess.
 *
 * **`max` defaults to 1 and the whole thing is written for more.** Selection is
 * a set and the caller takes an array, so picking several clips — to stitch, to
 * compare — is raising a number rather than rewriting this.
 */
export function ClipPicker({
  open,
  onOpenChange,
  clips,
  pickedIds,
  onConfirm,
  max = 1,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clips: Array<VideoRecord>
  pickedIds: Set<string>
  onConfirm: (clips: Array<VideoRecord>) => void
  max?: number
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // One clip means the click *is* the answer: a footer button to confirm a
  // choice that can only be one thing is a second click for nothing.
  const autoConfirm = max === 1

  useEffect(() => {
    if (!open) setSelectedIds(new Set())
  }, [open])

  const confirm = (ids: Set<string>) => {
    onConfirm(clips.filter((c) => ids.has(c.id)))
    setSelectedIds(new Set())
    onOpenChange(false)
  }

  const toggle = (id: string) => {
    if (autoConfirm) {
      confirm(new Set([id]))
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < max) next.add(id)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide" className={styles.popup}>
        <DialogHeader>
          <DialogTitle>Clips</DialogTitle>
        </DialogHeader>

        <div className={styles.grid}>
          {clips.length === 0 ? (
            <div className={styles.state}>No clips yet</div>
          ) : (
            <div className={styles.tiles}>
              {clips.map((clip) => {
                const selected = selectedIds.has(clip.id)
                const picked = pickedIds.has(clip.id)

                return (
                  <button
                    key={clip.id}
                    type="button"
                    className={selected ? styles.tileSelected : styles.tile}
                    onClick={() => toggle(clip.id)}
                    disabled={picked}
                    aria-pressed={selected}
                    /* The prompt, which is the only thing that tells two clips
                       from the same model apart, and far too long to print
                       under 132px of picture. */
                    title={clip.description ?? clip.title}
                  >
                    <MediaBox
                      kind="video"
                      src={`/img/${clip.id}`}
                      alt={clip.title}
                      size={TILE}
                      fit="cover"
                    />
                    {selected && (
                      <span className={styles.check}>
                        <Check />
                      </span>
                    )}
                    {/* The model and the duration: at five hundred clips a
                        first frame does not tell them apart, and these are the
                        two facts already on the row. */}
                    <span className={styles.facts}>{clipFacts(clip)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className={styles.footer}>
          <div className={styles.footerInner}>
            <span className={styles.count}>
              {selectedIds.size}/{max} selected
            </span>
            {!autoConfirm && (
              <Button
                variant="primary"
                onClick={() => confirm(selectedIds)}
                disabled={selectedIds.size === 0}
              >
                Add {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}Selected
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
